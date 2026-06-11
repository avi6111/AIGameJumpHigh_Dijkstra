import type { Material } from "three";

export function markMaterialNeedsUpdate(
  material: Material | Material[] | undefined
) {
  if (!material) return;
  if (Array.isArray(material)) {
    for (const item of material) item.needsUpdate = true;
    return;
  }
  material.needsUpdate = true;
}
