import GameObject from 'engine/core/GameObject';
import MeshComponent from 'engine/components/MeshComponent';
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

	const mesh = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial({ map: texture }));
	game.scene.threeScene.add(mesh);

	const cube = new GameObject('Cube');
	cube.addComponent(new MeshComponent(mesh));
	game.scene.gameObjects.push(cube);
}
