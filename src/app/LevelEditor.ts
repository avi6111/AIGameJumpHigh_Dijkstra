import * as THREE from "three/webgpu";
import {
  TransformControls,
  type TransformControlsMode,
} from "three/examples/jsm/controls/TransformControls.js";
import type { Level } from "./Level";
import {
  LEVEL_EXPORT_FILENAME,
  type LevelStateTarget,
} from "./LevelState";

const EDITOR_MODES: Array<{
  label: string;
  mode: TransformControlsMode;
}> = [
  { label: "Move", mode: "translate" },
  { label: "Rotate", mode: "rotate" },
  { label: "Scale", mode: "scale" },
];

export interface LevelEditorControls {
  edit(): void;
  save(): void;
  export(): void;
}

export interface LevelEditor {
  controls: LevelEditorControls;
  isEditing(): boolean;
  dispose(): void;
}

export interface LevelEditorOptions {
  camera: THREE.PerspectiveCamera;
  canvas: HTMLCanvasElement;
  level: Level;
  onTransformActiveChange?(active: boolean): void;
  scene: THREE.Scene;
}

export function createLevelEditor({
  camera,
  canvas,
  level,
  onTransformActiveChange,
  scene,
}: LevelEditorOptions): LevelEditor {
  const transformControls = new TransformControls(camera, canvas);
  transformControls.setMode("translate");
  transformControls.setSize(0.82);
  const transformHelper = transformControls.getHelper();
  transformHelper.visible = false;
  scene.add(transformHelper);

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const hits: THREE.Intersection[] = [];
  const overlay = createLevelEditorOverlay();
  const root = canvas.parentElement ?? document.body;
  root.appendChild(overlay.element);

  const targets = level.getEditorTargets();
  const raycastObjects = targets.map((target) => target.object);
  const targetsByObject = new Map(
    targets.map((target) => [target.object, target])
  );
  let editing = false;
  let selectedTarget: LevelStateTarget | null = null;

  const setEditing = (active: boolean) => {
    if (editing === active) return;
    editing = active;
    level.setEditMode(active);
    overlay.element.hidden = !active;
    if (!active) selectTarget(null);
    overlay.setStatus(active ? "Editing" : "");
  };

  const setMode = (mode: TransformControlsMode) => {
    transformControls.setMode(mode);
    overlay.setMode(mode);
  };

  const onPointerDown = (event: PointerEvent) => {
    if (!editing || event.button !== 0) return;
    if (transformControls.dragging || transformControls.axis !== null) return;
    selectTarget(pickTarget(event));
  };

  const onTransformMouseDown = () => {
    onTransformActiveChange?.(true);
  };

  const onTransformMouseUp = () => {
    selectedTarget?.onTransformChanged?.();
    onTransformActiveChange?.(false);
  };

  overlay.onModeChange = setMode;
  overlay.onDone = () => setEditing(false);
  canvas.addEventListener("pointerdown", onPointerDown);
  transformControls.addEventListener("mouseDown", onTransformMouseDown);
  transformControls.addEventListener("mouseUp", onTransformMouseUp);

  return {
    controls: {
      edit() {
        setEditing(!editing);
      },
      save() {
        if (!level.saveState()) {
          console.warn("Unable to save level state to localStorage.");
          return;
        }
        overlay.setStatus("Saved");
      },
      export() {
        exportLevelState(level.exportState());
        overlay.setStatus("Exported");
      },
    },
    isEditing() {
      return editing;
    },
    dispose() {
      setEditing(false);
      canvas.removeEventListener("pointerdown", onPointerDown);
      transformControls.removeEventListener("mouseDown", onTransformMouseDown);
      transformControls.removeEventListener("mouseUp", onTransformMouseUp);
      onTransformActiveChange?.(false);
      transformControls.dispose();
      transformHelper.removeFromParent();
      overlay.element.remove();
    },
  };

  function selectTarget(target: LevelStateTarget | null) {
    selectedTarget = target;
    if (!target) {
      transformControls.detach();
      overlay.setSelectedName("None");
      return;
    }
    transformControls.attach(target.object);
    overlay.setSelectedName(target.name);
  }

  function pickTarget(event: PointerEvent) {
    updatePointer(event);
    raycaster.setFromCamera(pointer, camera);
    hits.length = 0;
    raycaster.intersectObjects(raycastObjects, true, hits);
    for (const hit of hits) {
      const target = findTarget(hit.object);
      if (target) return target;
    }
    return null;
  }

  function updatePointer(event: PointerEvent) {
    const rect = canvas.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  }

  function findTarget(object: THREE.Object3D) {
    let current: THREE.Object3D | null = object;
    while (current) {
      const target = targetsByObject.get(current);
      if (target) return target;
      current = current.parent;
    }
    return null;
  }
}

interface LevelEditorOverlay {
  element: HTMLDivElement;
  onDone(): void;
  onModeChange(mode: TransformControlsMode): void;
  setMode(mode: TransformControlsMode): void;
  setSelectedName(name: string): void;
  setStatus(value: string): void;
}

function createLevelEditorOverlay(): LevelEditorOverlay {
  const element = document.createElement("div");
  element.className = "levelEditorOverlay";
  element.hidden = true;

  const heading = document.createElement("p");
  heading.className = "levelEditorTitle";
  heading.textContent = "Level Edit";

  const selected = document.createElement("p");
  selected.className = "levelEditorSelected";
  selected.textContent = "Selected: None";

  const status = document.createElement("p");
  status.className = "levelEditorStatus";

  const buttons = document.createElement("div");
  buttons.className = "levelEditorModes";

  const modeButtons = new Map<TransformControlsMode, HTMLButtonElement>();
  const overlay: LevelEditorOverlay = {
    element,
    onDone() {},
    onModeChange() {},
    setMode(mode) {
      for (const [buttonMode, button] of modeButtons) {
        button.dataset.active = buttonMode === mode ? "true" : "false";
      }
    },
    setSelectedName(name) {
      selected.textContent = `Selected: ${name}`;
    },
    setStatus(value) {
      status.textContent = value;
    },
  };

  for (const { label, mode } of EDITOR_MODES) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = label;
    button.addEventListener("click", () => overlay.onModeChange(mode));
    buttons.appendChild(button);
    modeButtons.set(mode, button);
  }

  const done = document.createElement("button");
  done.type = "button";
  done.className = "levelEditorDone";
  done.textContent = "Done";
  done.addEventListener("click", () => overlay.onDone());

  element.append(heading, selected, buttons, done, status);
  overlay.setMode("translate");
  return overlay;
}

function exportLevelState(json: string) {
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = LEVEL_EXPORT_FILENAME;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}
