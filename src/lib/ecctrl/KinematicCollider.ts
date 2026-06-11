/*!
 * BVHEcctrl
 * https://github.com/pmndrs/BVHEcctrl
 * (c) 2025 @ErdongChen-Andrew
 * Released under the MIT License.
 */

import * as THREE from "three";
import type { MeshBVHHelper } from "three-mesh-bvh";
import {
  buildMergedGeometry,
  COLLIDER_DEFAULTS,
  createBvhHelper,
  createColliderMesh,
  disposeBvhHelper,
  disposeColliderMesh,
  disposeTemporaryMeshes,
  updateColliderUserData,
} from "./ColliderUtils";
import { applyObject3DOptions } from "./Object3DUtils";
import type { BVHOptions, Object3DOptions } from "./Types";

export interface KinematicColliderProps extends Object3DOptions {
  debug?: boolean;
  debugVisualizeDepth?: number;
  bvhName?: string;
  active?: boolean;
  restitution?: number;
  friction?: number;
  excludeFloatHit?: boolean;
  excludeCollisionCheck?: boolean;
  BVHOptions?: BVHOptions;
  scene?: THREE.Scene;
}

export default class KinematicCollider {
  readonly object: THREE.Object3D;
  mergedMesh: THREE.Mesh | null = null;
  private helper: MeshBVHHelper | null = null;
  private helperDepth = -1;
  private helperMesh: THREE.Mesh | null = null;
  private helperScene: THREE.Scene | undefined;
  private temporaryMeshes: THREE.Mesh[] = [];
  private options: RequiredKinematicColliderProps;
  private readonly prevPosition = new THREE.Vector3();
  private readonly prevQuaternion = new THREE.Quaternion();
  private readonly currentPosition = new THREE.Vector3();
  private readonly currentQuaternion = new THREE.Quaternion();
  private readonly linearVelocity = new THREE.Vector3();
  private readonly angularVelocity = new THREE.Vector3();
  private readonly prevAngularVelocity = new THREE.Vector3();
  private readonly rotationAxis = new THREE.Vector3();
  private readonly deltaPos = new THREE.Vector3();
  private readonly deltaQuat = new THREE.Quaternion();
  private readonly invertPrevQuaternion = new THREE.Quaternion();

  constructor(object: THREE.Object3D, options: KinematicColliderProps = {}) {
    this.object = object;
    this.options = resolveKinematicOptions(options);
    applyObject3DOptions(object, options);
    this.rebuild();
  }

  rebuild() {
    this.disposeGenerated();
    const { geometry, temporaryMeshes } = buildMergedGeometry(
      this.object,
      this.options.BVHOptions,
      "local"
    );
    this.temporaryMeshes = temporaryMeshes;
    if (!geometry) {
      console.warn("No compatible meshes found for kinematic geometry generation.");
      return;
    }

    this.mergedMesh = createColliderMesh(
      geometry,
      this.createUserData(),
      this.options.bvhName
    );
    this.syncTransform();
    this.prevPosition.copy(this.currentPosition);
    this.prevQuaternion.copy(this.currentQuaternion);
    this.updateHelper();
  }

  update(delta: number, options: Partial<KinematicColliderProps> = {}) {
    const hasOptions = Object.keys(options).length > 0;
    if (options.BVHOptions !== undefined) {
      this.options = resolveKinematicOptions({ ...this.options, ...options });
      applyObject3DOptions(this.object, options);
      this.rebuild();
      return;
    }
    if (hasOptions) {
      this.options = resolveKinematicOptions({ ...this.options, ...options });
      applyObject3DOptions(this.object, options);
    }
    if (!this.mergedMesh) return;

    if (hasOptions) {
      updateColliderUserData(
        this.mergedMesh,
        {
          active: this.options.active,
          restitution: this.options.restitution,
          friction: this.options.friction,
          excludeFloatHit: this.options.excludeFloatHit,
          excludeCollisionCheck: this.options.excludeCollisionCheck,
        },
        this.options.bvhName,
        this.object.visible
      );
      this.updateHelper();
    }
    this.updateKinematics(Math.max(delta, 1e-6), this.options.active);
  }

  dispose() {
    this.disposeGenerated();
  }

  private createUserData() {
    return {
      active: this.options.active,
      restitution: this.options.restitution,
      friction: this.options.friction,
      excludeFloatHit: this.options.excludeFloatHit,
      excludeCollisionCheck: this.options.excludeCollisionCheck,
      type: "KINEMATIC" as const,
      deltaPos: new THREE.Vector3(),
      deltaQuat: new THREE.Quaternion(),
      rotationAxis: new THREE.Vector3(),
      rotationAngle: 0,
      linearVelocity: new THREE.Vector3(),
      angularVelocity: new THREE.Vector3(),
      center: new THREE.Vector3(),
    };
  }

  private updateKinematics(delta: number, active: boolean) {
    if (!this.mergedMesh) return;
    this.prevPosition.copy(this.currentPosition);
    this.prevQuaternion.copy(this.currentQuaternion);
    this.syncTransform();
    if (!active) {
      this.deltaPos.set(0, 0, 0);
      this.deltaQuat.identity();
      this.rotationAxis.set(0, 0, 0);
      this.linearVelocity.set(0, 0, 0);
      this.angularVelocity.set(0, 0, 0);
      this.prevAngularVelocity.set(0, 0, 0);
      Object.assign(this.mergedMesh.userData, {
        deltaPos: this.deltaPos,
        deltaQuat: this.deltaQuat,
        rotationAxis: this.rotationAxis,
        rotationAngle: 0,
        linearVelocity: this.linearVelocity,
        angularVelocity: this.angularVelocity,
        center: this.currentPosition,
      });
      return;
    }

    this.deltaPos.copy(this.currentPosition).sub(this.prevPosition);
    this.linearVelocity.copy(this.deltaPos).divideScalar(delta);
    this.invertPrevQuaternion.copy(this.prevQuaternion).invert();
    this.deltaQuat.copy(this.currentQuaternion).multiply(this.invertPrevQuaternion);
    if (this.deltaQuat.w < 0) {
      this.deltaQuat.x *= -1;
      this.deltaQuat.y *= -1;
      this.deltaQuat.z *= -1;
      this.deltaQuat.w *= -1;
    }
    this.deltaQuat.normalize();

    const rotationAngle = 2 * Math.acos(THREE.MathUtils.clamp(this.deltaQuat.w, -1, 1));
    if (rotationAngle > 1e-6) {
      const sinHalfAngle = Math.sin(rotationAngle / 2);
      this.rotationAxis
        .set(
          this.deltaQuat.x / sinHalfAngle,
          this.deltaQuat.y / sinHalfAngle,
          this.deltaQuat.z / sinHalfAngle
        )
        .normalize();
    } else {
      this.rotationAxis.set(0, 0, 0);
    }

    this.angularVelocity
      .copy(this.rotationAxis)
      .multiplyScalar(rotationAngle / delta)
      .lerp(this.prevAngularVelocity, 0.3);
    this.prevAngularVelocity.copy(this.angularVelocity);
    Object.assign(this.mergedMesh.userData, {
      deltaPos: this.deltaPos,
      deltaQuat: this.deltaQuat,
      rotationAxis: this.rotationAxis,
      rotationAngle,
      linearVelocity: this.linearVelocity,
      angularVelocity: this.angularVelocity,
      center: this.currentPosition,
    });
  }

  private syncTransform() {
    if (!this.mergedMesh) return;
    this.object.updateMatrixWorld(true);
    this.mergedMesh.matrix.copy(this.object.matrixWorld);
    this.mergedMesh.matrix.decompose(
      this.mergedMesh.position,
      this.mergedMesh.quaternion,
      this.mergedMesh.scale
    );
    this.mergedMesh.updateMatrixWorld(true);
    this.mergedMesh.getWorldPosition(this.currentPosition);
    this.mergedMesh.getWorldQuaternion(this.currentQuaternion);
  }

  private disposeGenerated() {
    disposeBvhHelper(this.helper);
    this.helper = null;
    this.helperDepth = -1;
    this.helperMesh = null;
    this.helperScene = undefined;
    disposeColliderMesh(this.mergedMesh);
    this.mergedMesh = null;
    disposeTemporaryMeshes(this.temporaryMeshes);
  }

  private updateHelper() {
    if (!this.options.debug || !this.mergedMesh) {
      disposeBvhHelper(this.helper);
      this.helper = null;
      this.helperMesh = null;
      this.helperDepth = -1;
      this.helperScene = undefined;
      return;
    }
    if (
      this.helper &&
      this.helperMesh === this.mergedMesh &&
      this.helperDepth === this.options.debugVisualizeDepth &&
      this.helperScene === this.options.scene
    ) {
      return;
    }
    disposeBvhHelper(this.helper);
    this.helper = createBvhHelper(
      this.mergedMesh,
      this.options.scene,
      this.options.debugVisualizeDepth
    );
    this.helperMesh = this.mergedMesh;
    this.helperDepth = this.options.debugVisualizeDepth;
    this.helperScene = this.options.scene;
  }
}

type RequiredKinematicColliderProps = Required<
  Pick<
    KinematicColliderProps,
    | "debug"
    | "debugVisualizeDepth"
    | "bvhName"
    | "active"
    | "restitution"
    | "friction"
    | "excludeFloatHit"
    | "excludeCollisionCheck"
  >
> &
  Pick<KinematicColliderProps, "BVHOptions" | "scene">;

function resolveKinematicOptions(
  options: KinematicColliderProps
): RequiredKinematicColliderProps {
  return {
    debug: options.debug ?? COLLIDER_DEFAULTS.debug,
    debugVisualizeDepth:
      options.debugVisualizeDepth ?? COLLIDER_DEFAULTS.debugVisualizeDepth,
    bvhName: options.bvhName ?? "",
    active: options.active ?? true,
    restitution: options.restitution ?? COLLIDER_DEFAULTS.restitution,
    friction: options.friction ?? COLLIDER_DEFAULTS.friction,
    excludeFloatHit:
      options.excludeFloatHit ?? COLLIDER_DEFAULTS.excludeFloatHit,
    excludeCollisionCheck:
      options.excludeCollisionCheck ?? COLLIDER_DEFAULTS.excludeCollisionCheck,
    BVHOptions: options.BVHOptions,
    scene: options.scene,
  };
}
