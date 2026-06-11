import assert from "node:assert/strict";
import * as THREE from "three/webgpu";
import { test } from "vitest";
import {
  createFreeCameraScratch,
  moveFreeCameraByWheel,
  updateFreeCamera,
  type FreeCameraInput,
} from "../src/app/FreeCamera";

test("free camera moves along the current view direction", () => {
  const camera = new THREE.PerspectiveCamera(64, 1, 0.1, 160);
  const position = new THREE.Vector3(0, 0, 5);
  const scratch = createFreeCameraScratch();
  const input = createFreeCameraInput({ forward: true });

  updateFreeCamera(camera, position, input, 0, 0, 1, scratch);
  camera.updateMatrixWorld(true);

  assert.deepEqual(roundVector(position), [0, 0, -2]);
  assert.deepEqual(roundVector(camera.getWorldDirection(new THREE.Vector3())), [
    0, 0, -1,
  ]);
});

test("free camera wheel moves forward and backward on the view axis", () => {
  const position = new THREE.Vector3(0, 0, 5);
  const scratch = createFreeCameraScratch();

  moveFreeCameraByWheel(position, 0, 0, 100, scratch);
  assert.deepEqual(roundVector(position), [0, 0, 6]);

  moveFreeCameraByWheel(position, 0, 0, -100, scratch);
  assert.deepEqual(roundVector(position), [0, 0, 5]);
});

function createFreeCameraInput(
  overrides: Partial<FreeCameraInput> = {}
): FreeCameraInput {
  return {
    forward: false,
    backward: false,
    left: false,
    right: false,
    up: false,
    down: false,
    fast: false,
    ...overrides,
  };
}

function roundVector(vector: THREE.Vector3) {
  return vector.toArray().map((value) => Number(value.toFixed(6)));
}
