import * as THREE from "three";
import type {
  CssStyle,
  EulerLike,
  Object3DOptions,
  QuaternionLike,
  Vector3Like,
} from "./Types";

export function applyObject3DOptions(
  object: THREE.Object3D,
  options: Object3DOptions
) {
  if (options.name !== undefined) object.name = options.name;
  if (options.visible !== undefined) object.visible = options.visible;
  if (options.position) setVector3(object.position, options.position);
  if (options.rotation) setEuler(object.rotation, options.rotation);
  if (options.quaternion) setQuaternion(object.quaternion, options.quaternion);
  if (options.scale !== undefined) {
    if (typeof options.scale === "number") {
      object.scale.setScalar(options.scale);
    } else {
      setVector3(object.scale, options.scale);
    }
  }
  if (options.userData) object.userData = { ...object.userData, ...options.userData };
}

export function addChildren(
  parent: THREE.Object3D,
  children?: THREE.Object3D | THREE.Object3D[]
) {
  if (!children) return;
  for (const child of Array.isArray(children) ? children : [children]) {
    parent.add(child);
  }
}

export function setVector3(target: THREE.Vector3, value: Vector3Like) {
  if (Array.isArray(value)) {
    target.set(value[0], value[1], value[2]);
    return;
  }
  target.set(value.x, value.y, value.z);
}

export function setEuler(target: THREE.Euler, value: EulerLike) {
  if (Array.isArray(value)) {
    target.set(value[0], value[1], value[2], value[3] ?? target.order);
    return;
  }
  target.set(value.x, value.y, value.z, value.order ?? target.order);
}

export function setQuaternion(
  target: THREE.Quaternion,
  value: QuaternionLike
) {
  if (Array.isArray(value)) {
    target.set(value[0], value[1], value[2], value[3]);
    return;
  }
  target.set(value.x, value.y, value.z, value.w);
}

export function applyStyle(element: HTMLElement, style?: CssStyle) {
  if (!style) return;
  for (const [key, value] of Object.entries(style)) {
    if (value !== undefined) element.style.setProperty(toKebabCase(key), String(value));
  }
}

export function disposeObject3D(object: THREE.Object3D) {
  const disposedMaterials = new Set<THREE.Material>();
  object.traverse((child) => {
    const mesh = child as THREE.Mesh;
    mesh.geometry?.dispose();
    const material = mesh.material;
    if (Array.isArray(material)) {
      for (const item of material) {
        if (disposedMaterials.has(item)) continue;
        item.dispose();
        disposedMaterials.add(item);
      }
    } else if (material && !disposedMaterials.has(material)) {
      material.dispose();
      disposedMaterials.add(material);
    }
  });
}

function toKebabCase(value: string) {
  return value.replace(/[A-Z]/g, (match) => `-${match.toLowerCase()}`);
}
