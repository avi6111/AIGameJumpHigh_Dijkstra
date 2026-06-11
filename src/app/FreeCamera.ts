import * as THREE from "three/webgpu";

const FREE_CAMERA_SPEED = 7;
const FREE_CAMERA_FAST_MULTIPLIER = 3;
const FREE_CAMERA_WHEEL_SPEED = 0.01;
const WORLD_UP = new THREE.Vector3(0, 1, 0);

export interface FreeCameraInput {
  forward: boolean;
  backward: boolean;
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
  fast: boolean;
}

export interface FreeCameraKeyboardInput {
  input: FreeCameraInput;
  setInputEnabled(enabled: boolean): void;
  dispose(): void;
}

export interface FreeCameraScratch {
  forward: THREE.Vector3;
  right: THREE.Vector3;
  movement: THREE.Vector3;
  lookAt: THREE.Vector3;
}

export function createFreeCameraKeyboardInput(): FreeCameraKeyboardInput {
  let inputEnabled = false;
  const input: FreeCameraInput = {
    forward: false,
    backward: false,
    left: false,
    right: false,
    up: false,
    down: false,
    fast: false,
  };

  const onKeyChange = (event: KeyboardEvent) => {
    if (!inputEnabled || isEditableEventTarget(event.target)) return;
    const active = event.type === "keydown";
    if (!setFreeCameraKey(input, event.code, active)) return;
    event.preventDefault();
  };

  const reset = () => resetFreeCameraInput(input);
  const onVisibilityChange = () => {
    if (document.hidden) reset();
  };

  window.addEventListener("keydown", onKeyChange);
  window.addEventListener("keyup", onKeyChange);
  window.addEventListener("blur", reset);
  document.addEventListener("visibilitychange", onVisibilityChange);

  return {
    input,
    setInputEnabled(enabled) {
      inputEnabled = enabled;
      if (!enabled) reset();
    },
    dispose() {
      window.removeEventListener("keydown", onKeyChange);
      window.removeEventListener("keyup", onKeyChange);
      window.removeEventListener("blur", reset);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    },
  };
}

export function createFreeCameraScratch(): FreeCameraScratch {
  return {
    forward: new THREE.Vector3(),
    right: new THREE.Vector3(),
    movement: new THREE.Vector3(),
    lookAt: new THREE.Vector3(),
  };
}

export function updateFreeCamera(
  camera: THREE.PerspectiveCamera,
  position: THREE.Vector3,
  input: FreeCameraInput,
  yaw: number,
  pitch: number,
  delta: number,
  scratch: FreeCameraScratch
) {
  updateFreeCameraBasis(scratch, yaw, pitch);
  scratch.movement.set(0, 0, 0);
  if (input.forward) scratch.movement.add(scratch.forward);
  if (input.backward) scratch.movement.sub(scratch.forward);
  if (input.right) scratch.movement.add(scratch.right);
  if (input.left) scratch.movement.sub(scratch.right);
  if (input.up) scratch.movement.add(WORLD_UP);
  if (input.down) scratch.movement.sub(WORLD_UP);
  if (scratch.movement.lengthSq() > 0) {
    const speed =
      FREE_CAMERA_SPEED * (input.fast ? FREE_CAMERA_FAST_MULTIPLIER : 1);
    position.addScaledVector(scratch.movement.normalize(), speed * delta);
  }
  applyFreeCameraPose(camera, position, scratch);
}

export function moveFreeCameraByWheel(
  position: THREE.Vector3,
  yaw: number,
  pitch: number,
  deltaY: number,
  scratch: FreeCameraScratch
) {
  updateFreeCameraBasis(scratch, yaw, pitch);
  position.addScaledVector(scratch.forward, -deltaY * FREE_CAMERA_WHEEL_SPEED);
}

function updateFreeCameraBasis(
  scratch: FreeCameraScratch,
  yaw: number,
  pitch: number
) {
  scratch.forward.set(
    -Math.sin(yaw) * Math.cos(pitch),
    -Math.sin(pitch),
    -Math.cos(yaw) * Math.cos(pitch)
  );
  scratch.right.crossVectors(scratch.forward, WORLD_UP);
  if (scratch.right.lengthSq() <= 1e-8) {
    scratch.right.set(1, 0, 0);
  } else {
    scratch.right.normalize();
  }
}

function applyFreeCameraPose(
  camera: THREE.PerspectiveCamera,
  position: THREE.Vector3,
  scratch: FreeCameraScratch
) {
  camera.position.copy(position);
  camera.lookAt(scratch.lookAt.copy(position).add(scratch.forward));
}

function setFreeCameraKey(
  input: FreeCameraInput,
  code: string,
  active: boolean
) {
  if (code === "KeyW" || code === "ArrowUp") input.forward = active;
  else if (code === "KeyS" || code === "ArrowDown") input.backward = active;
  else if (code === "KeyA" || code === "ArrowLeft") input.left = active;
  else if (code === "KeyD" || code === "ArrowRight") input.right = active;
  else if (code === "KeyE" || code === "PageUp") input.up = active;
  else if (code === "KeyQ" || code === "PageDown") input.down = active;
  else if (code === "ShiftLeft" || code === "ShiftRight") input.fast = active;
  else return false;
  return true;
}

function resetFreeCameraInput(input: FreeCameraInput) {
  input.forward = false;
  input.backward = false;
  input.left = false;
  input.right = false;
  input.up = false;
  input.down = false;
  input.fast = false;
}

function isEditableEventTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.isContentEditable ||
    target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA" ||
    target.tagName === "SELECT"
  );
}
