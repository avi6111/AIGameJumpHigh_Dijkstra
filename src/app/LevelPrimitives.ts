import * as THREE from "three/webgpu";

export type Axis = "x" | "y" | "z";
export type BoxSize = [width: number, height: number, depth: number];
export type BoxPosition = [x: number, y: number, z: number];

export function addPlatform(
  group: THREE.Group,
  name: string,
  size: BoxSize,
  topY: number,
  x: number,
  z: number,
  material: THREE.Material
) {
  group.add(box(name, size, [x, topY - size[1] / 2, z], material));
}

export function cylinder(
  name: string,
  radius: number,
  height: number,
  position: BoxPosition,
  material: THREE.Material
) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, height, 18), material);
  mesh.name = name;
  mesh.position.set(...position);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

export function box(
  name: string,
  size: BoxSize,
  position: BoxPosition,
  material: THREE.Material
) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
  mesh.name = name;
  mesh.position.set(...position);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}
