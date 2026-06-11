import * as THREE from "three/webgpu";
import { createLevelMaterial } from "./LevelMaterials";
import { addPlatform, box, cylinder } from "./LevelPrimitives";

// A Fall Guys style obstacle course laid out along -Z.
// Sections, in running order:
//   start gate -> sweeper deck -> shuttle gap -> hammer beams
//   -> stair climb / elevator -> windmill gate -> carousel gap -> goal
// Kinematic obstacles (sweeper, shuttles, hammers, elevator, windmill,
// carousel) are created in LevelGimmicks.ts and positioned to match.
export function createLevelLayout(scene: THREE.Scene) {
  const group = new THREE.Group();
  group.name = "obstacle-course";
  const materials = createLevelMaterials();

  // — Start deck (z 15..5, top 0) — the player spawns at (0, 1.1, 8).
  addPlatform(group, "start-deck", [14, 1, 10], 0, 0, 10, materials.floor);
  addPlatform(group, "start-back-rail", [14, 1, 0.35], 1, 0, 14.8, materials.rail);
  addPlatform(group, "start-left-rail", [0.35, 1, 10], 1, -6.8, 10, materials.rail);
  addPlatform(group, "start-right-rail", [0.35, 1, 10], 1, 6.8, 10, materials.rail);
  group.add(cylinder("start-left-post", 0.22, 3.2, [-4.6, 1.6, 5], materials.marker));
  group.add(cylinder("start-right-post", 0.22, 3.2, [4.6, 1.6, 5], materials.marker));
  addPlatform(group, "start-banner", [9.6, 0.5, 0.3], 3.6, 0, 5, materials.marker);

  // — Section 1: sweeper deck (z 5..-5, top 0.15) —
  // A single long bar (low-sweeper) spins around the hub; jump over it.
  addPlatform(group, "sweeper-deck", [9.27, 0.7, 10], 0.15, 0, 0, materials.deck);
  group.add(cylinder("sweeper-hub", 0.45, 1.1, [0, 0.7, 0], materials.post));

  // — Section 2: shuttle gap (z -5..-11, open void) —
  // Crossed by two side-sliding platforms from LevelGimmicks.

  // — Section 3: hammer beams (z -11..-24, top 0.6) —
  // A sloped entry deck leads onto three narrow beams watched over by two
  // swinging hammers. The outer beams are banked, the center one is thin.
  const entryDeck = box("hammer-entry-deck", [14, 0.7, 3], [0, 0.25, -12.36], materials.floor);
  entryDeck.rotation.x = -0.245;
  group.add(entryDeck);
  const beamLeft = box("beam-left", [1.8, 0.4, 8], [-4.5, 0.4, -18], materials.beam);
  beamLeft.rotation.z = -0.354;
  group.add(beamLeft);
  addPlatform(group, "beam-center", [1.04, 0.4, 8], 0.6, 0, -18, materials.beam);
  const beamRight = box("beam-right", [1.8, 0.4, 8], [4.5, 0.4, -18], materials.beam);
  beamRight.rotation.z = 0.405;
  group.add(beamRight);
  addPlatform(group, "hammer-exit-deck", [14, 0.7, 2], 0.6, 0, -23, materials.floor);

  // — Section 4: stair climb (left) or elevator ride (right) up to z -29.5 —
  addPlatform(group, "climb-step-1", [6.5, 0.7, 1.8], 0.95, -3.75, -24.9, materials.deck);
  addPlatform(group, "climb-step-2", [6.5, 0.7, 1.8], 1.35, -3.75, -26.7, materials.deck);
  addPlatform(group, "climb-step-3", [6.5, 0.7, 1.8], 1.75, -3.75, -28.5, materials.deck);

  // — Windmill deck (z -29.5..-34.5, top 2.2) —
  // The windmill-gate fan spins across the middle; the side blocks leave
  // narrow safe slots at the deck edges.
  addPlatform(group, "windmill-deck", [14, 0.7, 5], 2.2, 0, -31.89, materials.deck);
  addPlatform(group, "windmill-block-left", [1.4, 2.2, 1.4], 4.4, -5.4, -32, materials.post);
  addPlatform(group, "windmill-block-right", [1.4, 2.2, 1.4], 4.4, 5.4, -32, materials.post);

  // — Section 5: carousel gap (z -34.5..-42.5, open void) —
  // Crossed by riding the orbiting-pads carousel from LevelGimmicks.

  // — Goal deck (z -42.5..-50.5, top 2.5) —
  addPlatform(group, "goal-deck", [14, 0.8, 8], 2.5, 0, -46.5, materials.goal);
  addPlatform(group, "goal-back-rail", [14, 1, 0.35], 3.5, 0, -50.33, materials.rail);
  addPlatform(group, "goal-left-rail", [0.35, 1, 8], 3.5, -6.8, -46.5, materials.rail);
  addPlatform(group, "goal-right-rail", [0.35, 1, 8], 3.5, 6.8, -46.5, materials.rail);
  group.add(cylinder("goal-left-post", 0.22, 3.4, [-4.6, 4.2, -43.5], materials.marker));
  group.add(cylinder("goal-right-post", 0.22, 3.4, [4.6, 4.2, -43.5], materials.marker));
  addPlatform(group, "goal-banner", [9.6, 0.5, 0.3], 6.2, 0, -43.5, materials.marker);
  group.add(cylinder("crown-podium", 1.1, 0.6, [0, 2.42, -47.5], materials.post));
  group.add(cylinder("crown", 0.38, 0.5, [0, 2.75, -47.5], materials.marker));

  scene.add(group);
  return group;
}

function createLevelMaterials() {
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
