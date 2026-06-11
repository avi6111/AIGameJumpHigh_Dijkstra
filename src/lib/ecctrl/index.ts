/*!
 * BVHEcctrl
 * https://github.com/pmndrs/BVHEcctrl
 * (c) 2025 @ErdongChen-Andrew
 * Released under the MIT License.
 */

import BVHEcctrl from "./BVHEcctrl";
export default BVHEcctrl;

export { characterStatus } from "./BVHEcctrl";
export type { BVHEcctrlApi } from "./BVHEcctrl";
export type { EcctrlProps } from "./BVHEcctrl";
export type { CharacterStatus } from "./BVHEcctrl";
export type {
  BVHOptions,
  CharacterAnimationStatus,
  CssStyle,
  EcctrlOptions,
  FloatCheckType,
  MovementInput,
  Object3DOptions,
} from "./Types";

export { default as StaticCollider } from "./StaticCollider";
export type { StaticColliderProps } from "./StaticCollider";

export { default as KinematicCollider } from "./KinematicCollider";
export type { KinematicColliderProps } from "./KinematicCollider";

export { default as InstancedStaticCollider } from "./InstancedStaticCollider";
export type { InstancedStaticColliderProps } from "./InstancedStaticCollider";

export { default as Joystick } from "./Joystick";
export type { JoystickProps } from "./Joystick";

export { default as VirtualButton } from "./VirtualButton";
export type { VirtualButtonProps } from "./VirtualButton";

export { default as GamepadControls } from "./GamepadControls";
export type { GamepadControlsProps } from "./GamepadControls";

export { useEcctrlStore } from "./stores/EcctrlStore";
export type { StoreState } from "./stores/EcctrlStore";

export { useJoystickStore } from "./stores/JoystickStore";
export type { JoystickStoreState } from "./stores/JoystickStore";

export { useButtonStore } from "./stores/ButtonStore";
export type { ButtonStoreState } from "./stores/ButtonStore";

export { useGamepadCameraStore } from "./stores/GamepadCameraStore";
export type { GamepadCameraStoreState } from "./stores/GamepadCameraStore";

export { useAnimationStore } from "./stores/AnimationStore";
export type { AnimationStoreState } from "./stores/AnimationStore";
