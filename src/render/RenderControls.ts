import {
  ACESFilmicToneMapping,
  AgXToneMapping,
  CineonToneMapping,
  LinearToneMapping,
  MathUtils,
  NeutralToneMapping,
  type Node,
  NoToneMapping,
  ReinhardToneMapping,
  type RenderPipeline,
  type ToneMapping,
  type WebGPURenderer,
} from "three/webgpu";
import type BloomNode from "three/examples/jsm/tsl/display/BloomNode.js";
import type SSGINode from "three/examples/jsm/tsl/display/SSGINode.js";
import type TRAANode from "three/examples/jsm/tsl/display/TRAANode.js";
import type SSGIAONode from "./SSGIAONode.js";

interface RenderControlLimit {
  min: number;
  max: number;
  step: number;
}

interface RenderControlNodes {
  bloomNode: BloomNode;
  sceneEffect: RenderEffectNodes;
  effects: Record<AmbientOcclusionMode, RenderEffectNodes>;
  aoNode: SSGIAONode;
  ssgiNode: SSGINode;
  characterAoExcluded: BooleanUniform;
  traaNodes: TRAANode[];
}

interface BooleanUniform {
  value: boolean;
}

interface ResettableTRAANode extends TRAANode {
  setSize(width: number, height: number): void;
}

interface RenderEffectNodes {
  colorNode: Node<"vec4">;
  bloomColorNode: Node<"vec4">;
  traaNode: TRAANode;
  bloomTraaNode: Node<"vec4">;
}

interface RenderOutputFlags {
  aoEnabled: boolean;
  aoMode: AmbientOcclusionMode;
  bloomEnabled: boolean;
  traaEnabled: boolean;
}

interface RenderOutputSelection {
  outputNode: Node<"vec4"> | TRAANode;
  activeTraaNode: TRAANode | null;
}

export interface RenderInspectorControls {
  pixelRatio: number;
  toneMapping: ToneMapping;
  toneMappingExposure: number;
  aoEnabled: boolean;
  aoMode: AmbientOcclusionMode;
  aoResolutionScale: number;
  characterAoExcluded: boolean;
  bloomEnabled: boolean;
  bloomStrength: number;
  bloomRadius: number;
  bloomThreshold: number;
  bloomSmoothWidth: number;
  traaEnabled: boolean;
  traaDepthThreshold: number;
  traaEdgeDepthDiff: number;
  traaMaxVelocityLength: number;
  traaUseSubpixelCorrection: boolean;
}

export const AO_MODE_OPTIONS = {
  SSGIAONode: "SSGIAONode",
  SSGINode: "SSGINode",
} as const;

export type AmbientOcclusionMode =
  (typeof AO_MODE_OPTIONS)[keyof typeof AO_MODE_OPTIONS];

export const TONE_MAPPING_OPTIONS = {
  None: NoToneMapping,
  Linear: LinearToneMapping,
  Reinhard: ReinhardToneMapping,
  Cineon: CineonToneMapping,
  "ACES Filmic": ACESFilmicToneMapping,
  AgX: AgXToneMapping,
  Neutral: NeutralToneMapping,
} as const satisfies Record<string, ToneMapping>;

export const RENDER_CONTROL_LIMITS = {
  pixelRatio: { min: 0.5, max: 2, step: 0.05 },
  aoResolutionScale: { min: 0.25, max: 1, step: 0.05 },
  toneMappingExposure: { min: 0, max: 4, step: 0.01 },
  bloomStrength: { min: 0, max: 3, step: 0.01 },
  bloomRadius: { min: 0, max: 1, step: 0.01 },
  bloomThreshold: { min: 0, max: 3, step: 0.01 },
  bloomSmoothWidth: { min: 0, max: 1, step: 0.001 },
  traaDepthThreshold: { min: 0, max: 0.01, step: 0.0001 },
  traaEdgeDepthDiff: { min: 0, max: 0.01, step: 0.0001 },
  traaMaxVelocityLength: { min: 1, max: 512, step: 1 },
} as const satisfies Record<string, RenderControlLimit>;

export function createRenderControls(
  renderer: WebGPURenderer,
  renderPipeline: RenderPipeline,
  nodes: RenderControlNodes
): RenderInspectorControls {
  let pixelRatio = 1.25;
  let aoEnabled = true;
  let aoMode: AmbientOcclusionMode = AO_MODE_OPTIONS.SSGIAONode;
  let bloomEnabled = false;
  let traaEnabled = true;

  const markPipelineDirty = () => {
    renderPipeline.needsUpdate = true;
  };

  const resetTraaHistory = (node: TRAANode) => {
    (node as ResettableTRAANode).setSize(1, 1);
  };

  const selectCurrentRenderOutput = () => {
    return selectRenderOutput(nodes, {
      aoEnabled,
      aoMode,
      bloomEnabled,
      traaEnabled,
    });
  };

  const syncOutputNode = () => {
    const { outputNode, activeTraaNode } = selectCurrentRenderOutput();
    const outputChanged = renderPipeline.outputNode !== outputNode;
    renderPipeline.outputNode = outputNode;
    nodes.aoNode.useTemporalFiltering =
      aoEnabled && aoMode === AO_MODE_OPTIONS.SSGIAONode && traaEnabled;
    nodes.ssgiNode.useTemporalFiltering =
      aoEnabled && aoMode === AO_MODE_OPTIONS.SSGINode && traaEnabled;
    if (!outputChanged) return;
    // Resetting every node also shrinks inactive history targets to 1x1,
    // releasing their full-resolution VRAM until the mode is selected again.
    for (const node of nodes.traaNodes) resetTraaHistory(node);
    markPipelineDirty();
  };

  const resetActiveTraaHistory = () => {
    const { activeTraaNode } = selectCurrentRenderOutput();
    if (activeTraaNode) resetTraaHistory(activeTraaNode);
  };

  const updateTraaNodes = (updateNode: (node: TRAANode) => void) => {
    for (const node of nodes.traaNodes) updateNode(node);
    markPipelineDirty();
  };

  const referenceTraaNode = nodes.effects[AO_MODE_OPTIONS.SSGIAONode].traaNode;

  syncOutputNode();

  return {
    get pixelRatio() {
      return pixelRatio;
    },
    set pixelRatio(value) {
      const nextValue = clampRenderControl(
        value,
        RENDER_CONTROL_LIMITS.pixelRatio
      );
      if (nextValue === pixelRatio) return;
      pixelRatio = nextValue;
      renderer.setPixelRatio(pixelRatio);
    },
    get toneMapping() {
      return renderer.toneMapping;
    },
    set toneMapping(value) {
      if (value === renderer.toneMapping) return;
      renderer.toneMapping = value;
    },
    get toneMappingExposure() {
      return renderer.toneMappingExposure;
    },
    set toneMappingExposure(value) {
      const nextValue = clampRenderControl(
        value,
        RENDER_CONTROL_LIMITS.toneMappingExposure
      );
      if (nextValue === renderer.toneMappingExposure) return;
      renderer.toneMappingExposure = nextValue;
    },
    get aoEnabled() {
      return aoEnabled;
    },
    set aoEnabled(value) {
      if (value === aoEnabled) return;
      aoEnabled = value;
      syncOutputNode();
    },
    get aoMode() {
      return aoMode;
    },
    set aoMode(value) {
      if (value === aoMode) return;
      aoMode = value;
      syncOutputNode();
    },
    get aoResolutionScale() {
      return nodes.aoNode.resolutionScale;
    },
    set aoResolutionScale(value) {
      const nextValue = clampRenderControl(
        value,
        RENDER_CONTROL_LIMITS.aoResolutionScale
      );
      if (nextValue === nodes.aoNode.resolutionScale) return;
      nodes.aoNode.resolutionScale = nextValue;
    },
    get characterAoExcluded() {
      return nodes.characterAoExcluded.value;
    },
    set characterAoExcluded(value) {
      if (value === nodes.characterAoExcluded.value) return;
      nodes.characterAoExcluded.value = value;
      resetActiveTraaHistory();
    },
    get bloomEnabled() {
      return bloomEnabled;
    },
    set bloomEnabled(value) {
      if (value === bloomEnabled) return;
      bloomEnabled = value;
      syncOutputNode();
    },
    get bloomStrength() {
      return nodes.bloomNode.strength.value;
    },
    set bloomStrength(value) {
      const nextValue = clampRenderControl(
        value,
        RENDER_CONTROL_LIMITS.bloomStrength
      );
      if (nextValue === nodes.bloomNode.strength.value) return;
      nodes.bloomNode.strength.value = nextValue;
    },
    get bloomRadius() {
      return nodes.bloomNode.radius.value;
    },
    set bloomRadius(value) {
      const nextValue = clampRenderControl(
        value,
        RENDER_CONTROL_LIMITS.bloomRadius
      );
      if (nextValue === nodes.bloomNode.radius.value) return;
      nodes.bloomNode.radius.value = nextValue;
    },
    get bloomThreshold() {
      return nodes.bloomNode.threshold.value;
    },
    set bloomThreshold(value) {
      const nextValue = clampRenderControl(
        value,
        RENDER_CONTROL_LIMITS.bloomThreshold
      );
      if (nextValue === nodes.bloomNode.threshold.value) return;
      nodes.bloomNode.threshold.value = nextValue;
    },
    get bloomSmoothWidth() {
      return nodes.bloomNode.smoothWidth.value;
    },
    set bloomSmoothWidth(value) {
      const nextValue = clampRenderControl(
        value,
        RENDER_CONTROL_LIMITS.bloomSmoothWidth
      );
      if (nextValue === nodes.bloomNode.smoothWidth.value) return;
      nodes.bloomNode.smoothWidth.value = nextValue;
    },
    get traaEnabled() {
      return traaEnabled;
    },
    set traaEnabled(value) {
      if (value === traaEnabled) return;
      traaEnabled = value;
      syncOutputNode();
    },
    get traaDepthThreshold() {
      return referenceTraaNode.depthThreshold;
    },
    set traaDepthThreshold(value) {
      const nextValue = clampRenderControl(
        value,
        RENDER_CONTROL_LIMITS.traaDepthThreshold
      );
      if (nextValue === referenceTraaNode.depthThreshold) return;
      updateTraaNodes((node) => {
        node.depthThreshold = nextValue;
      });
    },
    get traaEdgeDepthDiff() {
      return referenceTraaNode.edgeDepthDiff;
    },
    set traaEdgeDepthDiff(value) {
      const nextValue = clampRenderControl(
        value,
        RENDER_CONTROL_LIMITS.traaEdgeDepthDiff
      );
      if (nextValue === referenceTraaNode.edgeDepthDiff) return;
      updateTraaNodes((node) => {
        node.edgeDepthDiff = nextValue;
      });
    },
    get traaMaxVelocityLength() {
      return referenceTraaNode.maxVelocityLength;
    },
    set traaMaxVelocityLength(value) {
      const nextValue = clampRenderControl(
        value,
        RENDER_CONTROL_LIMITS.traaMaxVelocityLength
      );
      if (nextValue === referenceTraaNode.maxVelocityLength) return;
      updateTraaNodes((node) => {
        node.maxVelocityLength = nextValue;
      });
    },
    get traaUseSubpixelCorrection() {
      return referenceTraaNode.useSubpixelCorrection;
    },
    set traaUseSubpixelCorrection(value) {
      if (value === referenceTraaNode.useSubpixelCorrection) return;
      updateTraaNodes((node) => {
        node.useSubpixelCorrection = value;
      });
    },
  };
}

function clampRenderControl(value: number, limit: RenderControlLimit) {
  return MathUtils.clamp(value, limit.min, limit.max);
}

function selectRenderOutput(
  nodes: RenderControlNodes,
  flags: RenderOutputFlags
): RenderOutputSelection {
  const selection = selectEffectNodes(nodes, flags);

  if (!flags.traaEnabled) {
    return {
      outputNode: flags.bloomEnabled
        ? selection.bloomColorNode
        : selection.colorNode,
      activeTraaNode: null,
    };
  }

  return {
    outputNode: flags.bloomEnabled
      ? selection.bloomTraaNode
      : selection.traaNode,
    activeTraaNode: selection.traaNode,
  };
}

function selectEffectNodes(nodes: RenderControlNodes, flags: RenderOutputFlags) {
  return flags.aoEnabled ? nodes.effects[flags.aoMode] : nodes.sceneEffect;
}
