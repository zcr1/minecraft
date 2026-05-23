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

const BLOCK_HITPOINTS: Record<BlockType, number> = {
    [BlockType.Air]: 0,
    [BlockType.Bedrock]: 0,
    [BlockType.Grass]: 2,
    [BlockType.Dirt]: 2,
    [BlockType.Stone]: 4,
    [BlockType.Cobblestone]: 3,
    [BlockType.CoalOre]: 4,
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
        return this.getBlock(x, y, z) === BlockType.Air;
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

        for (let x = 0; x < this.width; x++) {
            for (let y = 0; y < this.height; y++) {
                for (let z = 0; z < this.depth; z++) {
                    const block = this.getBlock(x, y, z);
                    if (block === BlockType.Air) {
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

                        // Face brightness comes from the air voxel we just culled against
                        // (the block we're emitting is opaque, so its own light level is 0).
                        // When that voxel falls outside the chunk we cross into a neighbor.
                        let lightValue: number;
                        if (this.isInBounds(adjacentX, adjacentY, adjacentZ)) {
                            lightValue = this.getSkyLight(adjacentX, adjacentY, adjacentZ);
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

    clearLightLevels(): void {
        this.lightLevels.fill(0);
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
