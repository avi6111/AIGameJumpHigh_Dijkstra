import * as THREE from "three";
import {
  MToonMaterialLoaderPlugin,
  VRMLoaderPlugin,
  VRMUtils,
  type VRM,
} from "@pixiv/three-vrm";
import { MToonNodeMaterial } from "@pixiv/three-vrm/nodes";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import {
  punchButtonId,
  punchMinIntervalSeconds,
  shouldStartPunchAction,
} from "./ActionContract";
import {
  punchActionName,
  requiredAnimationClipNames,
  statusToActionMap,
} from "./AnimationContract";
import {
  applyCharacterShadowSettings,
  type CharacterShadowSettings,
} from "./CharacterShadowSettings";
import { CharacterFootIK } from "./FootIK";
import { retargetHumanoidAnimationClips } from "./VrmAnimation";
import { getVrmMetaVersion, isVrm0 } from "./VrmMeta";
import { enableCharacterAoMaskLayer } from "../scene/RenderLayers";
import { waitForNextFrame } from "../utils/FrameYield";
import {
  useAnimationStore,
  useButtonStore,
  type CharacterAnimationStatus,
} from "../lib/ecctrl/index";

const animationLibraryUrl = new URL(
  "../assets/AnimationLibrary.glb",
  import.meta.url
).href;
export const sampleVrms = [
  { name: "sample.vrm", url: new URL("../assets/sample.vrm", import.meta.url).href },
  { name: "sample2.vrm", url: new URL("../assets/sample2.vrm", import.meta.url).href },
] as const;
let animationLibraryPromise: ReturnType<typeof loadAnimationLibraryGltf> | null = null;

const oneShotActions: ReadonlySet<string> = new Set([
  statusToActionMap.JUMP_START,
  statusToActionMap.JUMP_LAND,
  punchActionName,
]);

export class AnimatedCharacterModel {
  readonly group = new THREE.Group();
  readonly sourceName: string;
  readonly vrmVersionLabel: string;
  private readonly vrm: VRM;
  private readonly mixer: THREE.AnimationMixer;
  private readonly footIK: CharacterFootIK;
  private readonly actions = new Map<string, THREE.AnimationAction>();
  private readonly unsubscribe: () => void;
  private previousActionName: string = getActionName("IDLE");
  private nextPunchTime = 0;
  private canPlayNext = true;
  private disposed = false;

  constructor(
    vrm: VRM,
    animationGltf: Awaited<ReturnType<GLTFLoader["loadAsync"]>>,
    sourceName: string
  ) {
    this.vrm = vrm;
    this.sourceName = sourceName;
    this.vrmVersionLabel = getVrmVersionLabel(vrm);
    this.group.name = "AnimatedCharacterModel";
    this.group.position.set(0, -1.1, 0);
    this.group.add(vrm.scene);
    this.prepareModel();

    this.mixer = new THREE.AnimationMixer(this.group);
    const clips = retargetHumanoidAnimationClips(
      animationGltf.animations,
      vrm,
      requiredAnimationClipNames
    );
    const punchClip = clips.find((clip) => clip.name === punchActionName);
    if (!punchClip) {
      throw new Error(`AnimationLibrary.glb is missing clip: ${punchActionName}`);
    }
    for (const clip of clips) {
      this.actions.set(clip.name, this.mixer.clipAction(clip));
    }
    this.assertRequiredActions();
    this.footIK = new CharacterFootIK(vrm, this.group);
    this.unsubscribe = this.bindAnimationState();
  }

  static async load() {
    const [defaultVrm] = sampleVrms;
    return AnimatedCharacterModel.loadFromUrl(defaultVrm.url, defaultVrm.name);
  }

  static async loadFromFile(file: File) {
    const url = URL.createObjectURL(file);
    try {
      return await AnimatedCharacterModel.loadFromUrl(url, file.name);
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  static async loadFromUrl(url: string, sourceName: string) {
    let vrm: VRM | null = null;
    try {
      const [vrmResult, animationResult] = await Promise.allSettled([
        loadVrm(url),
        loadAnimationLibrary(),
      ]);
      if (vrmResult.status === "fulfilled") vrm = vrmResult.value;
      if (vrmResult.status === "rejected") throw vrmResult.reason;
      if (animationResult.status === "rejected") throw animationResult.reason;
      const model = new AnimatedCharacterModel(
        vrmResult.value,
        animationResult.value,
        sourceName
      );
      vrm = null;
      return model;
    } catch (error) {
      if (vrm) VRMUtils.deepDispose(vrm.scene);
      throw error;
    }
  }

  update(delta: number) {
    this.mixer.update(delta);
    this.vrm.update(delta);
    this.footIK.update(delta);
  }

  setShadowSettings(settings: CharacterShadowSettings) {
    applyCharacterShadowSettings(this.vrm.scene, settings);
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.unsubscribe();
    this.mixer.removeEventListener("finished", this.handleFinished);
    this.mixer.stopAllAction();
    this.mixer.uncacheRoot(this.group);
    VRMUtils.deepDispose(this.vrm.scene);
    this.group.clear();
  }

  private prepareModel() {
    this.vrm.scene.traverse((object) => {
      enableCharacterAoMaskLayer(object);
      if (object instanceof THREE.SkinnedMesh) {
        object.frustumCulled = false;
      }
    });
  }

  private playInitialIdle() {
    const idleAction = this.actions.get(this.previousActionName);
    idleAction?.reset().play();
  }

  private bindAnimationState() {
    this.mixer.addEventListener("finished", this.handleFinished);
    const unsubscribeAnimation = useAnimationStore.subscribe((state) => {
      this.playStatus(state.animationStatus);
    });
    const unsubscribeButtons = useButtonStore.subscribe((state, previousState) => {
      if (state.buttons[punchButtonId] && !previousState.buttons[punchButtonId]) {
        this.playPunch();
      }
    });
    this.playInitialIdle();
    this.playStatus(useAnimationStore.getState().animationStatus);
    return () => {
      unsubscribeAnimation();
      unsubscribeButtons();
    };
  }

  private playStatus(status: CharacterAnimationStatus) {
    const nextActionName = getActionName(status);
    const nextAction = this.actions.get(nextActionName);
    if (!nextAction) throw new Error(`Missing animation action: ${nextActionName}`);

    const previousActionName = this.previousActionName;
    if (nextActionName !== previousActionName && this.canPlayNext) {
      this.playAction(nextActionName, previousActionName);
      this.previousActionName = nextActionName;
    }

    if (
      !this.canPlayNext &&
      previousActionName === getActionName("JUMP_START") &&
      status !== "JUMP_IDLE" &&
      status !== "JUMP_START"
    ) {
      this.allowNextAction();
    }

    if (
      !this.canPlayNext &&
      previousActionName === getActionName("JUMP_LAND") &&
      status !== "IDLE" &&
      status !== "JUMP_LAND"
    ) {
      this.allowNextAction();
    }
  }

  private playAction(nextActionName: string, previousActionName: string) {
    const nextAction = this.actions.get(nextActionName);
    const previousAction = this.actions.get(previousActionName);
    if (!nextAction) throw new Error(`Missing animation action: ${nextActionName}`);

    nextAction.reset();
    if (oneShotActions.has(nextActionName)) {
      this.canPlayNext = false;
      nextAction.timeScale = 1.6;
      nextAction.setLoop(THREE.LoopOnce, 1);
      nextAction.clampWhenFinished = true;
      if (previousAction) nextAction.crossFadeFrom(previousAction, 0.1, false);
      nextAction.play();
      return;
    }

    this.canPlayNext = true;
    nextAction.timeScale = 1;
    nextAction.setLoop(THREE.LoopRepeat, Infinity);
    nextAction.clampWhenFinished = false;
    if (previousAction) nextAction.crossFadeFrom(previousAction, 0.2, false);
    nextAction.play();
  }

  private playPunch() {
    const currentTime = this.mixer.time;
    const punchPlaying =
      this.previousActionName === punchActionName && !this.canPlayNext;
    if (
      !shouldStartPunchAction(currentTime, this.nextPunchTime, punchPlaying)
    ) {
      return;
    }
    this.nextPunchTime = currentTime + punchMinIntervalSeconds;

    const previousActionName = this.previousActionName;
    const crossFadeFrom =
      previousActionName === punchActionName
        ? getActionName(useAnimationStore.getState().animationStatus)
        : previousActionName;
    this.playAction(punchActionName, crossFadeFrom);
    this.previousActionName = punchActionName;
  }

  private readonly handleFinished = (event: { action: THREE.AnimationAction }) => {
    const actionName = event.action.getClip().name;
    if (
      !this.canPlayNext &&
      actionName === this.previousActionName &&
      oneShotActions.has(actionName)
    ) {
      this.allowNextAction();
    }
  };

  private allowNextAction() {
    this.canPlayNext = true;
    this.playStatus(useAnimationStore.getState().animationStatus);
  }

  private assertRequiredActions() {
    for (const clipName of requiredAnimationClipNames) {
      if (!this.actions.has(clipName)) {
        throw new Error(`AnimationLibrary.glb is missing clip: ${clipName}`);
      }
    }
  }
}

function getActionName(status: CharacterAnimationStatus) {
  return statusToActionMap[status];
}

function loadAnimationLibrary() {
  animationLibraryPromise ??= loadAnimationLibraryGltf();
  return animationLibraryPromise;
}

function loadAnimationLibraryGltf() {
  return loadGltfFromUrl(animationLibraryUrl, new GLTFLoader());
}

async function loadVrm(url: string) {
  const loader = new GLTFLoader();
  loader.register((parser) => {
    const mtoonMaterialPlugin = new MToonMaterialLoaderPlugin(parser, {
      materialType: MToonNodeMaterial,
    });
    return new VRMLoaderPlugin(parser, { mtoonMaterialPlugin });
  });
  const gltf = await loadGltfFromUrl(url, loader);
  return finishLoadVrm(gltf);
}

async function loadGltfFromUrl(url: string, loader: GLTFLoader) {
  const buffer = await fetchArrayBuffer(url);
  await waitForNextFrame();
  return loader.parseAsync(buffer, getResourcePath(url));
}

async function fetchArrayBuffer(url: string) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch GLTF asset: ${response.status} ${response.statusText}`);
  }
  return response.arrayBuffer();
}

function getResourcePath(url: string) {
  try {
    return new URL("./", url).href;
  } catch {
    return "";
  }
}

function finishLoadVrm(gltf: Awaited<ReturnType<GLTFLoader["loadAsync"]>>) {
  const vrm = gltf.userData.vrm as VRM | undefined;
  if (!vrm) throw new Error("Character VRM asset is missing VRM metadata.");
  if (isVrm0(vrm)) VRMUtils.rotateVRM0(vrm);
  return vrm;
}

function getVrmVersionLabel(vrm: VRM) {
  return getVrmMetaVersion(vrm) === "0" ? "VRM0" : "VRM1.0";
}
