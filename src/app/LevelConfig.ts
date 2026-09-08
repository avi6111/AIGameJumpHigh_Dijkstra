import type { Vector3Tuple } from "./LevelState";
export interface LevelConfig {
  title: string;
  //finishLine: Vector3Tuple;
  finishName:string;
  //spawnPoint: Vector3Tuple;
  spawnName: string;
  timeLimit: number;
  sceneStr:string;
}

// 创建关卡配置数组
export const levelConfigs: LevelConfig[] = [
  {
    title: "level 1",
    finishName: "crown-podium",
    spawnName: "",
    timeLimit: 60,
    sceneStr: "./LevelLayout"
  },
  {
    title: "level 2",
    finishName: "crown-podium",
    spawnName: "",
    timeLimit: 90,
    sceneStr: "./levels/L2SliderLayout"
  },
  {
    title: "level 3",
    finishName: "crown-podium",
    spawnName: "",
    timeLimit: 120,
    sceneStr: "./levels/L3FansLayout"
  },
  {
    title: "level 4",
    finishName: "crown-podium",
    spawnName: "",
    timeLimit: 200,
    sceneStr: "./levels/xxxx"
  }
];

export default levelConfigs;