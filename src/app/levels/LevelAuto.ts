import * as THREE from "three/webgpu";
import { positionLocal, time, sin, vec3 } from "three/tsl";
import { type PlatformData, PLAYER_PHYSICS } from "./iPlatformData";
import { addPlatform, box, cylinder } from "../LevelPrimitives"
import { createLevelMaterial } from "../LevelMaterials";
import StaticCollider from "../../lib/ecctrl/StaticCollider";
import {plus} from "./LevelAutoProcessHigh";
import { EffectComposer, RenderPass, UnrealBloomPass } from "three/examples/jsm/Addons.js";
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

  plus(group,platformA,platformB,generatedPlatforms)//这里迷啊你也会console log ，所以打印生成的头尾两个点两次；

  const staticCollider = new StaticCollider(group, { scene:this_scene, bvhName: "level_plus" });
  // 添加到场景中
  this_scene.add(group);

  if (generatedPlatforms.length > 0) {
    console.log(`[Validator] 🌉 自动填补: 在 "${platformA.name}" 和 "${platformB.name}" 之间生成了 ${generatedPlatforms.length} 个过渡平台`);
  }

  return generatedPlatforms;

}
/**
 * 生成旗杆和红旗并添加到指定的 Group 中
 * @param targetGroup 目标 Group
 */
function createFlag(targetGroup: THREE.Group) {
  const height = 12;
  // 1. 创建旗杆
  const poleGeometry = new THREE.CylinderGeometry(0.05, 0.05, height, 16); // 半径 0.05，高度 4
  const poleMaterial = new THREE.MeshStandardMaterial({ color: 0x888888 }); // 灰色金属质感
  const pole = new THREE.Mesh(poleGeometry, poleMaterial);
  
  // 调整旗杆位置，使其底部对齐原点
  pole.position.y = height / 2; 
  targetGroup.add(pole);

  // 2. 创建红旗
  const flagGeometry = new THREE.PlaneGeometry(2, 1.2, 10, 5); // 宽 2，高 1.2，增加细分方便后续做飘动效果
  const flagMaterial = new THREE.MeshStandardMaterial({ 
    color: 0xff0000, // 红色
    side: THREE.DoubleSide // 双面渲染，防止背面看不见
    // ,emissive: 0xff0000 // 发光颜色，通常与基础颜色一致
    // ,emissiveIntensity: 2.0 // 发光强度，大于1才能触发Bloom
  });

  const flag = new THREE.Mesh(flagGeometry, flagMaterial);
  
  // 调整旗子位置，使其左上角连接到旗杆顶部
  flag.position.set(1, height - 0.6, 0); // X轴向右偏移一半宽度，Y轴偏移到旗杆顶部偏下
  
  targetGroup.add(flag);
  
}

/**
 * 模仿 createFlag 的模型参数（高度 12），创建带飘动效果的红旗;
 * 需要Level.ts -> update()方法，配合，不断更新场景中带有 uTime 的自定义材质动画；
 * @param targetGroup 目标 Group
 */
export function createWavingFlag12(targetGroup: THREE.Group): THREE.MeshStandardMaterial {
  const height = 12;

  // 1. 创建旗杆（高度 12）
  const poleGeometry = new THREE.CylinderGeometry(0.05, 0.05, height, 16);
  const poleMaterial = new THREE.MeshStandardMaterial({ color: 0x888888 });
  const pole = new THREE.Mesh(poleGeometry, poleMaterial);
  pole.position.y = height / 2;
  targetGroup.add(pole);

  // 2. 创建红旗几何体（增加细分度以支持顶点平滑波浪）
  const flagGeometry = new THREE.PlaneGeometry(2, 1.2, 64, 32);

  // 3. 创建材质并设置 TSL (WebGPU) 顶点动画节点
  const flagMaterial = new THREE.MeshStandardMaterial({
    color: 0xff0000,
    side: THREE.DoubleSide
    ,emissive: 0xff0000 // 发光颜色，通常与基础颜色一致
    ,emissiveIntensity: 3.0 // 发光强度，大于1才能触发Bloom
  });
  //不建议创建，而且传入 camera 等麻烦
  // // 发光特效：设置后期处理管线
  // const composer = new EffectComposer(renderer);
  // const renderPass = new RenderPass(scene, camera);
  // composer.addPass(renderPass);

  // // 发光特效：创建泛光通道：参数分别为 分辨率、强度(strength)、模糊半径(radius)、阈值(threshold)
  // const bloomPass = new UnrealBloomPass(
  //     new THREE.Vector2(window.innerWidth, window.innerHeight),
  //     1.5,  // strength: 泛光强度
  //     0.4,  // radius: 泛光扩散范围
  //     0.85  // threshold: 亮度阈值，建议设置在 0.8~1.0 之间
  // );
  // composer.addPass(bloomPass);

  // TSL 核心波浪算法：基于顶点 X 坐标，结合全局 time 节点实现自驱动波浪
  const x = positionLocal.x;
  const wave1 = sin(x.mul(4.0).sub(time.mul(3.0))).mul(0.1).mul(x);
  const wave2 = sin(x.mul(8.0).sub(time.mul(5.0))).mul(0.02).mul(x);
  const wave = wave1.add(wave2);

  flagMaterial.positionNode = vec3(positionLocal.x, positionLocal.y, positionLocal.z.add(wave));

  // 同时保留 GLSL onBeforeCompile 与 customUniforms 备用兼容
  const customUniforms = { uTime: { value: 0 } };
  flagMaterial.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = customUniforms.uTime;
    shader.vertexShader = shader.vertexShader.replace(
      '#include <common>',
      `#include <common>\nuniform float uTime;`
    );
    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>\nfloat wave = sin(transformed.x * 4.0 - uTime * 3.0) * 0.1 * transformed.x + sin(transformed.x * 8.0 - uTime * 5.0) * 0.02 * transformed.x;\ntransformed.z += wave;`
    );
  };

  const flag = new THREE.Mesh(flagGeometry, flagMaterial);
  flag.position.set(1, height - 0.6, 0);
  targetGroup.add(flag);

  flagMaterial.userData.customUniforms = customUniforms;
  return flagMaterial;
}

/**
 * 生成旗杆和飘动的红旗并添加到指定的 Group 中
 */
function createWavingFlag(targetGroup: THREE.Group): THREE.MeshStandardMaterial {
  // 1. 创建旗杆
  const poleGeometry = new THREE.CylinderGeometry(0.05, 0.05, 4, 16);
  const poleMaterial = new THREE.MeshStandardMaterial({ color: 0x888888 });
  const pole = new THREE.Mesh(poleGeometry, poleMaterial);
  pole.position.y = 2;
  targetGroup.add(pole);

  // 2. 创建红旗几何体（确保细分足够）
  const flagGeometry = new THREE.PlaneGeometry(2, 1.2, 64, 32); 

  // 3. 创建材质并设置 TSL (WebGPU) 顶点动画节点
  const flagMaterial = new THREE.MeshStandardMaterial({ 
    color: 0xff0000, 
    side: THREE.DoubleSide 
  });

  const x = positionLocal.x;
  const wave1 = sin(x.mul(4.0).sub(time.mul(3.0))).mul(0.1).mul(x);
  const wave2 = sin(x.mul(8.0).sub(time.mul(5.0))).mul(0.02).mul(x);
  const wave = wave1.add(wave2);

  flagMaterial.positionNode = vec3(positionLocal.x, positionLocal.y, positionLocal.z.add(wave));

  const customUniforms = { uTime: { value: 0 } };
  flagMaterial.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = customUniforms.uTime;
    shader.vertexShader = shader.vertexShader.replace(
      '#include <common>',
      `#include <common>\nuniform float uTime;`
    );
    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>\nfloat wave = sin(transformed.x * 4.0 - uTime * 3.0) * 0.1 * transformed.x + sin(transformed.x * 8.0 - uTime * 5.0) * 0.02 * transformed.x;\ntransformed.z += wave;`
    );
  };

  const flag = new THREE.Mesh(flagGeometry, flagMaterial);
  flag.position.set(1, 3.4, 0); 
  targetGroup.add(flag);

  flagMaterial.userData.customUniforms = customUniforms;
  return flagMaterial;
}

export function drawFinalFlag(scene: THREE.Scene, lastBox: PlatformData) {
  const group = new THREE.Group();
  group.name = "end 222";
  const floor = createLevelMaterial(0xe98ab6);
  const len = PLAYER_PHYSICS.MAX_GAP_DISTANCE * 2;

  // 随机前后左右 4 个方向，由 x 和 z 坐标控制
  // const directions = [
  //   { x: 1, z: 0 },  // 右 (+x)
  //   { x: -1, z: 0 }, // 左 (-x)
  //   { x: 0, z: 1 },  // 前 (+z)
  //   { x: 0, z: -1 }  // 后 (-z)
  // ];
  // const dir = directions[Math.floor(Math.random() * directions.length)];
  const dir = new THREE.Vector3(0,0,0)

  const finalPos = new THREE.Vector3(
    lastBox.position.x + dir.x * len,
    lastBox.position.y,
    lastBox.position.z + dir.z * len
  );

  addPlatform(group, "end-deck", [14, 1, 10], finalPos.y, finalPos.x, finalPos.z, floor);
  scene.add(group);
  new StaticCollider(group,{scene,bvhName:"level"});
  
  const packGroup = new THREE.Group();
  packGroup.name = "pack"
  createWavingFlag12(packGroup);
  packGroup.position.set(finalPos.x, finalPos.y, finalPos.z);
  group.add(packGroup);
  return group;
}
export function fixStartPlatform(scene: THREE.Scene):THREE.Group{
  const group = new THREE.Group();
  group.name="fix 111"
  const floor = createLevelMaterial(0xe98ab6)
  addPlatform(group, "start-deck", [14, 1, 10], 0, 0, 10, floor);
  console.log(group)
  const s = new StaticCollider(group, { scene, bvhName: "level" });

  scene.add(group)
  return group; 
}

/**
 * 原因分析
使用了 WebGPU 渲染器 (WebGPURenderer)，导致 onBeforeCompile 注入的 GLSL 被忽略：

项目全局使用的是 import * as THREE from "three/webgpu" (WebGPURenderer)。
原先代码通过 onBeforeCompile 替换 #include <begin_vertex> 注入 GLSL 代码，这是针对传统 WebGLRenderer 的写法。在 WebGPURenderer 的 NodeMaterial / TSL 材质管线中，onBeforeCompile 的 GLSL 字符串替换会被渲染器忽略，因此顶点变形没有被应用。
时间变量 uTime 永远为 0：

虽然定义了 customUniforms = { uTime: { value: 0 } }，但在每帧的渲染/更新循环（requestAnimationFrame 或 level.update）中没有任何地方在对 uTime.value 进行累加更新。由于 uTime 恒为 0，即便是生效的着色器计算出的正弦波也是静止的。
解决方案与已完成的修复
我们采用 WebGPU 原生 TSL (Three Shading Language) 和 兼容模式双保险 修复了该问题：

引入 WebGPU 原生节点动画（在 LevelAuto.ts:61-121 中）：
从 "three/tsl" 中引入 positionLocal、time、sin、vec3，直接为旗帜材质设置 positionNode：


time 节点是 WebGPU 渲染器内置的全局计时器，渲染器会自动在每帧驱动其更新，无需手动写累加代码。

在 Level.ts:178-184 的每帧 update 中加上了遍历更新：


这样既保证了在 WebGPU 下借助 TSL 节点流畅飘动，也保证了在降级 WebGL 渲染管线时 GLSL 的 uTime 能够正常更新。
 */