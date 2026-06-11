/*!
 * BVHEcctrl
 * https://github.com/pmndrs/BVHEcctrl
 * (c) 2025 @ErdongChen-Andrew
 * Released under the MIT License.
 */

import type * as THREE from "three";
import type { SplitStrategy } from "three-mesh-bvh";
import { SAH } from "three-mesh-bvh";

export type Vector3Like =
  | THREE.Vector3
  | [x: number, y: number, z: number]
  | { x: number; y: number; z: number };

export type EulerLike =
  | THREE.Euler
  | [x: number, y: number, z: number, order?: THREE.EulerOrder]
  | { x: number; y: number; z: number; order?: THREE.EulerOrder };

export type QuaternionLike =
  | THREE.Quaternion
  | [x: number, y: number, z: number, w: number]
  | { x: number; y: number; z: number; w: number };

export type CssStyle = Partial<Record<keyof CSSStyleDeclaration, string>> &
  Record<string, string | number | undefined>;

export interface Object3DOptions {
  name?: string;
  visible?: boolean;
  position?: Vector3Like;
  rotation?: EulerLike;
  quaternion?: QuaternionLike;
  scale?: Vector3Like | number;
  userData?: Record<string, unknown>;
}

export interface BVHOptions {
  strategy?: SplitStrategy;
  verbose?: boolean;
  setBoundingBox?: boolean;
  maxDepth?: number;
  maxLeafSize?: number;
  indirect?: boolean;
}

export const DEFAULT_BVH_OPTIONS: Required<BVHOptions> = {
  strategy: SAH,
  verbose: false,
  setBoundingBox: true,
  maxDepth: 40,
  maxLeafSize: 10,
  indirect: false,
};

export type FloatCheckType = "RAYCAST" | "SHAPECAST" | "BOTH";

export type MovementInput = {
  forward?: boolean;
  backward?: boolean;
  leftward?: boolean;
  rightward?: boolean;
  joystick?: { x: number; y: number };
  run?: boolean;
  jump?: boolean;
};

export type CharacterAnimationStatus =
  | "IDLE"
  | "WALK"
  | "RUN"
  | "JUMP_START"
  | "JUMP_IDLE"
  | "JUMP_FALL"
  | "JUMP_LAND";

export interface CharacterStatus {
  position: THREE.Vector3;
  linvel: THREE.Vector3;
  quaternion: THREE.Quaternion;
  inputDir: THREE.Vector3;
  movingDir: THREE.Vector3;
  isOnGround: boolean;
  isOnMovingPlatform: boolean;
  animationStatus: CharacterAnimationStatus;
}

export interface EcctrlSettings {
  debug: boolean;
  colliderCapsuleArgs: [
    radius: number,
    length: number,
    capSegments: number,
    radialSegments: number,
  ];
  paused: boolean;
  delay: number;
  gravity: number;
  fallGravityFactor: number;
  maxFallSpeed: number;
  mass: number;
  sleepTimeout: number;
  slowMotionFactor: number;
  turnSpeed: number;
  maxWalkSpeed: number;
  maxRunSpeed: number;
  acceleration: number;
  deceleration: number;
  counterAccFactor: number;
  airDragFactor: number;
  walkAirDragFactor: number;
  jumpVel: number;
  floatCheckType: FloatCheckType;
  maxSlope: number;
  floatHeight: number;
  floatPullBackHeight: number;
  floatSensorRadius: number;
  floatSpringK: number;
  floatDampingC: number;
  collisionCheckIteration: number;
  collisionPushBackDamping: number;
  collisionPushBackThreshold: number;
}

export interface EcctrlOptions
  extends Partial<EcctrlSettings>,
    Object3DOptions {
  camera: THREE.Camera;
  scene?: THREE.Scene;
  children?: THREE.Object3D | THREE.Object3D[];
}

export type ResolvedEcctrlOptions = EcctrlOptions & EcctrlSettings;

export interface EcctrlOptionsUpdateResult {
  options: ResolvedEcctrlOptions;
  walkAirDragFactorLinked: boolean;
}

export interface BVHEcctrlApi {
  group: THREE.Group;
  model: THREE.Group;
  resetLinVel: () => void;
  addLinVel: (v: THREE.Vector3) => void;
  setLinVel: (v: THREE.Vector3) => void;
  setMovement: (input: MovementInput) => void;
  setOptions: (options: Partial<EcctrlOptions>) => void;
  add: (child: THREE.Object3D) => void;
  remove: (child: THREE.Object3D) => void;
  update: (delta: number, elapsedTime?: number) => void;
  dispose: () => void;
}

export const DEFAULT_ECCTRL_SETTINGS: EcctrlSettings = {
  debug: false,
  colliderCapsuleArgs: [0.3, 0.6, 4, 8],
  paused: false,
  delay: 1.5,
  gravity: 9.81,
  fallGravityFactor: 4,
  maxFallSpeed: 50,
  mass: 1,
  sleepTimeout: 10,
  slowMotionFactor: 1,
  turnSpeed: 15,
  maxWalkSpeed: 3,
  maxRunSpeed: 5,
  acceleration: 30,
  deceleration: 20,
  counterAccFactor: 0.5,
  airDragFactor: 0.3,
  walkAirDragFactor: 0.3,
  jumpVel: 5,
  floatCheckType: "BOTH",
  maxSlope: 1,
  floatHeight: 0.2,
  floatPullBackHeight: 0.25,
  floatSensorRadius: 0.12,
  floatSpringK: 600,
  floatDampingC: 28,
  collisionCheckIteration: 3,
  collisionPushBackDamping: 0.1,
  collisionPushBackThreshold: 0.05,
};

export function resolveEcctrlOptions(
  options: EcctrlOptions
): ResolvedEcctrlOptions {
  const resolved = { ...DEFAULT_ECCTRL_SETTINGS, ...options };
  if (options.walkAirDragFactor === undefined) {
    resolved.walkAirDragFactor = resolved.airDragFactor;
  }
  return resolved;
}

export function resolveEcctrlOptionsUpdate(
  current: ResolvedEcctrlOptions,
  options: Partial<EcctrlOptions>,
  walkAirDragFactorLinked: boolean
): EcctrlOptionsUpdateResult {
  const nextOptions = {
    ...current,
    ...options,
    camera: options.camera ?? current.camera,
  };
  const nextWalkAirDragFactorLinked =
    options.walkAirDragFactor === undefined ? walkAirDragFactorLinked : false;
  if (
    options.airDragFactor !== undefined &&
    nextWalkAirDragFactorLinked
  ) {
    nextOptions.walkAirDragFactor = options.airDragFactor;
  }
  return {
    options: resolveEcctrlOptions(nextOptions),
    walkAirDragFactorLinked: nextWalkAirDragFactorLinked,
  };
}
