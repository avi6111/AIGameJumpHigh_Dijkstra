import { type WebGPURenderer } from "three/webgpu";
import { Inspector } from "three/examples/jsm/inspector/Inspector.js";
import type { ParametersGroup } from "three/examples/jsm/inspector/tabs/Parameters.js";
import type { Tab } from "three/examples/jsm/inspector/ui/Tab.js";
import type SSGINode from "three/examples/jsm/tsl/display/SSGINode.js";
import {
  AO_MODE_OPTIONS,
  RENDER_CONTROL_LIMITS,
  TONE_MAPPING_OPTIONS,
  type RenderInspectorControls,
} from "../render/RenderControls";
import type { CharacterShadowInspectorControls } from "../character/CharacterShadowSettings";
import { footIKSettings } from "../character/FootIK";
import type SSGIAONode from "../render/SSGIAONode.js";
import {
  CSM_MODE_OPTIONS,
  SHADOW_MAP_SIZE_OPTIONS,
  type ShadowInspectorControls,
} from "../scene/ShadowRig";
import type { SkyInspectorControls } from "../scene/SkyRig";
import type { CameraInspectorControls } from "./CameraRig";
import type { ControllerInspectorControls } from "./Controller";
import type { LevelEditorControls } from "./LevelEditor";

interface AOParameterControls {
  sliceCount: number;
  stepCount: number;
  aoIntensity: number;
  radius: number;
  useScreenSpaceSampling: boolean;
  expFactor: number;
  thickness: number;
  useLinearThickness: boolean;
}

interface InspectorWithParameters extends Inspector {
  parameters: Tab;
}

interface RendererInspectorSlot {
  _inspector: Inspector | null;
}

export interface CharacterFileControls {
  loadVrmFile(): void;
  switchSample(): void;
}

export interface InspectorOptions {
  renderer: WebGPURenderer;
  aoNode: SSGIAONode;
  ssgiNode: SSGINode;
  cameraControls: CameraInspectorControls;
  characterFileControls: CharacterFileControls;
  characterShadowControls: CharacterShadowInspectorControls;
  controllerControls: ControllerInspectorControls;
  levelControls: LevelEditorControls;
  renderControls: RenderInspectorControls;
  shadowControls: ShadowInspectorControls;
  skyControls: SkyInspectorControls;
}

export interface InspectorHandle {
  dispose(): void;
}

export function createInspector({
  renderer,
  aoNode,
  ssgiNode,
  cameraControls,
  characterFileControls,
  characterShadowControls,
  controllerControls,
  levelControls,
  renderControls,
  shadowControls,
  skyControls,
}: InspectorOptions): InspectorHandle {
  const inspector = new Inspector() as InspectorWithParameters;
  renderer.inspector = inspector;

  createCharacterParameters(inspector, characterFileControls);
  createLevelParameters(inspector, levelControls);
  createCameraParameters(inspector, cameraControls);
  createControllerParameters(inspector, controllerControls);
  createFootIKParameters(inspector);
  createRenderParameters(inspector, renderControls);

  const aoControls = createAOParameterControls(aoNode, ssgiNode);
  const { aoResolutionScale } = RENDER_CONTROL_LIMITS;
  const group = inspector.createParameters("SSGI");
  group.add(renderControls, "aoEnabled").name("Enabled");
  group.add(renderControls, "aoMode", AO_MODE_OPTIONS).name("Node");
  group.add(renderControls, "characterAoExcluded").name("Exclude VRM");
  group
    .add(
      renderControls,
      "aoResolutionScale",
      aoResolutionScale.min,
      aoResolutionScale.max,
      aoResolutionScale.step
    )
    .name("Resolution Scale");
  group.add(aoControls, "sliceCount", 1, 8, 1).name("Slice Count");
  group.add(aoControls, "stepCount", 1, 32, 1).name("Step Count");
  group.add(aoControls, "aoIntensity", 0, 4, 0.01).name("AO Intensity");
  group.add(aoControls, "radius", 0, 32, 0.1).name("Radius");
  group.add(aoControls, "useScreenSpaceSampling").name("Screen Space Sampling");
  group.add(aoControls, "expFactor", 0.5, 6, 0.01).name("Exp Factor");
  group.add(aoControls, "thickness", 0, 8, 0.01).name("Thickness");
  group.add(aoControls, "useLinearThickness").name("Linear Thickness");
  group.add(ssgiNode.giIntensity, "value", 0, 100, 0.1).name("GI Intensity");
  group
    .add(ssgiNode.backfaceLighting, "value", 0, 1, 0.01)
    .name("Backface Light");
  createTraaParameters(inspector, renderControls);
  createBloomParameters(inspector, renderControls);
  createSkyParameters(inspector, skyControls);
  createShadowParameters(inspector, shadowControls, characterShadowControls);

  inspector.setActiveTab(inspector.parameters);

  return {
    dispose() {
      if (renderer.inspector === inspector) {
        (renderer as unknown as RendererInspectorSlot)._inspector = null;
      }
      inspector.domElement.remove();
    },
  };
}

function createCharacterParameters(
  inspector: Inspector,
  controls: CharacterFileControls
) {
  const group = inspector.createParameters("Character");
  group.add(controls, "loadVrmFile").name("Load VRM File...");
  group.add(controls, "switchSample").name("Switch Sample VRM");
}

function createLevelParameters(
  inspector: Inspector,
  controls: LevelEditorControls
) {
  const group = inspector.createParameters("Level");
  group.add(controls, "edit").name("Edit");
  group.add(controls, "save").name("Save");
  group.add(controls, "export").name("Export");
}

function createControllerParameters(
  inspector: Inspector,
  controls: ControllerInspectorControls
) {
  const group = inspector.createParameters("Controller");
  group.add(controls, "resetPlayer").name("Reset Player");
  group
    .add(controls, "walkAirDragFactor", 0, 1, 0.01)
    .name("Walk Air Control");
  group.add(controls, "airDragFactor", 0, 1, 0.01).name("Run Air Control");
}

function createFootIKParameters(inspector: Inspector) {
  const group = inspector.createParameters("Foot IK");
  group.add(footIKSettings, "enabled").name("Enabled");
  group.add(footIKSettings, "maxAdjustment", 0, 0.6, 0.01).name("Max Adjust");
  group.add(footIKSettings, "smoothing", 4, 30, 0.5).name("Smoothing");
  group.add(footIKSettings, "alignFeetToGround").name("Align Feet");
}

function createCameraParameters(
  inspector: Inspector,
  controls: CameraInspectorControls
) {
  const group = inspector.createParameters("Camera");
  group.add(controls, "firstPerson").name("First Person");
  group.add(controls, "lockPointer").name("Lock Pointer");
  group.add(controls, "collisionEnabled").name("Collision");
  group.add(controls, "collisionPadding", 0, 1, 0.01).name("Collision Padding");
  group.add(controls, "minDistance", 0.02, 4, 0.01).name("Min Distance");
  group.add(controls, "maxDistance", 2, 30, 0.1).name("Max Distance");
  group.add(controls, "minPitch", -70, 30, 0.1).name("Min Pitch");
  group.add(controls, "maxPitch", 20, 85, 0.1).name("Max Pitch");
}

function createRenderParameters(
  inspector: Inspector,
  controls: RenderInspectorControls
) {
  const group = inspector.createParameters("Render");
  const { pixelRatio, toneMappingExposure } = RENDER_CONTROL_LIMITS;
  group
    .add(controls, "pixelRatio", pixelRatio.min, pixelRatio.max, pixelRatio.step)
    .name("Pixel Ratio");
  group.add(controls, "toneMapping", TONE_MAPPING_OPTIONS).name("Tone Mapping");
  group
    .add(
      controls,
      "toneMappingExposure",
      toneMappingExposure.min,
      toneMappingExposure.max,
      toneMappingExposure.step
    )
    .name("Exposure");
}

function createBloomParameters(
  inspector: Inspector,
  controls: RenderInspectorControls
) {
  const group = inspector.createParameters("Bloom");
  const {
    bloomStrength,
    bloomRadius,
    bloomThreshold,
    bloomSmoothWidth,
  } = RENDER_CONTROL_LIMITS;
  group.add(controls, "bloomEnabled").name("Enabled");
  group
    .add(
      controls,
      "bloomStrength",
      bloomStrength.min,
      bloomStrength.max,
      bloomStrength.step
    )
    .name("Strength");
  group
    .add(
      controls,
      "bloomRadius",
      bloomRadius.min,
      bloomRadius.max,
      bloomRadius.step
    )
    .name("Radius");
  group
    .add(
      controls,
      "bloomThreshold",
      bloomThreshold.min,
      bloomThreshold.max,
      bloomThreshold.step
    )
    .name("Threshold");
  group
    .add(
      controls,
      "bloomSmoothWidth",
      bloomSmoothWidth.min,
      bloomSmoothWidth.max,
      bloomSmoothWidth.step
    )
    .name("Smooth Width");
}

function createTraaParameters(
  inspector: Inspector,
  controls: RenderInspectorControls
) {
  const group = inspector.createParameters("TRAA");
  const {
    traaDepthThreshold,
    traaEdgeDepthDiff,
    traaMaxVelocityLength,
  } = RENDER_CONTROL_LIMITS;
  group.add(controls, "traaEnabled").name("Enabled");
  group
    .add(
      controls,
      "traaDepthThreshold",
      traaDepthThreshold.min,
      traaDepthThreshold.max,
      traaDepthThreshold.step
    )
    .name("Depth Threshold");
  group
    .add(
      controls,
      "traaEdgeDepthDiff",
      traaEdgeDepthDiff.min,
      traaEdgeDepthDiff.max,
      traaEdgeDepthDiff.step
    )
    .name("Edge Depth Diff");
  group
    .add(
      controls,
      "traaMaxVelocityLength",
      traaMaxVelocityLength.min,
      traaMaxVelocityLength.max,
      traaMaxVelocityLength.step
    )
    .name("Max Velocity");
  group
    .add(controls, "traaUseSubpixelCorrection")
    .name("Subpixel Correction");
}

function createSkyParameters(
  inspector: Inspector,
  controls: SkyInspectorControls
) {
  const group = inspector.createParameters("Sky");
  group.add(controls, "enabled").name("Enabled");
  group.add(controls, "showSunDisc").name("Sun Disc");
  group.add(controls, "elevation", -90, 90, 0.1).name("Sun Elevation");
  group.add(controls, "azimuth", -180, 180, 0.1).name("Sun Azimuth");
  addAtmosphereControls(group.addFolder("Atmosphere"), controls);
  addCloudControls(group.addFolder("Clouds"), controls);
}

function addAtmosphereControls(
  group: ParametersGroup,
  controls: SkyInspectorControls
) {
  group.add(controls, "turbidity", 0, 20, 0.1).name("Turbidity");
  group.add(controls, "rayleigh", 0, 4, 0.001).name("Rayleigh");
  group
    .add(controls, "mieCoefficient", 0, 0.1, 0.001)
    .name("Mie Coefficient");
  group.add(controls, "mieDirectionalG", 0, 1, 0.001).name("Mie Directional G");
}

function addCloudControls(
  group: ParametersGroup,
  controls: SkyInspectorControls
) {
  group.add(controls, "cloudScale", 0, 0.002, 0.00001).name("Scale");
  group.add(controls, "cloudSpeed", 0, 0.002, 0.00001).name("Speed");
  group.add(controls, "cloudCoverage", 0, 1, 0.01).name("Coverage");
  group.add(controls, "cloudDensity", 0, 1, 0.01).name("Density");
  group.add(controls, "cloudElevation", 0, 1, 0.01).name("Elevation");
}

function createShadowParameters(
  inspector: Inspector,
  controls: ShadowInspectorControls,
  characterControls: CharacterShadowInspectorControls
) {
  const group = inspector.createParameters("CSM Shadow");
  addCsmControls(group, controls);
  addShadowMapControls(group.addFolder("Shadow Map"), controls);
  addCharacterShadowControls(group.addFolder("VRM"), characterControls);
  addLightControls(group.addFolder("Light"), controls);
}

function addCsmControls(
  group: ParametersGroup,
  controls: ShadowInspectorControls
) {
  group.add(controls, "cascades", 1, 4, 1).name("Cascades");
  group.add(controls, "mode", CSM_MODE_OPTIONS).name("Split Mode");
  group.add(controls, "maxFar", 10, 160, 1).name("Max Far");
  group.add(controls, "lightMargin", 0, 120, 1).name("Light Margin");
  group.add(controls, "fade").name("Fade Cascades");
}

function addShadowMapControls(
  group: ParametersGroup,
  controls: ShadowInspectorControls
) {
  group.add(controls, "mapSize", SHADOW_MAP_SIZE_OPTIONS).name("Map Size");
  group.add(controls, "shadowIntensity", 0, 1, 0.01).name("Intensity");
  group.add(controls, "bias", -0.001, 0.001, 0.00001).name("Bias");
  group.add(controls, "normalBias", 0, 0.2, 0.001).name("Normal Bias");
  group.add(controls, "radius", 0, 8, 0.1).name("Radius");
}

function addCharacterShadowControls(
  group: ParametersGroup,
  controls: CharacterShadowInspectorControls
) {
  group.add(controls, "castShadow").name("Cast Shadow");
  group.add(controls, "receiveShadow").name("Receive Shadow");
}

function addLightControls(
  group: ParametersGroup,
  controls: ShadowInspectorControls
) {
  group.add(controls, "sunIntensity", 0, 6, 0.01).name("Sun Intensity");
  group.add(controls, "ambientIntensity", 0, 3, 0.01).name("Ambient Intensity");
  group.add(controls, "sunX", -30, 30, 0.1).name("Sun X");
  group.add(controls, "sunY", 1, 40, 0.1).name("Sun Y");
  group.add(controls, "sunZ", -30, 30, 0.1).name("Sun Z");
  group.add(controls, "targetX", -20, 20, 0.1).name("Target X");
  group.add(controls, "targetY", -10, 20, 0.1).name("Target Y");
  group.add(controls, "targetZ", -20, 20, 0.1).name("Target Z");
}

function createAOParameterControls(
  aoNode: SSGIAONode,
  ssgiNode: SSGINode
): AOParameterControls {
  const setBoth = <T>(
    update: (node: SSGIAONode | SSGINode, value: T) => void
  ) => {
    return (value: T) => {
      update(aoNode, value);
      update(ssgiNode, value);
    };
  };

  const setSliceCount = setBoth((node, value: number) => {
    node.sliceCount.value = Math.round(value);
  });
  const setStepCount = setBoth((node, value: number) => {
    node.stepCount.value = Math.round(value);
  });
  const setAoIntensity = setBoth((node, value: number) => {
    node.aoIntensity.value = value;
  });
  const setRadius = setBoth((node, value: number) => {
    node.radius.value = value;
  });
  const setUseScreenSpaceSampling = setBoth((node, value: boolean) => {
    node.useScreenSpaceSampling.value = value;
  });
  const setExpFactor = setBoth((node, value: number) => {
    node.expFactor.value = value;
  });
  const setThickness = setBoth((node, value: number) => {
    node.thickness.value = value;
  });
  const setUseLinearThickness = setBoth((node, value: boolean) => {
    node.useLinearThickness.value = value;
  });

  return {
    get sliceCount() {
      return aoNode.sliceCount.value;
    },
    set sliceCount(value) {
      setSliceCount(value);
    },
    get stepCount() {
      return aoNode.stepCount.value;
    },
    set stepCount(value) {
      setStepCount(value);
    },
    get aoIntensity() {
      return aoNode.aoIntensity.value;
    },
    set aoIntensity(value) {
      setAoIntensity(value);
    },
    get radius() {
      return aoNode.radius.value;
    },
    set radius(value) {
      setRadius(value);
    },
    get useScreenSpaceSampling() {
      return aoNode.useScreenSpaceSampling.value;
    },
    set useScreenSpaceSampling(value) {
      setUseScreenSpaceSampling(value);
    },
    get expFactor() {
      return aoNode.expFactor.value;
    },
    set expFactor(value) {
      setExpFactor(value);
    },
    get thickness() {
      return aoNode.thickness.value;
    },
    set thickness(value) {
      setThickness(value);
    },
    get useLinearThickness() {
      return aoNode.useLinearThickness.value;
    },
    set useLinearThickness(value) {
      setUseLinearThickness(value);
    },
  };
}
