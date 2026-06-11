import * as THREE from "three/webgpu";
import BVHEcctrl, {
  GamepadControls,
  Joystick,
  VirtualButton,
  useButtonStore,
  type MovementInput,
} from "../lib/ecctrl/index";
import { punchButtonId } from "../character/ActionContract";

const CONTROLLER_RUN_AIR_DRAG_FACTOR = 0.3;
const CONTROLLER_WALK_AIR_DRAG_FACTOR = 0.55;
const CONTROLLER_SPAWN_POSITION = new THREE.Vector3(0, 1.1, 8);
const MOUSE_PUNCH_SOURCE = "mouse";
const MOUSE_PUNCH_MAX_DRAG_PX = 6;

interface ControllerSettings {
  airDragFactor: number;
  walkAirDragFactor: number;
}

interface KeyboardMovementInput {
  input: MovementInput;
  setInputEnabled(enabled: boolean): void;
  dispose(): void;
}

interface DisposableControl {
  dispose(): void;
}

interface ToggleableControl extends DisposableControl {
  setInputEnabled(enabled: boolean): void;
}

interface MousePunchPress {
  button: number;
  x: number;
  y: number;
}

export interface ControllerInspectorControls {
  airDragFactor: number;
  walkAirDragFactor: number;
  resetPlayer(): void;
}

export interface ControllerRig {
  controller: BVHEcctrl;
  movementInput: MovementInput;
  inspectorControls: ControllerInspectorControls;
  resetPlayer(): void;
  setInputEnabled(enabled: boolean): void;
  dispose(): void;
}

export function createController(
  camera: THREE.PerspectiveCamera,
  scene: THREE.Scene,
  canvas: HTMLCanvasElement
): ControllerRig {
  const settings = createControllerSettings();
  const controller = createEcctrl(camera, scene, settings);
  const resetPlayer = () => resetController(controller);
  const keyboard = createKeyboardMovementInput();
  const gamepadControls = new GamepadControls({ punchButtonId });
  const mousePunch = createMousePunchInput(canvas);
  let touchControls = createTouchControls();

  return {
    controller,
    movementInput: keyboard.input,
    inspectorControls: createControllerControls(controller, settings, resetPlayer),
    resetPlayer,
    setInputEnabled(enabled) {
      keyboard.setInputEnabled(enabled);
      gamepadControls.update({ enabled });
      mousePunch.setInputEnabled(enabled);
      touchControls = setTouchControlsEnabled(touchControls, enabled);
    },
    dispose() {
      keyboard.dispose();
      gamepadControls.dispose();
      mousePunch.dispose();
      for (const control of touchControls) control.dispose();
      controller.dispose();
    },
  };
}

function createEcctrl(
  camera: THREE.PerspectiveCamera,
  scene: THREE.Scene,
  settings: ControllerSettings
) {
  const controller = new BVHEcctrl({
    camera,
    scene,
    delay: 0,
    colliderCapsuleArgs: [0.3, 0.8, 4, 8],
    floatHeight: 0.4,
    floatPullBackHeight: 0.25,
    floatSensorRadius: 0.12,
    floatSpringK: 900,
    floatDampingC: 30,
    maxWalkSpeed: 1.1,
    maxRunSpeed: 5.5,
    acceleration: 26,
    deceleration: 30,
    airDragFactor: settings.airDragFactor,
    walkAirDragFactor: settings.walkAirDragFactor,
    jumpVel: 6,
  });
  resetController(controller);
  controller.model.rotation.y = Math.PI;
  scene.add(controller.group);
  return controller;
}

function createControllerSettings(): ControllerSettings {
  return {
    airDragFactor: CONTROLLER_RUN_AIR_DRAG_FACTOR,
    walkAirDragFactor: CONTROLLER_WALK_AIR_DRAG_FACTOR,
  };
}

function createControllerControls(
  controller: BVHEcctrl,
  settings: ControllerSettings,
  resetPlayer: () => void
): ControllerInspectorControls {
  return {
    get airDragFactor() {
      return settings.airDragFactor;
    },
    set airDragFactor(value: number) {
      settings.airDragFactor = value;
      controller.setOptions({ airDragFactor: value });
    },
    get walkAirDragFactor() {
      return settings.walkAirDragFactor;
    },
    set walkAirDragFactor(value: number) {
      settings.walkAirDragFactor = value;
      controller.setOptions({ walkAirDragFactor: value });
    },
    resetPlayer() {
      resetPlayer();
    },
  };
}

function resetController(controller: BVHEcctrl) {
  controller.group.position.copy(CONTROLLER_SPAWN_POSITION);
  controller.resetLinVel();
}

function createKeyboardMovementInput(): KeyboardMovementInput {
  let inputEnabled = true;
  const input = {
    forward: false,
    backward: false,
    leftward: false,
    rightward: false,
    run: false,
    jump: false,
  };

  const onKeyChange = (event: KeyboardEvent) => {
    if (!inputEnabled) return;
    const active = event.type === "keydown";
    if (event.code === "KeyW" || event.code === "ArrowUp") input.forward = active;
    if (event.code === "KeyS" || event.code === "ArrowDown") input.backward = active;
    if (event.code === "KeyA" || event.code === "ArrowLeft") input.leftward = active;
    if (event.code === "KeyD" || event.code === "ArrowRight") input.rightward = active;
    if (event.code === "ShiftLeft" || event.code === "ShiftRight") input.run = active;
    if (event.code === "Space") input.jump = active;
  };

  const reset = () => {
    input.forward = false;
    input.backward = false;
    input.leftward = false;
    input.rightward = false;
    input.run = false;
    input.jump = false;
  };

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

function createMousePunchInput(canvas: HTMLCanvasElement): ToggleableControl {
  let inputEnabled = true;
  let pressStart: MousePunchPress | null = null;

  const press = (event: MouseEvent) => {
    if (!inputEnabled) return;
    if (event.button !== 0) return;
    pressStart = {
      button: event.button,
      x: event.clientX,
      y: event.clientY,
    };
  };

  const triggerPunch = () => {
    const store = useButtonStore.getState();
    store.setButtonActive(punchButtonId, true, MOUSE_PUNCH_SOURCE);
    store.setButtonActive(punchButtonId, false, MOUSE_PUNCH_SOURCE);
  };

  const release = (event: MouseEvent) => {
    if (!inputEnabled) {
      reset();
      return;
    }
    if (isMousePunchClick(pressStart, event)) triggerPunch();
    pressStart = null;
  };

  const reset = () => {
    pressStart = null;
    useButtonStore
      .getState()
      .setButtonActive(punchButtonId, false, MOUSE_PUNCH_SOURCE);
  };

  const onVisibilityChange = () => {
    if (document.hidden) reset();
  };

  canvas.addEventListener("mousedown", press);
  window.addEventListener("mouseup", release);
  window.addEventListener("blur", reset);
  document.addEventListener("visibilitychange", onVisibilityChange);

  return {
    setInputEnabled(enabled) {
      inputEnabled = enabled;
      if (!enabled) reset();
    },
    dispose() {
      reset();
      canvas.removeEventListener("mousedown", press);
      window.removeEventListener("mouseup", release);
      window.removeEventListener("blur", reset);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    },
  };
}

export function isMousePunchClick(
  press: MousePunchPress | null,
  release: Pick<MouseEvent, "button" | "clientX" | "clientY">
) {
  if (!press || press.button !== 0 || release.button !== 0) return false;
  const dx = release.clientX - press.x;
  const dy = release.clientY - press.y;
  return dx * dx + dy * dy <= MOUSE_PUNCH_MAX_DRAG_PX * MOUSE_PUNCH_MAX_DRAG_PX;
}

function createTouchControls(): DisposableControl[] {
  if (!("ontouchstart" in window) && navigator.maxTouchPoints <= 0) return [];
  return [
    new Joystick(),
    new VirtualButton({
      id: "run",
      label: "RUN",
      buttonWrapperStyle: { right: "100px", bottom: "40px" },
    }),
    new VirtualButton({
      id: "jump",
      label: "JUMP",
      buttonWrapperStyle: { right: "40px", bottom: "100px" },
    }),
  ];
}

function setTouchControlsEnabled(
  controls: DisposableControl[],
  enabled: boolean
) {
  if (enabled) return controls.length > 0 ? controls : createTouchControls();
  for (const control of controls) control.dispose();
  return [];
}
