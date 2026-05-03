import ChunkComponent from "engine/components/ChunkComponent";
import DebugCameraController from "engine/components/DebugCameraController";
import GameObject from "engine/core/GameObject";
import * as THREE from "three";
import type Game from "engine/Game";

import dirtUrl from "../assets/textures/dirt.png";

export function setupScene(game: Game) {
    game.scene.threeScene.add(new THREE.AmbientLight(0xffffff, 0.4));
    const dirLight = new THREE.DirectionalLight(0xffffff, 1);
    dirLight.position.set(1, 2, 3);
    game.scene.threeScene.add(dirLight);

    const texture = new THREE.TextureLoader().load(dirtUrl);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.magFilter = THREE.NearestFilter;

    const material = new THREE.MeshStandardMaterial({ map: texture });
    const chunkComponent = new ChunkComponent(8, 8, 8, material);

    const chunk = new GameObject("Chunk");
    chunk.addComponent(chunkComponent);
    game.scene.threeScene.add(chunkComponent.mesh);
    game.scene.add(chunk);

    game.camera.threeCamera.position.set(4, 8, 20);

    const cameraObj = new GameObject("DebugCamera");
    cameraObj.addComponent(new DebugCameraController(game.camera));
    game.scene.add(cameraObj);
}
