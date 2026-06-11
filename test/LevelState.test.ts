import assert from "node:assert/strict";
import * as THREE from "three/webgpu";
import { test } from "vitest";
import { useEcctrlStore } from "../src/lib/ecctrl/index";
import { createLevel } from "../src/app/Level";
import {
  LEVEL_OBJECT_METALNESS,
  LEVEL_OBJECT_ROUGHNESS,
} from "../src/app/LevelMaterials";
import {
  LEVEL_STATE_VERSION,
  LEVEL_STORAGE_KEY,
  applyLevelState,
  createLevelState,
  parseLevelState,
  serializeLevelState,
  type LevelState,
  type LevelStateTarget,
} from "../src/app/LevelState";

test("level state serializes and parses editable transforms", () => {
  const object = new THREE.Object3D();
  object.position.set(1, 2, 3);
  object.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), 0.5);
  object.scale.set(1.5, 2, 2.5);

  const state = createLevelState([
    { kind: "static", name: "test-platform", object },
  ]);
  const parsed = parseLevelState(serializeLevelState(state));

  assert.deepEqual(parsed, state);
});

test("level state rejects invalid json and unsupported versions", () => {
  assert.equal(parseLevelState("{"), null);
  assert.equal(
    parseLevelState(
      JSON.stringify({ version: LEVEL_STATE_VERSION + 1, objects: [] })
    ),
    null
  );
  assert.equal(
    parseLevelState(
      JSON.stringify({
        version: LEVEL_STATE_VERSION,
        objects: [{ kind: "static", name: "bad", position: [0, 0, 0] }],
      })
    ),
    null
  );
});

test("level state applies matching objects and reports missing entries", () => {
  const object = new THREE.Object3D();
  const state: LevelState = {
    version: LEVEL_STATE_VERSION,
    objects: [
      createObjectState("static", "present", [2, 3, 4]),
      createObjectState("static", "missing", [8, 9, 10]),
    ],
  };

  const result = applyLevelState(
    [{ kind: "static", name: "present", object }],
    state
  );

  assert.equal(result.applied, 1);
  assert.deepEqual(result.missing, ["static:missing"]);
  assert.deepEqual(object.position.toArray(), [2, 3, 4]);
});

test("level applies static mesh and kinematic root transforms", () => {
  const scene = new THREE.Scene();
  const level = createLevel(scene);
  const staticTarget = requireTarget(level.getEditorTargets(), "static", "start-deck");
  const kinematicTarget = requireTarget(
    level.getEditorTargets(),
    "kinematic",
    "wide-shuttle-platform"
  );
  const state: LevelState = {
    version: LEVEL_STATE_VERSION,
    objects: [
      createObjectState("static", "start-deck", [1, 0.5, 9]),
      createObjectState("kinematic", "wide-shuttle-platform", [3, 2, -4]),
    ],
  };

  try {
    const result = level.applyState(state);

    assert.equal(result.applied, 2);
    assert.deepEqual(result.missing, []);
    assert.deepEqual(staticTarget.object.position.toArray(), [1, 0.5, 9]);
    assert.deepEqual(kinematicTarget.object.position.toArray(), [3, 2, -4]);
    assert.equal(requireCollider("wide-shuttle-platform").userData.active, true);
    level.setEditMode(true);
    assert.equal(requireCollider("wide-shuttle-platform").userData.active, false);
    level.setEditMode(false);
    assert.equal(requireCollider("wide-shuttle-platform").userData.active, true);
    const exported = parseLevelState(level.exportState());
    assert.ok(exported?.objects.some((item) => item.name === "start-deck"));
    assert.ok(
      exported?.objects.some((item) => item.name === "wide-shuttle-platform")
    );
  } finally {
    level.dispose();
  }
});

test("level loads saved state from storage", () => {
  const scene = new THREE.Scene();
  const level = createLevel(scene);
  const storage = new MemoryStorage();
  const state: LevelState = {
    version: LEVEL_STATE_VERSION,
    objects: [createObjectState("static", "start-deck", [4, 0.5, 9])],
  };
  storage.setItem(LEVEL_STORAGE_KEY, serializeLevelState(state));

  try {
    const result = level.loadSavedState(storage);
    const target = requireTarget(level.getEditorTargets(), "static", "start-deck");

    assert.equal(result?.applied, 1);
    assert.deepEqual(target.object.position.toArray(), [4, 0.5, 9]);
  } finally {
    level.dispose();
  }
});

test("level saveState reports storage write failures", () => {
  const scene = new THREE.Scene();
  const level = createLevel(scene);

  try {
    assert.equal(level.saveState(new FailingStorage()), false);
  } finally {
    level.dispose();
  }
});

test("level display objects use the configured material surface", () => {
  const scene = new THREE.Scene();
  const level = createLevel(scene);
  const materials = new Set<THREE.Material>();

  try {
    scene.traverse((object) => {
      const mesh = object as THREE.Mesh;
      if (!mesh.isMesh || mesh.userData.type) return;
      const material = mesh.material;
      if (Array.isArray(material)) {
        for (const item of material) materials.add(item);
      } else {
        materials.add(material);
      }
    });

    assert.ok(materials.size > 0);
    for (const material of materials) {
      assert.ok(material instanceof THREE.MeshStandardMaterial);
      assert.equal(material.roughness, LEVEL_OBJECT_ROUGHNESS);
      assert.equal(material.metalness, LEVEL_OBJECT_METALNESS);
    }
  } finally {
    level.dispose();
  }
});

function createObjectState(
  kind: "static" | "kinematic",
  name: string,
  position: [number, number, number]
) {
  return {
    kind,
    name,
    position,
    quaternion: [0, 0, 0, 1] as [number, number, number, number],
    scale: [1, 1, 1] as [number, number, number],
  };
}

function requireTarget(
  targets: readonly LevelStateTarget[],
  kind: "static" | "kinematic",
  name: string
) {
  const target = targets.find((item) => item.kind === kind && item.name === name);
  assert.ok(target, `missing target: ${kind}:${name}`);
  return target;
}

function requireCollider(name: string) {
  const collider = useEcctrlStore
    .getState()
    .colliderMeshesArray.find((mesh) => mesh.name === name);
  assert.ok(collider, `missing collider: ${name}`);
  return collider;
}

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();

  get length() {
    return this.values.size;
  }

  clear() {
    this.values.clear();
  }

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  key(index: number) {
    return [...this.values.keys()][index] ?? null;
  }

  removeItem(key: string) {
    this.values.delete(key);
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}

class FailingStorage extends MemoryStorage {
  setItem(_key: string, _value: string) {
    throw new Error("storage unavailable");
  }
}
