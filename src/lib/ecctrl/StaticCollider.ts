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
  hasColliderGeometryAffectingOptions,
  updateColliderUserData,
} from "./ColliderUtils";
import { applyObject3DOptions } from "./Object3DUtils";
import type { BVHOptions, Object3DOptions } from "./Types";

export interface StaticColliderProps extends Object3DOptions {
  debug?: boolean;
  debugVisualizeDepth?: number;
  bvhName?: string;
  restitution?: number;
  friction?: number;
  excludeFloatHit?: boolean;
  excludeCollisionCheck?: boolean;
  BVHOptions?: BVHOptions;
  scene?: THREE.Scene;
}

export default class StaticCollider {
  readonly object: THREE.Object3D;
  mergedMesh: THREE.Mesh | null = null;
  private helper: MeshBVHHelper | null = null;
  private temporaryMeshes: THREE.Mesh[] = [];
  private options: RequiredStaticColliderProps;

  constructor(object: THREE.Object3D, options: StaticColliderProps = {}) {
    this.object = object;
    this.options = resolveStaticOptions(options);
    applyObject3DOptions(object, options);
    this.rebuild();
  }
  //#region 必然重建碰撞体
  rebuild() {
    this.disposeGenerated();
    //根本没有写这个方法在哪里//ColliderUtils.ts :27-58
    const { geometry, temporaryMeshes } = buildMergedGeometry(
      this.object,
      this.options.BVHOptions
    );
    this.temporaryMeshes = temporaryMeshes;
    if (!geometry) {
      console.warn("No compatible meshes found for static geometry generation.");
      return;
    }

    this.mergedMesh = createColliderMesh(
      geometry,
      {
        restitution: this.options.restitution,
        friction: this.options.friction,
        excludeFloatHit: this.options.excludeFloatHit,
        excludeCollisionCheck: this.options.excludeCollisionCheck,
        type: "STATIC",
      },
      this.options.bvhName
    );
    this.mergedMesh.visible = this.object.visible;
    this.updateHelper();
  }

  update(options: Partial<StaticColliderProps> = {}) {
    this.options = resolveStaticOptions({ ...this.options, ...options });
    applyObject3DOptions(this.object, options);
    if (hasColliderGeometryAffectingOptions(options)) {
      this.rebuild();
      return;
    }
    if (this.mergedMesh) {
      updateColliderUserData(
        this.mergedMesh,
        {
          restitution: this.options.restitution,
          friction: this.options.friction,
          excludeFloatHit: this.options.excludeFloatHit,
          excludeCollisionCheck: this.options.excludeCollisionCheck,
        },
        this.options.bvhName,
        this.object.visible
      );
    }
    this.updateHelper();
  }

  dispose() {
    this.disposeGenerated();
  }

  private disposeGenerated() {
    disposeBvhHelper(this.helper);
    this.helper = null;
    disposeColliderMesh(this.mergedMesh);
    this.mergedMesh = null;
    disposeTemporaryMeshes(this.temporaryMeshes);
  }

  private updateHelper() {
    disposeBvhHelper(this.helper);
    this.helper = null;
    if (this.options.debug && this.mergedMesh) {
      this.helper = createBvhHelper(
        this.mergedMesh,
        this.options.scene,
        this.options.debugVisualizeDepth
      );
    }
  }
}

type RequiredStaticColliderProps = Required<
  Pick<
    StaticColliderProps,
    | "debug"
    | "debugVisualizeDepth"
    | "bvhName"
    | "restitution"
    | "friction"
    | "excludeFloatHit"
    | "excludeCollisionCheck"
  >
> &
  Pick<StaticColliderProps, "BVHOptions" | "scene">;

function resolveStaticOptions(
  options: StaticColliderProps
): RequiredStaticColliderProps {
  return {
    debug: options.debug ?? COLLIDER_DEFAULTS.debug,
    debugVisualizeDepth:
      options.debugVisualizeDepth ?? COLLIDER_DEFAULTS.debugVisualizeDepth,
    bvhName: options.bvhName ?? "",
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
