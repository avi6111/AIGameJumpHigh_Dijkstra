import * as THREE from "three/webgpu";
import { StaticCollider } from "../lib/ecctrl/index";
import { disposeObject3D } from "../lib/ecctrl/Object3DUtils";
import { createKinematicActors } from "./LevelGimmicks";
import { createLevelLayout } from "./LevelLayout";
import {
  LEVEL_STORAGE_KEY,
  applyLevelState,
  createLevelState,
  parseLevelState,
  serializeLevelState,
  type LevelApplyResult,
  type LevelState,
  type LevelStateTarget,
} from "./LevelState";

export interface Level {
  applyState(state: LevelState): LevelApplyResult;
  captureState(): LevelState;
  exportState(): string;
  getEditorTargets(): readonly LevelStateTarget[];
  loadSavedState(storage?: Storage | null): LevelApplyResult | null;
  saveState(storage?: Storage | null): boolean;
  setEditMode(active: boolean): void;
  update(delta: number, elapsed: number): void;
  dispose(): void;
}

export function createLevel(scene: THREE.Scene): Level {
  const level = createLevelLayout(scene);
  const staticCollider = new StaticCollider(level, { scene, bvhName: "level" });
  const actors = createKinematicActors(scene);
  let editMode = false;
  let staticColliderDirty = false;
  const markStaticColliderDirty = () => {
    staticColliderDirty = true;
  };
  const staticTargets = createStaticEditorTargets(level, markStaticColliderDirty);
  const editorTargets = [
    ...staticTargets,
    ...actors.map((actor) => actor.getEditorTarget()),
  ];

  const rebuildDirtyStaticCollider = () => {
    if (!staticColliderDirty) return;
    staticColliderDirty = false;
    staticCollider.rebuild();
  };

  const handle: Level = {
    applyState(state) {
      const result = applyLevelState(editorTargets, state);
      rebuildDirtyStaticCollider();
      warnMissingTargets(result);
      return result;
    },
    captureState() {
      return createLevelState(editorTargets);
    },
    exportState() {
      return serializeLevelState(handle.captureState());
    },
    getEditorTargets() {
      return editorTargets;
    },
    loadSavedState(storage = getBrowserStorage()) {
      const savedState = storage?.getItem(LEVEL_STORAGE_KEY);
      if (!savedState) return null;
      const state = parseLevelState(savedState);
      if (!state) {
        console.warn("Ignoring invalid saved level state.");
        return null;
      }
      return handle.applyState(state);
    },
    saveState(storage = getBrowserStorage()) {
      if (!storage) return false;
      try {
        storage.setItem(LEVEL_STORAGE_KEY, handle.exportState());
        return true;
      } catch {
        return false;
      }
    },
    setEditMode(active) {
      if (editMode === active) return;
      editMode = active;
      for (const actor of actors) {
        actor.setEditMode(active);
      }
      rebuildDirtyStaticCollider();
    },
    update(delta, elapsed) {
      rebuildDirtyStaticCollider();
      if (editMode) return;
      for (const actor of actors) {
        actor.update(delta, elapsed);
        actor.collider.update(delta);
      }
    },
    dispose() {
      staticCollider.dispose();
      for (const actor of actors) {
        actor.collider.dispose();
        removeAndDispose(actor.group);
      }
      removeAndDispose(level);
    },
  };

  handle.loadSavedState();
  return handle;
}

function removeAndDispose(root: THREE.Object3D) {
  root.removeFromParent();
  disposeObject3D(root);
}

function createStaticEditorTargets(
  level: THREE.Group,
  onTransformChanged: () => void
): LevelStateTarget[] {
  const targets: LevelStateTarget[] = [];
  level.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (!mesh.isMesh || mesh.name.length === 0) return;
    targets.push({
      kind: "static",
      name: mesh.name,
      object: mesh,
      onTransformChanged,
    });
  });
  return targets;
}

function getBrowserStorage() {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function warnMissingTargets(result: LevelApplyResult) {
  for (const name of result.missing) {
    console.warn(`Saved level object is not present: ${name}`);
  }
}
