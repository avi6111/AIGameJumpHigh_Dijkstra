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
    const cleanGeometry = cloneColliderGeometry(mesh.geometry, geometryMatrix);
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

export function cloneColliderGeometry(
  geometry: THREE.BufferGeometry,
  matrix?: THREE.Matrix4
) {
  const position = geometry.getAttribute("position");
  const normal = geometry.getAttribute("normal");
  if (!position || !normal) return null;
  const source = geometry.index ? geometry.toNonIndexed() : geometry.clone();
  const cleanGeometry = new THREE.BufferGeometry();
  cleanGeometry.setAttribute("position", source.getAttribute("position").clone());
  cleanGeometry.setAttribute("normal", source.getAttribute("normal").clone());
  if (matrix) cleanGeometry.applyMatrix4(matrix);
  source.dispose();
  return cleanGeometry;
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
