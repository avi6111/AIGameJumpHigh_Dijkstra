/*!
 * BVHEcctrl
 * https://github.com/pmndrs/BVHEcctrl
 * (c) 2025 @ErdongChen-Andrew
 * Released under the MIT License.
 */

import { useButtonStore } from "./stores/ButtonStore";
import { useGamepadCameraStore } from "./stores/GamepadCameraStore";
import { useJoystickStore } from "./stores/JoystickStore";

const DEFAULT_DEADZONE = 0.15;
const DEFAULT_BUTTON_THRESHOLD = 0.5;
const DEFAULT_CAMERA_X_AXIS = 2;
const DEFAULT_CAMERA_Y_AXIS = 3;
const DEFAULT_RUN_STICK_THRESHOLD = 0.75;
const GAMEPAD_SOURCE = "gamepad";
const GAMEPAD_STICK_RUN_SOURCE = "gamepad-stick-run";
const GAMEPAD_BUTTON_KINDS = ["run", "jump", "punch"] as const;
type GamepadButtonKind = (typeof GAMEPAD_BUTTON_KINDS)[number];

export interface GamepadControlsProps {
  enabled?: boolean;
  gamepadIndex?: number;
  xAxis?: number;
  yAxis?: number;
  invertYAxis?: boolean;
  deadzone?: number;
  cameraEnabled?: boolean;
  cameraXAxis?: number;
  cameraYAxis?: number;
  invertCameraYAxis?: boolean;
  cameraDeadzone?: number;
  jumpButton?: number;
  runButton?: number;
  punchButton?: number;
  runStickThreshold?: number;
  jumpButtonId?: string;
  runButtonId?: string;
  punchButtonId?: string;
  buttonThreshold?: number;
  autoStart?: boolean;
}

export default class GamepadControls {
  private rawOptions: GamepadControlsProps;
  private options: RequiredGamepadControlsProps;
  private frameId: number | null = null;
  private frameIsTimeout = false;
  private readonly joystick = { x: 0, y: 0 };
  private readonly camera = { x: 0, y: 0 };
  private hasJoystickInput = false;
  private hasCameraInput = false;
  private runStickActive = false;
  private readonly buttonActive: Record<GamepadButtonKind, boolean> = {
    run: false,
    jump: false,
    punch: false,
  };

  constructor(options: GamepadControlsProps = {}) {
    this.rawOptions = options;
    this.options = resolveOptions(this.rawOptions);
    if (this.options.autoStart) this.start();
  }

  start() {
    if (this.frameId !== null || !this.options.enabled || !hasGamepadApi()) {
      return;
    }
    this.scheduleNext();
  }

  stop() {
    if (this.frameId !== null) cancelScheduledFrame(this.frameId, this.frameIsTimeout);
    this.frameId = null;
    this.frameIsTimeout = false;
    this.resetGamepadInput();
  }

  update(options: Partial<GamepadControlsProps>) {
    const wasRunning = this.frameId !== null;
    if (wasRunning) this.stop();
    this.rawOptions = { ...this.rawOptions, ...options };
    this.options = resolveOptions(this.rawOptions);
    if (wasRunning || this.options.autoStart) this.start();
  }

  dispose() {
    this.stop();
  }

  private poll() {
    const gamepad = getGamepad(this.options.gamepadIndex);
    if (!gamepad) {
      this.resetGamepadInput();
      this.scheduleNext(250);
      return;
    }

    applyDeadzone(
      gamepad.axes[this.options.xAxis] ?? 0,
      (gamepad.axes[this.options.yAxis] ?? 0) *
        (this.options.invertYAxis ? -1 : 1),
      this.options.deadzone,
      this.joystick
    );
    if (this.options.cameraEnabled) {
      applyDeadzone(
        gamepad.axes[this.options.cameraXAxis] ?? 0,
        (gamepad.axes[this.options.cameraYAxis] ?? 0) *
          (this.options.invertCameraYAxis ? -1 : 1),
        this.options.cameraDeadzone,
        this.camera
      );
    } else {
      this.camera.x = 0;
      this.camera.y = 0;
    }

    this.syncAnalogStores();
    this.syncRunStick();
    for (const kind of GAMEPAD_BUTTON_KINDS) this.syncButton(gamepad, kind);
    this.scheduleNext();
  }

  private syncAnalogStores() {
    const isJoystickActive = this.joystick.x !== 0 || this.joystick.y !== 0;
    const isCameraActive = this.camera.x !== 0 || this.camera.y !== 0;
    if (isJoystickActive || this.hasJoystickInput) {
      useJoystickStore
        .getState()
        .setJoystick(this.joystick.x, this.joystick.y, GAMEPAD_SOURCE);
      this.hasJoystickInput = isJoystickActive;
    }
    if (isCameraActive || this.hasCameraInput) {
      useGamepadCameraStore.getState().setCamera(this.camera.x, this.camera.y);
      this.hasCameraInput = isCameraActive;
    }
  }

  private syncRunStick() {
    const joystickAmount = Math.hypot(this.joystick.x, this.joystick.y);
    const active =
      joystickAmount > 0 && joystickAmount >= this.options.runStickThreshold;
    if (active === this.runStickActive) return;
    useButtonStore
      .getState()
      .setButtonActive(
        this.options.runButtonId,
        active,
        GAMEPAD_STICK_RUN_SOURCE
      );
    this.runStickActive = active;
  }

  private syncButton(gamepad: Gamepad, kind: GamepadButtonKind) {
    const mapping = getButtonMapping(this.options, kind);
    const active = getButtonPressed(
      gamepad,
      mapping.index,
      this.options.buttonThreshold
    );
    const previous = this.buttonActive[kind];
    if (active === previous) return;
    useButtonStore.getState().setButtonActive(mapping.id, active, GAMEPAD_SOURCE);
    this.buttonActive[kind] = active;
  }

  private resetGamepadInput() {
    const buttonStore = useButtonStore.getState();
    if (this.hasJoystickInput) {
      useJoystickStore.getState().resetJoystick(GAMEPAD_SOURCE);
      this.hasJoystickInput = false;
    }
    if (this.hasCameraInput) {
      useGamepadCameraStore.getState().resetCamera();
      this.hasCameraInput = false;
    }
    if (this.runStickActive) {
      buttonStore.resetAllButtons(GAMEPAD_STICK_RUN_SOURCE);
      this.runStickActive = false;
    }
    if (hasActiveButton(this.buttonActive)) {
      buttonStore.resetAllButtons(GAMEPAD_SOURCE);
      resetActiveButtons(this.buttonActive);
    }
  }

  private scheduleNext(delay = 0) {
    const scheduled = scheduleFrame(() => this.poll(), delay);
    this.frameId = scheduled.id;
    this.frameIsTimeout = scheduled.isTimeout;
  }
}

type RequiredGamepadControlsProps = Required<
  Omit<GamepadControlsProps, "gamepadIndex">
> &
  Pick<GamepadControlsProps, "gamepadIndex">;

function resolveOptions(options: GamepadControlsProps): RequiredGamepadControlsProps {
  return {
    enabled: options.enabled ?? true,
    gamepadIndex: options.gamepadIndex,
    xAxis: options.xAxis ?? 0,
    yAxis: options.yAxis ?? 1,
    invertYAxis: options.invertYAxis ?? true,
    deadzone: options.deadzone ?? DEFAULT_DEADZONE,
    cameraEnabled: options.cameraEnabled ?? true,
    cameraXAxis: options.cameraXAxis ?? DEFAULT_CAMERA_X_AXIS,
    cameraYAxis: options.cameraYAxis ?? DEFAULT_CAMERA_Y_AXIS,
    invertCameraYAxis: options.invertCameraYAxis ?? true,
    cameraDeadzone: options.cameraDeadzone ?? options.deadzone ?? DEFAULT_DEADZONE,
    jumpButton: options.jumpButton ?? 0,
    runButton: options.runButton ?? 10,
    punchButton: options.punchButton ?? 2,
    runStickThreshold: Math.min(
      Math.max(options.runStickThreshold ?? DEFAULT_RUN_STICK_THRESHOLD, 0),
      1
    ),
    jumpButtonId: options.jumpButtonId ?? "jump",
    runButtonId: options.runButtonId ?? "run",
    punchButtonId: options.punchButtonId ?? "punch",
    buttonThreshold: Math.min(
      Math.max(options.buttonThreshold ?? DEFAULT_BUTTON_THRESHOLD, 0),
      1
    ),
    autoStart: options.autoStart ?? hasGamepadApi(),
  };
}

function getButtonMapping(
  options: RequiredGamepadControlsProps,
  kind: GamepadButtonKind
) {
  switch (kind) {
    case "run":
      return { id: options.runButtonId, index: options.runButton };
    case "jump":
      return { id: options.jumpButtonId, index: options.jumpButton };
    case "punch":
      return { id: options.punchButtonId, index: options.punchButton };
  }
}

function hasActiveButton(buttons: Record<GamepadButtonKind, boolean>) {
  return GAMEPAD_BUTTON_KINDS.some((kind) => buttons[kind]);
}

function resetActiveButtons(buttons: Record<GamepadButtonKind, boolean>) {
  for (const kind of GAMEPAD_BUTTON_KINDS) buttons[kind] = false;
}

function getGamepad(index?: number) {
  if (!hasGamepadApi()) return null;
  const gamepads = navigator.getGamepads?.();
  if (!gamepads) return null;
  if (index !== undefined) {
    const gamepad = gamepads[index];
    return gamepad?.connected ? gamepad : null;
  }
  for (const gamepad of gamepads) {
    if (gamepad?.connected) return gamepad;
  }
  return null;
}

function hasGamepadApi() {
  return (
    typeof navigator !== "undefined" &&
    typeof navigator.getGamepads === "function"
  );
}

function scheduleFrame(callback: FrameRequestCallback, delay: number) {
  if (delay > 0) {
    return {
      id: setTimeout(() => callback(performance.now()), delay) as unknown as number,
      isTimeout: true,
    };
  }
  if (typeof requestAnimationFrame === "function") {
    return { id: requestAnimationFrame(callback), isTimeout: false };
  }
  return {
    id: setTimeout(() => callback(performance.now()), 16) as unknown as number,
    isTimeout: true,
  };
}

function cancelScheduledFrame(id: number, isTimeout: boolean) {
  if (isTimeout) {
    clearTimeout(id);
  } else if (typeof cancelAnimationFrame === "function") {
    cancelAnimationFrame(id);
  }
}

function getButtonPressed(gamepad: Gamepad, index: number, threshold: number) {
  const button = gamepad.buttons[index];
  return !!button && (button.pressed || button.value > threshold);
}

function applyDeadzone(
  x: number,
  y: number,
  deadzone: number,
  target: { x: number; y: number }
) {
  const safeDeadzone = Math.min(Math.max(deadzone, 0), 0.99);
  const length = Math.hypot(x, y);
  if (length <= safeDeadzone) {
    target.x = 0;
    target.y = 0;
    return;
  }
  const scale = Math.min(1, (length - safeDeadzone) / (1 - safeDeadzone));
  target.x = (x / length) * scale;
  target.y = (y / length) * scale;
}
