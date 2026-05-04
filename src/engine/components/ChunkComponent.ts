import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import * as THREE from 'three';

import Component from '../core/Component';

export enum BlockType {
	Air = 0,
	Dirt = 1,
	Grass = 2,
}

const EMPTY_RATE = 0.15;

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

		const template = new THREE.BoxGeometry(1, 1, 1);
		const geometries: THREE.BufferGeometry[] = [];

		for (let x = 0; x < width; x++) {
			for (let y = 0; y < height; y++) {
				for (let z = 0; z < depth; z++) {
					const type = Math.random() < EMPTY_RATE ? BlockType.Air : BlockType.Dirt;
					this.setBlock(x, y, z, type);
					if (type === BlockType.Air) continue;

					const geo = template.clone();
					geo.applyMatrix4(new THREE.Matrix4().makeTranslation(x, y, z));
					geometries.push(geo);
				}
			}
		}

		template.dispose();

		const merged =
			geometries.length > 0 ? (mergeGeometries(geometries) ?? new THREE.BufferGeometry()) : new THREE.BufferGeometry();

		geometries.forEach(g => g.dispose());

		this.mesh = new THREE.Mesh(merged, material);
	}

	getBlock(x: number, y: number, z: number): BlockType {
		return this.blocks[x * this.height * this.depth + y * this.depth + z];
	}

	setBlock(x: number, y: number, z: number, type: BlockType): void {
		this.blocks[x * this.height * this.depth + y * this.depth + z] = type;
	}

	update() {}
}
