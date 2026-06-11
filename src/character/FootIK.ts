import * as THREE from "three";
import type { VRM } from "@pixiv/three-vrm";
import { characterStatus, useEcctrlStore } from "../lib/ecctrl/index";

export interface FootIKSettings {
  enabled: boolean;
  /** Max vertical foot/pelvis adjustment in meters; deeper drops keep the animated pose. */
  maxAdjustment: number;
  /** Exponential damping rate for ground offsets (higher = snappier). */
  smoothing: number;
  /** Tilt planted feet to match the ground normal. */
  alignFeetToGround: boolean;
}

export const footIKSettings: FootIKSettings = {
  enabled: true,
  maxAdjustment: 0.5,
  smoothing: 14,
  alignFeetToGround: true,
};

const RAY_MARGIN = 0.2;
const WEIGHT_DAMPING = 8;
const NORMAL_DAMPING = 12;
const MAX_GROUND_SLOPE = 1.1;
const MAX_FOOT_TILT = 0.6;
const PLANTED_LIFT_MIN = 0.04;
const PLANTED_LIFT_MAX = 0.16;
const MIN_BONE_LENGTH = 1e-4;
const IK_EPSILON = 1e-4;

const LEG_BONES = [
  { upper: "leftUpperLeg", lower: "leftLowerLeg", foot: "leftFoot" },
  { upper: "rightUpperLeg", lower: "rightLowerLeg", foot: "rightFoot" },
] as const;

const UP = new THREE.Vector3(0, 1, 0);
const DOWN = new THREE.Vector3(0, -1, 0);

const _rootPos = new THREE.Vector3();
const _rayOrigin = new THREE.Vector3();
const _groundNormal = new THREE.Vector3();
const _normalMatrix = new THREE.Matrix3();
const _normalTarget = new THREE.Vector3();
const _ikTarget = new THREE.Vector3();
const _fallbackAxis = new THREE.Vector3();
const _modelQuat = new THREE.Quaternion();
const _hipPos = new THREE.Vector3();
const _kneePos = new THREE.Vector3();
const _anklePos = new THREE.Vector3();
const _toTarget = new THREE.Vector3();
const _kneeToHip = new THREE.Vector3();
const _kneeToAnkle = new THREE.Vector3();
const _bendAxis = new THREE.Vector3();
const _currentDir = new THREE.Vector3();
const _targetDir = new THREE.Vector3();
const _deltaQuat = new THREE.Quaternion();
const _parentQuat = new THREE.Quaternion();
const _localDelta = new THREE.Quaternion();
const _footWorldQuat = new THREE.Quaternion();
const _worldPos = new THREE.Vector3();
const _parentInverse = new THREE.Matrix4();
const _tiltAxis = new THREE.Vector3();

interface FootIKLeg {
  upper: THREE.Object3D;
  lower: THREE.Object3D;
  foot: THREE.Object3D;
  /** Damped vertical ground offset relative to the animation ground plane. */
  offset: number;
  /** Damped world-space ground normal under this foot. */
  normal: THREE.Vector3;
  /** Animated ankle world position captured before any IK this frame. */
  animFootPos: THREE.Vector3;
}

interface GroundHit {
  offset: number;
  normal: THREE.Vector3;
}

/**
 * Plants the feet of a VRM humanoid on uneven terrain. After the animation
 * pose is applied (mixer + vrm.update), this lowers the pelvis so the
 * downhill foot can reach, solves a two-bone IK per leg to keep each ankle
 * at its animated height above the ground actually under it, and tilts
 * planted feet to the ground normal. Assumes a world-space +Y up axis.
 */
export class CharacterFootIK {
  private readonly vrm: VRM;
  private readonly modelRoot: THREE.Object3D;
  private readonly hips: THREE.Object3D | null;
  private readonly legs: FootIKLeg[] = [];
  private readonly raycaster: THREE.Raycaster & { firstHitOnly?: boolean };
  private readonly hits: THREE.Intersection[] = [];
  private readonly groundHit: GroundHit = {
    offset: 0,
    normal: new THREE.Vector3(0, 1, 0),
  };
  private restFootHeight = 0;
  private weight = 0;

  constructor(vrm: VRM, modelRoot: THREE.Object3D) {
    this.vrm = vrm;
    this.modelRoot = modelRoot;
    this.hips = vrm.humanoid.getRawBoneNode("hips");
    for (const names of LEG_BONES) {
      const upper = vrm.humanoid.getRawBoneNode(names.upper);
      const lower = vrm.humanoid.getRawBoneNode(names.lower);
      const foot = vrm.humanoid.getRawBoneNode(names.foot);
      if (!upper || !lower || !foot) continue;
      this.legs.push({
        upper,
        lower,
        foot,
        offset: 0,
        normal: new THREE.Vector3(0, 1, 0),
        animFootPos: new THREE.Vector3(),
      });
    }
    this.raycaster = new THREE.Raycaster();
    this.raycaster.firstHitOnly = true;
    this.restFootHeight = this.measureRestFootHeight();
  }

  update(delta: number) {
    if (!this.hips || this.legs.length !== LEG_BONES.length) return;

    const active = footIKSettings.enabled && characterStatus.isOnGround;
    const targetWeight = active ? 1 : 0;
    this.weight = THREE.MathUtils.damp(
      this.weight,
      targetWeight,
      WEIGHT_DAMPING,
      delta
    );
    if (targetWeight === 0 && this.isSettled()) {
      this.resetState();
      return;
    }

    this.modelRoot.updateWorldMatrix(true, true);
    _rootPos.setFromMatrixPosition(this.modelRoot.matrixWorld);
    this.modelRoot.getWorldQuaternion(_modelQuat);
    _fallbackAxis.set(1, 0, 0).applyQuaternion(_modelQuat);

    const colliders = useEcctrlStore.getState().colliderMeshesArray;
    for (const leg of this.legs) {
      leg.animFootPos.setFromMatrixPosition(leg.foot.matrixWorld);
      const hit =
        targetWeight > 0
          ? this.castGround(colliders, leg.animFootPos, _rootPos.y)
          : null;
      leg.offset = THREE.MathUtils.damp(
        leg.offset,
        hit ? hit.offset : 0,
        footIKSettings.smoothing,
        delta
      );
      _normalTarget.copy(hit ? hit.normal : UP);
      leg.normal
        .lerp(_normalTarget, 1 - Math.exp(-NORMAL_DAMPING * delta))
        .normalize();
    }

    const pelvisOffset =
      Math.min(0, this.legs[0].offset, this.legs[1].offset) * this.weight;
    if (Math.abs(pelvisOffset) > IK_EPSILON) {
      shiftWorldY(this.hips, pelvisOffset);
    }

    for (const leg of this.legs) {
      _ikTarget.copy(leg.animFootPos);
      _ikTarget.y += leg.offset * this.weight;
      _anklePos.setFromMatrixPosition(leg.foot.matrixWorld);
      if (_anklePos.distanceToSquared(_ikTarget) > IK_EPSILON * IK_EPSILON) {
        solveTwoBoneIK(leg.upper, leg.lower, leg.foot, _ikTarget, _fallbackAxis);
      }
      if (footIKSettings.alignFeetToGround) {
        this.alignFootToGround(leg, _rootPos.y);
      }
    }

    // Twist/roll constraints (e.g. leg twist bones) ran inside vrm.update()
    // against the pre-IK pose; re-resolve them for the adjusted legs.
    this.vrm.nodeConstraintManager?.update();
  }

  private isSettled() {
    return (
      this.weight < 1e-3 &&
      this.legs.every((leg) => Math.abs(leg.offset) < IK_EPSILON)
    );
  }

  private resetState() {
    this.weight = 0;
    for (const leg of this.legs) {
      leg.offset = 0;
      leg.normal.copy(UP);
    }
  }

  /**
   * Casts a ray down through the animated foot position and returns the
   * clamped ground height offset relative to the animation ground plane.
   * Returns null when there is no conformable ground (no hit, too steep,
   * or a drop deeper than maxAdjustment). The returned object is shared
   * scratch state — consume it before the next call.
   */
  private castGround(
    colliders: readonly THREE.Mesh[],
    footPos: THREE.Vector3,
    rootY: number
  ): GroundHit | null {
    if (colliders.length === 0) return null;

    const rayUp = footIKSettings.maxAdjustment + RAY_MARGIN;
    _rayOrigin.set(footPos.x, rootY + rayUp, footPos.z);
    this.raycaster.set(_rayOrigin, DOWN);
    this.raycaster.near = 0;
    this.raycaster.far = rayUp + footIKSettings.maxAdjustment + RAY_MARGIN;

    this.hits.length = 0;
    for (const mesh of colliders) {
      // Instanced colliders are skipped (no per-instance raycast here);
      // feet then simply keep the animated pose on such ground.
      if (mesh instanceof THREE.InstancedMesh) continue;
      if (!mesh.visible || !mesh.geometry.boundsTree || mesh.userData.excludeFloatHit) {
        continue;
      }
      this.raycaster.intersectObject(mesh, false, this.hits);
    }

    let bestDistance = Infinity;
    for (const hit of this.hits) {
      if (!hit.normal || hit.distance >= bestDistance) continue;
      _groundNormal
        .copy(hit.normal)
        .applyMatrix3(_normalMatrix.getNormalMatrix(hit.object.matrixWorld))
        .normalize();
      if (_groundNormal.angleTo(UP) > MAX_GROUND_SLOPE) continue;
      bestDistance = hit.distance;
      this.groundHit.offset = hit.point.y - rootY;
      this.groundHit.normal.copy(_groundNormal);
    }
    if (bestDistance === Infinity) return null;
    if (this.groundHit.offset < -footIKSettings.maxAdjustment) return null;
    this.groundHit.offset = Math.min(
      this.groundHit.offset,
      footIKSettings.maxAdjustment
    );
    return this.groundHit;
  }

  private alignFootToGround(leg: FootIKLeg, rootY: number) {
    const lift = leg.animFootPos.y - rootY - this.restFootHeight;
    const planted =
      1 - THREE.MathUtils.smoothstep(lift, PLANTED_LIFT_MIN, PLANTED_LIFT_MAX);
    const tiltAngle =
      Math.min(leg.normal.angleTo(UP), MAX_FOOT_TILT) * this.weight * planted;
    if (tiltAngle < 1e-3) return;
    _tiltAxis.crossVectors(UP, leg.normal);
    if (_tiltAxis.lengthSq() < 1e-10) return;
    _deltaQuat.setFromAxisAngle(_tiltAxis.normalize(), tiltAngle);
    applyWorldRotationDelta(leg.foot, _deltaQuat);
  }

  private measureRestFootHeight() {
    if (this.legs.length === 0) return 0;
    this.modelRoot.updateWorldMatrix(true, true);
    _rootPos.setFromMatrixPosition(this.modelRoot.matrixWorld);
    let total = 0;
    for (const leg of this.legs) {
      total += _worldPos.setFromMatrixPosition(leg.foot.matrixWorld).y - _rootPos.y;
    }
    return total / this.legs.length;
  }
}

/**
 * Analytic two-bone IK: bends the knee and swings the hip so the ankle
 * (origin of `foot`) reaches `target`, preserving the foot's world
 * orientation. World matrices of the chain must be up to date on entry.
 * `bendFallbackAxis` is used as the knee hinge when the leg is collinear.
 */
export function solveTwoBoneIK(
  upperLeg: THREE.Object3D,
  lowerLeg: THREE.Object3D,
  foot: THREE.Object3D,
  target: THREE.Vector3,
  bendFallbackAxis: THREE.Vector3
) {
  _hipPos.setFromMatrixPosition(upperLeg.matrixWorld);
  _kneePos.setFromMatrixPosition(lowerLeg.matrixWorld);
  _anklePos.setFromMatrixPosition(foot.matrixWorld);
  const upperLength = _hipPos.distanceTo(_kneePos);
  const lowerLength = _kneePos.distanceTo(_anklePos);
  _toTarget.subVectors(target, _hipPos);
  if (
    upperLength < MIN_BONE_LENGTH ||
    lowerLength < MIN_BONE_LENGTH ||
    _toTarget.lengthSq() < MIN_BONE_LENGTH * MIN_BONE_LENGTH
  ) {
    return false;
  }

  foot.getWorldQuaternion(_footWorldQuat);

  const targetDistance = THREE.MathUtils.clamp(
    _toTarget.length(),
    Math.abs(upperLength - lowerLength) + IK_EPSILON,
    upperLength + lowerLength - IK_EPSILON
  );
  const cosKnee =
    (upperLength * upperLength +
      lowerLength * lowerLength -
      targetDistance * targetDistance) /
    (2 * upperLength * lowerLength);
  const desiredKneeAngle = Math.acos(THREE.MathUtils.clamp(cosKnee, -1, 1));

  _kneeToHip.subVectors(_hipPos, _kneePos);
  _kneeToAnkle.subVectors(_anklePos, _kneePos);
  const currentKneeAngle = _kneeToHip.angleTo(_kneeToAnkle);
  _bendAxis.crossVectors(_kneeToAnkle, _kneeToHip);
  if (_bendAxis.lengthSq() < 1e-10) _bendAxis.copy(bendFallbackAxis);
  _bendAxis.normalize();

  const bendDelta = currentKneeAngle - desiredKneeAngle;
  if (Math.abs(bendDelta) > 1e-6) {
    _deltaQuat.setFromAxisAngle(_bendAxis, bendDelta);
    applyWorldRotationDelta(lowerLeg, _deltaQuat);
    _anklePos.setFromMatrixPosition(foot.matrixWorld);
  }

  _currentDir.subVectors(_anklePos, _hipPos).normalize();
  _targetDir.copy(_toTarget).normalize();
  _deltaQuat.setFromUnitVectors(_currentDir, _targetDir);
  applyWorldRotationDelta(upperLeg, _deltaQuat);

  setWorldQuaternion(foot, _footWorldQuat);
  return true;
}

/** Rotates a bone by a world-space quaternion delta and refreshes its subtree. */
function applyWorldRotationDelta(bone: THREE.Object3D, worldDelta: THREE.Quaternion) {
  const parent = bone.parent;
  if (!parent) return;
  parent.getWorldQuaternion(_parentQuat);
  _localDelta
    .copy(_parentQuat)
    .invert()
    .multiply(worldDelta)
    .multiply(_parentQuat);
  bone.quaternion.premultiply(_localDelta);
  bone.updateWorldMatrix(false, true);
}

function setWorldQuaternion(bone: THREE.Object3D, worldQuat: THREE.Quaternion) {
  const parent = bone.parent;
  if (!parent) return;
  parent.getWorldQuaternion(_parentQuat);
  bone.quaternion.copy(_parentQuat).invert().multiply(worldQuat);
  bone.updateWorldMatrix(false, true);
}

/** Translates a bone vertically in world space and refreshes its subtree. */
function shiftWorldY(bone: THREE.Object3D, deltaY: number) {
  const parent = bone.parent;
  if (!parent) return;
  _worldPos.setFromMatrixPosition(bone.matrixWorld);
  _worldPos.y += deltaY;
  _parentInverse.copy(parent.matrixWorld).invert();
  bone.position.copy(_worldPos.applyMatrix4(_parentInverse));
  bone.updateWorldMatrix(false, true);
}
