import assert from "node:assert/strict";
import * as THREE from "three";
import { test } from "vitest";
import { solveTwoBoneIK } from "../src/character/FootIK";

const FALLBACK_AXIS = new THREE.Vector3(1, 0, 0);

test("two-bone IK places the ankle on a reachable target", () => {
  const { foot, lower, upper } = createLegChain();
  const target = new THREE.Vector3(0.1, 0.25, 0.1);

  const solved = solveTwoBoneIK(upper, lower, foot, target, FALLBACK_AXIS);

  assert.equal(solved, true);
  const ankle = new THREE.Vector3().setFromMatrixPosition(foot.matrixWorld);
  assert.ok(
    ankle.distanceTo(target) < 1e-3,
    `expected ankle at target, got ${ankle.toArray().join(", ")}`
  );
});

test("two-bone IK preserves bone lengths", () => {
  const { foot, lower, upper } = createLegChain();
  const target = new THREE.Vector3(-0.2, 0.35, 0.15);

  solveTwoBoneIK(upper, lower, foot, target, FALLBACK_AXIS);

  const hip = new THREE.Vector3().setFromMatrixPosition(upper.matrixWorld);
  const knee = new THREE.Vector3().setFromMatrixPosition(lower.matrixWorld);
  const ankle = new THREE.Vector3().setFromMatrixPosition(foot.matrixWorld);
  assert.ok(Math.abs(hip.distanceTo(knee) - 0.4) < 1e-6);
  assert.ok(Math.abs(knee.distanceTo(ankle) - 0.4) < 1e-6);
});

test("two-bone IK clamps an unreachable target to full extension", () => {
  const { foot, lower, upper } = createLegChain();
  const target = new THREE.Vector3(0, -0.5, 0);

  const solved = solveTwoBoneIK(upper, lower, foot, target, FALLBACK_AXIS);

  assert.equal(solved, true);
  const hip = new THREE.Vector3().setFromMatrixPosition(upper.matrixWorld);
  const ankle = new THREE.Vector3().setFromMatrixPosition(foot.matrixWorld);
  const reach = hip.distanceTo(ankle);
  assert.ok(reach <= 0.8, `expected reach <= 0.8, got ${reach}`);
  assert.ok(reach > 0.79, `expected near full extension, got ${reach}`);
  const toAnkle = ankle.sub(hip).normalize();
  const toTarget = target.clone().sub(hip).normalize();
  assert.ok(
    toAnkle.dot(toTarget) > 0.999,
    "expected ankle along the hip-to-target direction"
  );
});

test("two-bone IK preserves the foot world orientation", () => {
  const { foot, lower, upper, root } = createLegChain();
  foot.quaternion.setFromEuler(new THREE.Euler(0.2, 0.1, -0.3));
  root.updateMatrixWorld(true);
  const before = foot.getWorldQuaternion(new THREE.Quaternion());

  solveTwoBoneIK(upper, lower, foot, new THREE.Vector3(0.1, 0.3, 0.05), FALLBACK_AXIS);

  const after = foot.getWorldQuaternion(new THREE.Quaternion());
  assert.ok(
    before.angleTo(after) < 1e-3,
    `expected preserved foot orientation, drifted ${before.angleTo(after)}`
  );
});

test("two-bone IK keeps a bent knee plane instead of the fallback axis", () => {
  const { foot, lower, upper } = createLegChain();
  // Pre-bend the knee around world Z (sideways) so the natural bend axis is
  // orthogonal to the X fallback axis; the solve must stay in the XY plane.
  lower.quaternion.setFromAxisAngle(new THREE.Vector3(0, 0, 1), 0.5);
  upper.updateMatrixWorld(true);
  const target = new THREE.Vector3(0.1, 0.3, 0);

  const solved = solveTwoBoneIK(upper, lower, foot, target, FALLBACK_AXIS);

  assert.equal(solved, true);
  const ankle = new THREE.Vector3().setFromMatrixPosition(foot.matrixWorld);
  assert.ok(ankle.distanceTo(target) < 1e-3);
  const knee = new THREE.Vector3().setFromMatrixPosition(lower.matrixWorld);
  assert.ok(
    Math.abs(knee.z) < 1e-4,
    `expected knee to stay in the z=0 bend plane, got z=${knee.z}`
  );
});

test("two-bone IK rejects degenerate chains", () => {
  const root = new THREE.Object3D();
  const upper = new THREE.Object3D();
  const lower = new THREE.Object3D();
  const foot = new THREE.Object3D();
  root.add(upper);
  upper.add(lower);
  lower.add(foot);
  root.updateMatrixWorld(true);

  const solved = solveTwoBoneIK(
    upper,
    lower,
    foot,
    new THREE.Vector3(0, 1, 0),
    FALLBACK_AXIS
  );

  assert.equal(solved, false);
});

function createLegChain() {
  const root = new THREE.Object3D();
  const upper = new THREE.Object3D();
  const lower = new THREE.Object3D();
  const foot = new THREE.Object3D();
  root.add(upper);
  upper.add(lower);
  lower.add(foot);
  upper.position.set(0, 0.9, 0);
  lower.position.set(0, -0.4, 0);
  foot.position.set(0, -0.4, 0);
  root.updateMatrixWorld(true);
  return { root, upper, lower, foot };
}
