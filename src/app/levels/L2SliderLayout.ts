import * as THREE from "three/webgpu";
import { createLevelMaterial } from "../LevelMaterials";
import { addPlatform, box, cylinder } from "../LevelPrimitives";
// — Section 7: Slippery Slides & Pendulum Maze (z -78.5..-96.5) —
// A steep downward slide leads into a narrow bridge guarded by swinging pendulums.
export function createLevelLayout(scene: THREE.Scene) {
  const group = new THREE.Group();
  group.name = "obstacle-course";
  const materials = createLevelMaterialsMulti();
  
  // Slippery slide entry
  addPlatform(group, "start-deck", [14, 1, 10], 0, 0, 10, materials.floor);
  const slide = box("slippery-slide", [10, 0.8, 8], [0, 1.5, -82.5], materials.goal);
  slide.rotation.x = -0.35; // Tilted downwards
  group.add(slide);

  // Landing deck after slide
  addPlatform(group, "slide-landing", [14, 0.8, 4], 0.5, 0, -88.5, materials.deck);

  // Pendulum bridge
  addPlatform(group, "pendulum-bridge", [4, 0.5, 12], 0.5, 0, -94.5, materials.beam);
  
  // Pendulum pivot posts (visual only, actual swinging parts in LevelGimmicks)
  group.add(cylinder("pendulum-pivot-1", 0.3, 4, [0, 4.5, -91.5], materials.post));
  group.add(cylinder("pendulum-pivot-2", 0.3, 4, [0, 4.5, -97.5], materials.post));

  // Exit deck
  addPlatform(group, "pendulum-exit-deck", [14, 0.8, 4], 0.5, 0, -102.5, materials.floor);
    
  
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