import * as THREE from "three/webgpu";

export interface PlatformData {
  name: string;
  position: THREE.Vector3;
  size: THREE.Vector3;
}

// 2. 导出常量配置
export const PLAYER_PHYSICS = {
  MAX_JUMP_HEIGHT: 1.5,
  MAX_FALL_DEPTH: 5.0,
  MAX_GAP_DISTANCE: 3.0,
} as const; // `as const` 确保这些值变成只读常量，防止被意外修改