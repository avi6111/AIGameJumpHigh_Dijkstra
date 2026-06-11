import * as THREE from "three/webgpu";
import { SkyMesh } from "three/examples/jsm/objects/SkyMesh.js";
import type { ShadowSunDirectionApi } from "./ShadowRig";
import {
  skySunAnglesToDirection,
  skySunDirectionToAngles,
} from "./SkySunMath";

export interface SkyInspectorControls {
  enabled: boolean;
  turbidity: number;
  rayleigh: number;
  mieCoefficient: number;
  mieDirectionalG: number;
  elevation: number;
  azimuth: number;
  cloudScale: number;
  cloudSpeed: number;
  cloudCoverage: number;
  cloudDensity: number;
  cloudElevation: number;
  showSunDisc: boolean;
}

type SkySettings = SkyInspectorControls;

export interface SkyRig {
  controls: SkyInspectorControls;
  update(): void;
  dispose(): void;
}

const DEFAULT_SKY_SETTINGS: SkySettings = {
  enabled: true,
  turbidity: 2,
  rayleigh: 1,
  mieCoefficient: 0.005,
  mieDirectionalG: 0.8,
  elevation: 55,
  azimuth: -45,
  cloudScale: 0.0002,
  cloudSpeed: 0.0001,
  cloudCoverage: 0.4,
  cloudDensity: 0.4,
  cloudElevation: 0.5,
  showSunDisc: true,
};

const SKY_SCALE = 10000;

export function createSkyRig(
  scene: THREE.Scene,
  shadowSun?: ShadowSunDirectionApi
): SkyRig {
  const settings = { ...DEFAULT_SKY_SETTINGS };
  const sky = new SkyMesh();
  const sunPosition = new THREE.Vector3();
  let shadowSunVersion = -1;
  sky.name = "Sky";
  sky.scale.setScalar(SKY_SCALE);
  sky.frustumCulled = false;
  sky.material.fog = false;
  scene.add(sky);
  applySkySettings(sky, settings, sunPosition);
  syncShadowSunDirection();

  return {
    controls: createSkyControls(
      sky,
      settings,
      sunPosition,
      syncShadowSunDirection
    ),
    update() {
      syncSkyFromShadowSun();
    },
    dispose() {
      sky.removeFromParent();
      sky.geometry.dispose();
      sky.material.dispose();
    },
  };

  function syncShadowSunDirection() {
    if (!shadowSun) return;
    shadowSun.setDirection(sunPosition);
    shadowSunVersion = shadowSun.getVersion();
  }

  function syncSkyFromShadowSun() {
    if (!shadowSun) return;
    const nextVersion = shadowSun.getVersion();
    if (nextVersion === shadowSunVersion) return;
    shadowSunVersion = nextVersion;
    shadowSun.getDirection(sunPosition);
    const angles = skySunDirectionToAngles(sunPosition);
    settings.elevation = angles.elevation;
    settings.azimuth = angles.azimuth;
    sky.sunPosition.value.copy(sunPosition);
  }
}

function createSkyControls(
  sky: SkyMesh,
  settings: SkySettings,
  sunPosition: THREE.Vector3,
  syncShadowSunDirection: () => void
): SkyInspectorControls {
  const syncSunPosition = () => {
    syncSkySunPosition(sky, settings, sunPosition);
    syncShadowSunDirection();
  };

  return {
    get enabled() {
      return settings.enabled;
    },
    set enabled(value) {
      settings.enabled = value;
      sky.visible = value;
    },
    get turbidity() {
      return settings.turbidity;
    },
    set turbidity(value) {
      settings.turbidity = value;
      sky.turbidity.value = value;
    },
    get rayleigh() {
      return settings.rayleigh;
    },
    set rayleigh(value) {
      settings.rayleigh = value;
      sky.rayleigh.value = value;
    },
    get mieCoefficient() {
      return settings.mieCoefficient;
    },
    set mieCoefficient(value) {
      settings.mieCoefficient = value;
      sky.mieCoefficient.value = value;
    },
    get mieDirectionalG() {
      return settings.mieDirectionalG;
    },
    set mieDirectionalG(value) {
      settings.mieDirectionalG = value;
      sky.mieDirectionalG.value = value;
    },
    get elevation() {
      return settings.elevation;
    },
    set elevation(value) {
      settings.elevation = value;
      syncSunPosition();
    },
    get azimuth() {
      return settings.azimuth;
    },
    set azimuth(value) {
      settings.azimuth = value;
      syncSunPosition();
    },
    get cloudScale() {
      return settings.cloudScale;
    },
    set cloudScale(value) {
      settings.cloudScale = value;
      sky.cloudScale.value = value;
    },
    get cloudSpeed() {
      return settings.cloudSpeed;
    },
    set cloudSpeed(value) {
      settings.cloudSpeed = value;
      sky.cloudSpeed.value = value;
    },
    get cloudCoverage() {
      return settings.cloudCoverage;
    },
    set cloudCoverage(value) {
      settings.cloudCoverage = value;
      sky.cloudCoverage.value = value;
    },
    get cloudDensity() {
      return settings.cloudDensity;
    },
    set cloudDensity(value) {
      settings.cloudDensity = value;
      sky.cloudDensity.value = value;
    },
    get cloudElevation() {
      return settings.cloudElevation;
    },
    set cloudElevation(value) {
      settings.cloudElevation = value;
      sky.cloudElevation.value = value;
    },
    get showSunDisc() {
      return settings.showSunDisc;
    },
    set showSunDisc(value) {
      settings.showSunDisc = value;
      sky.showSunDisc.value = value ? 1 : 0;
    },
  };
}

function applySkySettings(
  sky: SkyMesh,
  settings: SkySettings,
  sunPosition: THREE.Vector3
) {
  sky.visible = settings.enabled;
  sky.turbidity.value = settings.turbidity;
  sky.rayleigh.value = settings.rayleigh;
  sky.mieCoefficient.value = settings.mieCoefficient;
  sky.mieDirectionalG.value = settings.mieDirectionalG;
  sky.cloudScale.value = settings.cloudScale;
  sky.cloudSpeed.value = settings.cloudSpeed;
  sky.cloudCoverage.value = settings.cloudCoverage;
  sky.cloudDensity.value = settings.cloudDensity;
  sky.cloudElevation.value = settings.cloudElevation;
  sky.showSunDisc.value = settings.showSunDisc ? 1 : 0;
  syncSkySunPosition(sky, settings, sunPosition);
}

function syncSkySunPosition(
  sky: SkyMesh,
  settings: SkySettings,
  sunPosition: THREE.Vector3
) {
  skySunAnglesToDirection(settings, sunPosition);
  sky.sunPosition.value.copy(sunPosition);
}
