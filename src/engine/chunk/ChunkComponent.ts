import * as THREE from "three";
import textureMananger from "../TextureManager";
import Component from "../core/Component";
import type TerrainGenerator from "./TerrainGenerator";

export enum BlockType {
    Air = 0,
    Dirt = 1,
    Grass = 2,
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

// todo doesn't need to be Component?
export default class ChunkComponent extends Component {
    readonly mesh: THREE.Group;
    readonly width: number;
    readonly height: number;
    readonly depth: number;

    private readonly blocks: Uint8Array;

    constructor(width: number, height: number, depth: number) {
        super();

        this.width = width;
        this.height = height;
        this.depth = depth;
        this.blocks = new Uint8Array(width * height * depth);
        this.mesh = new THREE.Group();
        this.mesh.userData.chunk = this;
    }

    private pushFace(
        face: (typeof FACES)[number],
        x: number,
        y: number,
        z: number,
        pos: number[],
        norm: number[],
        uv: number[],
        idx: number[],
    ) {
        const base = pos.length / 3;
        for (let v = 0; v < 4; v++) {
            pos.push(face.vertices[v * 3] + x, face.vertices[v * 3 + 1] + y, face.vertices[v * 3 + 2] + z);
            norm.push(face.normal[0], face.normal[1], face.normal[2]);
            uv.push(FACE_UVS[v * 2], FACE_UVS[v * 2 + 1]);
        }
        idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }

    private buildGeo(pos: number[], norm: number[], uv: number[], idx: number[]) {
        const geo = new THREE.BufferGeometry();
        geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
        geo.setAttribute("normal", new THREE.Float32BufferAttribute(norm, 3));
        geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
        geo.setIndex(idx);
        return geo;
    }

    generate(generator: TerrainGenerator, worldOriginX: number, worldOriginY: number, worldOriginZ: number) {
        for (let localX = 0; localX < this.width; localX++) {
            for (let localZ = 0; localZ < this.depth; localZ++) {
                // Surface height only depends on (x, z), so compute it once per column
                // rather than re-running the octave loop for every voxel in the column.
                const surface = Math.floor(generator.getHeight(worldOriginX + localX, worldOriginZ + localZ));
                for (let localY = 0; localY < this.height; localY++) {
                    const worldY = worldOriginY + localY;
                    if (worldY > surface) {
                        continue;
                    }

                    const blockType = worldY === surface ? BlockType.Grass : BlockType.Dirt;
                    this.setBlock(localX, localY, localZ, blockType);
                }
            }
        }
    }

    rebuild(): void {
        this.buildMesh();
    }

    buildMesh(): void {
        const dirtPos: number[] = [],
            dirtNorm: number[] = [],
            dirtUv: number[] = [],
            dirtIdx: number[] = [];
        const grassPos: number[] = [],
            grassNorm: number[] = [],
            grassUv: number[] = [],
            grassIdx: number[] = [];
        const grassSidePos: number[] = [],
            grassSideNorm: number[] = [],
            grassSideUv: number[] = [],
            grassSideIdx: number[] = [];

        for (let x = 0; x < this.width; x++) {
            for (let y = 0; y < this.height; y++) {
                for (let z = 0; z < this.depth; z++) {
                    const block = this.getBlock(x, y, z);
                    if (block === BlockType.Air) {
                        continue;
                    }

                    for (const face of FACES) {
                        const [dx, dy, dz] = face.neighbor;
                        if (!this.isAirOrOOB(x + dx, y + dy, z + dz)) {
                            continue;
                        }

                        if (block === BlockType.Grass && face.normal[1] === 1) {
                            this.pushFace(face, x, y, z, grassPos, grassNorm, grassUv, grassIdx);
                        } else if (block === BlockType.Grass && face.normal[1] === 0) {
                            this.pushFace(face, x, y, z, grassSidePos, grassSideNorm, grassSideUv, grassSideIdx);
                        } else {
                            this.pushFace(face, x, y, z, dirtPos, dirtNorm, dirtUv, dirtIdx);
                        }
                    }
                }
            }
        }

        this.mesh.children.forEach(c => (c as THREE.Mesh).geometry.dispose());
        this.mesh.clear();

        if (dirtIdx.length > 0) {
            this.mesh.add(
                new THREE.Mesh(this.buildGeo(dirtPos, dirtNorm, dirtUv, dirtIdx), tm.getMaterial(BlockType.Dirt, 0)),
            );
        }
        if (grassIdx.length > 0) {
            this.mesh.add(
                new THREE.Mesh(
                    this.buildGeo(grassPos, grassNorm, grassUv, grassIdx),
                    textureMananger.getMaterial(BlockType.Grass, 1),
                ),
            );
        }
        if (grassSideIdx.length > 0) {
            this.mesh.add(
                new THREE.Mesh(
                    this.buildGeo(grassSidePos, grassSideNorm, grassSideUv, grassSideIdx),
                    textureMananger.getMaterial(BlockType.Grass, 0),
                ),
            );
        }
    }

    getBlock(x: number, y: number, z: number): BlockType {
        return this.blocks[x * this.height * this.depth + y * this.depth + z];
    }

    setBlock(x: number, y: number, z: number, type: BlockType): void {
        this.blocks[x * this.height * this.depth + y * this.depth + z] = type;
    }

    private isAirOrOOB(x: number, y: number, z: number): boolean {
        if (x < 0 || x >= this.width || y < 0 || y >= this.height || z < 0 || z >= this.depth) return true;
        return this.getBlock(x, y, z) === BlockType.Air;
    }

    update() {}
}
