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
		materials,
		threeScene,
	}: {
		gridWidth: number;
		gridHeight: number;
		chunkWidth: number;
		chunkHeight: number;
		chunkDepth: number;
		materials: [THREE.Material, THREE.Material];
		threeScene: THREE.Scene;
	}) {
		super();

		for (let x = 0; x < gridWidth; x++) {
			for (let z = 0; z < gridHeight; z++) {
				const chunk = new ChunkComponent(chunkWidth, chunkHeight, chunkDepth);
				chunk.mesh.position.set(x * chunkWidth, 0, z * chunkDepth);
				chunk.buildMesh(materials[0], materials[1]);
				threeScene.add(chunk.mesh);
				this.chunks.push(chunk);
			}
		}
	}

	update() {}
}
