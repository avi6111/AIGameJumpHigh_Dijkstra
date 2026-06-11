/*!
 * BVHEcctrl
 * https://github.com/pmndrs/BVHEcctrl
 * (c) 2025 @ErdongChen-Andrew
 * Released under the MIT License.
 */

import { createStore } from "zustand/vanilla";
import type { CharacterAnimationStatus } from "../Types";

export interface AnimationStoreState {
  animationStatus: CharacterAnimationStatus;
  setAnimationStatus: (status: CharacterAnimationStatus) => void;
}

export const useAnimationStore = /* @__PURE__ */ createStore<AnimationStoreState>()(
  (set) => ({
    animationStatus: "IDLE",
    setAnimationStatus: (status) => set({ animationStatus: status }),
  })
);
