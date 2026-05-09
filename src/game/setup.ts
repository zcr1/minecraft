import ChunkManager from "engine/components/ChunkManager";
import DebugClicker from "engine/components/DebugClicker";
import PlayerCamera from "engine/components/PlayerCamera";
import PlayerController from "engine/components/PlayerController";
import PlayerPhysics from "engine/components/PlayerPhysics";
import Transform from "engine/components/Transform";
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

    // const cameraObj = new GameObject("DebugCamera");
    // cameraObj.addComponent(new DebugCameraController(game.camera));
    // game.scene.add(cameraObj);

    const debugClickerObj = new GameObject("DebugClicker");
    debugClickerObj.addComponent(new DebugClicker(game.camera.threeCamera, chunkManager));
    game.scene.add(debugClickerObj);

    const playerGeometry = new THREE.CapsuleGeometry(0.4, 1.0, 4, 8);
    const playerMaterial = new THREE.MeshStandardMaterial({ color: 0x4488ff });
    const playerMesh = new THREE.Mesh(playerGeometry, playerMaterial);
    game.scene.threeScene.add(playerMesh);

    const player = new GameObject("Player");
    const playerTransform = new Transform(playerMesh, 12, 30, 12);
    player.addComponent(playerTransform);
    player.addComponent(new PlayerPhysics(playerTransform, chunkManager));
    const playerCamera = new PlayerCamera(game.camera, game.renderer.domElement);
    player.addComponent(playerCamera);
    player.addComponent(new PlayerController(playerTransform, 5, playerCamera));
    game.scene.add(player);
}
