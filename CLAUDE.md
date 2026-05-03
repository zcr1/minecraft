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
- **`Scene`** — a flat array of `GameObject`s. Not yet wired into a game loop.
- **`ObjectPool`** — utility for reusing `GameObject` instances (currently stubbed out).

New engine behavior goes in a `Component` subclass. `GameObject` itself should stay logic-free.

### Path alias

`engine/*` resolves to `src/engine/*` (configured in `tsconfig.json`). Use this alias for engine imports:

```ts
import GameObject from 'engine/core/GameObject';
```

Note: the Jest config (`jest.config.ts`) only maps `@/` → `src/`, not `engine/`. Engine imports inside test files must use relative paths (`../src/engine/...`) until that mapping is added.

### UI

`src/index.tsx` bootstraps React into `#root`. `src/ui/App.tsx` is the root component. The UI layer will eventually host the Three.js canvas and any HUD/controls.

## Tests

Tests live in `test/` (not colocated with source). Jest uses `ts-jest` with `testEnvironment: node`.
