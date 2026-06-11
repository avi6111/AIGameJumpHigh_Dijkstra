import * as THREE from "three/webgpu";
import {
  CSMShadowNode,
  type CSMShadowNodeMode,
} from "three/examples/jsm/csm/CSMShadowNode.js";
import { markMaterialNeedsUpdate } from "../utils/MaterialUpdates";

type EditableCsmMode = Exclude<CSMShadowNodeMode, "custom">;
type ShadowInvalidation = () => void;
type ObjectWithMaterial = THREE.Object3D & {
  material?: THREE.Material | THREE.Material[];
};
type DisposableShadowNode = { dispose(): void };
type CSMShadowNodeWithInternals = CSMShadowNode & {
  _shadowNodes?: DisposableShadowNode[];
};

interface ShadowSettings {
  cascades: number;
  mode: EditableCsmMode;
  maxFar: number;
  lightMargin: number;
  fade: boolean;
  mapSize: number;
  shadowIntensity: number;
  bias: number;
  normalBias: number;
  radius: number;
  sunIntensity: number;
  ambientIntensity: number;
}

export interface ShadowInspectorControls {
  cascades: number;
  mode: EditableCsmMode;
  maxFar: number;
  lightMargin: number;
  fade: boolean;
  mapSize: number;
  shadowIntensity: number;
  bias: number;
  normalBias: number;
  radius: number;
  sunIntensity: number;
  ambientIntensity: number;
  sunX: number;
  sunY: number;
  sunZ: number;
  targetX: number;
  targetY: number;
  targetZ: number;
}

export interface ShadowSunDirectionApi {
  getDirection(target: THREE.Vector3): THREE.Vector3;
  setDirection(direction: THREE.Vector3): void;
  getVersion(): number;
}

export interface ShadowRig {
  controls: ShadowInspectorControls;
  sunDirection: ShadowSunDirectionApi;
  rebuild(): void;
  dispose(): void;
}

export const CSM_MODE_OPTIONS = [
  "practical",
  "uniform",
  "logarithmic",
] as const satisfies readonly EditableCsmMode[];
export const SHADOW_MAP_SIZE_OPTIONS = [512, 1024, 2048, 4096] as const;
const DEFAULT_SUN_DISTANCE = 24;
const MIN_SUN_DIRECTION_LENGTH = 1e-4;

const DEFAULT_SHADOW_SETTINGS: ShadowSettings = {
  cascades: 2,
  mode: "practical",
  maxFar: 60,
  lightMargin: 40,
  fade: true,
  mapSize: 4096,
  shadowIntensity: 1,
  bias: 0,
  normalBias: 0.01,
  radius: 1,
  sunIntensity: 3,
  ambientIntensity: 2,
};

export function createShadowRig(
  scene: THREE.Scene,
  invalidateShaders: ShadowInvalidation
): ShadowRig {
  const settings = { ...DEFAULT_SHADOW_SETTINGS };
  let sun = createSun(settings);
  let sunDirectionVersion = 0;
  const ambient = new THREE.AmbientLight(0xbfc8b8, settings.ambientIntensity);
  let csmNode = attachCsmNode(sun, settings);
  scene.add(sun, sun.target, ambient);

  const markSunDirectionChanged = () => {
    sunDirectionVersion += 1;
  };

  const invalidateShadowReceivers = () => {
    markShadowReceiverMaterialsForUpdate(scene);
    invalidateShaders();
  };

  const rebuildCsmNode = () => {
    const previousSun = sun;
    const previousCsmNode = csmNode;
    const sunPosition = previousSun.position.clone();
    const targetPosition = previousSun.target.position.clone();

    disposeSunAndCsm(previousSun, previousCsmNode);

    sun = createSun(settings);
    sun.position.copy(sunPosition);
    sun.target.position.copy(targetPosition);
    csmNode = attachCsmNode(sun, settings);
    scene.add(sun, sun.target);
    invalidateShadowReceivers();
  };

  const sunDirection = createSunDirectionApi({
    getSun: () => sun,
    getVersion: () => sunDirectionVersion,
    markChanged: markSunDirectionChanged,
  });

  const controls = createShadowControls({
    settings,
    ambient,
    getSun: () => sun,
    getCsmNode: () => csmNode,
    rebuildCsmNode,
    markSunDirectionChanged,
  });

  return {
    controls,
    sunDirection,
    rebuild: rebuildCsmNode,
    dispose() {
      disposeSunAndCsm(sun, csmNode);
      ambient.removeFromParent();
    },
  };
}

function createSun(settings: ShadowSettings) {
  const sun = new THREE.DirectionalLight(0xffffed, settings.sunIntensity);
  sun.name = "CSM Sun";
  sun.position.set(-10, 20, 10);
  sun.target.position.set(0, 0, 0);
  sun.castShadow = true;
  configureBaseShadow(sun, settings);
  return sun;
}

function attachCsmNode(
  sun: THREE.DirectionalLight,
  settings: ShadowSettings
) {
  const csmNode = createCsmNode(sun, settings);
  sun.shadow.shadowNode = csmNode;
  return csmNode;
}

function createCsmNode(
  sun: THREE.DirectionalLight,
  settings: ShadowSettings
): CSMShadowNode {
  const node = new CSMShadowNode(sun, {
    cascades: settings.cascades,
    maxFar: settings.maxFar,
    mode: settings.mode,
    lightMargin: settings.lightMargin,
  });
  node.fade = settings.fade;
  return node;
}

function createShadowControls({
  settings,
  ambient,
  getSun,
  getCsmNode,
  rebuildCsmNode,
  markSunDirectionChanged,
}: {
  settings: ShadowSettings;
  ambient: THREE.AmbientLight;
  getSun(): THREE.DirectionalLight;
  getCsmNode(): CSMShadowNode;
  rebuildCsmNode(): void;
  markSunDirectionChanged(): void;
}): ShadowInspectorControls {
  const refreshFrustums = () => {
    const csmNode = getCsmNode();
    if (csmNode.camera === null || csmNode.mainFrustum === null) return;
    csmNode.updateFrustums();
  };

  return {
    get cascades() {
      return settings.cascades;
    },
    set cascades(value) {
      const nextValue = THREE.MathUtils.clamp(Math.round(value), 1, 4);
      if (nextValue === settings.cascades) return;
      settings.cascades = nextValue;
      rebuildCsmNode();
    },
    get mode() {
      return settings.mode;
    },
    set mode(value) {
      settings.mode = value;
      getCsmNode().mode = value;
      refreshFrustums();
    },
    get maxFar() {
      return settings.maxFar;
    },
    set maxFar(value) {
      settings.maxFar = value;
      getCsmNode().maxFar = value;
      refreshFrustums();
    },
    get lightMargin() {
      return settings.lightMargin;
    },
    set lightMargin(value) {
      settings.lightMargin = value;
      getCsmNode().lightMargin = value;
    },
    get fade() {
      return settings.fade;
    },
    set fade(value) {
      if (value === settings.fade) return;
      settings.fade = value;
      rebuildCsmNode();
    },
    get mapSize() {
      return settings.mapSize;
    },
    set mapSize(value) {
      const nextValue = Math.round(value);
      if (nextValue === settings.mapSize) return;
      settings.mapSize = nextValue;
      rebuildCsmNode();
    },
    get bias() {
      return settings.bias;
    },
    set bias(value) {
      settings.bias = value;
      applyShadowSettings(getCsmNode(), getSun(), settings);
    },
    get shadowIntensity() {
      return settings.shadowIntensity;
    },
    set shadowIntensity(value) {
      const nextValue = THREE.MathUtils.clamp(value, 0, 1);
      if (nextValue === settings.shadowIntensity) return;
      settings.shadowIntensity = nextValue;
      applyShadowIntensity(getCsmNode(), getSun(), nextValue);
    },
    get normalBias() {
      return settings.normalBias;
    },
    set normalBias(value) {
      settings.normalBias = value;
      applyShadowSettings(getCsmNode(), getSun(), settings);
    },
    get radius() {
      return settings.radius;
    },
    set radius(value) {
      settings.radius = value;
      applyShadowSettings(getCsmNode(), getSun(), settings);
    },
    get sunIntensity() {
      return getSun().intensity;
    },
    set sunIntensity(value) {
      settings.sunIntensity = value;
      getSun().intensity = value;
    },
    get ambientIntensity() {
      return ambient.intensity;
    },
    set ambientIntensity(value) {
      settings.ambientIntensity = value;
      ambient.intensity = value;
    },
    get sunX() {
      return getSun().position.x;
    },
    set sunX(value) {
      if (value === getSun().position.x) return;
      getSun().position.x = value;
      markSunDirectionChanged();
    },
    get sunY() {
      return getSun().position.y;
    },
    set sunY(value) {
      if (value === getSun().position.y) return;
      getSun().position.y = value;
      markSunDirectionChanged();
    },
    get sunZ() {
      return getSun().position.z;
    },
    set sunZ(value) {
      if (value === getSun().position.z) return;
      getSun().position.z = value;
      markSunDirectionChanged();
    },
    get targetX() {
      return getSun().target.position.x;
    },
    set targetX(value) {
      if (value === getSun().target.position.x) return;
      getSun().target.position.x = value;
      markSunDirectionChanged();
    },
    get targetY() {
      return getSun().target.position.y;
    },
    set targetY(value) {
      if (value === getSun().target.position.y) return;
      getSun().target.position.y = value;
      markSunDirectionChanged();
    },
    get targetZ() {
      return getSun().target.position.z;
    },
    set targetZ(value) {
      if (value === getSun().target.position.z) return;
      getSun().target.position.z = value;
      markSunDirectionChanged();
    },
  };
}

function createSunDirectionApi({
  getSun,
  getVersion,
  markChanged,
}: {
  getSun(): THREE.DirectionalLight;
  getVersion(): number;
  markChanged(): void;
}): ShadowSunDirectionApi {
  return {
    getDirection(target) {
      const sun = getSun();
      target.copy(sun.position).sub(sun.target.position);
      const length = target.length();
      if (length <= MIN_SUN_DIRECTION_LENGTH) return target.set(0, 1, 0);
      return target.divideScalar(length);
    },
    setDirection(direction) {
      const length = direction.length();
      if (length <= MIN_SUN_DIRECTION_LENGTH) return;
      const sun = getSun();
      const distance = getSunDistance(sun);
      sun.position
        .copy(direction)
        .multiplyScalar(distance / length)
        .add(sun.target.position);
      markChanged();
    },
    getVersion,
  };
}

function getSunDistance(sun: THREE.DirectionalLight) {
  const distance = sun.position.distanceTo(sun.target.position);
  return distance > MIN_SUN_DIRECTION_LENGTH ? distance : DEFAULT_SUN_DISTANCE;
}

function configureBaseShadow(
  sun: THREE.DirectionalLight,
  settings: ShadowSettings
) {
  applyShadowValues(sun.shadow, settings);
  sun.shadow.camera.left = -30;
  sun.shadow.camera.right = 30;
  sun.shadow.camera.top = 30;
  sun.shadow.camera.bottom = -30;
}

function applyShadowSettings(
  csmNode: CSMShadowNode,
  sun: THREE.DirectionalLight,
  settings: ShadowSettings
) {
  applyShadowValues(sun.shadow, settings);
  for (const light of csmNode.lights) {
    if (light.shadow) applyShadowValues(light.shadow, settings);
  }
}

function applyShadowIntensity(
  csmNode: CSMShadowNode,
  sun: THREE.DirectionalLight,
  intensity: number
) {
  sun.shadow.intensity = intensity;
  for (const light of csmNode.lights) {
    if (light.shadow) light.shadow.intensity = intensity;
  }
}

function applyShadowValues(
  shadow: THREE.DirectionalLightShadow,
  settings: ShadowSettings
) {
  shadow.intensity = settings.shadowIntensity;
  shadow.bias = settings.bias;
  shadow.normalBias = settings.normalBias;
  shadow.radius = settings.radius;
  shadow.mapSize.set(settings.mapSize, settings.mapSize);
  shadow.needsUpdate = true;
}

function disposeCsmNode(csmNode: CSMShadowNode) {
  const internals = csmNode as CSMShadowNodeWithInternals;
  for (const shadowNode of internals._shadowNodes ?? []) {
    shadowNode.dispose();
  }
  csmNode.dispose();
}

function disposeSunAndCsm(
  sun: THREE.DirectionalLight,
  csmNode: CSMShadowNode
) {
  disposeCsmNode(csmNode);
  sun.shadow.dispose();
  sun.removeFromParent();
  sun.target.removeFromParent();
}

function markShadowReceiverMaterialsForUpdate(root: THREE.Object3D) {
  root.traverse((object) => {
    if (!object.receiveShadow) return;
    const material = (object as ObjectWithMaterial).material;
    markMaterialNeedsUpdate(material);
  });
}
