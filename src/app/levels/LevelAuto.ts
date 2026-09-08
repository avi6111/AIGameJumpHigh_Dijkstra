import * as THREE from "three/webgpu";
import  { type PlatformData, PLAYER_PHYSICS } from "./iPlatformData";
import { addPlatform, box, cylinder } from "../LevelPrimitives"
import { createLevelMaterial } from "../LevelMaterials";
import StaticCollider from "../../lib/ecctrl/StaticCollider";
import {plus} from "./LevelAutoProcessHigh";
/**
 * 检查两个平台，如果距离过远，则按比例在它们之间自动生成过渡平台
 * @param platformA 起点平台
 * @param platformB 终点平台
 * @returns 新生成的平台数组（如果未生成则返回空数组）
 */
export function autoBridgePlatforms(this_scene: THREE.Scene, platformA: PlatformData, platformB: PlatformData): PlatformData[] {
  const group = new THREE.Group();
  group.name = "obstacle-plus";
  const generatedPlatforms: PlatformData[] = [];

  plus(group,platformA,platformB,generatedPlatforms)
  // // 1. 计算两个平台的中心点距离
  // const distance = platformA.position.distanceTo(platformB.position);
  
  // // 如果距离在玩家能力范围内，无需生成
  // if (distance <= PLAYER_PHYSICS.MAX_GAP_DISTANCE) return [];
  

  // // 2. 计算需要插入多少个过渡平台
  // // 为了保证玩家能跳过去，每个间距不能超过 MAX_GAP_DISTANCE
  // // 所以需要的段数 = 总距离 / 最大跨度，向上取整
  // const segments = Math.ceil(distance / PLAYER_PHYSICS.MAX_GAP_DISTANCE);
  // // 3. 计算起点到终点的方向向量
  // const direction = new THREE.Vector3().subVectors(platformB.position, platformA.position);
  // const mat_floor = createLevelMaterial(0xe98ab6);
  // // 4. 按比例生成过渡平台
  // for (let i = 1; i < segments; i++) {
  //   // 计算当前过渡平台的比例 (0 到 1 之间)
  //   const ratio = i / segments;
    
  //   // 线性插值计算新平台的位置
  //   const newPos = new THREE.Vector3().copy(platformA.position).addScaledVector(direction, ratio);
    
  //   // 为了美观，可以让过渡平台的高度也随比例平滑过渡
  //   // 如果想保持同一高度，可以取消下面这行的注释：
  //   // newPos.y = platformA.position.y; 

  //   // 设定一个默认的过渡平台尺寸（比如 1x0.2x1）
  //   const bridgeSize = new THREE.Vector3(1.0, 0.2, 1.0);

  //   // 创建 Three.js 3D 网格
  //   // const geometry = new THREE.BoxGeometry(bridgeSize.x, bridgeSize.y, bridgeSize.z);
  //   // const material = new THREE.MeshStandardMaterial({ color: 0xffaa00 }); // 橙色高亮提示
  //   // const mesh = new THREE.Mesh(geometry, material);
  //   // mesh.position.copy(newPos);
  //   // mesh.name = `auto-bridge-${platformA.name}-to-${platformB.name}-${i}`;
  //   // mesh.castShadow = true;
  //   // mesh.receiveShadow = true;
  //   //const mesh = box("plus-deck",bridgeSize.toArray(),newPos.toArray(),mat_floor);
  //   addPlatform(group,"plus-deck" + i,bridgeSize.toArray(),newPos.y,newPos.x,newPos.z,mat_floor);


  //   // 将新平台加入数据列表
  //   const newPlatformData: PlatformData = {
  //     name: "plus-deck" + i,
  //     position: newPos.clone(),
  //     size: bridgeSize
  //   };
  //   generatedPlatforms.push(newPlatformData);
    
  //   // // 🔑 关键：将新平台加入 this.platforms，这样后续的验证或寻路也能识别到它们！
  //   // this.platforms.push(newPlatformData);
  // }

  const staticCollider = new StaticCollider(group, { scene:this_scene, bvhName: "level_plus" });
  // 添加到场景中
  this_scene.add(group);

  if (generatedPlatforms.length > 0) {
    console.log(`[Validator] 🌉 自动填补: 在 "${platformA.name}" 和 "${platformB.name}" 之间生成了 ${generatedPlatforms.length} 个过渡平台`);
  }

  return generatedPlatforms;

}