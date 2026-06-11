import assert from "node:assert/strict";
import * as THREE from "three";
import { test } from "vitest";
import {
  CHARACTER_AO_MASK_LAYER,
  enableCharacterAoMaskLayer,
} from "../src/scene/RenderLayers";

test("character AO mask layer is enabled without clearing the default layer", () => {
  const root = new THREE.Group();
  const nested = new THREE.Group();
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshBasicMaterial()
  );
  nested.add(mesh);
  root.add(nested);

  for (const object of [root, nested, mesh]) {
    enableCharacterAoMaskLayer(object);
  }

  assert.equal(root.layers.isEnabled(0), true);
  assert.equal(root.layers.isEnabled(CHARACTER_AO_MASK_LAYER), true);
  assert.equal(nested.layers.isEnabled(CHARACTER_AO_MASK_LAYER), true);
  assert.equal(mesh.layers.isEnabled(CHARACTER_AO_MASK_LAYER), true);

  mesh.geometry.dispose();
  if (Array.isArray(mesh.material)) {
    for (const material of mesh.material) material.dispose();
  } else {
    mesh.material.dispose();
  }
});
