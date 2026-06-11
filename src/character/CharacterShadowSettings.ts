import { Mesh, type Object3D } from "three";
import { markMaterialNeedsUpdate } from "../utils/MaterialUpdates";

export interface CharacterShadowSettings {
  castShadow: boolean;
  receiveShadow: boolean;
}

export type CharacterShadowInspectorControls = CharacterShadowSettings;

export const DEFAULT_CHARACTER_SHADOW_SETTINGS: CharacterShadowSettings = {
  castShadow: true,
  receiveShadow: true,
};

export function applyCharacterShadowSettings(
  root: Object3D,
  settings: CharacterShadowSettings
) {
  root.traverse((object) => {
    if (!(object instanceof Mesh)) return;
    const receiveShadowChanged = object.receiveShadow !== settings.receiveShadow;
    object.castShadow = settings.castShadow;
    object.receiveShadow = settings.receiveShadow;
    if (receiveShadowChanged) markMaterialNeedsUpdate(object.material);
  });
}
