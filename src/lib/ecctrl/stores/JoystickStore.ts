/*!
 * BVHEcctrl
 * https://github.com/pmndrs/BVHEcctrl
 * (c) 2025 @ErdongChen-Andrew
 * Released under the MIT License.
 */

import { createStore } from "zustand/vanilla";

export interface JoystickStoreState {
  joystickActive: boolean;
  joystickX: number;
  joystickY: number;
  joystickSource?: string;
  setJoystick: (x: number, y: number, source?: string) => void;
  resetJoystick: (source?: string) => void;
}

export const useJoystickStore = /* @__PURE__ */ createStore<JoystickStoreState>()(
  (set) => ({
    joystickActive: false,
    joystickX: 0,
    joystickY: 0,
    joystickSource: undefined,
    setJoystick: (x: number, y: number, source?: string) =>
      set((state) => {
        const joystickActive = !(x === 0 && y === 0);
        if (!joystickActive && source !== undefined && state.joystickSource !== source) {
          return state;
        }
        const joystickSource = joystickActive ? source : undefined;
        if (
          state.joystickActive === joystickActive &&
          state.joystickX === x &&
          state.joystickY === y &&
          state.joystickSource === joystickSource
        ) {
          return state;
        }
        return {
          joystickActive,
          joystickX: x,
          joystickY: y,
          joystickSource,
        };
      }),
    resetJoystick: (source?: string) =>
      set((state) => {
        if (source !== undefined && state.joystickSource !== source) return state;
        return {
          joystickActive: false,
          joystickX: 0,
          joystickY: 0,
          joystickSource: undefined,
        };
      }),
  })
);
