/*!
 * BVHEcctrl
 * https://github.com/pmndrs/BVHEcctrl
 * (c) 2025 @ErdongChen-Andrew
 * Released under the MIT License.
 */

import { createStore } from "zustand/vanilla";

const DEFAULT_BUTTON_SOURCE = "default";

export interface ButtonStoreState {
  buttons: Record<string, boolean>;
  buttonSources: Record<string, Record<string, true>>;
  setButtonActive: (id: string, active: boolean, source?: string) => void;
  resetAllButtons: (source?: string) => void;
}

export const useButtonStore = /* @__PURE__ */ createStore<ButtonStoreState>()(
  (set) => ({
    buttons: {},
    buttonSources: {},
    setButtonActive: (id, active, source) =>
      set((state) => {
        const sourceId = source ?? DEFAULT_BUTTON_SOURCE;
        const currentSources = state.buttonSources[id] ?? {};
        if (active) {
          if (state.buttons[id] === true && currentSources[sourceId]) return state;
          return {
            buttons: { ...state.buttons, [id]: true },
            buttonSources: {
              ...state.buttonSources,
              [id]: { ...currentSources, [sourceId]: true },
            },
          };
        }

        if (source === undefined) {
          if (state.buttons[id] !== true && state.buttonSources[id] === undefined) {
            return state;
          }
          const buttonSources = { ...state.buttonSources };
          delete buttonSources[id];
          return {
            buttons: { ...state.buttons, [id]: false },
            buttonSources,
          };
        }

        if (!currentSources[sourceId]) return state;

        const nextSources = { ...currentSources };
        delete nextSources[sourceId];
        const buttonActive = Object.keys(nextSources).length > 0;
        const buttonSources = { ...state.buttonSources };
        if (buttonActive) {
          buttonSources[id] = nextSources;
        } else {
          delete buttonSources[id];
        }
        return {
          buttons: { ...state.buttons, [id]: buttonActive },
          buttonSources,
        };
      }),
    resetAllButtons: (source?: string) =>
      set((state) => {
        if (source === undefined) return { buttons: {}, buttonSources: {} };

        let buttons: Record<string, boolean> | undefined;
        let buttonSources: Record<string, Record<string, true>> | undefined;
        for (const id of Object.keys(state.buttonSources)) {
          const currentSources = state.buttonSources[id];
          if (!currentSources[source]) continue;

          buttons ??= { ...state.buttons };
          buttonSources ??= { ...state.buttonSources };
          const nextSources = { ...currentSources };
          delete nextSources[source];
          const buttonActive = Object.keys(nextSources).length > 0;
          buttons[id] = buttonActive;
          if (buttonActive) {
            buttonSources[id] = nextSources;
          } else {
            delete buttonSources[id];
          }
        }
        if (!buttons || !buttonSources) return state;
        return { buttons, buttonSources };
      }),
  })
);
