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
console.time('xxxmain 流程')
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
import {fixStartPlatform} from "./levels/LevelAuto";
import type { PlatformData } from "./levels/iPlatformData";
import type { Number } from "three/examples/jsm/transpiler/AST.js";


console.timeEnd('xxxmain 流程')
const CURRENT_LEVEL_STORAGE_KEY = "vrm-game-starter.current-level";
let g_lc:LevelConfig;
let g_currLevel:number;
// 全局单例：当前激活的 Level 实体，供跨层级模块（如 Vue 组件）直接获取，无需逐层传递 props。
let g_activeLevel: Level | undefined;
export function getActiveLevel(): Level | undefined {
  return g_activeLevel;
}
let cachedLayoutFn: ((scene: THREE.Scene) => THREE.Group) | null = null;
// 提供一个预加载函数，在异步阶段调用；返回 false 表示当前关卡配置缺失，供调用方弹出提示
export async function preloadLevelLayout(): Promise<boolean> {
  let currentLevel = readCurrentLevel();
  g_currLevel = currentLevel;
  g_lc = levelConfigs[currentLevel];
  // sceneStr 在类型上是必填；真正要防的是 levelConfigs 下标越界导致 g_lc 为 undefined
  //if ('sceneStr' in g_lc) {
  if (!g_lc || !g_lc.sceneStr) {
    console.error("Level config missing: levelConfigs[" + currentLevel + "] has no sceneStr");
    return false;
  }
  if (!cachedLayoutFn) {
    try
    {
      console.timeLog('main 流程',`s1-1 |level=${currentLevel}|s=${g_lc.sceneStr}`);
      //const module = await import(g_lc.sceneStr);
      //const module = await import('./LevelLayout');
      console.timeLog('main 流程','s1-2');
      //cachedLayoutFn = module.createLevelLayout;
    }
    catch(error)
    {
      console.error("Failed to preload level layout:", error);
      return false;
    }
  }
  return true;
}
// 提供一个同步获取函数
export function getLevelLayout(scene: THREE.Scene): THREE.Group {
  //#region 如果没有开始点。。
  if (!cachedLayoutFn) {
    //throw new Error("模块未加载！请先调用 preloadLevelLayout()");
    console.log("模块未加载！请先调用 preloadLevelLayout()");
    return fixStartPlatform(scene);
  }
  return cachedLayoutFn(scene);
  //#endregion
}


export interface Level {
  applyState(state: LevelState): LevelApplyResult;
  captureState(): LevelState;
  currentLevel: number;
  finalFlag: THREE.Object3D| undefined
  exportState(): string;
  getEditorTargets(): readonly LevelStateTarget[];
  loadSavedState(storage?: Storage | null): LevelApplyResult | null;
  saveState(storage?: Storage | null): boolean;
  setEditMode(active: boolean): void;
  update(delta: number, elapsed: number): void;
  dispose(): void;
  triggerWin(): void;
}

export interface LevelOptions {
  onWin?: () => void;
}

//#region 主要逻辑
export function createLevel(
  scene: THREE.Scene,
  ctl: BVHEcctrl,
  options: LevelOptions = {},
): Level {
  console.timeLog('main 流程','fff')
  //const level = createLevelLayout(scene);//好像是关卡样板，，Group{}
  const level = getLevelLayout(scene);
  
  const v = new LevelValidator(scene);
  v.collectPlatforms(scene);
  let plusPathes: PlatformData[]=[];
  const isReachable = v.validate("start-deck", "goal-deck",g_lc,plusPathes); //增加, 关卡补充板 | box

  if (!isReachable) {
    // 可以在游戏里弹出一个巨大的红色警告，或者暂停游戏
    alert("⚠️ 关卡设计错误 x2：玩家无法到达终点！请检查中间缺失的平台。");
  }
  
  let finishLine:any = null;
  if(plusPathes.length>0) //有些绕的逻辑，，，，，，，终点最终取，补充的先；如没有补充，才按最原始的执行。。。。。
  {
    
    const finalName =  plusPathes.at(-1)!.name;
    finishLine = scene.getObjectByName(finalName);
    //console.log("终点0 SET ",finishLine.name)
  }else
  {
    finishLine = scene.getObjectByName(g_lc?.finishName);
    if(finishLine==null)
      finishLine = scene.getObjectByName("goal-deck");
    //console.log("终点1 SET ",finishLine.name)
  }
  //console.log('level 的终点是 ？',finishLine)
  const cctl = ctl
  const staticCollider = new StaticCollider(level, { scene, bvhName: "level" });
  const actors = createKinematicActors(scene);
  let editMode = false;
  let hasWon = false;
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
    get currentLevel() {return Math.trunc(g_currLevel)},
    set currentLevel(value) {
      g_currLevel = value
      saveCurrentLevel(value)
    },
    get finalFlag(){return finishLine;},
    set finalFlag(value){finishLine = value;},
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
      //#region 胜利，关卡结算
      // 旗子飘动 Mat 需要； 低端才需要，现在webGl 不需要；
      // // 更新场景中带有 uTime 的自定义材质动画
      // scene.traverse((obj) => {
      //   if (obj instanceof THREE.Mesh && obj.material?.userData?.customUniforms?.uTime) {
      //     obj.material.userData.customUniforms.uTime.value = elapsed;
      //   }
      // });

      const position = cctl.group?.position ?? null;
      // // 打印和终点距离
      // if(finishLine)
      //   console.log('终点 pos=', position," 距离=",position.distanceTo(finishLine.position))
      if (!hasWon && finishLine && position && position.distanceTo(finishLine.position) < 3.8) {
        this.triggerWin();
        //搜索用:showSettlement
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
      hasWon = true;
      console.log('win');
      options.onWin?.();
    },
  };

  handle.loadSavedState();
  g_activeLevel = handle;
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

function readCurrentLevel():number {
  const s  =getBrowserStorage()?.getItem(CURRENT_LEVEL_STORAGE_KEY);
  return parseInt(s!) || 0;
}

function saveCurrentLevel(value: number) {
  try {
    getBrowserStorage()?.setItem(CURRENT_LEVEL_STORAGE_KEY, String(value));
  } catch {
    console.warn("Unable to save the current level to localStorage.");
  }
}

function warnMissingTargets(result: LevelApplyResult) {
  for (const name of result.missing) {
    console.warn(`Saved level object is not present: ${name}`);
  }
}

