import * as THREE from "three/webgpu";
import {type PlatformData, PLAYER_PHYSICS } from "./iPlatformData"; // 一次性引入接口和常量
import { autoBridgePlatforms } from "./LevelAuto";

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
  private readonly MAX_GAP_DISTANCE = PLAYER_PHYSICS.MAX_GAP_DISTANCE;  
  
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
          obj.name.includes("-hub")|| obj.name.includes("-deck")||
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
    
    // 记录前驱（用于成功时回溯最短路径）
    const parentMap = new Map<string, string>(); 
    // 🔑 新增：记录后继（用于构建完整的探索树分支）
    const childrenMap = new Map<string, string[]>(); 

    while (queue.length > 0) {
      const current = queue.shift()!;

      // 如果已经找到终点，可以提前结束搜索
      if (current.name === goalNode.name) {
        break; 
      }

      for (const neighbor of this.platforms) {
        if (!visited.has(neighbor.name)) {
          const isConnected = this.arePlatformsConnected(current, neighbor);
          if (isConnected) {
            visited.add(neighbor.name);
            queue.push(neighbor);
            
            // 记录前驱
            parentMap.set(neighbor.name, current.name); 
            
            // 🔑 记录后继
            if (!childrenMap.has(current.name)) {
              childrenMap.set(current.name, []);
            }
            childrenMap.get(current.name)!.push(neighbor.name);
          }
        }
      }
    }

    // 提取探索树的所有边
    const treeEdges = this.extractTreeEdges(childrenMap);

    // 🔑 无论是否到达终点，都绘制探索到的分支（使用黄色以示区别）
    if (treeEdges.length > 0) {
      console.log(`[Validator] 🔍 绘制探索分支，共 ${treeEdges.length} 条连线`);
      this.drawPath(treeEdges, 0xffff00); // 黄色代表探索过的可行分支
    }

    // 如果没到达终点
    if (!visited.has(goalName)) {
      console.error(`[Validator] ❌ 连通性验证失败: 无法从 "${startName}" 到达 "${goalName}"`);
      //this.generatePathLabels(this.findFarthestEndpoints(startName));
      this.generatePathLabels(this.calPlatforms(startName));
      return false;
    }

    // 如果到达了终点，提取并绘制最短路径（绿色）
    const orderedPath: PlatformData[] = [];
    let currentName: string | undefined = goalName;
    while (currentName) {
      const node = this.platforms.find(p => p.name === currentName);
      if (node) orderedPath.unshift(node);
      currentName = parentMap.get(currentName);
    }

    console.log(`[Validator] ✅ 连通性验证成功，最短路径节点数: ${orderedPath.length}`);
    this.generatePathLabels(orderedPath); // 生成 1, 2, 3 标签
    this.drawPath(this.getPathEdges(orderedPath), 0x00ff00); // 绘制绿色最短路径

    return true;
  }
  /**
   * 根据 childrenMap 提取所有探索过的边
   */
  private extractTreeEdges(childrenMap: Map<string, string[]>): [THREE.Vector3, THREE.Vector3][] {
    const edges: [THREE.Vector3, THREE.Vector3][] = [];
    
    childrenMap.forEach((children, parentName) => {
      const parentNode = this.platforms.find(p => p.name === parentName);
      if (!parentNode) return;

      for (const childName of children) {
        const childNode = this.platforms.find(p => p.name === childName);
        if (childNode) {
          edges.push([parentNode.position, childNode.position]);
        }
      }
    });

    return edges;
  }

  /**
   * 根据有序路径提取边（用于绘制绿色最短路径）
   */
  private getPathEdges(path: PlatformData[]): [THREE.Vector3, THREE.Vector3][] {
    const edges: [THREE.Vector3, THREE.Vector3][] = [];
    for (let i = 0; i < path.length - 1; i++) {
      edges.push([path[i].position, path[i + 1].position]);
    }
    return edges;
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

  //#region 全新计算各方块 ------------------------------------
  public calPlatforms(startName: string,isplus:boolean = false){
    const startNode = this.platforms.find(p => p.name === startName);
    
    if(!startNode) return [];
    // 记录按顺序找到的平台
    const orderedPath: PlatformData[] = [startNode];
    const visited = new Set<string>();
    visited.add(startName);
    //const queue: PlatformData[] = [startNode];
    while(true)
    {
      let minDist = Infinity;
      let nearestPlatform: PlatformData | null = null;
      let nearestVisitedName: string | null = null;
      for (const neighbor of this.platforms) {
        if (visited.has(neighbor.name)) continue;

        for(const visitedName of visited) {
          const visitedNode = this.platforms.find(p => p.name === visitedName);
          const dist = neighbor.position.distanceTo(visitedNode!.position);
          if(dist<minDist){
            minDist = dist;
            nearestPlatform = neighbor;
            nearestVisitedName = visitedName;
          } 
        }
      }
      // 3. 如果找不到更近的平台，说明探索结束
      if (!nearestPlatform) break;
      autoBridgePlatforms(this.scene,
         orderedPath.at(-1)!, nearestPlatform);
      // 5. 将找到的最近平台加入已访问集合，并记录到路径中
      visited.add(nearestPlatform.name);
      orderedPath.push(nearestPlatform);
    }

    console.log(`[Validator] 🏁 最近路径探索完成，共连接 ${orderedPath.length} 个平台 total=${this.platforms.length}`);
    return orderedPath;
  }
  //#region BFS 图计算
  /**
   * 寻找从起点出发，探索到的所有最远支点（叶子节点）
   */
  public findFarthestEndpoints(startName: string): PlatformData[] {
    const startNode = this.platforms.find(p => p.name === startName);
    if (!startNode) return [];

    const visited = new Set<string>();
    const queue: PlatformData[] = [startNode];
    //visited.add(startNode.name);
    
    // 记录每个节点有多少个“向外连通”的邻居
    const outDegree = new Map<string, number>(); 

    while (queue.length > 0) {
      const current = queue.shift()!;
      let degree = 0;

      for (const neighbor of this.platforms) {
        if (!visited.has(neighbor.name)) {
          const isConnected = this.arePlatformsConnected(current, neighbor);
          if (isConnected) {
            visited.add(neighbor.name);
            queue.push(neighbor);
            degree++;
          }
        }
      }
      outDegree.set(current.name, degree);
    }

    // 找出所有向外连通数为 0 的节点（即叶子节点/最远支点）
    const endpoints: PlatformData[] = [];
    visited.forEach(name => {
      if (outDegree.get(name) === 0) {
        const node = this.platforms.find(p => p.name === name);
        if (node) endpoints.push(node);
      }
    });

    console.log(`[Validator] 🎯 从 "${startName}" 出发，找到 ${endpoints.length} 个最远支点`);
    return endpoints;
  }
  /**
   * (孤岛）寻找场景中所有的独立连通分量（孤岛）
   * 返回一个二维数组，每个子数组代表一个连通区域内的所有平台
   */
  public findAllIslands(): PlatformData[][] {
    const globalVisited = new Set<string>();
    const islands: PlatformData[][] = [];

    for (const platform of this.platforms) {
      if (globalVisited.has(platform.name)) continue;

      // 发现一个新的孤岛，开始 BFS 收集这个岛的所有节点
      const island: PlatformData[] = [];
      const queue: PlatformData[] = [platform];
      globalVisited.add(platform.name);

      while (queue.length > 0) {
        const current = queue.shift()!;
        island.push(current);

        for (const neighbor of this.platforms) {
          if (!globalVisited.has(neighbor.name)) {
            if (this.arePlatformsConnected(current, neighbor)) {
              globalVisited.add(neighbor.name);
              queue.push(neighbor);
            }
          }
        }
      }
      islands.push(island);
    }

    console.log(`[Validator] 🏝️ 场景中共发现 ${islands.length} 个独立连通区域`);
    return islands;
  }
}