import assert from "node:assert/strict";
import * as THREE from "three";
import {
  acceleratedRaycast,
  computeBoundsTree,
  disposeBoundsTree,
} from "three-mesh-bvh";
import { test } from "vitest";
import {
  createCameraCollisionScratch,
  resolveCameraCollisionDistance,
  updateCameraCollisionProbePoints,
} from "../src/app/CameraRig";

test("camera collision clips distance before an occluding collider", () => {
  const wall = createCameraCollider();
  const raycaster = new THREE.Raycaster();
  const hits: THREE.Intersection[] = [];
  const target = new THREE.Vector3(0, 0, 0);
  const desiredPosition = new THREE.Vector3(0, 0, 5);

  try {
    const distance = resolveCameraCollisionDistance(
      raycaster,
      hits,
      target,
      desiredPosition,
      5,
      0.2,
      [wall]
    );

    assert.ok(distance < 1.7, `expected clipped distance, got ${distance}`);
    assert.ok(distance > 1.5, `expected padding after wall hit, got ${distance}`);
  } finally {
    disposeCameraCollider(wall);
  }
});

test("camera collision ignores hidden or collision-excluded colliders", () => {
  const wall = createCameraCollider();
  const raycaster = new THREE.Raycaster();
  const hits: THREE.Intersection[] = [];
  const target = new THREE.Vector3(0, 0, 0);
  const desiredPosition = new THREE.Vector3(0, 0, 5);

  try {
    wall.visible = false;
    assert.equal(
      resolveCameraCollisionDistance(
        raycaster,
        hits,
        target,
        desiredPosition,
        5,
        0.2,
        [wall]
      ),
      5
    );

    wall.visible = true;
    wall.userData.excludeCollisionCheck = true;
    assert.equal(
      resolveCameraCollisionDistance(
        raycaster,
        hits,
        target,
        desiredPosition,
        5,
        0.2,
        [wall]
      ),
      5
    );
  } finally {
    disposeCameraCollider(wall);
  }
});

test("camera collision checks off-center camera probe points", () => {
  const wall = createCameraCollider([0.4, 0.4, 0.4]);
  const raycaster = new THREE.Raycaster();
  const hits: THREE.Intersection[] = [];
  const scratch = createCameraCollisionScratch();
  const camera = new THREE.PerspectiveCamera(90, 1, 1, 10);
  const target = new THREE.Vector3(0, 0, 0);
  const desiredPosition = new THREE.Vector3(0, 0, 5);

  wall.position.set(0.9, 0.9, 4);
  wall.updateMatrixWorld(true);
  updateCameraCollisionProbePoints(scratch, target, desiredPosition, 5, camera);

  try {
    assert.equal(
      resolveCameraCollisionDistance(
        raycaster,
        hits,
        target,
        desiredPosition,
        5,
        0.2,
        [wall]
      ),
      5
    );

    const distance = resolveCameraCollisionDistance(
      raycaster,
      hits,
      target,
      desiredPosition,
      5,
      0.2,
      [wall],
      scratch.probePoints
    );

    assert.ok(distance < 5, `expected off-center probe to clip, got ${distance}`);
  } finally {
    disposeCameraCollider(wall);
  }
});

test("camera probe points stay reusable after first-person distance", () => {
  const scratch = createCameraCollisionScratch();
  const camera = new THREE.PerspectiveCamera(90, 1, 0.1, 10);
  const target = new THREE.Vector3(0, 0, 0);
  const nearPosition = new THREE.Vector3(0, 0, 0.08);
  const farPosition = new THREE.Vector3(0, 0, 5);

  updateCameraCollisionProbePoints(scratch, target, nearPosition, 0.08, camera);
  assert.equal(scratch.probePoints.length, 5);
  for (const point of scratch.probePoints) {
    assert.ok(point instanceof THREE.Vector3);
  }

  updateCameraCollisionProbePoints(scratch, target, farPosition, 5, camera);
  assert.equal(scratch.probePoints.length, 5);
  for (const point of scratch.probePoints) {
    assert.ok(point instanceof THREE.Vector3);
  }
});

function createCameraCollider(size: [number, number, number] = [4, 4, 0.4]) {
  const wall = new THREE.Mesh(new THREE.BoxGeometry(...size));
  wall.position.set(0, 0, 2);
  wall.updateMatrixWorld(true);
  computeBoundsTree.call(wall.geometry);
  wall.raycast = acceleratedRaycast;
  return wall;
}

function disposeCameraCollider(mesh: THREE.Mesh) {
  disposeBoundsTree.call(mesh.geometry);
  mesh.geometry.dispose();
}
