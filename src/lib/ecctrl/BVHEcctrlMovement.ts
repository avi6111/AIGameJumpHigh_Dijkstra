import * as THREE from "three";
import { characterStatus } from "./CharacterStatus";
import { useAnimationStore } from "./stores/AnimationStore";
import type { BVHEcctrlState } from "./BVHEcctrlState";
import type { CharacterAnimationStatus, MovementInput } from "./Types";

export function applyGravity(state: BVHEcctrlState, delta: number) {
  const { gravity, fallGravityFactor, maxFallSpeed } = state.options;
  state.gravityDir.copy(state.upAxis).negate();
  const fallingSpeed = state.currentLinVel.dot(state.gravityDir);
  state.isFalling = fallingSpeed > 0;
  if (fallingSpeed < maxFallSpeed) {
    state.currentLinVel.addScaledVector(
      state.gravityDir,
      gravity * (state.isFalling ? fallGravityFactor : 1) * delta
    );
  }
}

export function checkCharacterSleep(
  state: BVHEcctrlState,
  jump: boolean,
  delta: number
) {
  const moving = state.currentLinVel.lengthSq() > 1e-6;
  const platformIsMoving = state.totalPlatformDeltaPos.lengthSq() > 1e-6;
  if (
    !moving &&
    state.isOnGround &&
    !jump &&
    !state.isOnMovingPlatform &&
    !platformIsMoving
  ) {
    state.idleTime += delta;
    if (state.idleTime > state.options.sleepTimeout) state.isSleeping = true;
  } else {
    state.idleTime = 0;
    state.isSleeping = false;
  }
}

export function setInputDirection(
  state: BVHEcctrlState,
  dir: {
    forward?: boolean;
    backward?: boolean;
    leftward?: boolean;
    rightward?: boolean;
    joystick?: THREE.Vector2;
  }
) {
  state.inputDir.set(0, 0, 0);
  const joystickActive = !!dir.joystick && dir.joystick.lengthSq() > 0;
  if (
    !joystickActive &&
    !dir.forward &&
    !dir.backward &&
    !dir.leftward &&
    !dir.rightward
  ) {
    return;
  }

  state.options.camera.getWorldDirection(state.camProjDir);
  state.camProjDir.projectOnPlane(state.upAxis).normalize();
  state.camRightDir.crossVectors(state.camProjDir, state.upAxis).normalize();

  if (joystickActive && dir.joystick) {
    state.inputDir
      .addScaledVector(state.camProjDir, dir.joystick.y)
      .addScaledVector(state.camRightDir, dir.joystick.x);
  } else {
    if (dir.forward) state.inputDir.add(state.camProjDir);
    if (dir.backward) state.inputDir.sub(state.camProjDir);
    if (dir.leftward) state.inputDir.sub(state.camRightDir);
    if (dir.rightward) state.inputDir.add(state.camRightDir);
  }
  state.inputDir.normalize();
}

export function handleCharacterMovement(
  state: BVHEcctrlState,
  runState: boolean,
  delta: number
) {
  const friction = THREE.MathUtils.clamp(state.groundFriction, 0, 1);
  const {
    acceleration,
    deceleration,
    airDragFactor,
    counterAccFactor,
    maxRunSpeed,
    maxWalkSpeed,
    turnSpeed,
    walkAirDragFactor,
  } = state.options;

  if (state.inputDir.lengthSq() > 0) {
    state.inputDirOnPlane.copy(state.inputDir).projectOnPlane(state.upAxis);
    state.characterModelLookMatrix.lookAt(
      state.inputDirOnPlane,
      state.characterOrigin,
      state.upAxis
    );
    state.characterModelTargetQuat.setFromRotationMatrix(
      state.characterModelLookMatrix
    );
    state.model.quaternion.slerp(state.characterModelTargetQuat, delta * turnSpeed);

    const maxSpeed = runState ? maxRunSpeed : maxWalkSpeed;
    const airControlFactor = runState ? airDragFactor : walkAirDragFactor;
    state.wantToMoveVel.copy(state.inputDir).multiplyScalar(maxSpeed);
    const dot = state.movingDir.dot(state.inputDir);
    state.deltaLinVel.subVectors(
      state.wantToMoveVel,
      state.currentLinVelOnPlane
    );
    state.deltaLinVel.clampLength(
      0,
      (dot <= 0 ? 1 + counterAccFactor : 1) *
        acceleration *
        friction *
        delta *
        (state.isOnGround ? 1 : airControlFactor)
    );
    state.currentLinVel.add(state.deltaLinVel);
  } else if (state.isOnGround) {
    state.deltaLinVel
      .copy(state.currentLinVelOnPlane)
      .clampLength(0, deceleration * friction * delta);
    state.currentLinVel.sub(state.deltaLinVel);
  }
}

export function updateSegmentBBox(state: BVHEcctrlState) {
  const { floatHeight, floatPullBackHeight, floatSensorRadius } = state.options;
  state.characterSegment.start
    .set(0, state.capsuleLength / 2, 0)
    .add(state.group.position);
  state.characterSegment.end
    .set(0, -state.capsuleLength / 2, 0)
    .add(state.group.position);
  state.characterBbox
    .makeEmpty()
    .expandByPoint(state.characterSegment.start)
    .expandByPoint(state.characterSegment.end)
    .expandByScalar(state.capsuleRadius);
  state.floatSensorSegment.start.copy(state.characterSegment.end);
  state.floatSensorSegment.end
    .copy(state.floatSensorSegment.start)
    .addScaledVector(state.gravityDir, floatHeight + state.capsuleRadius);
  state.floatSensorBboxExpendPoint
    .copy(state.floatSensorSegment.end)
    .addScaledVector(state.gravityDir, floatPullBackHeight);
  state.floatSensorBbox
    .makeEmpty()
    .expandByPoint(state.floatSensorSegment.start)
    .expandByPoint(state.floatSensorBboxExpendPoint)
    .expandByScalar(floatSensorRadius);
}

export function updateCharacterWithPlatform(state: BVHEcctrlState) {
  const hitMesh = state.floatHitMesh;
  if (
    state.isOnGround &&
    hitMesh &&
    (hitMesh.userData.type === "STATIC" ||
      (hitMesh.userData.type === "KINEMATIC" && hitMesh.userData.active === false)) &&
    state.totalPlatformDeltaPos.lengthSq() > 0
  ) {
    state.totalPlatformDeltaPos.set(0, 0, 0);
    return;
  }

  if (!state.isOnGround && state.totalPlatformDeltaPos.lengthSq() > 0) {
    state.group.position.add(state.totalPlatformDeltaPos);
  }

  if (
    !state.isOnGround ||
    !hitMesh ||
    hitMesh.userData.type !== "KINEMATIC" ||
    hitMesh.userData.active === false
  ) {
    state.isOnMovingPlatform = false;
    return;
  }

  const center = hitMesh.userData.center as THREE.Vector3;
  const deltaPos = hitMesh.userData.deltaPos as THREE.Vector3;
  const deltaQuat = hitMesh.userData.deltaQuat as THREE.Quaternion;
  const rotationAxis = hitMesh.userData.rotationAxis as THREE.Vector3;
  const rotationAngle = hitMesh.userData.rotationAngle as number;
  state.isOnMovingPlatform = true;
  state.relativeHitPoint.copy(state.globalClosestPoint).sub(center);
  state.rotationDeltaPos
    .copy(state.relativeHitPoint)
    .applyQuaternion(deltaQuat)
    .sub(state.relativeHitPoint);
  state.totalPlatformDeltaPos.copy(state.rotationDeltaPos).add(deltaPos);
  state.group.position.add(state.totalPlatformDeltaPos);

  if (rotationAngle > 1e-6) {
    const projection = rotationAxis.dot(state.upAxis);
    if (Math.abs(projection) > 0.9) {
      state.yawQuaternion.setFromAxisAngle(state.upAxis, rotationAngle * projection);
      state.model.quaternion.premultiply(state.yawQuaternion);
    }
  }
}

export function updateCharacterStatus(
  state: BVHEcctrlState,
  run: boolean,
  jump: boolean
) {
  state.model.getWorldPosition(characterStatus.position);
  state.model.getWorldQuaternion(characterStatus.quaternion);
  characterStatus.linvel.copy(state.currentLinVel);
  characterStatus.inputDir.copy(state.inputDir);
  characterStatus.movingDir.copy(state.movingDir);
  characterStatus.isOnGround = state.isOnGround;
  characterStatus.isOnMovingPlatform = state.isOnMovingPlatform;
  characterStatus.animationStatus = updateCharacterAnimation(state, run, jump);
  if (state.prevAnimation !== characterStatus.animationStatus) {
    useAnimationStore.getState().setAnimationStatus(characterStatus.animationStatus);
    state.prevAnimation = characterStatus.animationStatus;
  }
}

export function applyMovementInput(
  state: BVHEcctrlState,
  movement: MovementInput
) {
  if (movement.forward !== undefined) state.forwardState = movement.forward;
  if (movement.backward !== undefined) state.backwardState = movement.backward;
  if (movement.leftward !== undefined) state.leftwardState = movement.leftward;
  if (movement.rightward !== undefined) state.rightwardState = movement.rightward;
  if (movement.joystick) state.joystickState.set(movement.joystick.x, movement.joystick.y);
  if (movement.run !== undefined) state.runState = state.runLock || movement.run;
  if (movement.jump !== undefined) state.jumpState = movement.jump;
}

function updateCharacterAnimation(
  state: BVHEcctrlState,
  run: boolean,
  jump: boolean
): CharacterAnimationStatus {
  if (state.isOnGround) {
    if (!state.prevIsOnGround) return "JUMP_LAND";
    if (state.inputDir.lengthSq() === 0) return "IDLE";
    return run ? "RUN" : "WALK";
  }
  if (state.prevIsOnGround && jump) return "JUMP_START";
  return state.isFalling ? "JUMP_FALL" : "JUMP_IDLE";
}
