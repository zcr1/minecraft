import * as THREE from "three";
import textureManager from "../TextureManager";
import { BlockType, INDESTRUCTIBLE_BLOCKS } from "../block/BlockType";
import Component from "../core/Component";
import type { VoxelDelta } from "../persistence/SaveData";
import type ChunkManager from "./ChunkManager";
import type TerrainGenerator from "./TerrainGenerator";

// Each face: 4 vertices (x,y,z relative to block center), outward normal, neighbor offset to check
const FACES = [
    // +X (right)
    {
        vertices: [0.5, -0.5, 0.5, 0.5, -0.5, -0.5, 0.5, 0.5, -0.5, 0.5, 0.5, 0.5],
        normal: [1, 0, 0],
        neighbor: [1, 0, 0],
    },
    // -X (left)
    {
        vertices: [-0.5, -0.5, -0.5, -0.5, -0.5, 0.5, -0.5, 0.5, 0.5, -0.5, 0.5, -0.5],
        normal: [-1, 0, 0],
        neighbor: [-1, 0, 0],
    },
    // +Y (top)
    {
        vertices: [-0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, -0.5, -0.5, 0.5, -0.5],
        normal: [0, 1, 0],
        neighbor: [0, 1, 0],
    },
    // -Y (bottom)
    {
        vertices: [-0.5, -0.5, -0.5, 0.5, -0.5, -0.5, 0.5, -0.5, 0.5, -0.5, -0.5, 0.5],
        normal: [0, -1, 0],
        neighbor: [0, -1, 0],
    },
    // +Z (front)
    {
        vertices: [-0.5, -0.5, 0.5, 0.5, -0.5, 0.5, 0.5, 0.5, 0.5, -0.5, 0.5, 0.5],
        normal: [0, 0, 1],
        neighbor: [0, 0, 1],
    },
    // -Z (back)
    {
        vertices: [0.5, -0.5, -0.5, -0.5, -0.5, -0.5, -0.5, 0.5, -0.5, 0.5, 0.5, -0.5],
        normal: [0, 0, -1],
        neighbor: [0, 0, -1],
    },
] as const;

const FACE_UVS = [0, 0, 1, 0, 1, 1, 0, 1];

// Torch geometry keyed by the direction of the solid block the torch is attached to.
// Each entry lists one or more quads (12 floats = 4 vertices × xyz) relative to the block center.
// Wall cases: a single flat quad pressed against the attachment face.
// Floor case: two narrow crossed vertical quads sitting on the block floor.
const TORCH_QUADS: ReadonlyArray<{
    readonly offset: readonly [number, number, number];
    readonly quads: ReadonlyArray<ReadonlyArray<number>>;
}> = [
    {
        // Floor — solid below. Cross of two narrow vertical quads; bottom flush with the block floor.
        offset: [0, -1, 0],
        quads: [
            [-0.1, -0.5, 0, 0.1, -0.5, 0, 0.1, 0.05, 0, -0.1, 0.05, 0],
            [0, -0.5, -0.1, 0, -0.5, 0.1, 0, 0.05, 0.1, 0, 0.05, -0.1],
        ],
    },
    {
        // Wall −X — solid to the left. Flat quad pressed against the −X face.
        offset: [-1, 0, 0],
        quads: [[-0.45, -0.3, -0.25, -0.45, -0.3, 0.25, -0.45, 0.3, 0.25, -0.45, 0.3, -0.25]],
    },
    {
        // Wall +X — solid to the right. Flat quad pressed against the +X face.
        offset: [1, 0, 0],
        quads: [[0.45, -0.3, -0.25, 0.45, -0.3, 0.25, 0.45, 0.3, 0.25, 0.45, 0.3, -0.25]],
    },
    {
        // Wall −Z — solid behind. Flat quad pressed against the −Z face.
        offset: [0, 0, -1],
        quads: [[-0.25, -0.3, -0.45, 0.25, -0.3, -0.45, 0.25, 0.3, -0.45, -0.25, 0.3, -0.45]],
    },
    {
        // Wall +Z — solid in front. Flat quad pressed against the +Z face.
        offset: [0, 0, 1],
        quads: [[-0.25, -0.3, 0.45, 0.25, -0.3, 0.45, 0.25, 0.3, 0.45, -0.25, 0.3, 0.45]],
    },
];

// The 5 possible attachment-offset directions, one per TORCH_QUADS entry (index = blockMeta value).
// Exported so ChunkManager can walk adjacent positions when a support block is destroyed.
export const TORCH_ATTACHMENT_OFFSETS: ReadonlyArray<readonly [number, number, number]> = TORCH_QUADS.map(
    ({ offset }) => offset,
);

// Maps a placement hit-normal to the TORCH_QUADS index for that attachment direction.
// The hit normal is the outward face of the clicked block; the torch attaches on the opposite
// side, so its support offset equals −hitNormal. Returns −1 for the bottom face (ceiling),
// which has no geometry entry and should be rejected at the call site.
export function torchQuadIndexFromHitNormal(normalX: number, normalY: number, normalZ: number): number {
    if (normalY === 1) {
        return 0; // top face hit → torch sits on floor (solid below)
    }
    if (normalX === 1) {
        return 1; // +X face hit → torch on −X wall (solid to its left)
    }
    if (normalX === -1) {
        return 2; // −X face hit → torch on +X wall (solid to its right)
    }
    if (normalZ === 1) {
        return 3; // +Z face hit → torch on −Z wall (solid behind)
    }
    if (normalZ === -1) {
        return 4; // −Z face hit → torch on +Z wall (solid in front)
    }
    return -1; // bottom face hit (ceiling) — no torch geometry for this case
}

// Per-material vertex buffers accumulated during meshing, then handed to a single BufferGeometry.
interface SubMesh {
    positions: number[];
    normals: number[];
    uvs: number[];
    lights: number[];
    indices: number[];
}

function createSubMesh(): SubMesh {
    return { positions: [], normals: [], uvs: [], lights: [], indices: [] };
}

// todo doesn't need to be Component?
export default class ChunkComponent extends Component {
    readonly mesh: THREE.Group;
    readonly width: number;
    readonly height: number;
    readonly depth: number;
    readonly worldOriginX: number;
    readonly worldOriginY: number;
    readonly worldOriginZ: number;

    private readonly blocks: Uint8Array;
    // Byte per voxel: high nibble = sky light, low nibble = block light (reserved for emissives).
    // Packing both channels into one byte keeps the per-chunk light memory at width*height*depth
    // bytes instead of doubling it when block-light gets implemented.
    private readonly lightLevels: Uint8Array;
    // Auxiliary byte per voxel for block-type-specific data. For torches this stores the
    // TORCH_QUADS index (0-4) set at placement time via torchQuadIndexFromHitNormal, locking
    // the visual orientation to the face the player actually clicked rather than re-inferring it
    // from whichever neighbour happens to be solid at the next mesh rebuild. For water it stores
    // current flow distance
    private readonly blockMeta: Uint8Array;

    constructor(
        width: number,
        height: number,
        depth: number,
        worldOriginX: number,
        worldOriginY: number,
        worldOriginZ: number,
    ) {
        super();

        this.width = width;
        this.height = height;
        this.depth = depth;
        this.worldOriginX = worldOriginX;
        this.worldOriginY = worldOriginY;
        this.worldOriginZ = worldOriginZ;
        this.blocks = new Uint8Array(width * height * depth);
        this.lightLevels = new Uint8Array(width * height * depth);
        this.blockMeta = new Uint8Array(width * height * depth);
        this.mesh = new THREE.Group();
        this.mesh.userData.chunk = this;
    }

    private pushFace(
        face: (typeof FACES)[number],
        x: number,
        y: number,
        z: number,
        subMesh: SubMesh,
        lightValue: number,
    ) {
        const base = subMesh.positions.length / 3;
        for (let v = 0; v < 4; v++) {
            subMesh.positions.push(
                face.vertices[v * 3] + x,
                face.vertices[v * 3 + 1] + y,
                face.vertices[v * 3 + 2] + z,
            );
            subMesh.normals.push(face.normal[0], face.normal[1], face.normal[2]);
            subMesh.uvs.push(FACE_UVS[v * 2], FACE_UVS[v * 2 + 1]);
            subMesh.lights.push(lightValue);
        }
        subMesh.indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }

    // Appends a single quad from TORCH_QUADS to subMesh. The material must be DoubleSide because
    // each quad must be visible from both faces. Called once per quad in the attachment entry.
    //
    // The normal is derived analytically from the quad's own vertex data via (v1−v0) × (v3−v0)
    // so that directional-light shading in applyVertexLighting runs on the correct axis for each
    // quad orientation (floor cross-quads get ±X / ±Z normals; wall quads get their inward normal).
    // Using the hardcoded upward (0,1,0) previously caused vertical torch quads to receive no
    // directional-sun contribution and rendered them purely by ambient + aLight.
    private pushCrossQuad(
        vertices: ReadonlyArray<number>,
        x: number,
        y: number,
        z: number,
        subMesh: SubMesh,
        lightValue: number,
    ) {
        // Compute face normal from two edge vectors: edge1 = v1−v0, edge2 = v3−v0.
        // All four vertices of a flat quad share the same normal so we compute it once.
        const edge1X = vertices[3] - vertices[0];
        const edge1Y = vertices[4] - vertices[1];
        const edge1Z = vertices[5] - vertices[2];
        const edge2X = vertices[9] - vertices[0];
        const edge2Y = vertices[10] - vertices[1];
        const edge2Z = vertices[11] - vertices[2];
        const crossX = edge1Y * edge2Z - edge1Z * edge2Y;
        const crossY = edge1Z * edge2X - edge1X * edge2Z;
        const crossZ = edge1X * edge2Y - edge1Y * edge2X;
        const crossLength = Math.sqrt(crossX * crossX + crossY * crossY + crossZ * crossZ);
        const normalX = crossX / crossLength;
        const normalY = crossY / crossLength;
        const normalZ = crossZ / crossLength;

        const base = subMesh.positions.length / 3;
        for (let v = 0; v < 4; v++) {
            subMesh.positions.push(vertices[v * 3] + x, vertices[v * 3 + 1] + y, vertices[v * 3 + 2] + z);
            subMesh.normals.push(normalX, normalY, normalZ);
            subMesh.uvs.push(FACE_UVS[v * 2], FACE_UVS[v * 2 + 1]);
            subMesh.lights.push(lightValue);
        }
        subMesh.indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }

    // Returns the quad vertices for a torch at (x, y, z) using the attachment direction
    // stored in blockMeta (set at placement time via torchQuadIndexFromHitNormal). This locks
    // the orientation to the face the player clicked and prevents it from silently flipping when
    // neighbours change (e.g. after a relight-rebuild triggered by a different block).
    private getTorchQuads(x: number, y: number, z: number): ReadonlyArray<ReadonlyArray<number>> {
        const meta = this.getBlockMeta(x, y, z);
        return (TORCH_QUADS[meta] ?? TORCH_QUADS[0]).quads;
    }

    private buildGeometry(subMesh: SubMesh) {
        const geo = new THREE.BufferGeometry();
        geo.setAttribute("position", new THREE.Float32BufferAttribute(subMesh.positions, 3));
        geo.setAttribute("normal", new THREE.Float32BufferAttribute(subMesh.normals, 3));
        geo.setAttribute("uv", new THREE.Float32BufferAttribute(subMesh.uvs, 2));
        geo.setAttribute("aLight", new THREE.Float32BufferAttribute(subMesh.lights, 1));
        geo.setIndex(subMesh.indices);
        return geo;
    }

    private isAirOrOOB(x: number, y: number, z: number): boolean {
        if (x < 0 || x >= this.width || y < 0 || y >= this.height || z < 0 || z >= this.depth) {
            return true;
        }
        const block = this.getBlock(x, y, z);
        return (
            block === BlockType.Air ||
            block === BlockType.OakLeaves ||
            block === BlockType.Torch ||
            block === BlockType.Water
        );
    }

    private isInBounds(x: number, y: number, z: number): boolean {
        return x >= 0 && x < this.width && y >= 0 && y < this.height && z >= 0 && z < this.depth;
    }

    private getBlockIndex(x: number, y: number, z: number) {
        return x * this.height * this.depth + y * this.depth + z;
    }

    generate(generator: TerrainGenerator) {
        for (let localX = 0; localX < this.width; localX++) {
            for (let localZ = 0; localZ < this.depth; localZ++) {
                const worldX = this.worldOriginX + localX;
                const worldZ = this.worldOriginZ + localZ;
                // Surface height and biome only depend on (x, z), so compute once per column.
                const { surface, biome } = generator.getColumn(worldX, worldZ);
                for (let localY = 0; localY < this.height; localY++) {
                    const worldY = this.worldOriginY + localY;
                    if (worldY === 0) {
                        this.setBlock(localX, localY, localZ, BlockType.Bedrock);
                        continue;
                    }
                    if (worldY > surface) {
                        // Fill open air below sea level with water.
                        if (worldY <= generator.seaLevel) {
                            this.setBlock(localX, localY, localZ, BlockType.Water);
                        }
                        continue;
                    }
                    // Grass doesn't grow on submerged surfaces — use dirt instead.
                    const blockType =
                        worldY === surface && surface < generator.seaLevel
                            ? BlockType.Dirt
                            : generator.blockTypeForLayer(worldY, surface, biome);
                    this.setBlock(localX, localY, localZ, blockType);
                }
            }
        }
        generator.carveCaves(this);
        generator.placeCoalVeins(this);
        generator.placeTrees(this);
    }

    rebuild(chunkManager: ChunkManager): void {
        this.buildMesh(chunkManager);
    }

    buildMesh(chunkManager: ChunkManager): void {
        const meshes: Record<
            string,
            {
                subMesh: SubMesh;
                material: () => THREE.Material;
                renderOrder?: number;
            }
        > = {
            bedrock: { subMesh: createSubMesh(), material: () => textureManager.getMaterial(BlockType.Bedrock, 0) },
            coalOre: { subMesh: createSubMesh(), material: () => textureManager.getMaterial(BlockType.CoalOre, 0) },
            cobblestone: {
                subMesh: createSubMesh(),
                material: () => textureManager.getMaterial(BlockType.Cobblestone, 0),
            },
            dirt: { subMesh: createSubMesh(), material: () => textureManager.getMaterial(BlockType.Dirt, 0) },
            grassSide: { subMesh: createSubMesh(), material: () => textureManager.getMaterial(BlockType.Grass, 0) },
            grassTop: { subMesh: createSubMesh(), material: () => textureManager.getMaterial(BlockType.Grass, 1) },
            oakLeaves1: { subMesh: createSubMesh(), material: () => textureManager.getLeavesMaterial(0) },
            oakLeaves2: { subMesh: createSubMesh(), material: () => textureManager.getLeavesMaterial(1) },
            oakLogSide: { subMesh: createSubMesh(), material: () => textureManager.getMaterial(BlockType.OakLog, 0) },
            oakLogTop: { subMesh: createSubMesh(), material: () => textureManager.getMaterial(BlockType.OakLog, 1) },
            oakPlanks: { subMesh: createSubMesh(), material: () => textureManager.getMaterial(BlockType.OakPlanks, 0) },
            craftingTableTop: {
                subMesh: createSubMesh(),
                material: () => textureManager.getCraftingTableMaterial(0, 1, 0),
            },
            craftingTableFront: {
                subMesh: createSubMesh(),
                material: () => textureManager.getCraftingTableMaterial(0, 0, -1),
            },
            craftingTableBack: {
                subMesh: createSubMesh(),
                material: () => textureManager.getCraftingTableMaterial(0, 0, 1),
            },
            craftingTableSide: {
                subMesh: createSubMesh(),
                material: () => textureManager.getCraftingTableMaterial(1, 0, 0),
            },
            dirtSnowSide: { subMesh: createSubMesh(), material: () => textureManager.getDirtSnowMaterial(0) },
            dirtSnowTop: { subMesh: createSubMesh(), material: () => textureManager.getDirtSnowMaterial(1) },
            dirtSnowBottom: { subMesh: createSubMesh(), material: () => textureManager.getDirtSnowMaterial(-1) },
            snow: { subMesh: createSubMesh(), material: () => textureManager.getSnowMaterial() },
            stone: { subMesh: createSubMesh(), material: () => textureManager.getMaterial(BlockType.Stone, 0) },
            torch: { subMesh: createSubMesh(), material: () => textureManager.getTorchMaterial() },
            // Water renderOrder=1 is it is rendered after all opaque geometry and alpha blending sorts correctly.
            water: { subMesh: createSubMesh(), material: () => textureManager.getWaterMaterial(), renderOrder: 1 },
        };

        for (let x = 0; x < this.width; x++) {
            for (let y = 0; y < this.height; y++) {
                for (let z = 0; z < this.depth; z++) {
                    const block = this.getBlock(x, y, z);
                    if (block === BlockType.Air) {
                        continue;
                    }

                    // Torch renders as a surface-affixed sprite rather than cube faces.
                    // Attachment direction is stored in blockMeta at placement time.
                    if (block === BlockType.Torch) {
                        const lightValue = Math.max(this.getSkyLight(x, y, z), this.getBlockLight(x, y, z));
                        for (const quadVerts of this.getTorchQuads(x, y, z)) {
                            this.pushCrossQuad(quadVerts, x, y, z, meshes.torch.subMesh, lightValue);
                        }
                        continue;
                    }

                    // Water uses different face culling: only render faces adjacent to air.
                    // Internal water-water faces are culled; faces against opaque blocks are also
                    // culled since the opaque block's own face covers that boundary.
                    // For out-of-bounds neighbours we query the chunk manager so that water blocks
                    // straddling a chunk boundary don't each render a face toward each other,
                    // which would produce a doubled semi-transparent seam at the boundary.
                    if (block === BlockType.Water) {
                        for (const face of FACES) {
                            const [dx, dy, dz] = face.neighbor;
                            const adjacentX = x + dx;
                            const adjacentY = y + dy;
                            const adjacentZ = z + dz;
                            const inBounds = this.isInBounds(adjacentX, adjacentY, adjacentZ);
                            const adjacentBlock = inBounds
                                ? this.getBlock(adjacentX, adjacentY, adjacentZ)
                                : chunkManager.getBlockAtWorld(
                                      this.worldOriginX + adjacentX,
                                      this.worldOriginY + adjacentY,
                                      this.worldOriginZ + adjacentZ,
                                  );
                            if (adjacentBlock !== BlockType.Air) {
                                continue;
                            }
                            const lightValue = inBounds
                                ? Math.max(
                                      this.getSkyLight(adjacentX, adjacentY, adjacentZ),
                                      this.getBlockLight(adjacentX, adjacentY, adjacentZ),
                                  )
                                : chunkManager.getLightAtWorld(
                                      this.worldOriginX + adjacentX,
                                      this.worldOriginY + adjacentY,
                                      this.worldOriginZ + adjacentZ,
                                  );
                            this.pushFace(face, x, y, z, meshes.water.subMesh, lightValue);
                        }
                        continue;
                    }

                    for (const face of FACES) {
                        const [dx, dy, dz] = face.neighbor;
                        const adjacentX = x + dx;
                        const adjacentY = y + dy;
                        const adjacentZ = z + dz;
                        if (!this.isAirOrOOB(adjacentX, adjacentY, adjacentZ)) {
                            continue;
                        }

                        // Face brightness comes from the air voxel we just culled against.
                        // Combine sky and block light: use whichever is brighter.
                        // When that voxel falls outside the chunk we cross into a neighbor.
                        let lightValue: number;
                        if (this.isInBounds(adjacentX, adjacentY, adjacentZ)) {
                            lightValue = Math.max(
                                this.getSkyLight(adjacentX, adjacentY, adjacentZ),
                                this.getBlockLight(adjacentX, adjacentY, adjacentZ),
                            );
                        } else {
                            lightValue = chunkManager.getLightAtWorld(
                                this.worldOriginX + adjacentX,
                                this.worldOriginY + adjacentY,
                                this.worldOriginZ + adjacentZ,
                            );
                        }

                        switch (block) {
                            case BlockType.Bedrock:
                                this.pushFace(face, x, y, z, meshes.bedrock.subMesh, lightValue);
                                break;
                            case BlockType.CoalOre:
                                this.pushFace(face, x, y, z, meshes.coalOre.subMesh, lightValue);
                                break;
                            case BlockType.Cobblestone:
                                this.pushFace(face, x, y, z, meshes.cobblestone.subMesh, lightValue);
                                break;
                            case BlockType.Dirt:
                                this.pushFace(face, x, y, z, meshes.dirt.subMesh, lightValue);
                                break;
                            case BlockType.Grass:
                                this.pushFace(
                                    face,
                                    x,
                                    y,
                                    z,
                                    face.normal[1] === 1 ? meshes.grassTop.subMesh : meshes.grassSide.subMesh,
                                    lightValue,
                                );
                                break;
                            case BlockType.OakLeaves: {
                                const worldX = this.worldOriginX + x;
                                const worldY = this.worldOriginY + y;
                                const worldZ = this.worldOriginZ + z;
                                const hash =
                                    (Math.imul(worldX, 73856093) ^
                                        Math.imul(worldY, 19349663) ^
                                        Math.imul(worldZ, 83492791)) &
                                    1;
                                this.pushFace(
                                    face,
                                    x,
                                    y,
                                    z,
                                    hash === 0 ? meshes.oakLeaves1.subMesh : meshes.oakLeaves2.subMesh,
                                    lightValue,
                                );
                                break;
                            }
                            case BlockType.OakLog:
                                this.pushFace(
                                    face,
                                    x,
                                    y,
                                    z,
                                    face.normal[1] !== 0 ? meshes.oakLogTop.subMesh : meshes.oakLogSide.subMesh,
                                    lightValue,
                                );
                                break;
                            case BlockType.OakPlanks:
                                this.pushFace(face, x, y, z, meshes.oakPlanks.subMesh, lightValue);
                                break;
                            case BlockType.CraftingTable: {
                                let craftingTableSubMesh = meshes.craftingTableSide.subMesh;
                                if (face.normal[1] === 1) {
                                    craftingTableSubMesh = meshes.craftingTableTop.subMesh;
                                } else if (face.normal[2] === -1) {
                                    craftingTableSubMesh = meshes.craftingTableFront.subMesh;
                                } else if (face.normal[2] === 1) {
                                    craftingTableSubMesh = meshes.craftingTableBack.subMesh;
                                }
                                this.pushFace(face, x, y, z, craftingTableSubMesh, lightValue);
                                break;
                            }
                            case BlockType.DirtSnow:
                                this.pushFace(
                                    face,
                                    x,
                                    y,
                                    z,
                                    face.normal[1] === 1
                                        ? meshes.dirtSnowTop.subMesh
                                        : face.normal[1] === -1
                                          ? meshes.dirtSnowBottom.subMesh
                                          : meshes.dirtSnowSide.subMesh,
                                    lightValue,
                                );
                                break;
                            case BlockType.Snow:
                                this.pushFace(face, x, y, z, meshes.snow.subMesh, lightValue);
                                break;
                            case BlockType.Stone:
                                this.pushFace(face, x, y, z, meshes.stone.subMesh, lightValue);
                                break;

                            default: {
                                throw new Error(`buildMesh: unhandled BlockType.${BlockType[block]}`);
                            }
                        }
                    }
                }
            }
        }

        this.mesh.children.forEach(c => (c as THREE.Mesh).geometry.dispose());
        this.mesh.clear();

        for (const { subMesh, material, renderOrder } of Object.values(meshes)) {
            if (subMesh.indices.length === 0) {
                continue;
            }

            const threeMesh = new THREE.Mesh(this.buildGeometry(subMesh), material());
            if (renderOrder !== undefined) {
                threeMesh.renderOrder = renderOrder;
            }

            this.mesh.add(threeMesh);
        }
    }

    getBlock(x: number, y: number, z: number): BlockType {
        return this.blocks[x * this.height * this.depth + y * this.depth + z];
    }

    setBlock(x: number, y: number, z: number, type: BlockType): void {
        const index = this.getBlockIndex(x, y, z);
        this.blocks[index] = type;
    }

    getSkyLight(x: number, y: number, z: number): number {
        return (this.lightLevels[this.getBlockIndex(x, y, z)] >> 4) & 0x0f;
    }

    setSkyLight(x: number, y: number, z: number, level: number): void {
        const index = this.getBlockIndex(x, y, z);
        const existing = this.lightLevels[index] & 0x0f;
        this.lightLevels[index] = ((level & 0x0f) << 4) | existing;
    }

    getBlockLight(x: number, y: number, z: number): number {
        return this.lightLevels[this.getBlockIndex(x, y, z)] & 0x0f;
    }

    setBlockLight(x: number, y: number, z: number, level: number): void {
        const index = this.getBlockIndex(x, y, z);
        this.lightLevels[index] = (this.lightLevels[index] & 0xf0) | (level & 0x0f);
    }

    getBlockMeta(x: number, y: number, z: number): number {
        return this.blockMeta[this.getBlockIndex(x, y, z)];
    }

    setBlockMeta(x: number, y: number, z: number, meta: number): void {
        this.blockMeta[this.getBlockIndex(x, y, z)] = meta;
    }

    clearLightLevels(): void {
        this.lightLevels.fill(0);
    }

    // Zeroes only the sky-light nibble (high), preserving any block light already set.
    clearSkyLight(): void {
        for (let i = 0; i < this.lightLevels.length; i++) {
            this.lightLevels[i] &= 0x0f;
        }
    }

    // Zeroes only the block-light nibble (low), preserving sky light.
    clearBlockLight(): void {
        for (let i = 0; i < this.lightLevels.length; i++) {
            this.lightLevels[i] &= 0xf0;
        }
    }

    // Returns true if the block was destroyed. The caller (ChunkManager.relightAround via
    // PlayerBlockInteraction) is responsible for the relight + rebuild because relighting may
    // need to touch neighbor chunks, which ChunkComponent has no handle to.
    destroyBlock(x: number, y: number, z: number): boolean {
        if (x < 0 || x >= this.width || y < 0 || y >= this.height || z < 0 || z >= this.depth) {
            return false;
        }

        const index = this.getBlockIndex(x, y, z);

        if (INDESTRUCTIBLE_BLOCKS.has(this.blocks[index] as BlockType)) {
            return false;
        }

        this.setBlock(x, y, z, BlockType.Air);
        this.blockMeta[index] = 0;
        return true;
    }

    // Returns only the voxels whose block type or meta differs from freshly-generated terrain.
    // Builds a throwaway sibling chunk with identical dims/origin, regenerates it from the same
    // seed, and diffs. Because terrain generation is deterministic, this captures exactly the
    // player's edits — the compact payload that needs persisting. lightLevels are
    // derived/transient and intentionally excluded. No mesh is built for the pristine chunk.
    diffAgainstPristine(generator: TerrainGenerator): VoxelDelta[] {
        const pristine = new ChunkComponent(
            this.width,
            this.height,
            this.depth,
            this.worldOriginX,
            this.worldOriginY,
            this.worldOriginZ,
        );
        pristine.generate(generator);

        const deltas: VoxelDelta[] = [];
        const total = this.width * this.height * this.depth;
        for (let i = 0; i < total; i++) {
            if (this.blocks[i] !== pristine.blocks[i] || this.blockMeta[i] !== pristine.blockMeta[i]) {
                deltas.push({ i, t: this.blocks[i], m: this.blockMeta[i] });
            }
        }
        return deltas;
    }

    // Writes saved deltas onto the raw arrays by linear index.
    // Does NOT relight or rebuild — the caller (ChunkManager.getOrCreateChunk) handles that.
    applyDeltas(deltas: ReadonlyArray<VoxelDelta>): void {
        for (const { i, t, m } of deltas) {
            this.blocks[i] = t;
            this.blockMeta[i] = m;
        }
    }

    update() {}
}
