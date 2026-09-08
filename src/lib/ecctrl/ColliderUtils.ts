import * as THREE from "three";
import {
  type GeometryBVH,
  MeshBVHHelper,
  StaticGeometryGenerator,
  acceleratedRaycast,
  computeBoundsTree,
  disposeBoundsTree,
} from "three-mesh-bvh";
import { useEcctrlStore } from "./stores/EcctrlStore";
import {
  DEFAULT_BVH_OPTIONS,
  type BVHOptions,
  type Object3DOptions,
} from "./Types";

export const COLLIDER_DEFAULTS = {
  debug: false,
  debugVisualizeDepth: 10,
  restitution: 0.05,
  friction: 0.8,
  excludeFloatHit: false,
  excludeCollisionCheck: false,
};

export interface ColliderUserData {
  restitution: number;
  friction: number;
  excludeFloatHit: boolean;
  excludeCollisionCheck: boolean;
  type: "STATIC" | "KINEMATIC";
  active?: boolean;
}

export interface ColliderMeshUserData {
  collisionPadding?: number;
}

export type CollisionCheckCollider = THREE.Mesh & {
  geometry: THREE.BufferGeometry & { boundsTree: GeometryBVH };
};

export function buildMergedGeometry(
  root: THREE.Object3D,
  options?: BVHOptions,
  space: "world" | "local" = "world"
) {
  root.updateMatrixWorld(true);
  const rootInverse = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const geometryMatrix = new THREE.Matrix4();
  const temporaryMeshes: THREE.Mesh[] = [];

  root.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh) return;
    const position = mesh.geometry.getAttribute("position");
    const normal = mesh.geometry.getAttribute("normal");
    if (!position || !normal) return;

    geometryMatrix.copy(mesh.matrixWorld);
    if (space === "local") geometryMatrix.premultiply(rootInverse);
    const collisionPadding = getCollisionPadding(mesh);
    const cleanGeometry = cloneColliderGeometry(
      mesh.geometry,
      geometryMatrix,
      collisionPadding
    );
    if (!cleanGeometry) return;
    temporaryMeshes.push(new THREE.Mesh(cleanGeometry));
  });

  if (temporaryMeshes.length === 0) {
    return { geometry: null, temporaryMeshes };
  }

  const generator = new StaticGeometryGenerator(temporaryMeshes);
  generator.attributes = ["position", "normal"];
  const geometry = generator.generate();
  computeBoundsTree.call(geometry, { ...DEFAULT_BVH_OPTIONS, ...options });
  return { geometry, temporaryMeshes };
}

export function createColliderMesh(
  geometry: THREE.BufferGeometry,
  data: ColliderUserData,
  name = ""
) {
  const mesh = new THREE.Mesh(geometry);
  mesh.name = name;
  registerColliderMesh(mesh, data);
  return mesh;
}

export function registerColliderMesh(mesh: THREE.Mesh, data: ColliderUserData) {
  if (!(mesh instanceof THREE.InstancedMesh)) {
    mesh.raycast = acceleratedRaycast;
  }
  mesh.userData = { ...data };
  useEcctrlStore.getState().setColliderMeshesArray(mesh);
}

export function updateColliderUserData(
  mesh: THREE.Mesh,
  data: Partial<ColliderUserData>,
  name?: string,
  visible?: boolean
) {
  if (name !== undefined) mesh.name = name;
  if (visible !== undefined) mesh.visible = visible;
  Object.assign(mesh.userData, data);
}

export function isCollisionCheckCollider(
  mesh: THREE.Mesh
): mesh is CollisionCheckCollider {
  return (
    mesh.visible &&
    Boolean(mesh.geometry.boundsTree) &&
    !mesh.userData.excludeCollisionCheck
  );
}

export function createBvhHelper(
  mesh: THREE.Mesh,
  scene: THREE.Scene | undefined,
  depth: number
) {
  if (!scene) return null;
  const helper = new MeshBVHHelper(mesh, depth);
  scene.add(helper);
  return helper;
}

export function disposeBvhHelper(helper: MeshBVHHelper | null) {
  if (!helper) return;
  helper.parent?.remove(helper);
  helper.dispose();
}

export function disposeColliderMesh(mesh: THREE.Mesh | null) {
  if (!mesh) return;
  useEcctrlStore.getState().removeColliderMesh(mesh);
  disposeBoundsTree.call(mesh.geometry);
  mesh.geometry.dispose();
  disposeMaterial(mesh.material);
  mesh.raycast =
    mesh instanceof THREE.InstancedMesh
      ? THREE.InstancedMesh.prototype.raycast
      : THREE.Mesh.prototype.raycast;
}

export function disposeTemporaryMeshes(meshes: THREE.Mesh[]) {
  for (const mesh of meshes) {
    mesh.geometry.dispose();
    disposeMaterial(mesh.material);
  }
  meshes.length = 0;
}
/**
 * 
 * @param geometry 要克隆的碰撞几何体
 * @param matrix （是否）变换的矩阵
 * @param padding 创建的 box 会把geometry.getAttribute('position|(Scale)') 这属性放大一点，则reboundMesh()的时候完成更新 Mesh
 * @returns 
 */
export function cloneColliderGeometry(
  geometry: THREE.BufferGeometry,
  matrix?: THREE.Matrix4,
  padding = 0
) {
  const position = geometry.getAttribute("position");
  const normal = geometry.getAttribute("normal");
  if (!position || !normal) return null;
  const source = geometry.index ? geometry.toNonIndexed() : geometry.clone();
  const cleanGeometry = new THREE.BufferGeometry();
  cleanGeometry.setAttribute("position", source.getAttribute("position").clone());
  cleanGeometry.setAttribute("normal", source.getAttribute("normal").clone());
  expandGeometryBounds(cleanGeometry, padding);
  if (matrix) cleanGeometry.applyMatrix4(matrix);
  source.dispose();
  return cleanGeometry;
}

function getCollisionPadding(mesh: THREE.Mesh) {
  const padding = (mesh.userData as ColliderMeshUserData).collisionPadding;
  return typeof padding === "number" && padding > 0 ? padding : 0;
}

function expandGeometryBounds(geometry: THREE.BufferGeometry, padding: number) {
  if (padding === 0) return;
  geometry.computeBoundingBox();
  const bounds = geometry.boundingBox;
  if (!bounds) return;

  const size = bounds.getSize(new THREE.Vector3());
  if (size.x === 0 || size.y === 0 || size.z === 0) return;

  const center = bounds.getCenter(new THREE.Vector3());
  const position = geometry.getAttribute("position");
  const scale = new THREE.Vector3(
    (size.x + padding * 2) / size.x,
    (size.y + padding * 2) / size.y,
    (size.z + padding * 2) / size.z
  );
  for (let index = 0; index < position.count; index++) {
    position.setXYZ(
      index,
      center.x + (position.getX(index) - center.x) * scale.x,
      center.y + (position.getY(index) - center.y) * scale.y,
      center.z + (position.getZ(index) - center.z) * scale.z
    );
  }
  position.needsUpdate = true;
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
}

export function hasColliderGeometryAffectingOptions(
  options: Partial<Object3DOptions & { BVHOptions?: BVHOptions }>
) {
  return (
    options.position !== undefined ||
    options.rotation !== undefined ||
    options.quaternion !== undefined ||
    options.scale !== undefined ||
    options.BVHOptions !== undefined
  );
}

function disposeMaterial(material: THREE.Material | THREE.Material[]) {
  if (Array.isArray(material)) {
    for (const item of material) item.dispose();
  } else {
    material.dispose();
  }
}
