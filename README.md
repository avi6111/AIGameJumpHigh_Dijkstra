# VRM Game Starter

**English | [日本語](README.ja.md)**

![VRM Game Starter screenshot](image\修改意见\1788520151280.png)

一个完整的跳跳乐，往向上条跳完整游戏 for building 3D games with [VRM](https://vrm.dev/en/) avatars and [Three.js](https://threejs.org/) (WebGPU). Clone it, run one command, and you have a walkable character on a playable level — then make it your own.

No physics engine（其实是自己实现了一个墙体碰撞）, no framework lock-in（接入了一个Vite框架做结算界面，也是很简单的）: plain TypeScript（有利有弊的） + Three.js, with fast triangle-accurate collision powered by [three-mesh-bvh](https://github.com/gkjohnson/three-mesh-bvh).

## Features

二次开发，写了一写备注：

- 🏃 **Animation retargeting** — one shared animation library (idle / walk / run / jump / punch) retargeted onto any humanoid VRM；只有简单的 Idle 和 Walk，加速还有跳步问题，请问这个动画系统是有多好呢
- 🦶 **Foot IK** — feet stick to slopes and steps  脚步其实没用，如这个游戏的一些滚动碰到了主角也没有受击攻击，就算上楼梯做的在漂亮，玩家也没什么感受，也体会不到重力和动作的重量
- 🎮 **Character controller** — floating-capsule controller with no physics engine, built on the [BVHEcctrl](https://github.com/pmndrs/BVHEcctrl) core (keyboard / gamepad / touch)；虽然说是人物控制器，但 BVH 的物理系统反而是不错，才是核心；
- 🗺️ **In-app level editor** — move, rotate, and scale level objects in the browser, save to localStorage or export JSON；不怎么好用的编辑器，二次开发写了一个 Auto Connect
- 🌅 **WebGPU rendering** — SSGI, ambient occlusion, bloom, cascaded shadow maps, and a dynamic sky; 真的吗？
- 🔍 **Inspector** — tweak rendering, shadows, sky, camera, and controller parameters live；Threejs 的官方工具，能用，只是不知道怎么用
- ✅ **Tested** — the gameplay-critical math (IK, camera, retarget contracts, level state) is covered by unit tests；自动化测试，暂时没管；
- 🧍 **VRM avatars** — loads VRM 0.x and VRM 1.0 models, with drag & drop to swap your avatar at runtime；

## Requirements

- [Node.js](https://nodejs.org/) 20 (因为绑定 npm 工具, 需要 npm run dev)
- A Browser (recent Chrome or Edge)手机都有浏览器，这不用说
- Threejs，需各种 3d 引擎基础 ，无论商业引擎或开源，不论原生或者网页Webgl， 不一定只包括 Threejs；

## Quick Start

```bash
# Use this template on GitHub, or clone it:
git clone https://github.com/norio/vrm-game-starter.git
cd vrm-game-starter

npm install
npm run dev
```

**测试 dict 方法**

```JavaScript
cd dist
npx serve .
```

## Project Structure(仅记录二次开发部分)

```
index.html            Entry HTML (canvas, HUD, drop overlay)
src/
  main.ts             Bootstraps the app
  app/                Game shell
    App.ts            Wires everything together — start reading here
    Controller.ts     Player input + character controller setup
    CameraRig.ts      Third-person follow camera (with collision)
    Level.ts          Level assembly + colliders + save/load
    LevelLayout.ts    The level geometry — edit this to build your map
    LevelGimmicks.ts  Moving platforms and other kinematic objects
    LevelEditor.ts    In-app transform editor
    Inspector.ts      Live parameter panel
  character/          VRM loading, animation retargeting, foot IK
  render/             WebGPU render graph (SSGI / AO / bloom)
  scene/              Sky and cascaded shadow maps
  lib/ecctrl/         Character controller core (based on BVHEcctrl)
  assets/             Sample VRMs + animation library
test/                 Unit tests (vitest)
```

## Learning Resources

- [Three.js manual](https://threejs.org/manual/) — fundamentals of scenes, cameras, and materials
- [VRM documentation](https://vrm.dev/en/) — the VRM avatar format
- [@pixiv/three-vrm](https://github.com/pixiv/three-vrm) — the VRM loader used here
- [three-mesh-bvh](https://github.com/gkjohnson/three-mesh-bvh) — the collision acceleration structure

## Credits

- Character controller core based on [BVHEcctrl](https://github.com/pmndrs/BVHEcctrl) by [Erdong Chen (Andrew)](https://github.com/ErdongChen-Andrew) (MIT)
- Animations from the [Universal Animation Library](https://quaternius.itch.io/universal-animation-library) by [Quaternius](https://x.com/quaternius)
- Sample avatars were made with [VRoid Studio](https://vroid.com/) and are VRoid sample models (redistribution permitted by their license)

## License

The source code is licensed under [MIT](LICENSE).

The bundled assets are **not** covered by MIT and remain under their own licenses:

- `src/assets/sample.vrm`, `src/assets/sample2.vrm` — VRoid sample models, redistributed under the terms declared in their VRM metadata
- `src/assets/AnimationLibrary.glb` — built from the [Universal Animation Library](https://quaternius.itch.io/universal-animation-library) by Quaternius

When you publish your own game, replace or review these assets according to their licenses.
