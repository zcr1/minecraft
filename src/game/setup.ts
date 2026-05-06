import ChunkManager from "engine/components/ChunkManager";
import DebugCameraController from "engine/components/DebugCameraController";
import DebugClicker from "engine/components/DebugClicker";
import GameObject from "engine/core/GameObject";
import TextureManager from "engine/TextureManager";
import * as THREE from "three";
import type Game from "engine/Game";

export function setupScene(game: Game) {
    game.scene.threeScene.add(new THREE.AmbientLight(0xffffff, 0.4));
    const dirLight = new THREE.DirectionalLight(0xffffff, 1);
    dirLight.position.set(1, 2, 3);
    game.scene.threeScene.add(dirLight);

    TextureManager.instance.init();

    const chunkManager = new ChunkManager({
        gridWidth: 3,
        gridHeight: 3,
        gridLayers: 3,
        chunkWidth: 8,
        chunkHeight: 8,
        chunkDepth: 8,
        threeScene: game.scene.threeScene,
    });

    const managerObj = new GameObject("ChunkManager");
    managerObj.addComponent(chunkManager);
    game.scene.add(managerObj);

    game.camera.threeCamera.position.set(12, 25, 50);

    const cameraObj = new GameObject("DebugCamera");
    cameraObj.addComponent(new DebugCameraController(game.camera));
    game.scene.add(cameraObj);

    const debugClickerObj = new GameObject("DebugClicker");
    debugClickerObj.addComponent(new DebugClicker(game.camera.threeCamera, chunkManager));
    game.scene.add(debugClickerObj);
}
