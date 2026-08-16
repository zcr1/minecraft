# Craft

An MVP Minecraft clone that runs in the browser, written in TypeScript with React and Three.js on a small
component-entity engine (no off the shelf engine or physics library).

Play it at [zcr1.github.io/minecraft](https://zcr1.github.io/minecraft/).

It covers the basics: procedural terrain, mining and placing blocks, item drops, crafting, torches and lighting, a day/night cycle, water, and saving. A few extras on top of that, mostly TNT so things go BOOM.

## Running it

```bash
yarn install
yarn start      # dev server at http://localhost:3000
yarn build      # production build
yarn preview    # serve the production build
yarn test       # jest
```

## Controls

| Input             | Action                                         |
| ----------------- | ---------------------------------------------- |
| Mouse             | Look (click the canvas to lock the pointer)    |
| WASD              | Move                                           |
| Space             | Jump, or swim up while in water                |
| Left Shift        | Swim down                                      |
| Left click (hold) | Mine the targeted block                        |
| Right click       | Place the held block, or open a crafting table |
| 1-9               | Select a hotbar slot                           |
| E                 | Open the inventory and 2x2 crafting grid       |
| Escape            | Pause menu (save, or start a new world)        |
| Ctrl/Cmd + S      | Force an immediate save                        |

Dragging a stack out of the inventory window and releasing it drops the item into the world.

## What's implemented

**World generation.** Layered simplex noise drives the surface height. Three biomes (forest, mountain, lake) blend into
each other, with snow above y=60 in the mountains, water pooling at sea level, 3D noise caves, coal veins and three
shapes of oak tree.

**Blocks and items:** 15 block types plus a handful of non-block items (coal, sticks, torches, pickaxes, swords).
Blocks take time to break based on their material and the tool in your hand, with a crack overlay that advances through
10 stages and particle puffs at each stage. Broken blocks drop item entities that fall, bounce, spin and get sucked
toward the player when you walk near them. Some blocks drop something other than themselves (stone drops cobblestone,
leaves occasionally drop sticks).

**Crafting:** A 2x2 grid in the inventory and a 3x3 grid when you right click a crafting table. Recipes are matched
either shaped or shapeless, and shaped patterns are normalized to the top left corner so it does not matter where in
the grid you place the ingredients. The 3x3 table also falls back to the 2x2 recipe list when everything fits in a 2x2
area.

**Lighting:** Voxel sky light and torch block light, both flood filled and baked into the chunk mesh as a per-vertex
attribute. On top of that there is a real day/night cycle using the Three.js atmospheric sky shader, a star field that
fades in after dusk, distance fog that shifts between day, sunset and night colors, and a point light that follows you
when you are holding a torch.

**Water:** Water generates below sea level and flows. Placing or breaking a block wakes the water next to it, which
then spreads down first and sideways up to 7 blocks from its source. Swimming has its own movement mode and there is a
blue overlay when your head goes under.

**TNT:** Place it and you get a 4 second fuse with a flashing block, then a spherical blast that clears everything in a
radius of 4, drops the broken blocks as items, and chain-primes any other TNT it touches with a short fuse so the
explosions cascade.

**UI:** Hotbar and 36 slot inventory with drag and drop, stack merging and splitting, crafting panels, a crosshair,
first-person arm and held-item rendering with a swing animation, and a Tweakpane debug menu with FPS graph, player
position, no-clip, instant break, chunk boundary wireframes, a time-of-day slider and a TNT spawn button.

**Persistence:** Autosave every 30 seconds to IndexedDB, plus manual save from the pause menu or Ctrl+S.

## How the interesting parts work

### Chunk generation and streaming

Chunks are 16 x 32 x 16 voxels, stacked 3 high for a 96 block tall world, held in a `Map` keyed by a single 32-bit
integer packed from the chunk coordinates. Block data is a flat `Uint8Array` of block types, with a second `Uint8Array`
of per-voxel metadata used for torch orientation and water flow distance.

Generation runs per column. Surface height comes from fractal Brownian motion (several octaves of simplex noise summed
at rising frequency and falling amplitude), then the biome noise field blends the base height and amplitude toward
mountain or lake values with a smoothstep so there are no hard seams. After the columns are filled, three passes run
over the chunk: caves carve stone wherever a world-space 3D noise sample crosses a threshold, coal veins do a short
seeded random walk that converts the stone it lands on, and trees are placed.

Everything is seeded, so any chunk always generates identically. That matters in two places. Trees are the first: a
canopy can spill across a chunk border, so each chunk also generates the trees of all 8 neighbours and keeps whichever
blocks land inside its own bounds. Because the neighbour's tree positions are derived deterministically from its
origin, both chunks agree on the result without needing to talk to each other.

Streaming keeps a radius of 6 chunks around the player. Chunks that leave the radius are hidden rather than deleted, so
walking back is a free visibility toggle, and new chunks are generated nearest-first at a budget of 2 per frame to
avoid hitches.

Meshing is face-culled and split by material. Every visible face is appended into a per-material vertex buffer and each
buffer becomes one `THREE.Mesh`, so a chunk is a couple of dozen draw calls instead of thousands. Torches are the
exception and get a voxelized 3D mesh baked in, rotated by the attachment direction stored in the block metadata.

### Lighting

Each voxel gets one byte of light: sky light in the high nibble, block light in the low nibble, both 0-15.

Sky light is computed in three passes. First a top-down column seed, where each column inherits the light value of the
voxel directly above the chunk and carries it straight down through air with no falloff, which is what keeps a tunnel
under an overhang dark instead of resetting to full brightness. Leaves deliberately stop this pass, so a canopy casts a
real shadow. Second, a seed pass along the six chunk faces that pulls light in from already-lit neighbours so there is
no visible seam at chunk borders. Third, a breadth-first flood fill that spreads light at -1 per step through anything
transparent, including leaves, which is how the ground under a tree ends up dimmer but not black.

Block light works the same way with torches as emitters at level 14. Because a chunk is 16 wide and a torch reaches at
most 13 blocks past its own chunk, relighting the edited chunk plus its 6 face neighbours is always enough after a
placement or a break.

The result is written into the mesh as a per-vertex `aLight` attribute. A small `onBeforeCompile` patch on the material
multiplies `outgoingLight` by that value right before the opaque fragment stage, so the bake attenuates the directional
sun as well. Patching earlier only dimmed the albedo and left the sun shining onto cave walls.

### Persistence

Saving the whole world would mean storing every voxel of every chunk the player has ever loaded. Since terrain
generation is deterministic, the save only needs the seed plus whatever the player changed.

Each chunk keeps a pristine copy of its block and metadata arrays taken right after generation. On save, the live
arrays are diffed against that snapshot and only the differing voxels are written out, each as a linear index, block
type and metadata byte. Chunks with no edits are skipped entirely. Deltas belonging to chunks that were never streamed
in this session are carried straight through, so re-saving after roaming does not lose anything.

Loading stages the deltas by chunk key inside the chunk manager. They sit there until the player streams that chunk in,
at which point they are applied on top of the freshly generated terrain before lighting and meshing run, so the light
is computed against the state you actually left behind. Everything is stored in IndexedDB as a structured clone, which
avoids the localStorage size ceiling. A save whose version or shape does not match is discarded and the game starts
fresh instead of crashing.

## Layout

```
src/engine/     the game engine
  core/         Component, GameObject, Camera, EventManager
  chunk/        chunk storage, meshing, terrain generation, lighting
  player/       controller, physics, camera, block interaction, inventory
  items/        item types, dropped item entities, voxel item meshes
  block/        block types, materials, drop tables
  crafting/     recipe definitions and matching
  effects/      particles, overlays, TNT
  environment/  day/night cycle
  persistence/  save format, save manager, IndexedDB wrapper
  physics/      shared voxel collision helpers
src/ui/         React overlay (inventory, crafting, debug menu, crosshair)
src/game/       scene setup
test/           jest tests
```

`Game`, `Input` and `TextureManager` are module-level singletons. All game behavior lives in `Component` subclasses.
