import assert from "node:assert/strict";
import * as THREE from "three";
import { test } from "vitest";
import BVHEcctrl, {
  GamepadControls,
  InstancedStaticCollider,
  KinematicCollider,
  StaticCollider,
  useButtonStore,
  useEcctrlStore,
  type EcctrlOptions,
} from "../src/lib/ecctrl/index";

test("BVHEcctrl exposes plain three.js groups and update API", () => {
  const camera = new THREE.PerspectiveCamera();
  camera.position.set(0, 1, 5);
  camera.lookAt(0, 0, 0);
  const model = new THREE.Group();
  const controller = new BVHEcctrl({ camera, children: model, delay: 0 });

  assert.equal(controller.group.isGroup, true);
  assert.equal(controller.model.children.includes(model), true);
  controller.setMovement({ forward: true, run: true });
  controller.update(1 / 60, 1);
  assert.equal(controller.group.children.includes(controller.model), true);
  controller.dispose();
});

test("StaticCollider registers and disposes generated collider mesh", () => {
  resetColliderStore();
  const root = createBoxColliderRoot();

  const collider = new StaticCollider(root);
  assert.equal(useEcctrlStore.getState().colliderMeshesArray.length, 1);
  collider.dispose();
  assert.equal(useEcctrlStore.getState().colliderMeshesArray.length, 0);
});

test("StaticCollider rebuilds baked geometry when transform changes", () => {
  resetColliderStore();
  const root = createBoxColliderRoot();
  const collider = new StaticCollider(root);

  collider.update({ position: [2, 0, 0] });
  const bounds = new THREE.Box3().setFromObject(
    requireColliderMesh(collider.mergedMesh)
  );
  assertApprox(bounds.min.x, 1.5);
  assertApprox(bounds.max.x, 2.5);
  collider.dispose();
});

test("StaticCollider expands collision geometry without scaling the display mesh", () => {
  resetColliderStore();
  const root = createBoxColliderRoot();
  const displayMesh = root.children[0] as THREE.Mesh;
  displayMesh.userData.collisionPadding = 0.1;

  const collider = new StaticCollider(root);
  const displayBounds = new THREE.Box3().setFromObject(displayMesh);
  const colliderBounds = new THREE.Box3().setFromObject(
    requireColliderMesh(collider.mergedMesh)
  );

  assertApprox(displayBounds.min.x, -0.5);
  assertApprox(displayBounds.max.x, 0.5);
  assertApprox(colliderBounds.min.x, -0.6);
  assertApprox(colliderBounds.max.x, 0.6);
  collider.dispose();
});

test("KinematicCollider updates kinematic user data", () => {
  resetColliderStore();
  const root = createBoxColliderRoot();
  const collider = new KinematicCollider(root);
  root.position.x = 1;
  collider.update(1 / 60);

  assert.equal(collider.mergedMesh?.userData.type, "KINEMATIC");
  assert.ok(collider.mergedMesh?.userData.linearVelocity instanceof THREE.Vector3);
  collider.dispose();
});

test("KinematicCollider keeps generated geometry in object-local space", () => {
  resetColliderStore();
  const root = createBoxColliderRoot();
  root.position.x = 2;
  const collider = new KinematicCollider(root);

  const bounds = new THREE.Box3().setFromObject(
    requireColliderMesh(collider.mergedMesh)
  );
  assertApprox(bounds.min.x, 1.5);
  assertApprox(bounds.max.x, 2.5);
  collider.dispose();
});

test("KinematicCollider still follows transforms while inactive", () => {
  resetColliderStore();
  const root = createBoxColliderRoot();
  const collider = new KinematicCollider(root, { active: false });

  root.position.x = 4;
  collider.update(1 / 60);
  const bounds = new THREE.Box3().setFromObject(
    requireColliderMesh(collider.mergedMesh)
  );
  assertApprox(bounds.min.x, 3.5);
  assertApprox(bounds.max.x, 4.5);
  assert.equal(collider.mergedMesh?.userData.linearVelocity.lengthSq(), 0);
  collider.dispose();
});

test("InstancedStaticCollider stores full world instance matrices once", () => {
  resetColliderStore();
  const root = new THREE.Group();
  const instanced = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), undefined, 1);
  instanced.position.x = 2;
  instanced.setMatrixAt(0, new THREE.Matrix4().makeTranslation(3, 0, 0));
  root.add(instanced);
  const collider = new InstancedStaticCollider(root);
  const matrix = new THREE.Matrix4();
  const position = new THREE.Vector3();

  collider.mergedMeshes[0].getMatrixAt(0, matrix);
  position.setFromMatrixPosition(matrix);
  assert.equal(position.x, 5);
  collider.dispose();
});

test("InstancedStaticCollider keeps instance-aware raycast distances", () => {
  resetColliderStore();
  const root = new THREE.Group();
  const instanced = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), undefined, 1);
  instanced.setMatrixAt(0, new THREE.Matrix4().makeTranslation(5, 0, 0));
  root.add(instanced);
  const collider = new InstancedStaticCollider(root);
  const raycaster = new THREE.Raycaster(
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(1, 0, 0),
    0,
    10
  );

  const hits = raycaster.intersectObject(collider.mergedMeshes[0], false);
  assertApprox(hits[0]?.distance ?? Infinity, 4.5);
  collider.dispose();
});

test("walkAirDragFactor strengthens non-run air movement", () => {
  const weak = createAirControlController({ walkAirDragFactor: 0.2 });
  const strong = createAirControlController({ walkAirDragFactor: 0.8 });

  weak.setMovement({ forward: true });
  strong.setMovement({ forward: true });
  weak.update(1 / 60, 1);
  strong.update(1 / 60, 1);

  assert.ok(Math.abs(strong.group.position.z) > Math.abs(weak.group.position.z));
  weak.dispose();
  strong.dispose();
});

test("setOptions keeps airDragFactor compatibility when walk factor is unset", () => {
  const controller = createAirControlController({ airDragFactor: 0.2 });
  controller.setOptions({ airDragFactor: 0.8 });
  controller.setMovement({ forward: true });
  controller.update(1 / 60, 1);

  const expected = createAirControlController({ airDragFactor: 0.8 });
  expected.setMovement({ forward: true });
  expected.update(1 / 60, 1);

  assertApprox(controller.group.position.z, expected.group.position.z);
  controller.dispose();
  expected.dispose();
});

test("explicit walkAirDragFactor remains independent from airDragFactor updates", () => {
  const controller = createAirControlController({
    airDragFactor: 0.2,
    walkAirDragFactor: 0.2,
  });
  controller.setOptions({ airDragFactor: 0.8 });
  controller.setMovement({ forward: true });
  controller.update(1 / 60, 1);

  const expected = createAirControlController({
    airDragFactor: 0.2,
    walkAirDragFactor: 0.2,
  });
  expected.setMovement({ forward: true });
  expected.update(1 / 60, 1);

  assertApprox(controller.group.position.z, expected.group.position.z);
  controller.dispose();
  expected.dispose();
});

test("run air movement keeps using airDragFactor", () => {
  const lowRun = createAirControlController({
    airDragFactor: 0.2,
    walkAirDragFactor: 0.8,
  });
  const highRun = createAirControlController({
    airDragFactor: 0.8,
    walkAirDragFactor: 0.8,
  });

  lowRun.setMovement({ forward: true, run: true });
  highRun.setMovement({ forward: true, run: true });
  lowRun.update(1 / 60, 1);
  highRun.update(1 / 60, 1);

  assert.ok(Math.abs(highRun.group.position.z) > Math.abs(lowRun.group.position.z));
  lowRun.dispose();
  highRun.dispose();
});

test("GamepadControls does not auto-start without browser Gamepad API", () => {
  const controls = new GamepadControls();
  controls.dispose();
  assert.ok(controls);
});

test("GamepadControls treats deep left stick tilt as run input", () => {
  const axes = [0, 1, 0, 0];
  const gamepad = {
    connected: true,
    axes,
    buttons: [],
  } as unknown as Gamepad;

  withMockGamepad(gamepad, ({ callbacks, createControls }) => {
    createControls({ runStickThreshold: 0.7 });
    const firstFrame = callbacks.shift();
    assert.ok(firstFrame);
    firstFrame(0);
    assert.equal(useButtonStore.getState().buttons.run, true);

    axes[1] = 0.2;
    const secondFrame = callbacks.shift();
    assert.ok(secondFrame);
    secondFrame(16);
    assert.equal(useButtonStore.getState().buttons.run, false);
  });
});

test("GamepadControls maps button 2 to punch by default", () => {
  const buttons = [
    { pressed: false, value: 0 },
    { pressed: false, value: 0 },
    { pressed: true, value: 1 },
  ];
  const gamepad = {
    connected: true,
    axes: [0, 0, 0, 0],
    buttons,
  } as unknown as Gamepad;

  withMockGamepad(gamepad, ({ callbacks, createControls }) => {
    createControls();
    const firstFrame = callbacks.shift();
    assert.ok(firstFrame);
    firstFrame(0);
    assert.equal(useButtonStore.getState().buttons.punch, true);

    buttons[2].pressed = false;
    buttons[2].value = 0;
    const secondFrame = callbacks.shift();
    assert.ok(secondFrame);
    secondFrame(16);
    assert.equal(useButtonStore.getState().buttons.punch, false);
  });
});

function assertApprox(actual: number, expected: number, epsilon = 1e-5) {
  assert.ok(
    Math.abs(actual - expected) <= epsilon,
    `expected ${actual} to be within ${epsilon} of ${expected}`
  );
}

function requireColliderMesh(mesh: THREE.Mesh | null) {
  assert.ok(mesh, "expected collider mesh to be generated");
  return mesh;
}

function resetColliderStore() {
  useEcctrlStore.setState({ colliderMeshesArray: [] });
}

function createBoxColliderRoot() {
  const root = new THREE.Group();
  root.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1)));
  return root;
}

function createAirControlController(options: Partial<EcctrlOptions>) {
  const camera = new THREE.PerspectiveCamera();
  camera.lookAt(0, 0, -1);
  return new BVHEcctrl({
    camera,
    delay: 0,
    acceleration: 30,
    airDragFactor: 0.2,
    maxWalkSpeed: 5,
    ...options,
  });
}

interface MockGamepadContext {
  callbacks: FrameRequestCallback[];
  createControls(
    options?: ConstructorParameters<typeof GamepadControls>[0]
  ): InstanceType<typeof GamepadControls>;
}

function withMockGamepad(
  gamepad: Gamepad,
  runTest: (context: MockGamepadContext) => void
) {
  const navigatorDescriptor = Object.getOwnPropertyDescriptor(
    globalThis,
    "navigator"
  );
  const originalRequestAnimationFrame = globalThis.requestAnimationFrame;
  const originalCancelAnimationFrame = globalThis.cancelAnimationFrame;
  const callbacks: FrameRequestCallback[] = [];
  let controls: InstanceType<typeof GamepadControls> | undefined;

  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: { getGamepads: () => [gamepad] },
  });
  globalThis.requestAnimationFrame = (callback: FrameRequestCallback) => {
    callbacks.push(callback);
    return callbacks.length;
  };
  globalThis.cancelAnimationFrame = () => {};
  useButtonStore.getState().resetAllButtons();

  try {
    runTest({
      callbacks,
      createControls(options) {
        controls = new GamepadControls(options);
        return controls;
      },
    });
  } finally {
    controls?.dispose();
    useButtonStore.getState().resetAllButtons();
    if (navigatorDescriptor) {
      Object.defineProperty(globalThis, "navigator", navigatorDescriptor);
    } else {
      Reflect.deleteProperty(globalThis, "navigator");
    }
    if (originalRequestAnimationFrame) {
      globalThis.requestAnimationFrame = originalRequestAnimationFrame;
    } else {
      Reflect.deleteProperty(globalThis, "requestAnimationFrame");
    }
    if (originalCancelAnimationFrame) {
      globalThis.cancelAnimationFrame = originalCancelAnimationFrame;
    } else {
      Reflect.deleteProperty(globalThis, "cancelAnimationFrame");
    }
  }
}
