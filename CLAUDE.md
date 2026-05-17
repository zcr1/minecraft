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

- **`Component`** — base class for all behavior. Subclass it and override `update()` for per-frame logic, `start()` for one-time setup after all components are registered, and `dispose()` to release Three.js resources (geometries, materials, scene objects) when the engine stops.
- **`GameObject`** — an entity that owns a set of components, keyed by constructor type (one instance per component type enforced). Calls `update()` on all components each frame when `enabled = true`. `dispose()` fans out to all owned components.
- **`Game`** — owns the game loop (`requestAnimationFrame`), the `THREE.Scene`, the set of `GameObject`s, the renderer, and the camera. Ticks all active GameObjects each frame and is the entry point for starting/stopping the engine. `Game.stop()` disposes every GameObject before clearing. Module-level singleton — call `game.init(container)` once before `game.start()`.

Engine-wide services like `Game`, `Input`, and `TextureManager` are module-level singletons: the module default-exports a `new Foo()` instance, and callers import that instance directly.

New engine behavior goes in a `Component` subclass. `GameObject` itself should stay logic-free.

### Major Systems

- **Terrain** — `ChunkComponent` represents a voxel chunk (with `BlockType`: Air/Dirt/Grass/Bedrock). Each block tracks integer hit points in a `Uint8Array` so destruction can be driven by `hitBlock(x, y, z, damage)`. `ChunkManager` maintains a grid of chunks stored in a `Map`, handles chunk generation and face-culled mesh building.
- **Player** — a `GameObject` with `Transform`, `PlayerPhysics` (gravity, terrain collision), `PlayerController` (WASD movement), `PlayerCamera` (pointer-lock first-person camera with eye offset), and `PlayerBlockInteraction` (raycasts each frame; while left-click is held, accumulates `damageProgress` 0→1 over 1.2 s on the targeted block, exposing `targetedBlock`, `damageStage`, and `onStageAdvanced` / `onBlockBroken` callbacks for sibling effect components).
- **Input** — `Input` (Singleton) tracks keyboard, mouse, and scroll state each frame; provides NDC conversion for raycasting. Distinguishes "held" from "pressed this frame" — use `isMouseHeld(0)` for continuous actions, `wasMousePressed(0)` for one-shots.
- **Camera** — `Camera` wraps Three.js `PerspectiveCamera`. `DebugCameraController` is a free-look component (mouse + keyboard zoom).
- **Rendering** — `Renderer` wraps `WebGLRenderer`. `TextureManager` (Singleton) loads and caches Three.js materials for block types, plus the 10 `destroy_stage_*.png` crack-overlay textures (`createBlockBreakMaterial()` / `setBlockBreakStage()`; `BLOCK_BREAK_STAGE_COUNT` is the source of truth for stage count).
- **Effects** — `BlockDamageOverlay` (`src/engine/effects/`) is a single oversized cube mesh that snaps to the targeted block and swaps crack textures based on `PlayerBlockInteraction.damageStage`. `BlockBreakParticles` manages a pre-allocated pool of cube particles via free-list + active-set, spawning block-tinted puffs on each stage advance and a larger burst on destruction.

### Path alias

`engine/*` resolves to `src/engine/*` (configured in `tsconfig.json`). Use this alias for engine imports:

```ts
import GameObject from "engine/core/GameObject";
```

### Utilities

- **`GameObjectNames`** (`engine/utils/gameObjectNames.ts`) — enum of named `GameObject` identifiers (BlockBreakParticles, BlockDamageOverlay, ChunkManager, DebugCamera, Player). Use these constants instead of raw strings when looking up objects in the scene.
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
