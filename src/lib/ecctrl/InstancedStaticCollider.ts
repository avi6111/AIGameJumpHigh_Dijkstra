/*!
 * BVHEcctrl
 * https://github.com/pmndrs/BVHEcctrl
 * (c) 2025 @ErdongChen-Andrew
 * Released under the MIT License.
 */

import * as THREE from "three";
import type { MeshBVHHelper } from "three-mesh-bvh";
import {
  cloneColliderGeometry,
  COLLIDER_DEFAULTS,
  createBvhHelper,
  disposeBvhHelper,
  disposeColliderMesh,
  hasColliderGeometryAffectingOptions,
  registerColliderMesh,
  updateColliderUserData,
} from "./ColliderUtils";
import { applyObject3DOptions } from "./Object3DUtils";
import {
  DEFAULT_BVH_OPTIONS,
  type BVHOptions,
  type Object3DOptions,
} from "./Types";
import { computeBoundsTree } from "three-mesh-bvh";

export interface InstancedStaticColliderProps extends Object3DOptions {
  debug?: boolean;
  debugVisualizeDepth?: number;
  restitution?: number;
  friction?: number;
  excludeFloatHit?: boolean;
  excludeCollisionCheck?: boolean;
  BVHOptions?: BVHOptions;
  scene?: THREE.Scene;
}

export default class InstancedStaticCollider {
  readonly object: THREE.Object3D;
  readonly mergedMeshes: THREE.InstancedMesh[] = [];
  private readonly helpers: MeshBVHHelper[] = [];
  private readonly tempMatrix = new THREE.Matrix4();
  private options: RequiredInstancedStaticColliderProps;

  constructor(object: THREE.Object3D, options: InstancedStaticColliderProps = {}) {
    this.object = object;
    this.options = resolveInstancedOptions(options);
    applyObject3DOptions(object, options);
    this.rebuild();
  }

  rebuild() {
    this.dispose();
    this.object.updateMatrixWorld(true);
    this.object.traverse((child) => {
      if (!(child instanceof THREE.InstancedMesh)) return;
      const cleanGeometry = cloneColliderGeometry(child.geometry);
      if (!cleanGeometry) return;
      computeBoundsTree.call(cleanGeometry, {
        ...DEFAULT_BVH_OPTIONS,
        ...this.options.BVHOptions,
      });

      const mergedMesh = new THREE.InstancedMesh(
        cleanGeometry,
        undefined,
        child.count
      );
      for (let i = 0; i < child.count; i++) {
        child.getMatrixAt(i, this.tempMatrix);
        this.tempMatrix.premultiply(child.matrixWorld);
        mergedMesh.setMatrixAt(i, this.tempMatrix);
      }
      mergedMesh.instanceMatrix.needsUpdate = true;
      mergedMesh.visible = this.object.visible;
      registerColliderMesh(mergedMesh, {
        restitution: this.options.restitution,
        friction: this.options.friction,
        excludeFloatHit: this.options.excludeFloatHit,
        excludeCollisionCheck: this.options.excludeCollisionCheck,
        type: "STATIC",
      });
      this.mergedMeshes.push(mergedMesh);
    });
    this.updateHelpers();
  }

  update(options: Partial<InstancedStaticColliderProps> = {}) {
    this.options = resolveInstancedOptions({ ...this.options, ...options });
    applyObject3DOptions(this.object, options);
    if (hasColliderGeometryAffectingOptions(options)) {
      this.rebuild();
      return;
    }
    for (const mesh of this.mergedMeshes) {
      updateColliderUserData(
        mesh,
        {
          restitution: this.options.restitution,
          friction: this.options.friction,
          excludeFloatHit: this.options.excludeFloatHit,
          excludeCollisionCheck: this.options.excludeCollisionCheck,
        },
        undefined,
        this.object.visible
      );
    }
    this.updateHelpers();
  }

  dispose() {
    for (const helper of this.helpers) disposeBvhHelper(helper);
    this.helpers.length = 0;
    for (const mesh of this.mergedMeshes) disposeColliderMesh(mesh);
    this.mergedMeshes.length = 0;
  }

  private updateHelpers() {
    for (const helper of this.helpers) disposeBvhHelper(helper);
    this.helpers.length = 0;
    if (!this.options.debug) return;
    for (const mesh of this.mergedMeshes) {
      const helper = createBvhHelper(
        mesh,
        this.options.scene,
        this.options.debugVisualizeDepth
      );
      if (helper) this.helpers.push(helper);
    }
  }
}

type RequiredInstancedStaticColliderProps = Required<
  Pick<
    InstancedStaticColliderProps,
    | "debug"
    | "debugVisualizeDepth"
    | "restitution"
    | "friction"
    | "excludeFloatHit"
    | "excludeCollisionCheck"
  >
> &
  Pick<InstancedStaticColliderProps, "BVHOptions" | "scene">;

function resolveInstancedOptions(
  options: InstancedStaticColliderProps
): RequiredInstancedStaticColliderProps {
  return {
    debug: options.debug ?? COLLIDER_DEFAULTS.debug,
    debugVisualizeDepth:
      options.debugVisualizeDepth ?? COLLIDER_DEFAULTS.debugVisualizeDepth,
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
