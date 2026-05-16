import * as THREE from "three";
import game from "engine/Game";
import TextureManager from "engine/TextureManager";
import ChunkManager from "engine/chunk/ChunkManager";
import TerrainGenerator from "engine/chunk/TerrainGenerator";
import Transform from "engine/components/Transform";
import GameObject from "engine/core/GameObject";
import DebugCameraController from "engine/debug/DebugCameraController";
import DebugClicker from "engine/debug/DebugClicker";
import PlayerCamera from "engine/player/PlayerCamera";
import PlayerController from "engine/player/PlayerController";
import PlayerPhysics from "engine/player/PlayerPhysics";
import GameObjectName from "engine/utils/gameObjectNames";

export function setupScene(): void {
    game.threeScene.add(new THREE.AmbientLight(0xffffff, 0.4));
    const dirLight = new THREE.DirectionalLight(0xffffff, 1);
    dirLight.position.set(1, 2, 3);
    game.threeScene.add(dirLight);

    TextureManager.init();

    const terrainGenerator = new TerrainGenerator({
        seed: 1,
        baseHeight: 10,
        heightAmplitude: 5,
        baseFrequency: 1 / 32,
        octaves: 4,
        persistence: 0.5,
        lacunarity: 2.0,
    });

    const playerGeometry = new THREE.CapsuleGeometry(0.4, 1.0, 4, 8);
    const playerMaterial = new THREE.MeshStandardMaterial({ color: 0x4488ff });
    const playerMesh = new THREE.Mesh(playerGeometry, playerMaterial);
    game.threeScene.add(playerMesh);

    const player = new GameObject(GameObjectName.Player);
    player.addComponent(new Transform(playerMesh, 12, 30, 12));
    game.add(player);

    const chunkManager = new ChunkManager({
        renderRadius: 4,
        worldHeightChunks: 3,
        chunkWidth: 8,
        chunkHeight: 8,
        chunkDepth: 8,
        terrainGenerator,
    });

    const managerObj = new GameObject(GameObjectName.ChunkManager);
    managerObj.addComponent(chunkManager);
    game.add(managerObj);

    game.camera.threeCamera.position.set(12, 25, 50);

    const debugCameraController = new DebugCameraController(game.camera);
    debugCameraController.enabled = false;
    const cameraObj = new GameObject(GameObjectName.DebugCamera);
    cameraObj.addComponent(debugCameraController);
    game.add(cameraObj);

    const debugClickerObj = new GameObject(GameObjectName.DebugClicker);
    debugClickerObj.addComponent(new DebugClicker(game.camera.threeCamera, chunkManager));
    game.add(debugClickerObj);

    player.addComponent(new PlayerController());
    player.addComponent(new PlayerPhysics(chunkManager));
    player.addComponent(new PlayerCamera(game.camera, game.renderer.domElement));
}
