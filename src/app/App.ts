import * as THREE from "three/webgpu";
import { characterStatus, type MovementInput } from "../lib/ecctrl/index";
import { sampleVrms } from "../character/AnimatedCharacterModel";
import { createCharacterModelRuntime } from "../character/CharacterModelRuntime";
import { createVrmDropTarget } from "../character/VrmDropTarget";
import { openVrmFilePicker } from "../character/VrmFilePicker";
import { createRenderGraph } from "../render/RenderGraph";
import { createShadowRig } from "../scene/ShadowRig";
import { createSkyRig } from "../scene/SkyRig";
import { waitForNextFrame } from "../utils/FrameYield";
import { createCameraRig } from "./CameraRig";
import { createController } from "./Controller";
import { createHud } from "./Hud";
import { createInspector } from "./Inspector";
import { createLevel } from "./Level";
import { createLevelEditor } from "./LevelEditor";

const IDLE_MOVEMENT_INPUT: MovementInput = {
  forward: false,
  backward: false,
  leftward: false,
  rightward: false,
  run: false,
  jump: false,
};

export interface AppOptions {
  canvas: HTMLCanvasElement;
  statusElement: HTMLElement | null;
  vrmDropOverlay: HTMLElement | null;
}

export interface App {
  start(): void;
  dispose(): void;
}

export function createApp({
  canvas,
  statusElement,
  vrmDropOverlay,
}: AppOptions): App {
  const scene = new THREE.Scene();
  const skyScene = new THREE.Scene();
  scene.background = new THREE.Color(0x111814);
  skyScene.background = scene.background;
  scene.fog = new THREE.Fog(0x111814, 28, 80);

  const camera = new THREE.PerspectiveCamera(64, 1, 0.1, 160);
  const renderer = new THREE.WebGPURenderer({
    canvas,
    antialias: false,
    powerPreference: "high-performance",
  });
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;

  const renderGraph = createRenderGraph(renderer, scene, skyScene, camera);
  const clock = new THREE.Clock();
  const hud = createHud(statusElement);
  const level = createLevel(scene);
  const controllerRig = createController(camera, scene, canvas);
  const characterRuntime = createCharacterModelRuntime(controllerRig.controller, {
    warmUp: warmUpCharacterModel,
  });
  let sampleVrmIndex = 0;
  const characterFileControls = {
    loadVrmFile: () => {
      openVrmFilePicker((file) => characterRuntime.loadFile(file));
    },
    switchSample: () => {
      sampleVrmIndex = (sampleVrmIndex + 1) % sampleVrms.length;
      const sample = sampleVrms[sampleVrmIndex];
      characterRuntime.loadUrl(sample.url, sample.name);
    },
  };
  const vrmDropTarget = createVrmDropTarget({
    overlay: vrmDropOverlay,
    onFile: (file) => characterRuntime.loadFile(file),
    onInvalidDrop: () => characterRuntime.showMessage("DROP A .VRM FILE"),
  });
  const shadowRig = createShadowRig(scene, () => {
    renderGraph.invalidate();
  });
  const skyRig = createSkyRig(skyScene, shadowRig.sunDirection);
  const cameraRig = createCameraRig(
    camera,
    canvas,
    controllerRig.controller
  );
  const levelEditor = createLevelEditor({
    camera,
    canvas,
    level,
    onTransformActiveChange: (active) =>
      cameraRig.setPointerInputEnabled(!active),
    scene,
  });
  const inspector = createInspector({
    renderer,
    aoNode: renderGraph.aoNode,
    ssgiNode: renderGraph.ssgiNode,
    cameraControls: cameraRig.controls,
    characterFileControls,
    characterShadowControls: characterRuntime.shadowControls,
    controllerControls: controllerRig.inspectorControls,
    levelControls: levelEditor.controls,
    renderControls: renderGraph.renderControls,
    shadowControls: shadowRig.controls,
    skyControls: skyRig.controls,
  });

  let disposed = false;
  let inputLockedByLevelEditor = false;
  let pendingInitialShadowRebuild = true;
  let simulationElapsed = 0;

  const render = () => {
    const delta = Math.min(clock.getDelta(), 1 / 30);
    simulationElapsed += delta;
    const levelEditing = levelEditor.isEditing();
    setLevelEditorInputLocked(levelEditing);
    level.update(delta, simulationElapsed);
    updateController(delta, simulationElapsed, levelEditing);
    characterRuntime.update(delta, simulationElapsed);
    cameraRig.update(delta);
    skyRig.update();
    renderGraph.render();
    if (pendingInitialShadowRebuild) {
      pendingInitialShadowRebuild = false;
      // CSM creates its cascade lights during first setup; rebuild once after that.
      shadowRig.rebuild();
    }
  };

  const resize = () => {
    const width = window.innerWidth;
    const height = window.innerHeight;
    cameraRig.resize(width, height);
    renderer.setPixelRatio(renderGraph.renderControls.pixelRatio);
    renderer.setSize(width, height, false);
  };

  const dispose = () => {
    if (disposed) return;
    disposed = true;
    renderer.setAnimationLoop(null);
    window.removeEventListener("resize", resize);
    window.removeEventListener("beforeunload", dispose);
    vrmDropTarget.dispose();
    levelEditor.dispose();
    level.dispose();
    characterRuntime.dispose();
    controllerRig.dispose();
    cameraRig.dispose();
    renderGraph.dispose();
    inspector.dispose();
    skyRig.dispose();
    shadowRig.dispose();
    renderer.dispose();
  };

  window.addEventListener("resize", resize);
  window.addEventListener("beforeunload", dispose);

  return {
    start() {
      void startRendering();
    },
    dispose,
  };

  async function startRendering() {
    hud.setStatusText("INITIALIZING RENDERER");
    try {
      await renderer.init();
    } catch (error) {
      if (disposed) return;
      hud.setStatusText("RENDERER INIT FAILED");
      console.error("Failed to initialize the Three.js renderer.", error);
      return;
    }
    if (disposed) return;
    resize();
    renderer.setAnimationLoop(render);
    await waitForNextFrame();
    if (!disposed) characterRuntime.loadDefault();
  }

  async function warmUpCharacterModel(model: { group: THREE.Object3D }) {
    const originalPosition = model.group.position.clone();
    const originalParent = model.group.parent;
    model.group.position.set(0, -10000, 0);
    controllerRig.controller.add(model.group);
    try {
      await waitForNextFrame();
      await waitForNextFrame();
    } finally {
      controllerRig.controller.remove(model.group);
      if (originalParent) originalParent.add(model.group);
      model.group.position.copy(originalPosition);
    }
  }

  function setLevelEditorInputLocked(active: boolean) {
    if (inputLockedByLevelEditor === active) return;
    inputLockedByLevelEditor = active;
    cameraRig.setEditMode(active);
    controllerRig.setInputEnabled(!active);
    if (active) {
      controllerRig.controller.setMovement(IDLE_MOVEMENT_INPUT);
      controllerRig.controller.resetLinVel();
    }
  }

  function updateController(delta: number, elapsed: number, levelEditing: boolean) {
    const controller = controllerRig.controller;
    if (levelEditing) {
      controller.setMovement(IDLE_MOVEMENT_INPUT);
      return;
    }
    controller.setMovement(controllerRig.movementInput);
    controller.update(delta, elapsed);
    if (controller.group.position.y < -8) {
      controllerRig.resetPlayer();
    }
    hud.update(elapsed, () => {
      const characterStatusMessage = characterRuntime.getStatusMessage(elapsed);
      if (characterStatusMessage) return characterStatusMessage;
      const status = characterStatus.animationStatus.replace("_", " ");
      const speed = characterStatus.linvel.length().toFixed(1);
      return `${status} / ${speed} m/s`;
    });
  }
}
