import * as THREE from "three/webgpu";
import { createLevelMaterial } from "../LevelMaterials";
import { addPlatform, box, cylinder } from "../LevelPrimitives";
// — Section 7: Slippery Slides & Pendulum Maze (z -78.5..-96.5) —
// A steep downward slide leads into a narrow bridge guarded by swinging pendulums.
export function createLevelLayout(scene: THREE.Scene) {
  const group = new THREE.Group();
  group.name = "obstacle-course";
  const materials = createLevelMaterialsMulti();
  //开始
  addPlatform(group, "start-deck", [14, 1, 10], 0, 0, 11, materials.floor);

  // Fan entry deck
  addPlatform(group, "fan-entry-deck", [14, 0.8, 6], 0.5, 0, 3.5, materials.floor);

  // Fan 1
  addPlatform(group, "fan1-hub", [1, 1, 1], 3.5, 0, -58, materials.post);
  // (Blades would be added in LevelGimmicks and parented to this hub)

  // Middle safe zone
  addPlatform(group, "fan-middle-deck", [19, 0.8, 4], 3.5, 0, -62, materials.deck);

  // Fan 2
  addPlatform(group, "fan2-hub", [1, 1, 1], 3.5, 0, -66, materials.post);

  // Moving pads gap (z -68.5..-76.5)
  // Base visual track (optional, for player reference)
  addPlatform(group, "pad-gap-track", [14, 0.2, 8], 3.5, 0, -72.5, materials.rail);
  
  // Moving pads themselves are usually handled by LevelGimmicks, 
  // but we can add static markers or a base deck if needed.
  addPlatform(group, "pad-exit-deck", [14, 0.8, 4], 3.5, 0, -78.5, materials.floor);
    
  //Exit 退出 平台
  addPlatform(group, "goal-deck", [14, 0.8, 8], 2.5, 0, -46.5, materials.goal);
  scene.add(group);
  return group;
}
function createLevelMaterialsMulti() {
  return {
    floor: createLevelMaterial(0xe98ab6),
    deck: createLevelMaterial(0x7fd1bd),
    beam: createLevelMaterial(0xf3cf5d),
    rail: createLevelMaterial(0xf6f1e7),
    post: createLevelMaterial(0xf08a5c),
    marker: createLevelMaterial(0xf6c453),
    goal: createLevelMaterial(0x7ec8e3),
  };
}