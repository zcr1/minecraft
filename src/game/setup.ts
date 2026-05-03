import ChunkManager from 'engine/components/ChunkManager';
import DebugCameraController from 'engine/components/DebugCameraController';
import GameObject from 'engine/core/GameObject';
import * as THREE from 'three';
import type Game from 'engine/Game';

import dirtUrl from '../assets/textures/dirt.png';

export function setupScene(game: Game) {
	game.scene.threeScene.add(new THREE.AmbientLight(0xffffff, 0.4));
	const dirLight = new THREE.DirectionalLight(0xffffff, 1);
	dirLight.position.set(1, 2, 3);
	game.scene.threeScene.add(dirLight);

	const texture = new THREE.TextureLoader().load(dirtUrl);
	texture.colorSpace = THREE.SRGBColorSpace;
	texture.magFilter = THREE.NearestFilter;

	const material = new THREE.MeshStandardMaterial({ map: texture });
	const chunkManager = new ChunkManager({
		gridWidth: 3,
		gridDepth: 3,
		chunkWidth: 8,
		chunkHeight: 8,
		chunkDepth: 8,
		material,
		threeScene: game.scene.threeScene,
	});

	const managerObj = new GameObject('ChunkManager');
	managerObj.addComponent(chunkManager);
	game.scene.add(managerObj);

	game.camera.threeCamera.position.set(12, 25, 50);

	const cameraObj = new GameObject('DebugCamera');
	cameraObj.addComponent(new DebugCameraController(game.camera));
	game.scene.add(cameraObj);
}
