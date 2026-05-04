import * as THREE from 'three';

import Component from '../core/Component';

export enum BlockType {
	Air = 0,
	Dirt = 1,
	Grass = 2,
}

const EMPTY_RATE = 0.15;

// Each face: 4 vertices (x,y,z relative to block center), outward normal, neighbor offset to check
const FACES = [
	{
		vertices: [0.5, -0.5, 0.5, 0.5, -0.5, -0.5, 0.5, 0.5, -0.5, 0.5, 0.5, 0.5],
		normal: [1, 0, 0],
		neighbor: [1, 0, 0],
	},
	{
		vertices: [-0.5, -0.5, -0.5, -0.5, -0.5, 0.5, -0.5, 0.5, 0.5, -0.5, 0.5, -0.5],
		normal: [-1, 0, 0],
		neighbor: [-1, 0, 0],
	},
	{
		vertices: [-0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, -0.5, -0.5, 0.5, -0.5],
		normal: [0, 1, 0],
		neighbor: [0, 1, 0],
	},
	{
		vertices: [-0.5, -0.5, -0.5, 0.5, -0.5, -0.5, 0.5, -0.5, 0.5, -0.5, -0.5, 0.5],
		normal: [0, -1, 0],
		neighbor: [0, -1, 0],
	},
	{
		vertices: [-0.5, -0.5, 0.5, 0.5, -0.5, 0.5, 0.5, 0.5, 0.5, -0.5, 0.5, 0.5],
		normal: [0, 0, 1],
		neighbor: [0, 0, 1],
	},
	{
		vertices: [0.5, -0.5, -0.5, -0.5, -0.5, -0.5, -0.5, 0.5, -0.5, 0.5, 0.5, -0.5],
		normal: [0, 0, -1],
		neighbor: [0, 0, -1],
	},
] as const;

const FACE_UVS = [0, 0, 1, 0, 1, 1, 0, 1];

// todo doesn't need to be chunk?
export default class ChunkComponent extends Component {
	readonly mesh: THREE.Mesh;
	readonly width: number;
	readonly height: number;
	readonly depth: number;

	private readonly blocks: Uint8Array;

	constructor(width: number, height: number, depth: number, material: THREE.Material) {
		super();

		this.width = width;
		this.height = height;
		this.depth = depth;
		this.blocks = new Uint8Array(width * height * depth);

		for (let x = 0; x < width; x++) {
			for (let y = 0; y < height; y++) {
				for (let z = 0; z < depth; z++) {
					this.setBlock(x, y, z, Math.random() < EMPTY_RATE ? BlockType.Air : BlockType.Dirt);
				}
			}
		}

		const positions: number[] = [];
		const normals: number[] = [];
		const uvs: number[] = [];
		const indices: number[] = [];

		for (let x = 0; x < width; x++) {
			for (let y = 0; y < height; y++) {
				for (let z = 0; z < depth; z++) {
					if (this.getBlock(x, y, z) === BlockType.Air) continue;

					for (const face of FACES) {
						const [dx, dy, dz] = face.neighbor;
						if (!this.isAirOrOOB(x + dx, y + dy, z + dz)) continue;

						const base = positions.length / 3;
						for (let v = 0; v < 4; v++) {
							positions.push(face.vertices[v * 3] + x, face.vertices[v * 3 + 1] + y, face.vertices[v * 3 + 2] + z);
							normals.push(face.normal[0], face.normal[1], face.normal[2]);
							uvs.push(FACE_UVS[v * 2], FACE_UVS[v * 2 + 1]);
						}
						indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
					}
				}
			}
		}

		const geo = new THREE.BufferGeometry();
		geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
		geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
		geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
		geo.setIndex(indices);

		this.mesh = new THREE.Mesh(geo, material);
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
