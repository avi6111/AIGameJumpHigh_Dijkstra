# VRM Game Starter

**English | [日本語](README.ja.md)**

A beginner-friendly starter template for building 3D games with [VRM](https://vrm.dev/en/) avatars and [Three.js](https://threejs.org/) (WebGPU). Clone it, run one command, and you have a walkable character on a playable level — then make it your own.

No physics engine, no framework lock-in: plain TypeScript + Three.js, with fast triangle-accurate collision powered by [three-mesh-bvh](https://github.com/gkjohnson/three-mesh-bvh).

## Features

- 🧍 **VRM avatars** — loads VRM 0.x and VRM 1.0 models, with drag & drop to swap your avatar at runtime
- 🏃 **Animation retargeting** — one shared animation library (idle / walk / run / jump / punch) retargeted onto any humanoid VRM
- 🦶 **Foot IK** — feet stick to slopes and steps
- 🎮 **Character controller** — floating-capsule controller with no physics engine, built on the [BVHEcctrl](https://github.com/pmndrs/BVHEcctrl) core (keyboard / gamepad / touch)
- 🗺️ **In-app level editor** — move, rotate, and scale level objects in the browser, save to localStorage or export JSON
- 🌅 **WebGPU rendering** — SSGI, ambient occlusion, bloom, cascaded shadow maps, and a dynamic sky
- 🔍 **Inspector** — tweak rendering, shadows, sky, camera, and controller parameters live
- ✅ **Tested** — the gameplay-critical math (IK, camera, retarget contracts, level state) is covered by unit tests

## Requirements

- [Node.js](https://nodejs.org/) 20 or newer
- A browser with WebGPU support (recent Chrome or Edge recommended)

## Quick Start

```bash
# Use this template on GitHub, or clone it:
git clone https://github.com/norio/vrm-game-starter.git
cd vrm-game-starter

npm install
npm run dev
```

Open the printed URL (usually `http://localhost:5173`) and walk around.

## Use Your Own Avatar

Two ways:

1. **Drag & drop** — drop any `.vrm` file onto the window. Works with VRM 0.x and VRM 1.0.
2. **Replace the default** — overwrite [src/assets/sample.vrm](src/assets/sample.vrm) with your model (keep the filename, or update the URL in [AnimatedCharacterModel.ts](src/character/AnimatedCharacterModel.ts)).

You can create your own avatar for free with [VRoid Studio](https://vroid.com/en/studio).

## Controls

| Input | Action |
| --- | --- |
| `W` `A` `S` `D` / arrow keys | Move |
| `Shift` | Run |
| `Space` | Jump |
| Left click | Punch |
| Mouse drag / wheel | Orbit & zoom camera |
| Gamepad | Left stick move, right stick camera, buttons jump/punch/run |
| Touch | Virtual joystick + buttons (shown automatically) |

Open the **Inspector** panel (top-right) to tweak rendering and gameplay parameters, or use **Level → Edit** to enter the in-app level editor.

## Project Structure

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

## Make It Yours

| I want to… | Edit |
| --- | --- |
| Change walk/run speed, jump height | [src/app/Controller.ts](src/app/Controller.ts) (`createEcctrl` options) |
| Build my own level | [src/app/LevelLayout.ts](src/app/LevelLayout.ts) — or use the in-app editor and export JSON |
| Add moving platforms | [src/app/LevelGimmicks.ts](src/app/LevelGimmicks.ts) |
| Change the camera feel | [src/app/CameraRig.ts](src/app/CameraRig.ts) |
| Add new animations / actions | [src/assets/AnimationLibrary.glb](src/assets/AnimationLibrary.glb) + [src/character/AnimationContract.ts](src/character/AnimationContract.ts) |
| Tune lighting, sky, post-processing | [src/scene/](src/scene), [src/render/](src/render) — or live in the Inspector |

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` | Production build into `dist/` |
| `npm run preview` | Preview the production build |
| `npm run typecheck` | TypeScript type check |
| `npm test` | Run unit tests |

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
