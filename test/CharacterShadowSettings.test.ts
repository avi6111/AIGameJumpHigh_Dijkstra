import assert from "node:assert/strict";
import * as THREE from "three";
import { test } from "vitest";
import {
  DEFAULT_CHARACTER_SHADOW_SETTINGS,
  applyCharacterShadowSettings,
} from "../src/character/CharacterShadowSettings";
import { disposeObject3D } from "../src/lib/ecctrl/Object3DUtils";

test("default character shadow settings cast and receive shadows", () => {
  const root = new THREE.Group();
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshBasicMaterial()
  );
  root.add(mesh);

  applyCharacterShadowSettings(root, DEFAULT_CHARACTER_SHADOW_SETTINGS);

  assert.equal(mesh.castShadow, true);
  assert.equal(mesh.receiveShadow, true);

  disposeObject3D(root);
});

test("character shadow settings update nested skinned meshes", () => {
  const root = new THREE.Group();
  const nested = new THREE.Group();
  const material = new THREE.MeshBasicMaterial();
  const mesh = new THREE.SkinnedMesh(
    new THREE.BoxGeometry(1, 1, 1),
    material
  );
  const materialVersion = material.version;
  nested.add(mesh);
  root.add(nested);

  applyCharacterShadowSettings(root, {
    castShadow: false,
    receiveShadow: true,
  });

  assert.equal(mesh.castShadow, false);
  assert.equal(mesh.receiveShadow, true);
  assert.equal(material.version, materialVersion + 1);

  disposeObject3D(root);
});
