/*!
 * BVHEcctrl
 * https://github.com/pmndrs/BVHEcctrl
 * (c) 2025 @ErdongChen-Andrew
 * Released under the MIT License.
 */

import * as THREE from "three";
import { BVHEcctrlState } from "./BVHEcctrlState";
import {
  handleCollisionResponse,
  handleFloatingResponse,
} from "./BVHEcctrlCollision";
import {
  disposeDebugObjects,
  syncDebugObjects,
  updateDebugger,
} from "./BVHEcctrlDebug";
import {
  applyGravity,
  applyMovementInput,
  checkCharacterSleep,
  handleCharacterMovement,
  setInputDirection,
  updateCharacterStatus,
  updateCharacterWithPlatform,
  updateSegmentBBox,
} from "./BVHEcctrlMovement";
import { characterStatus } from "./CharacterStatus";
import { addChildren, applyObject3DOptions } from "./Object3DUtils";
import { useButtonStore } from "./stores/ButtonStore";
import { useEcctrlStore } from "./stores/EcctrlStore";
import { useJoystickStore } from "./stores/JoystickStore";
import type {
  BVHEcctrlApi,
  CharacterStatus,
  EcctrlOptions,
  MovementInput,
} from "./Types";
import { resolveEcctrlOptions, resolveEcctrlOptionsUpdate } from "./Types";

export default class BVHEcctrl implements BVHEcctrlApi {
  private readonly state: BVHEcctrlState;
  private readonly unsubscribeJoystick: () => void;
  private walkAirDragFactorLinked: boolean;

  constructor(options: EcctrlOptions) {
    this.walkAirDragFactorLinked = options.walkAirDragFactor === undefined;
    this.state = new BVHEcctrlState(resolveEcctrlOptions(options));
    applyObject3DOptions(this.state.group, options);
    addChildren(this.state.model, options.children);
    this.unsubscribeJoystick = useJoystickStore.subscribe((joystickState) => {
      this.state.joystickState.set(
        joystickState.joystickX,
        joystickState.joystickY
      );
    });
    syncDebugObjects(this.state);
  }

  get group() {
    return this.state.group;
  }

  get model() {
    return this.state.model;
  }

  resetLinVel() {
    this.state.currentLinVel.set(0, 0, 0);
  }

  addLinVel(velocity: THREE.Vector3) {
    this.state.currentLinVel.add(velocity);
  }

  setLinVel(velocity: THREE.Vector3) {
    this.state.currentLinVel.copy(velocity);
  }

  setMovement(input: MovementInput) {
    applyMovementInput(this.state, input);
  }

  setOptions(options: Partial<EcctrlOptions>) {
    const next = resolveEcctrlOptionsUpdate(
      this.state.options,
      options,
      this.walkAirDragFactorLinked
    );
    this.state.options = next.options;
    this.walkAirDragFactorLinked = next.walkAirDragFactorLinked;
    applyObject3DOptions(this.state.group, options);
    this.state.refreshDerivedOptions();
    syncDebugObjects(this.state);
  }

  add(child: THREE.Object3D) {
    this.state.model.add(child);
  }

  remove(child: THREE.Object3D) {
    this.state.model.remove(child);
  }

  update(delta: number, elapsedTime = this.state.elapsedTime + delta) {
    this.state.elapsedTime = elapsedTime;
    if (this.state.options.paused || elapsedTime < this.state.options.delay) {
      return;
    }

    const deltaTime =
      Math.min(1 / 45, delta) * this.state.options.slowMotionFactor;
    const { buttons } = useButtonStore.getState();
    const forward = this.state.forwardState;
    const backward = this.state.backwardState;
    const leftward = this.state.leftwardState;
    const rightward = this.state.rightwardState;
    const run = this.state.runState || buttons.run;
    //const run = true;
    const jump = this.state.jumpState || buttons.jump;

    setInputDirection(this.state, {
      forward,
      backward,
      leftward,
      rightward,
      joystick: this.state.joystickState,
    });
    handleCharacterMovement(this.state, run, deltaTime);
    if (jump && this.state.isOnGround) {
      this.state.currentLinVel.y = this.state.options.jumpVel;
    }
    this.state.movingDir.copy(this.state.currentLinVel).normalize();
    this.state.currentLinVelOnPlane
      .copy(this.state.currentLinVel)
      .projectOnPlane(this.state.upAxis);
    checkCharacterSleep(this.state, jump, deltaTime);

    if (!this.state.isSleeping) {
      if (!this.state.isOnGround) applyGravity(this.state, deltaTime);
      updateSegmentBBox(this.state);
      const colliderMeshesArray = useEcctrlStore.getState().colliderMeshesArray;
      handleCollisionResponse(this.state, colliderMeshesArray, deltaTime);
      handleFloatingResponse(this.state, colliderMeshesArray, jump, deltaTime);
      updateCharacterWithPlatform(this.state);
      this.state.group.position.addScaledVector(
        this.state.currentLinVel,
        deltaTime
      );
      this.state.group.updateMatrixWorld(true);
      updateCharacterStatus(this.state, run, jump);
      this.state.prevIsOnGround = this.state.isOnGround;
    }

    if (this.state.options.debug) updateDebugger(this.state);
  }

  dispose() {
    this.unsubscribeJoystick();
    disposeDebugObjects(this.state);
    this.state.group.remove(this.state.model);
    this.state.model.clear();
  }
}

export { characterStatus };
export type EcctrlProps = EcctrlOptions;
export type { BVHEcctrlApi, CharacterStatus };
