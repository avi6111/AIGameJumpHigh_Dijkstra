/*!
 * BVHEcctrl
 * https://github.com/pmndrs/BVHEcctrl
 * (c) 2025 @ErdongChen-Andrew
 * Released under the MIT License.
 */

import { createStore } from "zustand/vanilla";

export interface GamepadCameraStoreState {
  cameraActive: boolean;
  cameraX: number;
  cameraY: number;
  setCamera: (x: number, y: number) => void;
  resetCamera: () => void;
}

export const useGamepadCameraStore = /* @__PURE__ */ createStore<GamepadCameraStoreState>()(
  (set) => ({
    cameraActive: false,
    cameraX: 0,
    cameraY: 0,
    setCamera: (x, y) =>
      set((state) => {
        const cameraActive = !(x === 0 && y === 0);
        if (
          state.cameraActive === cameraActive &&
          state.cameraX === x &&
          state.cameraY === y
        ) {
          return state;
        }
        return {
          cameraActive,
          cameraX: x,
          cameraY: y,
        };
      }),
    resetCamera: () =>
      set((state) => {
        if (!state.cameraActive && state.cameraX === 0 && state.cameraY === 0) {
          return state;
        }
        return {
          cameraActive: false,
          cameraX: 0,
          cameraY: 0,
        };
      }),
  })
);
