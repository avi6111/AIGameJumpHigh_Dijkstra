/** 简单说：这是一个“关卡编辑器”的底层框架，不是“游戏流程”的顶层控制器。
 * 
功能	                说明
------              ----------------------------------------
加载/保存关卡状态	    通过 localStorage 序列化/反序列化
静态碰撞体	          StaticCollider 管理地形碰撞
动态机关（Actor）	    createKinematicActors() 生成可交互物体，update() 驱动它们运动
编辑模式	            setEditMode() 切换编辑/运行模式
资源清理	            dispose() 释放内存
 * 
 */
import * as THREE from "three/webgpu";
import BVHEcctrl, { StaticCollider } from "../lib/ecctrl/index";
import { disposeObject3D } from "../lib/ecctrl/Object3DUtils";
import { createKinematicActors } from "./LevelGimmicks";

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
import {levelConfigs, type LevelConfig } from "./LevelConfig";
//import { createLevelLayout } from "./LevelLayout";
//import { createLevelLayout } from "./levels/L2SliderLayout";
import { createLevelLayout } from "./levels/L3FansLayout";
import { LevelValidator } from "./levels/LevelValidator";
import { addPlatform } from "./LevelPrimitives";
import { createLevelMaterial } from "./LevelMaterials";
//import type { AnimatedCharacterModel } from "../character/AnimatedCharacterModel";

const CURRENT_LEVEL_STORAGE_KEY = "vrm-game-starter.current-level";
let g_lc:LevelConfig;
let g_currLevel:number;
let cachedLayoutFn: ((scene: THREE.Scene) => THREE.Group) | null = null;
// 提供一个预加载函数，在异步阶段调用
export async function preloadLevelLayout() {
  let currentLevel = readCurrentLevel();
  g_currLevel = parseInt(currentLevel);
  g_lc = levelConfigs[parseInt(currentLevel)];
  if (!cachedLayoutFn) {
    try
    {
      const module = await import(g_lc.sceneStr);
      //const module = await import('./LevelLayout');
      cachedLayoutFn = module.createLevelLayout;
    }
    catch(error)
    {
      console.error("Failed to preload level layout:", error);
      //TODO 错误提示 “需改 Level ”的图文
    }
  }
}
// 提供一个同步获取函数
export function getLevelLayout(scene: THREE.Scene): THREE.Group {
  if (!cachedLayoutFn) {
    //throw new Error("模块未加载！请先调用 preloadLevelLayout()");
    console.log("模块未加载！请先调用 preloadLevelLayout()");
    return createDefaultPlatform(scene);
  }
  return cachedLayoutFn(scene);
}
function createDefaultPlatform(scene: THREE.Scene):THREE.Group{
  const group = new THREE.Group();
  const floor = createLevelMaterial(0xe98ab6)
  addPlatform(group, "start-deck", [14, 1, 10], 0, 0, 10, floor);
  const s = new StaticCollider(group, { scene, bvhName: "level" });
  return group; 
}
export interface Level {
  applyState(state: LevelState): LevelApplyResult;
  captureState(): LevelState;
  currentLevel: string;
  exportState(): string;
  getEditorTargets(): readonly LevelStateTarget[];
  loadSavedState(storage?: Storage | null): LevelApplyResult | null;
  saveState(storage?: Storage | null): boolean;
  setEditMode(active: boolean): void;
  update(delta: number, elapsed: number): void;
  dispose(): void;
  triggerWin(): void;
}


export function createLevel(scene: THREE.Scene,ctl:BVHEcctrl): Level {
  //const level = createLevelLayout(scene);//好像是关卡样板，，Group{}
  const level = getLevelLayout(scene);
  
  const v = new LevelValidator(null);
  v.collectPlatforms(scene);
  const isReachable = v.validate("start-deck", "goal-deck"); 
  if (!isReachable) {
    // 可以在游戏里弹出一个巨大的红色警告，或者暂停游戏
    alert("⚠️ 关卡设计错误：玩家无法到达终点！请检查中间缺失的平台。");
  }
  
  
  const finishLine = scene.getObjectByName(g_lc?.finishName);
  console.log('level 是？',level,finishLine)
  const cctl = ctl
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
    get currentLevel() {
      return String(g_currLevel);
    },
    set currentLevel(value) {
      g_currLevel = parseInt(value);
      saveCurrentLevel(value);
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
      const position = cctl.group?.position ?? null;
      //console.log(cctl)
      //console.log(cctl.group)
      // 打印和终点距离
      // if(finishLine)
      //   console.log('pos=', position,position.distanceTo(finishLine.position))
      if (finishLine && position && position.distanceTo(finishLine.position) < 2) {
        this.triggerWin();
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
    triggerWin(){
      console.log('win');
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

function readCurrentLevel() {
  return getBrowserStorage()?.getItem(CURRENT_LEVEL_STORAGE_KEY) ?? "0";
}

function saveCurrentLevel(value: string) {
  try {
    getBrowserStorage()?.setItem(CURRENT_LEVEL_STORAGE_KEY, value);
  } catch {
    console.warn("Unable to save the current level to localStorage.");
  }
}

function warnMissingTargets(result: LevelApplyResult) {
  for (const name of result.missing) {
    console.warn(`Saved level object is not present: ${name}`);
  }
}

