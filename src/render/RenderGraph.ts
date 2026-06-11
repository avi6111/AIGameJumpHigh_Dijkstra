import * as THREE from "three/webgpu";
import type { Node } from "three/webgpu";
import {
  float,
  mrt,
  normalView,
  output,
  pass,
  reference,
  uniform,
  uint,
  vec3,
  vec4,
  velocity,
} from "three/tsl";
import { bloom } from "three/examples/jsm/tsl/display/BloomNode.js";
import { ssgi } from "three/examples/jsm/tsl/display/SSGINode.js";
import type SSGINode from "three/examples/jsm/tsl/display/SSGINode.js";
import { traa } from "three/examples/jsm/tsl/display/TRAANode.js";
import {
  AO_MODE_OPTIONS,
  createRenderControls,
  type RenderInspectorControls,
} from "./RenderControls";
import { CHARACTER_AO_MASK_LAYER } from "../scene/RenderLayers";
import { ssgiAO } from "./SSGIAONode.js";
import type SSGIAONode from "./SSGIAONode.js";

const CHARACTER_AO_MASK_BIT = 1 << CHARACTER_AO_MASK_LAYER;

type DisposableMaterial = { dispose(): void };
type BloomSetup = ReturnType<typeof bloom>["setup"];
type BloomSetupBuilder = Parameters<BloomSetup>[0];
type BloomSetupResult = ReturnType<BloomSetup>;
type RepeatableBloomNode = ReturnType<typeof bloom> & {
  _separableBlurMaterials?: DisposableMaterial[];
};
type SSGINodeHandle = SSGINode & {
  getTextureNode(): Node<"vec4">;
  dispose(): void;
};

export interface RenderGraph {
  aoNode: SSGIAONode;
  ssgiNode: SSGINodeHandle;
  renderControls: RenderInspectorControls;
  invalidate(): void;
  render(): void;
  dispose(): void;
}

export function createRenderGraph(
  renderer: THREE.WebGPURenderer,
  scene: THREE.Scene,
  skyScene: THREE.Scene,
  camera: THREE.PerspectiveCamera
): RenderGraph {
  const scenePass = pass(scene, camera);
  scenePass.setMRT(
    mrt({
      output,
      normal: vec4(normalView, createCharacterAoMaskNode()),
      velocity,
    })
  );
  const scenePassColor = scenePass.getTextureNode("output");
  const scenePassNormal = scenePass.getTextureNode("normal");
  const scenePassDepth = scenePass.getTextureNode("depth");
  const scenePassVelocity = scenePass.getTextureNode("velocity");
  const skyPass = pass(skyScene, camera);
  // Sky and clouds are low-frequency; render at half resolution.
  skyPass.setResolutionScale(0.5);
  const skyPassColor = skyPass.getTextureNode("output");
  const aoNode = ssgiAO(scenePassDepth, scenePassNormal, camera);
  const ssgiNode = ssgi(
    scenePassColor,
    scenePassDepth,
    scenePassNormal,
    camera
  ) as SSGINodeHandle;
  configureAoNode(aoNode);
  aoNode.resolutionScale = 0.6;
  configureAoNode(ssgiNode);

  const aoTextureNode = aoNode.getTextureNode();
  const ssgiTextureNode = ssgiNode.getTextureNode();
  const backgroundMask = scenePassDepth.r.greaterThanEqual(1);
  const characterAoExcluded = uniform(true);
  const characterVisibleMask = scenePassNormal.a.greaterThan(0.5);
  const aoMultiplier = createCharacterAoMultiplier(
    characterAoExcluded,
    characterVisibleMask,
    aoTextureNode.r
  );
  const ssgiAoMultiplier = createCharacterAoMultiplier(
    characterAoExcluded,
    characterVisibleMask,
    ssgiTextureNode.a
  );
  const sceneDisplayNode = backgroundMask.select(skyPassColor, scenePassColor);
  const bloomNode = createBloomNode(sceneDisplayNode);
  const aoCompositeNode = backgroundMask.select(
    skyPassColor,
    scenePassColor.mul(vec4(vec3(aoMultiplier), 1))
  );
  const ssgiCompositeNode = backgroundMask.select(
    skyPassColor,
    scenePassColor
      .mul(vec4(vec3(ssgiAoMultiplier), 1))
      .add(vec4(ssgiTextureNode.rgb, 0))
  );
  const traaSceneNode = traa(
    sceneDisplayNode,
    scenePassDepth,
    scenePassVelocity,
    camera
  );
  const traaAoNode = traa(
    aoCompositeNode,
    scenePassDepth,
    scenePassVelocity,
    camera
  );
  const traaSsgiNode = traa(
    ssgiCompositeNode,
    scenePassDepth,
    scenePassVelocity,
    camera
  );
  const traaSceneOutputNode = traaSceneNode as unknown as Node<"vec4">;
  const traaAoOutputNode = traaAoNode as unknown as Node<"vec4">;
  const traaSsgiOutputNode = traaSsgiNode as unknown as Node<"vec4">;
  const renderPipeline = new THREE.RenderPipeline(renderer);
  const renderControls = createRenderControls(renderer, renderPipeline, {
    bloomNode,
    sceneEffect: {
      colorNode: sceneDisplayNode,
      bloomColorNode: sceneDisplayNode.add(bloomNode),
      traaNode: traaSceneNode,
      bloomTraaNode: traaSceneOutputNode.add(bloomNode),
    },
    effects: {
      [AO_MODE_OPTIONS.SSGIAONode]: {
        colorNode: aoCompositeNode,
        bloomColorNode: aoCompositeNode.add(bloomNode),
        traaNode: traaAoNode,
        bloomTraaNode: traaAoOutputNode.add(bloomNode),
      },
      [AO_MODE_OPTIONS.SSGINode]: {
        colorNode: ssgiCompositeNode,
        bloomColorNode: ssgiCompositeNode.add(bloomNode),
        traaNode: traaSsgiNode,
        bloomTraaNode: traaSsgiOutputNode.add(bloomNode),
      },
    },
    aoNode,
    ssgiNode,
    characterAoExcluded,
    traaNodes: [traaSceneNode, traaAoNode, traaSsgiNode],
  });

  return {
    aoNode,
    ssgiNode,
    renderControls,
    invalidate() {
      renderPipeline.needsUpdate = true;
    },
    render() {
      renderPipeline.render();
    },
    dispose() {
      skyPass.dispose();
      scenePass.dispose();
      aoNode.dispose();
      ssgiNode.dispose();
      bloomNode.dispose();
      traaSceneNode.dispose();
      traaAoNode.dispose();
      traaSsgiNode.dispose();
      renderPipeline.dispose();
    },
  };
}

function configureAoNode(aoNode: SSGIAONode | SSGINode) {
  aoNode.sliceCount.value = 3;
  aoNode.stepCount.value = 16;
  aoNode.radius.value = 8;
  aoNode.aoIntensity.value = 1;
  aoNode.useScreenSpaceSampling.value = true;
  aoNode.expFactor.value = 1.5;
  aoNode.thickness.value = 0.1;
  aoNode.useLinearThickness.value = true;
  aoNode.useTemporalFiltering = true;
}

function createCharacterAoMaskNode() {
  const layersMask = reference("layers.mask", "uint", null);
  return layersMask
    .bitAnd(uint(CHARACTER_AO_MASK_BIT))
    .greaterThan(uint(0))
    .select(float(1), float(0));
}

function createCharacterAoMultiplier(
  characterAoExcluded: Node<"bool">,
  characterVisibleMask: Node<"bool">,
  aoFactor: Node<"float">
) {
  return characterAoExcluded.select(
    characterVisibleMask.select(float(1), aoFactor),
    aoFactor
  );
}

function createBloomNode(inputNode: Node<"vec4">) {
  const bloomNode = bloom(inputNode, 0.4, 0.25, 0.9);
  bloomNode.smoothWidth.value = 0.04;
  makeBloomSetupRepeatable(bloomNode as RepeatableBloomNode);
  return bloomNode;
}

function makeBloomSetupRepeatable(bloomNode: RepeatableBloomNode) {
  const setupBloom = bloomNode.setup.bind(bloomNode) as BloomSetup;

  bloomNode.setup = ((builder: BloomSetupBuilder): BloomSetupResult => {
    const blurMaterials = bloomNode._separableBlurMaterials;
    if (!Array.isArray(blurMaterials)) {
      throw new Error("BloomNode internals changed: missing blur materials.");
    }
    // BloomNode appends blur materials on every setup; Inspector output swaps
    // can rebuild the pipeline multiple times, so clear the previous batch.
    for (const material of blurMaterials) {
      material.dispose();
    }
    blurMaterials.length = 0;
    return setupBloom(builder);
  }) as BloomSetup;
}
