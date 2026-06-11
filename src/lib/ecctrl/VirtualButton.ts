/*!
 * BVHEcctrl
 * https://github.com/pmndrs/BVHEcctrl
 * (c) 2025 @ErdongChen-Andrew
 * Released under the MIT License.
 */

import { applyStyle } from "./Object3DUtils";
import { useButtonStore } from "./stores/ButtonStore";
import type { CssStyle } from "./Types";

const BUTTON_SOURCE = "touch";

const defaultButtonWrapperStyle: CssStyle = {
  userSelect: "none",
  MozUserSelect: "none",
  WebkitUserSelect: "none",
  msUserSelect: "none",
  touchAction: "none",
  overscrollBehavior: "none",
  position: "fixed",
  zIndex: "10",
  height: "60px",
  width: "60px",
  right: "0",
  bottom: "0",
  background: "rgba(0, 0, 0, 0.1)",
  borderRadius: "50%",
};

const defaultButtonCapStyle: CssStyle = {
  width: "45px",
  height: "45px",
  background: "rgba(255, 255, 255, 0.8)",
  borderRadius: "50%",
  position: "absolute",
  top: "50%",
  left: "50%",
  transform: "translate(-50%, -50%)",
  transition: "transform 0.2s cubic-bezier(0.25, 1.5, 0.5, 1)",
  willChange: "transform",
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  fontSize: "12px",
  fontWeight: "bold",
  fontFamily: "Arial, sans-serif",
  color: "LightGray",
  userSelect: "none",
  pointerEvents: "none",
};

export interface VirtualButtonProps {
  id: string;
  label?: string;
  buttonWrapperStyle?: CssStyle;
  buttonCapStyle?: CssStyle;
  parent?: HTMLElement;
}

export default class VirtualButton {
  readonly element: HTMLDivElement;
  readonly capElement: HTMLDivElement;
  private readonly id: string;

  constructor(props: VirtualButtonProps) {
    this.id = props.id;
    this.element = document.createElement("div");
    this.capElement = document.createElement("div");
    this.element.id = "ecctrl-virtual-button";
    this.capElement.id = "virtual-button-cap";
    this.capElement.textContent = props.label ?? "";
    applyStyle(this.element, {
      ...defaultButtonWrapperStyle,
      ...props.buttonWrapperStyle,
    });
    applyStyle(this.capElement, {
      ...defaultButtonCapStyle,
      ...props.buttonCapStyle,
    });
    this.element.append(this.capElement);
    this.element.addEventListener("contextmenu", this.preventDefault);
    this.element.addEventListener("pointerdown", this.press);
    this.element.addEventListener("pointerup", this.reset);
    this.element.addEventListener("pointercancel", this.reset);
    this.element.addEventListener("pointerleave", this.reset);
    (props.parent ?? document.body).append(this.element);
  }

  dispose() {
    this.reset();
    this.element.removeEventListener("contextmenu", this.preventDefault);
    this.element.removeEventListener("pointerdown", this.press);
    this.element.removeEventListener("pointerup", this.reset);
    this.element.removeEventListener("pointercancel", this.reset);
    this.element.removeEventListener("pointerleave", this.reset);
    this.element.remove();
  }

  private readonly preventDefault = (event: Event) => event.preventDefault();

  private readonly press = (event: PointerEvent) => {
    event.preventDefault();
    event.stopPropagation();
    useButtonStore.getState().setButtonActive(this.id, true, BUTTON_SOURCE);
    this.capElement.style.transform = "translate(-50%, -50%) scale(1.3)";
    this.capElement.style.opacity = "0.5";
  };

  private readonly reset = () => {
    useButtonStore.getState().setButtonActive(this.id, false, BUTTON_SOURCE);
    this.capElement.style.transform = "translate(-50%, -50%) scale(1)";
    this.capElement.style.opacity = "0.8";
  };
}
