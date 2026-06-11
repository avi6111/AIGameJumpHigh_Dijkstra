import type { Camera } from "three";
import type { Node } from "three/webgpu";

interface SSGIAONodeUniform<T> {
  value: T;
}

export default class SSGIAONode {
  sliceCount: SSGIAONodeUniform<number>;
  stepCount: SSGIAONodeUniform<number>;
  radius: SSGIAONodeUniform<number>;
  aoIntensity: SSGIAONodeUniform<number>;
  useScreenSpaceSampling: SSGIAONodeUniform<boolean>;
  expFactor: SSGIAONodeUniform<number>;
  thickness: SSGIAONodeUniform<number>;
  useLinearThickness: SSGIAONodeUniform<boolean>;
  useTemporalFiltering: boolean;
  resolutionScale: number;

  constructor(depthNode: unknown, normalNode: unknown, camera: Camera);
  getTextureNode(): Node<"vec4">;
  dispose(): void;
}

export function ssgiAO(
  depthNode: unknown,
  normalNode: unknown,
  camera: Camera
): SSGIAONode;
