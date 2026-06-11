import * as THREE from "three/webgpu";
import { useEcctrlStore, useGamepadCameraStore } from "../lib/ecctrl/index";
import {
  createCameraCollisionScratch,
  resolveCameraCollisionDistance,
  updateCameraCollisionProbePoints,
  type CameraCollisionScratch,
} from "./CameraCollision";
import {
  createFreeCameraKeyboardInput,
  createFreeCameraScratch,
  moveFreeCameraByWheel,
  updateFreeCamera,
} from "./FreeCamera";

export {
  createCameraCollisionScratch,
  resolveCameraCollisionDistance,
  updateCameraCollisionProbePoints,
  type CameraCollisionScratch,
} from "./CameraCollision";

const DEFAULT_CAMERA_SETTINGS = {
  collisionEnabled: true,
  collisionPadding: 0.02,
  minDistance: 0.8,
  maxDistance: 14,
  minPitch: THREE.MathUtils.degToRad(-70),
  maxPitch: THREE.MathUtils.degToRad(85),
  targetYOffset: 0.3,
  modelVisibleDistance: 0.7,
};

const POINTER_YAW_SPEED = 0.006;
const POINTER_PITCH_SPEED = 0.004;
// Fraction of vertical offset remaining after 1s; smooths stair-step bounce.
const VERTICAL_FOLLOW_SMOOTHING_BASE = 0.01;
// Cap the smoothed Y lag so long falls and teleports never leave the camera behind.
const VERTICAL_FOLLOW_MAX_LAG = 1.0;

interface CameraRigTarget {
  group: THREE.Object3D;
  model: THREE.Object3D;
}

interface CameraRigSettings {
  collisionEnabled: boolean;
  collisionPadding: number;
  minDistance: number;
  maxDistance: number;
  minPitch: number;
  maxPitch: number;
  targetYOffset: number;
  modelVisibleDistance: number;
}

interface CameraRigState {
  inputEnabled: boolean;
  pointerInputEnabled: boolean;
  editMode: boolean;
  yaw: number;
  pitch: number;
  distance: number;
  followY: number | null;
  freePosition: THREE.Vector3;
  dragging: boolean;
  pointerId: number;
  pointerX: number;
  pointerY: number;
  settings: CameraRigSettings;
}

export interface CameraInspectorControls {
  collisionEnabled: boolean;
  collisionPadding: number;
  minDistance: number;
  maxDistance: number;
  minPitch: number;
  maxPitch: number;
  firstPerson(): void;
  lockPointer(): void;
}

export interface CameraRig {
  controls: CameraInspectorControls;
  resize(width: number, height: number): void;
  setEditMode(enabled: boolean): void;
  setInputEnabled(enabled: boolean): void;
  setPointerInputEnabled(enabled: boolean): void;
  update(delta: number): void;
  dispose(): void;
}

export function createCameraRig(
  camera: THREE.PerspectiveCamera,
  canvas: HTMLCanvasElement,
  target: CameraRigTarget
): CameraRig {
  const state: CameraRigState = {
    inputEnabled: true,
    pointerInputEnabled: true,
    editMode: false,
    yaw: 0,
    pitch: 0.35,
    distance: 3.5,
    followY: null,
    freePosition: new THREE.Vector3(),
    dragging: false,
    pointerId: -1,
    pointerX: 0,
    pointerY: 0,
    settings: { ...DEFAULT_CAMERA_SETTINGS },
  };
  const cameraTarget = new THREE.Vector3();
  const cameraOffset = new THREE.Vector3();
  const cameraDesiredPosition = new THREE.Vector3();
  const cameraCollisionPosition = new THREE.Vector3();
  const collisionScratch = createCameraCollisionScratch();
  const freeCameraInput = createFreeCameraKeyboardInput();
  const freeCameraScratch = createFreeCameraScratch();

  const onPointerDown = (event: PointerEvent) => {
    if (!state.inputEnabled || !state.pointerInputEnabled) return;
    state.dragging = true;
    state.pointerId = event.pointerId;
    state.pointerX = event.clientX;
    state.pointerY = event.clientY;
    canvas.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: PointerEvent) => {
    if (!state.pointerInputEnabled) return;
    if (!state.dragging || event.pointerId !== state.pointerId) return;
    rotateCameraByPixels(
      state,
      event.clientX - state.pointerX,
      event.clientY - state.pointerY
    );
    state.pointerX = event.clientX;
    state.pointerY = event.clientY;
  };

  const onPointerUp = (event: PointerEvent) => {
    if (event.pointerId !== state.pointerId) return;
    releasePointerCapture(state, canvas);
  };

  const onWheel = (event: WheelEvent) => {
    if (!state.inputEnabled) return;
    if (state.editMode) {
      moveFreeCameraByWheel(
        state.freePosition,
        state.yaw,
        state.pitch,
        event.deltaY,
        freeCameraScratch
      );
      return;
    }
    state.distance = clampCameraDistance(
      state,
      state.distance + event.deltaY * 0.004
    );
  };

  const onLockedMouseMove = (event: MouseEvent) => {
    if (!state.inputEnabled || !state.pointerInputEnabled) return;
    if (document.pointerLockElement !== canvas) return;
    rotateCameraByPixels(state, event.movementX, event.movementY);
  };

  canvas.addEventListener("pointerdown", onPointerDown);
  canvas.addEventListener("pointermove", onPointerMove);
  canvas.addEventListener("pointerup", onPointerUp);
  canvas.addEventListener("pointercancel", onPointerUp);
  canvas.addEventListener("wheel", onWheel, { passive: true });
  document.addEventListener("mousemove", onLockedMouseMove);

  const controls = createCameraControls(state, canvas);
  return {
    controls,
    resize(width, height) {
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    },
    setEditMode(enabled) {
      if (state.editMode === enabled) return;
      state.editMode = enabled;
      state.pointerInputEnabled = true;
      state.freePosition.copy(camera.position);
      freeCameraInput.setInputEnabled(enabled && state.inputEnabled);
      if (!enabled) releasePointerCapture(state, canvas);
      target.model.visible = true;
    },
    setInputEnabled(enabled) {
      state.inputEnabled = enabled;
      freeCameraInput.setInputEnabled(enabled && state.editMode);
      if (!enabled) {
        releasePointerCapture(state, canvas);
        if (document.pointerLockElement === canvas) {
          document.exitPointerLock();
        }
      }
    },
    setPointerInputEnabled(enabled) {
      state.pointerInputEnabled = enabled;
      if (!enabled) releasePointerCapture(state, canvas);
    },
    update(delta) {
      updateGamepadCamera(state, delta);
      if (state.editMode) {
        updateFreeCamera(
          camera,
          state.freePosition,
          freeCameraInput.input,
          state.yaw,
          state.pitch,
          delta,
          freeCameraScratch
        );
        target.model.visible = true;
        return;
      }
      const followY = smoothFollowY(state, target.group.position.y, delta);
      cameraTarget
        .copy(target.group.position)
        .setY(followY + state.settings.targetYOffset);
      cameraOffset.set(
        Math.sin(state.yaw) * Math.cos(state.pitch),
        Math.sin(state.pitch),
        Math.cos(state.yaw) * Math.cos(state.pitch)
      );
      cameraOffset.multiplyScalar(state.distance);
      cameraDesiredPosition.copy(cameraTarget).add(cameraOffset);
      camera.position.lerp(cameraDesiredPosition, 1 - Math.pow(0.001, delta));
      if (state.settings.collisionEnabled) {
        cameraCollisionPosition.copy(camera.position);
        applyCameraCollision(
          collisionScratch,
          cameraTarget,
          cameraCollisionPosition,
          camera,
          state
        );
        camera.position.copy(cameraCollisionPosition);
      }
      camera.lookAt(cameraTarget);
      target.model.visible =
        camera.position.distanceTo(cameraTarget) >
        state.settings.modelVisibleDistance;
    },
    dispose() {
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointercancel", onPointerUp);
      canvas.removeEventListener("wheel", onWheel);
      document.removeEventListener("mousemove", onLockedMouseMove);
      freeCameraInput.dispose();
      releasePointerCapture(state, canvas);
      if (document.pointerLockElement === canvas) {
        document.exitPointerLock();
      }
    },
  };
}

function updateGamepadCamera(state: CameraRigState, delta: number) {
  if (!state.inputEnabled) return;
  const { cameraActive, cameraX, cameraY } = useGamepadCameraStore.getState();
  if (!cameraActive) return;
  state.yaw -= cameraX * delta * 2.7;
  state.pitch = clampCameraPitch(state, state.pitch - cameraY * delta * 1.8);
}

function smoothFollowY(
  state: CameraRigState,
  targetY: number,
  delta: number
): number {
  if (state.followY === null) {
    state.followY = targetY;
    return targetY;
  }
  state.followY +=
    (targetY - state.followY) *
    (1 - Math.pow(VERTICAL_FOLLOW_SMOOTHING_BASE, delta));
  state.followY = THREE.MathUtils.clamp(
    state.followY,
    targetY - VERTICAL_FOLLOW_MAX_LAG,
    targetY + VERTICAL_FOLLOW_MAX_LAG
  );
  return state.followY;
}

function rotateCameraByPixels(
  state: CameraRigState,
  deltaX: number,
  deltaY: number
) {
  state.yaw -= deltaX * POINTER_YAW_SPEED;
  state.pitch = clampCameraPitch(
    state,
    state.pitch + deltaY * POINTER_PITCH_SPEED
  );
}

function applyCameraCollision(
  scratch: CameraCollisionScratch,
  target: THREE.Vector3,
  desiredPosition: THREE.Vector3,
  camera: THREE.PerspectiveCamera,
  state: CameraRigState
) {
  const desiredDistance = desiredPosition.distanceTo(target);
  updateCameraCollisionProbePoints(
    scratch,
    target,
    desiredPosition,
    desiredDistance,
    camera
  );
  const colliders = useEcctrlStore.getState().colliderMeshesArray;
  const distance = resolveCameraCollisionDistance(
    scratch.raycaster,
    scratch.hits,
    target,
    desiredPosition,
    desiredDistance,
    state.settings.collisionPadding,
    colliders,
    scratch.probePoints
  );
  if (distance >= desiredDistance) return;
  desiredPosition
    .subVectors(desiredPosition, target)
    .normalize()
    .multiplyScalar(clampCameraDistance(state, distance))
    .add(target);
}

function releasePointerCapture(
  state: CameraRigState,
  canvas: HTMLCanvasElement
) {
  if (state.pointerId !== -1 && canvas.hasPointerCapture(state.pointerId)) {
    canvas.releasePointerCapture(state.pointerId);
  }
  state.dragging = false;
  state.pointerId = -1;
}

function createCameraControls(
  state: CameraRigState,
  canvas: HTMLCanvasElement
): CameraInspectorControls {
  return {
    get collisionEnabled() {
      return state.settings.collisionEnabled;
    },
    set collisionEnabled(value) {
      state.settings.collisionEnabled = value;
    },
    get collisionPadding() {
      return state.settings.collisionPadding;
    },
    set collisionPadding(value) {
      state.settings.collisionPadding = Math.max(0, value);
    },
    get minDistance() {
      return state.settings.minDistance;
    },
    set minDistance(value) {
      state.settings.minDistance = Math.min(value, state.settings.maxDistance);
      state.distance = clampCameraDistance(state, state.distance);
    },
    get maxDistance() {
      return state.settings.maxDistance;
    },
    set maxDistance(value) {
      state.settings.maxDistance = Math.max(value, state.settings.minDistance);
      state.distance = clampCameraDistance(state, state.distance);
    },
    get minPitch() {
      return THREE.MathUtils.radToDeg(state.settings.minPitch);
    },
    set minPitch(value) {
      state.settings.minPitch = Math.min(
        THREE.MathUtils.degToRad(value),
        state.settings.maxPitch
      );
      state.pitch = clampCameraPitch(state, state.pitch);
    },
    get maxPitch() {
      return THREE.MathUtils.radToDeg(state.settings.maxPitch);
    },
    set maxPitch(value) {
      state.settings.maxPitch = Math.max(
        THREE.MathUtils.degToRad(value),
        state.settings.minPitch
      );
      state.pitch = clampCameraPitch(state, state.pitch);
    },
    firstPerson() {
      state.distance = state.settings.minDistance;
    },
    lockPointer() {
      void canvas.requestPointerLock();
    },
  };
}

function clampCameraDistance(state: CameraRigState, distance: number) {
  return THREE.MathUtils.clamp(
    distance,
    state.settings.minDistance,
    state.settings.maxDistance
  );
}

function clampCameraPitch(state: CameraRigState, pitch: number) {
  return THREE.MathUtils.clamp(
    pitch,
    state.settings.minPitch,
    state.settings.maxPitch
  );
}
