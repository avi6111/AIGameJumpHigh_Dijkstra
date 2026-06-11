import * as THREE from "three/webgpu";

export const LEVEL_OBJECT_ROUGHNESS = 0.35;
export const LEVEL_OBJECT_METALNESS = 0.1;

export function createLevelMaterial(color: number) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: LEVEL_OBJECT_ROUGHNESS,
    metalness: LEVEL_OBJECT_METALNESS,
  });
}
