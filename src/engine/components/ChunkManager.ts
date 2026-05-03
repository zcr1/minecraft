import * as THREE from 'three';

import ChunkComponent from './ChunkComponent';
import Component from '../core/Component';

export default class ChunkManager extends Component {
	private readonly chunks: ChunkComponent[] = [];

	constructor({
		gridWidth,
		gridHeight,
		chunkWidth,
		chunkHeight,
		chunkDepth,
		material,
		threeScene,
	}: {
		gridWidth: number;
		gridHeight: number;
		chunkWidth: number;
		chunkHeight: number;
		chunkDepth: number;
		material: THREE.Material;
		threeScene: THREE.Scene;
	}) {
		super();

		for (let x = 0; x < gridWidth; x++) {
			for (let y = 0; y < gridHeight; y++) {
				const chunk = new ChunkComponent(chunkWidth, chunkHeight, chunkDepth, material);
				chunk.mesh.position.set(x * chunkWidth, 0, y * chunkDepth);
				threeScene.add(chunk.mesh);
				this.chunks.push(chunk);
			}
		}
	}

	update() {}
}
