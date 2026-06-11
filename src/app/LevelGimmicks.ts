import * as THREE from "three/webgpu";
import { KinematicCollider } from "../lib/ecctrl/index";
import {
  type Axis,
  type BoxPosition,
  type BoxSize,
  box,
} from "./LevelPrimitives";
import {
  applyObjectTransform,
  captureObjectTransform,
  type LevelStateTarget,
} from "./LevelState";
import { createLevelMaterial } from "./LevelMaterials";

export interface KinematicActor {
  group: THREE.Group;
  collider: KinematicCollider;
  getEditorTarget(): LevelStateTarget;
  setEditMode(active: boolean): void;
  update(delta: number, elapsed: number): void;
}

interface SlidingPlatformConfig {
  name: string;
  size: BoxSize;
  position: BoxPosition;
  axis: Axis;
  amplitude: number;
  speed: number;
  phase?: number;
  color: number;
}

interface RotatingBarConfig {
  name: string;
  position: BoxPosition;
  axis: Axis;
  speed: number;
  phase?: number;
  color: number;
  bars: Array<{
    name: string;
    size: BoxSize;
    position: BoxPosition;
  }>;
}

interface PendulumConfig {
  name: string;
  position: BoxPosition;
  speed: number;
  phase?: number;
  color: number;
}

interface OrbitingPadsConfig {
  name: string;
  position: BoxPosition;
  radius: number;
  speed: number;
  color: number;
}

interface KinematicEditState {
  active: boolean;
}

const AXIS_VECTORS: Record<Axis, THREE.Vector3> = {
  x: new THREE.Vector3(1, 0, 0),
  y: new THREE.Vector3(0, 1, 0),
  z: new THREE.Vector3(0, 0, 1),
};
const PENDULUM_SWING = 0.85;
const animationQuaternion = new THREE.Quaternion();

// Obstacles for the Fall Guys style course in LevelLayout.ts, ordered by
// course section. Positions are tuned to the deck heights defined there.
export function createKinematicActors(scene: THREE.Scene): KinematicActor[] {
  return [
    // Section 1: a long bar sweeping the first deck — jump over it.
    createRotatingBars(scene, {
      name: "low-sweeper",
      position: [0, 0.65, 0],
      axis: "y",
      speed: 0.8,
      color: 0xf2645a,
      bars: [{ name: "bar", size: [10, 0.4, 0.4], position: [0, 0, 0] }],
    }),
    // Section 2: two side-sliding platforms bridge the first gap.
    createSlidingPlatform(scene, {
      name: "wide-shuttle-platform",
      size: [4.2, 0.42, 2.6],
      position: [0, 0.24, -6.64],
      axis: "x",
      amplitude: 3.2,
      speed: 0.9,
      color: 0x6fb9f2,
    }),
    createSlidingPlatform(scene, {
      name: "ferry-platform",
      size: [4.2, 0.42, 2.6],
      position: [0, 0.24, -9.49],
      axis: "x",
      amplitude: 3.2,
      speed: 0.9,
      phase: Math.PI,
      color: 0x8fd0ff,
    }),
    // Section 3: two hammers swing across the balance beams.
    createPendulum(scene, {
      name: "pendulum-hammer",
      position: [-2.25, 4.75, -16.5],
      speed: 1.25,
      color: 0xe85d6c,
    }),
    createPendulum(scene, {
      name: "pendulum-hammer-2",
      position: [2.25, 4.75, -19.5],
      speed: 1.25,
      phase: 1.6,
      color: 0xe85d6c,
    }),
    // Section 4: the elevator is the right-hand alternative to the stairs.
    createSlidingPlatform(scene, {
      name: "elevator-platform",
      size: [4.6, 0.42, 4.6],
      position: [3.75, 1.29, -26.75],
      axis: "y",
      amplitude: 0.8,
      speed: 0.55,
      color: 0x7fe0c3,
    }),
    // Windmill fan spinning across the upper deck — time your crossing.
    createRotatingBars(scene, {
      name: "windmill-gate",
      position: [0, 5.15, -32],
      axis: "z",
      speed: 0.85,
      phase: Math.PI / 4,
      color: 0xb48fe8,
      bars: [
        { name: "vertical-blade", size: [0.32, 5.8, 0.32], position: [0, 0, 0] },
        { name: "horizontal-blade", size: [5.8, 0.32, 0.32], position: [0, 0, 0] },
      ],
    }),
    // Section 5: ride the carousel pads across the final gap.
    createOrbitingPads(scene, {
      name: "orbiting-pads",
      position: [0, 2.34, -38],
      radius: 2.7,
      speed: 0.7,
      color: 0xf5d76e,
    }),
  ];
}

function createSlidingPlatform(
  scene: THREE.Scene,
  config: SlidingPlatformConfig
): KinematicActor {
  const group = new THREE.Group();
  group.name = config.name;
  const base = createBaseTransform(config.position);
  const material = createLevelMaterial(config.color);
  group.add(box(`${config.name}-mesh`, config.size, [0, 0, 0], material));
  updateSlidingPlatformTransform(group, config, base, 0);
  scene.add(group);
  const collider = new KinematicCollider(group, {
    scene,
    bvhName: config.name,
    friction: 0.9,
  });
  const editState = { active: false };
  const editorTarget = createKinematicEditorTarget(
    config.name,
    group,
    base,
    collider,
    editState
  );

  return {
    group,
    collider,
    getEditorTarget() {
      return editorTarget;
    },
    setEditMode(active) {
      setActorEditMode(active, group, base, collider, editState);
    },
    update(_delta, elapsed) {
      updateSlidingPlatformTransform(group, config, base, elapsed);
    },
  };
}

function updateSlidingPlatformTransform(
  group: THREE.Group,
  config: SlidingPlatformConfig,
  base: THREE.Object3D,
  elapsed: number
) {
  applyBaseTransform(group, base);
  group.position[config.axis] +=
    Math.sin(elapsed * config.speed + (config.phase ?? 0)) * config.amplitude;
  group.updateMatrixWorld(true);
}

function createRotatingBars(
  scene: THREE.Scene,
  config: RotatingBarConfig
): KinematicActor {
  const group = new THREE.Group();
  group.name = config.name;
  const base = createBaseTransform(config.position);
  const material = createLevelMaterial(config.color);
  for (const bar of config.bars) {
    group.add(box(`${config.name}-${bar.name}`, bar.size, bar.position, material));
  }
  updateRotatingBarTransform(group, config, base, 0);
  scene.add(group);
  const collider = new KinematicCollider(group, {
    scene,
    bvhName: config.name,
    restitution: 0.12,
    friction: 0.45,
    excludeFloatHit: true,
  });
  const editState = { active: false };
  const editorTarget = createKinematicEditorTarget(
    config.name,
    group,
    base,
    collider,
    editState
  );

  return {
    group,
    collider,
    getEditorTarget() {
      return editorTarget;
    },
    setEditMode(active) {
      setActorEditMode(active, group, base, collider, editState);
    },
    update(_delta, elapsed) {
      updateRotatingBarTransform(group, config, base, elapsed);
    },
  };
}

function updateRotatingBarTransform(
  group: THREE.Group,
  config: RotatingBarConfig,
  base: THREE.Object3D,
  elapsed: number
) {
  applyBaseTransform(group, base);
  applyAnimatedRotation(
    group,
    base,
    config.axis,
    elapsed * config.speed + (config.phase ?? 0)
  );
}

function createOrbitingPads(
  scene: THREE.Scene,
  config: OrbitingPadsConfig
): KinematicActor {
  const group = new THREE.Group();
  group.name = config.name;
  const base = createBaseTransform(config.position);
  const material = createLevelMaterial(config.color);
  for (let i = 0; i < 3; i++) {
    const angle = (i / 3) * Math.PI * 2;
    group.add(
      box(
        `${config.name}-${i + 1}`,
        [2.8, 0.34, 2.8],
        [Math.cos(angle) * config.radius, 0, Math.sin(angle) * config.radius],
        material
      )
    );
  }
  applyBaseTransform(group, base);
  scene.add(group);
  const collider = new KinematicCollider(group, {
    scene,
    bvhName: config.name,
    friction: 0.92,
  });
  const editState = { active: false };
  const editorTarget = createKinematicEditorTarget(
    config.name,
    group,
    base,
    collider,
    editState
  );

  return {
    group,
    collider,
    getEditorTarget() {
      return editorTarget;
    },
    setEditMode(active) {
      setActorEditMode(active, group, base, collider, editState);
    },
    update(_delta, elapsed) {
      applyBaseTransform(group, base);
      applyAnimatedRotation(group, base, "y", elapsed * config.speed);
    },
  };
}

function createPendulum(
  scene: THREE.Scene,
  config: PendulumConfig
): KinematicActor {
  const group = new THREE.Group();
  group.name = config.name;
  const base = createBaseTransform(config.position);
  const material = createLevelMaterial(config.color);
  group.add(box(`${config.name}-arm`, [0.42, 3.5, 0.42], [0, -1.75, 0], material));
  group.add(box(`${config.name}-head`, [1.35, 1.1, 1.1], [0, -3.35, 0], material));
  applyBaseTransform(group, base);
  scene.add(group);
  const collider = new KinematicCollider(group, {
    scene,
    bvhName: config.name,
    restitution: 0.18,
    friction: 0.35,
    excludeFloatHit: true,
  });
  const editState = { active: false };
  const editorTarget = createKinematicEditorTarget(
    config.name,
    group,
    base,
    collider,
    editState
  );

  return {
    group,
    collider,
    getEditorTarget() {
      return editorTarget;
    },
    setEditMode(active) {
      setActorEditMode(active, group, base, collider, editState);
    },
    update(_delta, elapsed) {
      applyBaseTransform(group, base);
      applyAnimatedRotation(
        group,
        base,
        "z",
        Math.sin(elapsed * config.speed + (config.phase ?? 0)) * PENDULUM_SWING
      );
    },
  };
}

function createBaseTransform(position: BoxPosition) {
  const base = new THREE.Object3D();
  base.position.set(...position);
  return base;
}

function createKinematicEditorTarget(
  name: string,
  group: THREE.Group,
  base: THREE.Object3D,
  collider: KinematicCollider,
  editState: KinematicEditState
): LevelStateTarget {
  return {
    kind: "kinematic",
    name,
    object: group,
    captureTransform() {
      return captureObjectTransform(base);
    },
    applyTransform(transform) {
      applyObjectTransform(base, transform);
      applyBaseTransform(group, base);
    },
    onTransformChanged() {
      copyTransform(base, group);
      collider.update(1 / 60, { active: !editState.active });
    },
  };
}

function setActorEditMode(
  active: boolean,
  group: THREE.Group,
  base: THREE.Object3D,
  collider: KinematicCollider,
  editState: KinematicEditState
) {
  editState.active = active;
  if (active) {
    applyBaseTransform(group, base);
    collider.update(1 / 60, { active: false });
    return;
  }
  collider.update(1 / 60, { active: true });
}

function applyBaseTransform(group: THREE.Group, base: THREE.Object3D) {
  copyTransform(group, base);
}

function copyTransform(target: THREE.Object3D, source: THREE.Object3D) {
  target.position.copy(source.position);
  target.quaternion.copy(source.quaternion);
  target.scale.copy(source.scale);
  target.updateMatrixWorld(true);
}

function applyAnimatedRotation(
  group: THREE.Group,
  base: THREE.Object3D,
  axis: Axis,
  angle: number
) {
  animationQuaternion.setFromAxisAngle(AXIS_VECTORS[axis], angle);
  group.quaternion.copy(base.quaternion).multiply(animationQuaternion);
  group.updateMatrixWorld(true);
}
