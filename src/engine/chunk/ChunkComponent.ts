import * as THREE from "three";
import textureManager from "../TextureManager";
import Component from "../core/Component";
import type ChunkManager from "./ChunkManager";
import type TerrainGenerator from "./TerrainGenerator";

export enum BlockType {
    Air = 0,
    Dirt = 1,
    Grass = 2,
    Bedrock = 3,
    Stone = 4,
    Cobblestone = 5,
    CoalOre = 6,
    OakLog = 7,
    OakLeaves = 8,
    Torch = 9,
}

// Blocks the player can walk through (non-solid).
export function isPassableBlock(blockType: BlockType): boolean {
    return blockType === BlockType.Air || blockType === BlockType.Torch;
}

// Returns true for opaque, solid blocks that can support placements (e.g. torches on walls/floors).
export function isSolidBlock(blockType: BlockType): boolean {
    return blockType !== BlockType.Air && blockType !== BlockType.Torch && blockType !== BlockType.OakLeaves;
}

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

const BLOCK_HITPOINTS: Record<BlockType, number> = {
    [BlockType.Air]: 0,
    [BlockType.Bedrock]: 0,
    [BlockType.Grass]: 2,
    [BlockType.Dirt]: 2,
    [BlockType.Stone]: 4,
    [BlockType.Cobblestone]: 3,
    [BlockType.CoalOre]: 4,
    [BlockType.OakLog]: 3,
    [BlockType.OakLeaves]: 1,
    [BlockType.Torch]: 1,
};

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
    private readonly blockHitPoints: Uint8Array;
    // Byte per voxel: high nibble = sky light, low nibble = block light (reserved for emissives).
    // Packing both channels into one byte keeps the per-chunk light memory at width*height*depth
    // bytes instead of doubling it when block-light gets implemented.
    private readonly lightLevels: Uint8Array;

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
        this.blockHitPoints = new Uint8Array(width * height * depth);
        this.lightLevels = new Uint8Array(width * height * depth);
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

    // Returns the set of quads to render for a torch at (x, y, z) based on which adjacent block
    // is solid. Checks the 5 candidates in priority order (floor first) and falls back to floor.
    private getTorchQuads(
        x: number,
        y: number,
        z: number,
        chunkManager: ChunkManager,
    ): ReadonlyArray<ReadonlyArray<number>> {
        for (const {
            offset: [deltaX, deltaY, deltaZ],
            quads,
        } of TORCH_QUADS) {
            const neighborX = x + deltaX;
            const neighborY = y + deltaY;
            const neighborZ = z + deltaZ;
            let neighborType: BlockType;
            if (this.isInBounds(neighborX, neighborY, neighborZ)) {
                neighborType = this.getBlock(neighborX, neighborY, neighborZ);
            } else {
                neighborType = chunkManager.getBlockAtWorld(
                    this.worldOriginX + neighborX,
                    this.worldOriginY + neighborY,
                    this.worldOriginZ + neighborZ,
                );
            }
            if (isSolidBlock(neighborType)) {
                return quads;
            }
        }
        return TORCH_QUADS[0].quads; // fallback to floor
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
        return block === BlockType.Air || block === BlockType.OakLeaves || block === BlockType.Torch;
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
                // Surface height only depends on (x, z), so compute it once per column
                // rather than re-running the noise octaves for every voxel in the column.
                const surface = Math.floor(generator.getHeight(this.worldOriginX + localX, this.worldOriginZ + localZ));
                for (let localY = 0; localY < this.height; localY++) {
                    const worldY = this.worldOriginY + localY;
                    if (worldY === 0) {
                        this.setBlock(localX, localY, localZ, BlockType.Bedrock);
                        continue;
                    }
                    if (worldY > surface) {
                        continue;
                    }
                    this.setBlock(localX, localY, localZ, generator.blockTypeForLayer(worldY, surface));
                }
            }
        }
        generator.placeCoalVeins(this);
        generator.placeTrees(this);
    }

    rebuild(chunkManager: ChunkManager): void {
        this.buildMesh(chunkManager);
    }

    buildMesh(chunkManager: ChunkManager): void {
        const dirt = createSubMesh();
        const grassTop = createSubMesh();
        const grassSide = createSubMesh();
        const bedrock = createSubMesh();
        const stone = createSubMesh();
        const cobblestone = createSubMesh();
        const coalOre = createSubMesh();
        const oakLogTop = createSubMesh();
        const oakLogSide = createSubMesh();
        const oakLeaves1 = createSubMesh();
        const oakLeaves2 = createSubMesh();
        const torch = createSubMesh();

        for (let x = 0; x < this.width; x++) {
            for (let y = 0; y < this.height; y++) {
                for (let z = 0; z < this.depth; z++) {
                    const block = this.getBlock(x, y, z);
                    if (block === BlockType.Air) {
                        continue;
                    }

                    // Torch renders as a surface-affixed sprite rather than cube faces.
                    // Geometry depends on which adjacent face is solid (inferred at mesh time).
                    if (block === BlockType.Torch) {
                        const lightValue = Math.max(this.getSkyLight(x, y, z), this.getBlockLight(x, y, z));
                        for (const quadVerts of this.getTorchQuads(x, y, z, chunkManager)) {
                            this.pushCrossQuad(quadVerts, x, y, z, torch, lightValue);
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

                        if (block === BlockType.CoalOre) {
                            this.pushFace(face, x, y, z, coalOre, lightValue);
                        } else if (block === BlockType.Stone) {
                            this.pushFace(face, x, y, z, stone, lightValue);
                        } else if (block === BlockType.Cobblestone) {
                            this.pushFace(face, x, y, z, cobblestone, lightValue);
                        } else if (block === BlockType.Grass && face.normal[1] === 1) {
                            this.pushFace(face, x, y, z, grassTop, lightValue);
                        } else if (block === BlockType.Grass && face.normal[1] === 0) {
                            this.pushFace(face, x, y, z, grassSide, lightValue);
                        } else if (block === BlockType.Bedrock) {
                            this.pushFace(face, x, y, z, bedrock, lightValue);
                        } else if (block === BlockType.OakLog && face.normal[1] !== 0) {
                            this.pushFace(face, x, y, z, oakLogTop, lightValue);
                        } else if (block === BlockType.OakLog) {
                            this.pushFace(face, x, y, z, oakLogSide, lightValue);
                        } else if (block === BlockType.OakLeaves) {
                            const worldX = this.worldOriginX + x;
                            const worldY = this.worldOriginY + y;
                            const worldZ = this.worldOriginZ + z;
                            const hash =
                                (Math.imul(worldX, 73856093) ^
                                    Math.imul(worldY, 19349663) ^
                                    Math.imul(worldZ, 83492791)) &
                                1;
                            this.pushFace(face, x, y, z, hash === 0 ? oakLeaves1 : oakLeaves2, lightValue);
                        } else {
                            this.pushFace(face, x, y, z, dirt, lightValue);
                        }
                    }
                }
            }
        }

        this.mesh.children.forEach(c => (c as THREE.Mesh).geometry.dispose());
        this.mesh.clear();

        if (dirt.indices.length > 0) {
            this.mesh.add(new THREE.Mesh(this.buildGeometry(dirt), textureManager.getMaterial(BlockType.Dirt, 0)));
        }
        if (grassTop.indices.length > 0) {
            this.mesh.add(new THREE.Mesh(this.buildGeometry(grassTop), textureManager.getMaterial(BlockType.Grass, 1)));
        }
        if (grassSide.indices.length > 0) {
            this.mesh.add(
                new THREE.Mesh(this.buildGeometry(grassSide), textureManager.getMaterial(BlockType.Grass, 0)),
            );
        }
        if (bedrock.indices.length > 0) {
            this.mesh.add(
                new THREE.Mesh(this.buildGeometry(bedrock), textureManager.getMaterial(BlockType.Bedrock, 0)),
            );
        }
        if (stone.indices.length > 0) {
            this.mesh.add(new THREE.Mesh(this.buildGeometry(stone), textureManager.getMaterial(BlockType.Stone, 0)));
        }
        if (cobblestone.indices.length > 0) {
            this.mesh.add(
                new THREE.Mesh(this.buildGeometry(cobblestone), textureManager.getMaterial(BlockType.Cobblestone, 0)),
            );
        }
        if (coalOre.indices.length > 0) {
            this.mesh.add(
                new THREE.Mesh(this.buildGeometry(coalOre), textureManager.getMaterial(BlockType.CoalOre, 0)),
            );
        }
        if (oakLogTop.indices.length > 0) {
            this.mesh.add(
                new THREE.Mesh(this.buildGeometry(oakLogTop), textureManager.getMaterial(BlockType.OakLog, 1)),
            );
        }
        if (oakLogSide.indices.length > 0) {
            this.mesh.add(
                new THREE.Mesh(this.buildGeometry(oakLogSide), textureManager.getMaterial(BlockType.OakLog, 0)),
            );
        }
        if (oakLeaves1.indices.length > 0) {
            this.mesh.add(new THREE.Mesh(this.buildGeometry(oakLeaves1), textureManager.getLeavesMaterial(0)));
        }
        if (oakLeaves2.indices.length > 0) {
            this.mesh.add(new THREE.Mesh(this.buildGeometry(oakLeaves2), textureManager.getLeavesMaterial(1)));
        }
        if (torch.indices.length > 0) {
            this.mesh.add(new THREE.Mesh(this.buildGeometry(torch), textureManager.getTorchMaterial()));
        }
    }

    getBlock(x: number, y: number, z: number): BlockType {
        return this.blocks[x * this.height * this.depth + y * this.depth + z];
    }

    setBlock(x: number, y: number, z: number, type: BlockType): void {
        const index = this.getBlockIndex(x, y, z);
        this.blocks[index] = type;
        this.blockHitPoints[index] = BLOCK_HITPOINTS[type];
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
    hitBlock(x: number, y: number, z: number, damage: number): boolean {
        if (x < 0 || x >= this.width || y < 0 || y >= this.height || z < 0 || z >= this.depth) {
            return false;
        }
        const index = this.getBlockIndex(x, y, z);
        const currentHitPoints = this.blockHitPoints[index];

        if (currentHitPoints === 0) {
            return false;
        }

        if (damage >= currentHitPoints) {
            this.setBlock(x, y, z, BlockType.Air);
            return true;
        }
        this.blockHitPoints[index] = currentHitPoints - damage;
        return false;
    }

    update() {}
}
