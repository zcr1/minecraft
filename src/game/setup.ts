import ChunkManager from "engine/components/ChunkManager";
import DebugCameraController from "engine/components/DebugCameraController";
import DebugClicker from "engine/components/DebugClicker";
import GameObject from "engine/core/GameObject";
import * as THREE from "three";
import type Game from "engine/Game";

import dirtUrl from "../assets/textures/dirt.png";
import grassSideUrl from "../assets/textures/grass_side.png";
import grassTopUrl from "../assets/textures/grass_top.png";

export function setupScene(game: Game) {
    game.scene.threeScene.add(new THREE.AmbientLight(0xffffff, 0.4));
    const dirLight = new THREE.DirectionalLight(0xffffff, 1);
    dirLight.position.set(1, 2, 3);
    game.scene.threeScene.add(dirLight);

    const loader = new THREE.TextureLoader();

    const dirtTexture = loader.load(dirtUrl);
    dirtTexture.colorSpace = THREE.SRGBColorSpace;
    dirtTexture.magFilter = THREE.NearestFilter;

    const grassTopTexture = loader.load(grassTopUrl);
    grassTopTexture.colorSpace = THREE.SRGBColorSpace;
    grassTopTexture.magFilter = THREE.NearestFilter;

    const grassSideTexture = loader.load(grassSideUrl);
    grassSideTexture.colorSpace = THREE.SRGBColorSpace;
    grassSideTexture.magFilter = THREE.NearestFilter;

    const dirtMaterial = new THREE.MeshStandardMaterial({ map: dirtTexture });
    const grassTopMaterial = new THREE.MeshStandardMaterial({
        map: grassTopTexture,
    });
    const grassSideMaterial = new THREE.MeshStandardMaterial({
        map: grassSideTexture,
    });

    const chunkManager = new ChunkManager({
        gridWidth: 3,
        gridHeight: 3,
        gridLayers: 3,
        chunkWidth: 8,
        chunkHeight: 8,
        chunkDepth: 8,
        materials: [dirtMaterial, grassTopMaterial, grassSideMaterial],
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
