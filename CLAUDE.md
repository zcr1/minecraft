# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
yarn start        # dev server at http://localhost:3000
yarn build        # production build
yarn preview      # preview production build
yarn test         # run all tests
yarn test -- --testPathPattern=GameObject  # run a single test file
```

## Architecture

This is a Minecraft-style 3D game built with React + Three.js. The codebase is split into a game engine (`src/engine/`) and a React UI layer (`src/ui/`).

### Engine (ECS-inspired)

The engine uses a component-entity pattern:

- **`Component`** — base class for all behavior. Subclass it and override `update()` for per-frame logic.
- **`GameObject`** — an entity that owns a set of components, keyed by constructor type (one instance per component type enforced). Calls `update()` on all components each frame when `enabled = true`.
- **`Scene`** — a `Set<GameObject>`. Has its own `update()` which ticks all active GameObjects; wired into the game loop via `Game.ts`.
- **`Game`** — owns the game loop (`requestAnimationFrame`), the scene, renderer, and camera. Entry point for starting/stopping the engine.

Engine-wide services like `Input` and `TextureManager` are module-level singletons: the module default-exports a `new Foo()` instance, and callers import that instance directly.

New engine behavior goes in a `Component` subclass. `GameObject` itself should stay logic-free.

### Major Systems

- **Terrain** — `ChunkComponent` represents a voxel chunk (with `BlockType`: Air/Dirt/Grass). `ChunkManager` maintains a grid of chunks stored in a `Map`, handles chunk generation and face-culled mesh building.
- **Player** — a `GameObject` with `Transform`, `PlayerPhysics` (gravity, terrain collision), `PlayerController` (WASD movement), and `PlayerCamera` (pointer-lock first-person camera with eye offset).
- **Input** — `Input` (Singleton) tracks keyboard, mouse, and scroll state each frame; provides NDC conversion for raycasting.
- **Camera** — `Camera` wraps Three.js `PerspectiveCamera`. `DebugCameraController` is a free-look component (mouse + keyboard zoom).
- **Rendering** — `Renderer` wraps `WebGLRenderer`. `TextureManager` (Singleton) loads and caches Three.js materials for block types.
- **Interaction** — `DebugClicker` component uses raycasting to detect and remove blocks on click.

### Path alias

`engine/*` resolves to `src/engine/*` (configured in `tsconfig.json`). Use this alias for engine imports:

```ts
import GameObject from "engine/core/GameObject";
```

### Utilities

- **`GameObjectNames`** (`engine/utils/gameObjectNames.ts`) — enum of named `GameObject` identifiers (ChunkManager, DebugCamera, DebugClicker, Player). Use these constants instead of raw strings when looking up objects in the scene.
- **`KeyCode`** (`engine/utils/keyCode.ts`) — TypeScript type and validation helper for keyboard key strings used by `Input`.

### UI

`src/index.tsx` bootstraps React into `#root`. `src/ui/App.tsx` is the root component. `src/ui/GameCanvas.tsx` mounts the `Game` instance and provides the Three.js canvas DOM element. `GameContext.tsx` exposes the `Game` instance via React context so any child component can access it. `DebugMenu.tsx` is a Tweakpane-based overlay for toggling between the debug free-cam and the player camera.

### Scene setup

`src/game/setup.ts` contains the scene initialization function — add new GameObjects and configure systems here.

## Tests

Tests live in `test/` (not colocated with source). Jest uses `ts-jest` with `testEnvironment: node`.

## Coding Conventions

### No abbreviated variable names

Use full, descriptive names. Single-letter or truncated names are not allowed:

| Instead of       | Use                          |
| ---------------- | ---------------------------- |
| `dx`, `dy`, `dz` | `deltaX`, `deltaY`, `deltaZ` |
| `wx`, `wy`, `wz` | `worldX`, `worldY`, `worldZ` |
| `cx`, `cz`       | `chunkX`, `chunkZ`           |
| `len`            | `length`                     |

This applies to parameters, locals, fields, and loop variables. The only exception is well-established math/loop indices (`i`, `j`) in tightly scoped loops where the meaning is unambiguous.

### No single-line conditionals

Always use braces and place the body on its own line. Do not write single-line `if` statements, even for early returns or loop control.

```ts
// Bad
if (flag) continue;
if (!entity) return;

// Good
if (flag) {
    continue;
}
if (!entity) {
    return;
}
```
