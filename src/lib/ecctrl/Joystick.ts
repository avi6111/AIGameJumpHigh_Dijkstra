/*!
 * BVHEcctrl
 * https://github.com/pmndrs/BVHEcctrl
 * (c) 2025 @ErdongChen-Andrew
 * Released under the MIT License.
 */

import { applyStyle } from "./Object3DUtils";
import { useJoystickStore } from "./stores/JoystickStore";
import type { CssStyle } from "./Types";

const JOYSTICK_SOURCE = "touch";

const defaultJoystickWrapperStyle: CssStyle = {
  userSelect: "none",
  MozUserSelect: "none",
  WebkitUserSelect: "none",
  msUserSelect: "none",
  touchAction: "none",
  overscrollBehavior: "none",
  position: "fixed",
  zIndex: "10",
  height: "200px",
  width: "200px",
  left: "0",
  bottom: "0",
  borderRadius: "50%",
};

const defaultJoystickBaseStyle: CssStyle = {
  width: "100px",
  height: "100px",
  background: "rgba(0, 0, 0, 0.1)",
  border: "2px solid white",
  borderRadius: "50%",
  position: "absolute",
  top: "50%",
  left: "50%",
  transform: "translate(-50%, -50%)",
  touchAction: "none",
};

const defaultJoystickKnobStyle: CssStyle = {
  width: "70px",
  height: "70px",
  background: "rgba(255, 255, 255, 0.8)",
  borderRadius: "50%",
  position: "absolute",
  top: "50%",
  left: "50%",
  transform: "translate(-50%, -50%)",
  transition: "transform 0.2s cubic-bezier(0.25, 1.5, 0.5, 1)",
  willChange: "transform",
  pointerEvents: "none",
};

export interface JoystickProps {
  joystickMaxRadius?: number;
  joystickWrapperStyle?: CssStyle;
  joystickBaseStyle?: CssStyle;
  joystickKnobStyle?: CssStyle;
  parent?: HTMLElement;
}

export default class Joystick {
  readonly element: HTMLDivElement;
  readonly baseElement: HTMLDivElement;
  readonly knobElement: HTMLDivElement;
  private active = false;
  private centerX = 0;
  private centerY = 0;
  private readonly joystickMaxRadius: number;

  constructor(props: JoystickProps = {}) {
    this.joystickMaxRadius = props.joystickMaxRadius ?? 50;
    this.element = document.createElement("div");
    this.baseElement = document.createElement("div");
    this.knobElement = document.createElement("div");
    this.element.id = "ecctrl-joystick";
    this.baseElement.id = "joystick-base";
    this.knobElement.id = "joystick-knob";
    applyStyle(this.element, {
      ...defaultJoystickWrapperStyle,
      ...props.joystickWrapperStyle,
    });
    applyStyle(this.baseElement, {
      ...defaultJoystickBaseStyle,
      ...props.joystickBaseStyle,
    });
    applyStyle(this.knobElement, {
      ...defaultJoystickKnobStyle,
      ...props.joystickKnobStyle,
    });
    this.baseElement.append(this.knobElement);
    this.element.append(this.baseElement);
    this.element.addEventListener("contextmenu", this.preventDefault);
    this.element.addEventListener("pointerdown", this.onPointerDown);
    this.element.addEventListener("pointermove", this.onPointerMove);
    this.element.addEventListener("pointerup", this.onPointerReset);
    this.element.addEventListener("pointercancel", this.onPointerReset);
    this.element.addEventListener("pointerleave", this.onPointerReset);
    (props.parent ?? document.body).append(this.element);
  }

  dispose() {
    this.reset();
    this.element.removeEventListener("contextmenu", this.preventDefault);
    this.element.removeEventListener("pointerdown", this.onPointerDown);
    this.element.removeEventListener("pointermove", this.onPointerMove);
    this.element.removeEventListener("pointerup", this.onPointerReset);
    this.element.removeEventListener("pointercancel", this.onPointerReset);
    this.element.removeEventListener("pointerleave", this.onPointerReset);
    this.element.remove();
  }

  private readonly preventDefault = (event: Event) => event.preventDefault();

  private readonly onPointerDown = (event: PointerEvent) => {
    event.preventDefault();
    event.stopPropagation();
    this.element.setPointerCapture?.(event.pointerId);
    this.updateCenter();
    this.move(event.clientX, event.clientY);
    this.active = true;
  };

  private readonly onPointerMove = (event: PointerEvent) => {
    if (this.active) this.move(event.clientX, event.clientY);
  };

  private readonly onPointerReset = (event: PointerEvent) => {
    this.element.releasePointerCapture?.(event.pointerId);
    this.reset();
  };

  private move(x: number, y: number) {
    let dx = x - this.centerX;
    let dy = y - this.centerY;
    const distance = Math.hypot(dx, dy);
    if (distance > this.joystickMaxRadius) {
      dx *= this.joystickMaxRadius / distance;
      dy *= this.joystickMaxRadius / distance;
    }
    this.knobElement.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
    useJoystickStore
      .getState()
      .setJoystick(dx / this.joystickMaxRadius, -dy / this.joystickMaxRadius, JOYSTICK_SOURCE);
  }

  private updateCenter() {
    const rect = this.baseElement.getBoundingClientRect();
    this.centerX = rect.left + rect.width / 2;
    this.centerY = rect.top + rect.height / 2;
  }

  private reset() {
    this.active = false;
    this.knobElement.style.transform = "translate(-50%, -50%)";
    useJoystickStore.getState().resetJoystick(JOYSTICK_SOURCE);
  }
}
