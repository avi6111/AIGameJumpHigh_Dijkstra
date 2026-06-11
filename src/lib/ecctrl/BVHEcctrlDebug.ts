import * as THREE from "three";
import type { BVHEcctrlState, ControllerDebugObjects } from "./BVHEcctrlState";
import { disposeObject3D } from "./Object3DUtils";

export function syncDebugObjects(state: BVHEcctrlState) {
  if (state.options.debug && state.debugObjects) {
    const owner = getDebugOwner(state);
    if (
      state.debugObjects.owner !== owner ||
      state.debugObjects.capsuleArgsKey !== getCapsuleArgsKey(state)
    ) {
      disposeDebugObjects(state);
    }
  }
  if (state.options.debug && !state.debugObjects) createDebugObjects(state);
  if (!state.options.debug && state.debugObjects) disposeDebugObjects(state);
}

export function updateDebugger(state: BVHEcctrlState) {
  const debug = state.debugObjects;
  if (!debug) return;
  debug.lineStart.position.copy(state.characterSegment.start);
  debug.lineEnd.position.copy(state.characterSegment.end);
  debug.rayStart.position.copy(state.floatSensorSegment.start);
  debug.rayEnd.position.copy(state.floatSensorSegment.end);
  debug.standPoint.position.copy(state.globalClosestPoint);
  debug.lookDir.position.copy(state.group.position).addScaledVector(state.upAxis, 0.7);
  debug.lookDir.lookAt(debug.lookDir.position.clone().add(state.camProjDir));
  debug.inputDir.position.copy(state.characterSegment.end);
  debug.inputDir.setDirection(nonZeroDirection(state.inputDir));
  debug.inputDir.setLength(state.inputDir.lengthSq());
  debug.moveDir.position.copy(state.characterSegment.end);
  debug.moveDir.setDirection(nonZeroDirection(state.currentLinVel));
  debug.moveDir.setLength(state.currentLinVel.length() / state.options.maxWalkSpeed);
}

export function disposeDebugObjects(state: BVHEcctrlState) {
  const debug = state.debugObjects;
  if (!debug) return;
  debug.root.parent?.remove(debug.root);
  debug.capsule.parent?.remove(debug.capsule);
  disposeObject3D(debug.root);
  disposeObject3D(debug.capsule);
  state.debugObjects = null;
}

function createDebugObjects(state: BVHEcctrlState) {
  const [radius, length, capSegments, radialSegments] =
    state.options.colliderCapsuleArgs;
  const capsule = new THREE.Mesh(
    new THREE.CapsuleGeometry(radius, length, capSegments, radialSegments),
    new THREE.MeshNormalMaterial({ wireframe: true })
  );
  state.group.add(capsule);

  const root = new THREE.Group();
  const lineStart = marker(0.05, new THREE.MeshNormalMaterial());
  const lineEnd = marker(0.05, new THREE.MeshNormalMaterial());
  const rayStart = marker(
    0.1,
    new THREE.MeshBasicMaterial({ color: "yellow", wireframe: true })
  );
  const rayEnd = marker(
    0.1,
    new THREE.MeshBasicMaterial({ color: "yellow", wireframe: true })
  );
  const standPoint = marker(
    0.12,
    new THREE.MeshBasicMaterial({ color: "red", transparent: true, opacity: 0.2 })
  );
  const lookDir = marker(0.1, new THREE.MeshNormalMaterial());
  lookDir.scale.set(1, 0.5, 4);
  const inputDir = new THREE.ArrowHelper(
    new THREE.Vector3(1, 0, 0),
    new THREE.Vector3(),
    0,
    0x0000ff
  );
  const moveDir = new THREE.ArrowHelper(
    new THREE.Vector3(1, 0, 0),
    new THREE.Vector3(),
    0,
    0xff0000
  );
  const characterBox = new THREE.Box3Helper(state.characterBbox);
  const sensorBox = new THREE.Box3Helper(state.floatSensorBbox);
  const owner = getDebugOwner(state);
  root.add(
    characterBox,
    sensorBox,
    lineStart,
    lineEnd,
    rayStart,
    rayEnd,
    standPoint,
    lookDir,
    inputDir,
    moveDir
  );
  owner.add(root);
  state.debugObjects = {
    owner,
    capsuleArgsKey: getCapsuleArgsKey(state),
    root,
    capsule,
    lineStart,
    lineEnd,
    rayStart,
    rayEnd,
    standPoint,
    lookDir,
    inputDir,
    moveDir,
    characterBox,
    sensorBox,
  };
}

function marker(radius: number, material: THREE.Material) {
  return new THREE.Mesh(new THREE.OctahedronGeometry(radius, 0), material);
}

function getDebugOwner(state: BVHEcctrlState) {
  return state.options.scene ?? state.group;
}

function getCapsuleArgsKey(state: BVHEcctrlState) {
  return state.options.colliderCapsuleArgs.join(":");
}

function nonZeroDirection(source: THREE.Vector3) {
  return source.lengthSq() > 0 ? source : new THREE.Vector3(1, 0, 0);
}
