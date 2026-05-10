import ChunkManager from "engine/chunk/ChunkManager";
import DebugCameraController from "engine/debug/DebugCameraController";
import DebugClicker from "engine/debug/DebugClicker";
import PlayerCamera from "engine/player/PlayerCamera";
import PlayerController from "engine/player/PlayerController";
import PlayerPhysics from "engine/player/PlayerPhysics";
import Transform from "engine/components/Transform";
import GameObject from "engine/core/GameObject";
import TextureManager from "engine/TextureManager";
import * as THREE from "three";
import type Game from "engine/Game";
import GameObjectName from "engine/utils/gameObjectNames";

export function setupScene(game: Game): void {
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

    const managerObj = new GameObject(GameObjectName.ChunkManager);
    managerObj.addComponent(chunkManager);
    game.scene.add(managerObj);

    game.camera.threeCamera.position.set(12, 25, 50);

    const debugCameraController = new DebugCameraController(game.camera);
    debugCameraController.enabled = false;
    const cameraObj = new GameObject(GameObjectName.DebugCamera);
    cameraObj.addComponent(debugCameraController);
    game.scene.add(cameraObj);

    const debugClickerObj = new GameObject(GameObjectName.DebugClicker);
    debugClickerObj.addComponent(new DebugClicker(game.camera.threeCamera, chunkManager));
    game.scene.add(debugClickerObj);

    const playerGeometry = new THREE.CapsuleGeometry(0.4, 1.0, 4, 8);
    const playerMaterial = new THREE.MeshStandardMaterial({ color: 0x4488ff });
    const playerMesh = new THREE.Mesh(playerGeometry, playerMaterial);
    game.scene.threeScene.add(playerMesh);

    const player = new GameObject(GameObjectName.Player);
    const playerTransform = new Transform(playerMesh, 12, 30, 12);
    player.addComponent(playerTransform);
    const playerController = new PlayerController();
    player.addComponent(playerController);
    player.addComponent(new PlayerPhysics(chunkManager));
    const playerCamera = new PlayerCamera(game.camera, game.renderer.domElement);
    player.addComponent(playerCamera);
    game.scene.add(player);
}
