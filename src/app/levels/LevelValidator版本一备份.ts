import * as THREE from "three/webgpu";

interface PlatformData {
  name: string;
  position: THREE.Vector3;
  size: THREE.Vector3;
}
/**
 * LevelValidator 用于验证关卡中各个平台之间的连通性。
 * 它会根据玩家的物理能力（最大跳跃高度、最大下落深度、最大跨越距离）来判断平台之间是否可达。
 * 使用方法：
 *   1. collectPlatforms(scene) 收集场景中的平台数据
 *   2. validate(startName, goalName) 验证从起点到终点是否存在可达路径
 * 
// 在你的 main.ts 或初始化逻辑中
import { LevelValidator } from "./LevelValidator";
// 1. 生成关卡
const levelGroup = createLevelLayout(scene);
// 2. 执行验证
const validator = new LevelValidator();
validator.collectPlatforms(scene); // 从场景中抓取所有平台
// 验证从 start-deck 到 goal-banner (或 goal-deck) 是否连通
const isReachable = validator.validate("start-deck", "goal-deck"); 
if (!isReachable) {
  // 可以在游戏里弹出一个巨大的红色警告，或者暂停游戏
  alert("⚠️ 关卡设计错误：玩家无法到达终点！请检查中间缺失的平台。");
}
 */



export class LevelValidator {
  private platforms: PlatformData[] = [];
  private scene: THREE.Scene;

  // 玩家物理参数
  private readonly MAX_JUMP_HEIGHT = 1.5;   
  private readonly MAX_FALL_DEPTH = 5.0;    
  private readonly MAX_GAP_DISTANCE = 3.0;  
  
  constructor(scene: THREE.Scene) {
    this.scene = scene;//可以传一个null 进来（如果这么写）
  }

  public collectPlatforms(scene: THREE.Scene) {
    this.scene = scene;
    this.platforms = [];
    scene.traverse((obj) => {
      if (obj instanceof THREE.Mesh && obj.name) {
        const isPlatform = 
          obj.name.includes("deck") || 
          obj.name.includes("beam") || 
          obj.name.includes("step") ||
          obj.name.includes("slide");
          
        if (isPlatform) {
          const box = new THREE.Box3().setFromObject(obj);
          const size = new THREE.Vector3();
          box.getSize(size);
          this.platforms.push({
            name: obj.name,
            position: new THREE.Vector3().setFromMatrixPosition(obj.matrixWorld),
            size: size
          });
        }
      }
    });
  }

  /**
   * 核心验证方法：带可视化的 BFS 寻路
   */
  public validate(startName: string, goalName: string): boolean {
    const startNode = this.platforms.find(p => p.name === startName);
    const goalNode = this.platforms.find(p => p.name === goalName);

    if (!startNode || !goalNode) {
      console.error(`[Validator] 找不到起点 "${startName}" 或终点 "${goalName}"`);
      return false;
    }

    const visited = new Set<string>();
    const queue: PlatformData[] = [startNode];
    visited.add(startNode.name);
    
    // 记录成功的路径边，用于最后绘制绿色线
    const validEdges: [THREE.Vector3, THREE.Vector3][] = [];
    // 🔑 核心修改：使用 Map 记录每个节点是从哪个节点走过来的（前驱节点）
    const parentMap = new Map<string, string>(); 
    while (queue.length > 0) {
      const current = queue.shift()!;
      // 到达终点，提前结束搜索
      if (current.name === goalNode.name) {
        // console.log(`[Validator] ✅ 连通性验证成功: "${startName}" -> "${goalName}"`);
        // this.drawPath(validEdges, 0x00ff00); // 绘制绿色路径
        // return true;
        break;
      }

      for (const neighbor of this.platforms) {
        if (!visited.has(neighbor.name)) {
          const isConnected = this.arePlatformsConnected(current, neighbor);
          
          if (isConnected) {
            visited.add(neighbor.name);
            queue.push(neighbor);
            validEdges.push([current.position, neighbor.position]);
            parentMap.set(neighbor.name, current.name); // 🔑 记录前驱
          } else {
            // 如果距离在检查范围内但不连通，绘制红色阻断线
            const dx = Math.abs(current.position.x - neighbor.position.x);
            const dz = Math.abs(current.position.z - neighbor.position.z);
            const horizontalDist = Math.sqrt(dx * dx + dz * dz);
            const radiusA = Math.max(current.size.x, current.size.z) / 2;
            const radiusB = Math.max(neighbor.size.x, neighbor.size.z) / 2;
            const gap = horizontalDist - (radiusA + radiusB);
            
            console.log(`[Validator] 平台 "${current.name}" 与 "${neighbor.name}" 不连通，水平间距 gap=${gap} max=${this.MAX_GAP_DISTANCE*2}`);
            // 只绘制“看起来应该连通，但实际超出了玩家能力”的断点
            if (gap < this.MAX_GAP_DISTANCE * 2) { 
              this.drawSingleLine(current.position, neighbor.position, 0xff0000);
            }else
            {//this.MAX_GAP_DISTANCE * 2 只有区区6，大部分都达不到
              this.drawSingleLine(current.position, neighbor.position, 0xff00f7);
            }
          }
        }else
        {
          //console.log("no name =", neighbor.name);
        }
      }

      // if(this.platforms.length === 0) {
      //   console.warn("mo 根本没有 [Validator] ⚠️ 当前没有平台数据");
      // }
    }
    console.log('ffffffffffff')
    // 🔑 核心修改：如果终点不在 visited 中，说明无路可走
    if (!visited.has(goalName)) {
      console.error(`[Validator] ❌ 连通性验证失败: 无法从 "${startName}" 到达 "${goalName}" count=${validEdges.length}`);
      this.drawPath(validEdges, 0x00ff00); // 即使失败，也画出已经探索到的绿色部分
      return false;
    }
    console.log('fffffff')
    // 🔑 核心修改：从终点向起点回溯，还原完整路径
    const orderedPath: PlatformData[] = [];
    let currentName: string | undefined = goalName;
    while (currentName) {
      const node = this.platforms.find(p => p.name === currentName);
      if (node) orderedPath.unshift(node); // 插入到数组头部，保证顺序是 起点 -> 终点
      currentName = parentMap.get(currentName); // 找前驱
    }

    console.log(`[Validator] ✅ 连通性验证成功，最短路径节点数: ${orderedPath.length}`);
    
    // 🔥 现在你可以拿着这个排好序的数组去生成 1, 2, 3, 4 的 3D 标签了！
    this.generatePathLabels(orderedPath); 
    
    return true;
  }
  /**
   * 🔑 新增：生成路径标签的方法
   */
  private generatePathLabels(path: PlatformData[]) {
    console.log('ff orderedPath=',path.length)
    // 清理旧的标签（可选）
    const oldLabels = this.scene.children.filter(c => c.name.startsWith('path-label-'));
    oldLabels.forEach(l => this.scene.remove(l));

    path.forEach((platform, index) => {
      console.log("fffff each")
      // 这里可以调用你之前选择的 CSS2DRenderer 或 Sprite 方案
      // 例如使用 Sprite：
      const sprite = this.createNumberSprite(index + 1);
      sprite.name = `path-label-${index}`;
      sprite.position.set(
        platform.position.x, 
        platform.position.y + platform.size.y / 2 + 0.5, 
        platform.position.z
      );
      this.scene.add(sprite);
    });
  }
  private createNumberSprite(number: number): THREE.Sprite {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    canvas.width = 64;
    canvas.height = 64;

    // 绘制背景
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.beginPath();
    ctx.arc(32, 32, 30, 0, Math.PI * 2);
    ctx.fill();

    // 绘制数字
    ctx.fillStyle = '#ffffff';
    ctx.font = 'Bold 40px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(number.toString(), 32, 32);

    const texture = new THREE.CanvasTexture(canvas);
    const material = new THREE.SpriteMaterial({ map: texture, depthTest: false }); // depthTest: false 防止被遮挡
    const sprite = new THREE.Sprite(material);
    sprite.scale.set(0.5, 0.5, 1); // 调整大小
    return sprite;
  }
  /**
   * 判断两个平台是否连通
   */
  private arePlatformsConnected(a: PlatformData, b: PlatformData): boolean {
    const dx = Math.abs(a.position.x - b.position.x);
    const dz = Math.abs(a.position.z - b.position.z);
    const horizontalDist = Math.sqrt(dx * dx + dz * dz);

    const radiusA = Math.max(a.size.x, a.size.z) / 2;
    const radiusB = Math.max(b.size.x, b.size.z) / 2;
    const gap = horizontalDist - (radiusA + radiusB);

    if (gap > this.MAX_GAP_DISTANCE) return false;

    const topA = a.position.y + a.size.y / 2;
    const topB = b.position.y + b.size.y / 2;
    const heightDiff = topB - topA;

    if (heightDiff > this.MAX_JUMP_HEIGHT) return false;
    if (heightDiff < -this.MAX_FALL_DEPTH) return false;

    return true;
  }

  /**
   * 绘制单条线段（用于红色阻断线）
   */
  private drawSingleLine(start: THREE.Vector3, end: THREE.Vector3, color: number) {
    const points = [
      new THREE.Vector3(start.x, start.y + 0.5, start.z), // 稍微抬高一点避免与模型穿插
      new THREE.Vector3(end.x, end.y + 0.5, end.z)
    ];
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({ color, linewidth: 5 });
    const line = new THREE.Line(geometry, material);
    line.name = `validator-line-${color}`;
    this.scene.add(line);
  }

  /**
   * 批量绘制路径（用于绿色连通线）
   */
  private drawPath(edges: [THREE.Vector3, THREE.Vector3][], color: number) {
    edges.forEach(([start, end]) => this.drawSingleLine(start, end, color));
  }
}