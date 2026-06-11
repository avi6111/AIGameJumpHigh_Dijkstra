import * as THREE from "three/webgpu";

export const LEVEL_STORAGE_KEY = "vrm-game-starter.level.v1";
export const LEVEL_EXPORT_FILENAME = "vrm-game-starter-level.json";
export const LEVEL_STATE_VERSION = 2;

export type LevelTargetKind = "static" | "kinematic";
export type Vector3Tuple = [x: number, y: number, z: number];
export type QuaternionTuple = [x: number, y: number, z: number, w: number];

export interface LevelObjectTransform {
  position: Vector3Tuple;
  quaternion: QuaternionTuple;
  scale: Vector3Tuple;
}

export interface LevelObjectState extends LevelObjectTransform {
  kind: LevelTargetKind;
  name: string;
}

export interface LevelState {
  version: typeof LEVEL_STATE_VERSION;
  objects: LevelObjectState[];
}

export interface LevelStateTarget {
  kind: LevelTargetKind;
  name: string;
  object: THREE.Object3D;
  applyTransform?(transform: LevelObjectTransform): void;
  captureTransform?(): LevelObjectTransform;
  onTransformChanged?(): void;
}

export interface LevelApplyResult {
  applied: number;
  missing: string[];
}

export function createLevelState(
  targets: readonly LevelStateTarget[]
): LevelState {
  return {
    version: LEVEL_STATE_VERSION,
    objects: targets.map((target) => ({
      kind: target.kind,
      name: target.name,
      ...(target.captureTransform?.() ?? captureObjectTransform(target.object)),
    })),
  };
}

export function serializeLevelState(state: LevelState) {
  return `${JSON.stringify(state, null, 2)}\n`;
}

export function parseLevelState(value: string): LevelState | null {
  try {
    return normalizeLevelState(JSON.parse(value));
  } catch {
    return null;
  }
}

export function applyLevelState(
  targets: readonly LevelStateTarget[],
  state: LevelState
): LevelApplyResult {
  const targetsByKey = new Map(
    targets.map((target) => [getStateKey(target.kind, target.name), target])
  );
  const missing: string[] = [];
  let applied = 0;

  for (const objectState of state.objects) {
    const target = targetsByKey.get(getStateKey(objectState.kind, objectState.name));
    if (!target) {
      missing.push(`${objectState.kind}:${objectState.name}`);
      continue;
    }
    const transform = getStateTransform(objectState);
    if (target.applyTransform) {
      target.applyTransform(transform);
    } else {
      applyObjectTransform(target.object, transform);
    }
    target.onTransformChanged?.();
    applied++;
  }

  return { applied, missing };
}

export function captureObjectTransform(
  object: THREE.Object3D
): LevelObjectTransform {
  return {
    position: [object.position.x, object.position.y, object.position.z],
    quaternion: [
      object.quaternion.x,
      object.quaternion.y,
      object.quaternion.z,
      object.quaternion.w,
    ],
    scale: [object.scale.x, object.scale.y, object.scale.z],
  };
}

export function applyObjectTransform(
  object: THREE.Object3D,
  transform: LevelObjectTransform
) {
  object.position.set(...transform.position);
  object.quaternion.set(...transform.quaternion).normalize();
  object.scale.set(...transform.scale);
  object.updateMatrixWorld(true);
}

function normalizeLevelState(value: unknown): LevelState | null {
  if (!isRecord(value) || value.version !== LEVEL_STATE_VERSION) {
    return null;
  }
  if (!Array.isArray(value.objects)) return null;
  const objects: LevelObjectState[] = [];
  for (const item of value.objects) {
    const objectState = normalizeObjectState(item);
    if (!objectState) return null;
    objects.push(objectState);
  }
  return { version: LEVEL_STATE_VERSION, objects };
}

function normalizeObjectState(value: unknown): LevelObjectState | null {
  if (!isRecord(value)) return null;
  if (value.kind !== "static" && value.kind !== "kinematic") return null;
  if (typeof value.name !== "string" || value.name.length === 0) return null;
  const position = normalizeVector3(value.position);
  const quaternion = normalizeQuaternion(value.quaternion);
  const scale = normalizeVector3(value.scale);
  if (!position || !quaternion || !scale) return null;
  return { kind: value.kind, name: value.name, position, quaternion, scale };
}

function getStateTransform(
  state: LevelObjectState
): LevelObjectTransform {
  return {
    position: state.position,
    quaternion: state.quaternion,
    scale: state.scale,
  };
}

function normalizeVector3(value: unknown): Vector3Tuple | null {
  if (!Array.isArray(value) || value.length !== 3) return null;
  if (!value.every(isFiniteNumber)) return null;
  return [value[0], value[1], value[2]];
}

function normalizeQuaternion(value: unknown): QuaternionTuple | null {
  if (!Array.isArray(value) || value.length !== 4) return null;
  if (!value.every(isFiniteNumber)) return null;
  return [value[0], value[1], value[2], value[3]];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function getStateKey(kind: LevelTargetKind, name: string) {
  return `${kind}:${name}`;
}
