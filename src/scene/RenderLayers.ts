import type { Object3D } from "three";

export const CHARACTER_AO_MASK_LAYER = 1;

export function enableCharacterAoMaskLayer(object: Object3D) {
  object.layers.enable(CHARACTER_AO_MASK_LAYER);
}
