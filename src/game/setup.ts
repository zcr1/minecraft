import * as THREE from "three";
import game from "engine/Game";
import TextureManager from "engine/TextureManager";
import ChunkManager from "engine/chunk/ChunkManager";
import TerrainGenerator from "engine/chunk/TerrainGenerator";
import Transform from "engine/components/Transform";
import GameObject from "engine/core/GameObject";
import BlockBreakParticles from "engine/effects/BlockBreakParticles";
import BlockDamageOverlay from "engine/effects/BlockDamageOverlay";
import BlockPlacementPreview from "engine/effects/BlockPlacementPreview";
import ChunkBoundaryOverlay from "engine/effects/ChunkBoundaryOverlay";
import SkyComponent, { DAYTIME_PRESET } from "engine/environment/SkyComponent";
import DroppedItems from "engine/items/DroppedItems";
import HeldItem from "engine/player/HeldItem";
import Inventory from "engine/player/Inventory";
import PlayerBlockInteraction from "engine/player/PlayerBlockInteraction";
import PlayerCamera from "engine/player/PlayerCamera";
import PlayerController from "engine/player/PlayerController";
import PlayerPhysics from "engine/player/PlayerPhysics";
import TorchLight from "engine/player/TorchLight";
import GameObjectName from "engine/utils/gameObjectNames";

export function setupScene(): void {
    const skyObj = new GameObject(GameObjectName.Sky);
    skyObj.addComponent(new SkyComponent(DAYTIME_PRESET));
    game.add(skyObj);

    game.threeScene.add(new THREE.AmbientLight(0xffffff, 0.4));

    TextureManager.init();

    const terrainGenerator = new TerrainGenerator({
        seed: Math.random() * 1e6,
        baseHeight: 48,
        heightAmplitude: 10,
        baseFrequency: 1 / 48,
        octaves: 4,
        persistence: 0.5,
        lacunarity: 2.0,
        seaLevel: 44,
    });

    const playerGeometry = new THREE.CapsuleGeometry(0.4, 1.0, 4, 8);
    const playerMaterial = new THREE.MeshStandardMaterial({ color: 0x4488ff });
    const playerMesh = new THREE.Mesh(playerGeometry, playerMaterial);
    const player = new GameObject(GameObjectName.Player);
    player.addComponent(new Transform(playerMesh, 12, 70, 12));
    player.addComponent(new PlayerController());
    player.addComponent(new PlayerPhysics());
    player.addComponent(new PlayerCamera(game.camera, game.renderer.domElement));
    player.addComponent(new PlayerBlockInteraction());
    player.addComponent(new Inventory());
    player.addComponent(new HeldItem());
    player.addComponent(new TorchLight());
    game.threeScene.add(playerMesh);
    game.add(player);

    const chunkManager = new ChunkManager({
        renderRadius: 4,
        worldHeightChunks: 3,
        chunkWidth: 16,
        chunkHeight: 32,
        chunkDepth: 16,
        terrainGenerator,
    });

    const managerObj = new GameObject(GameObjectName.ChunkManager);
    managerObj.addComponent(chunkManager);
    game.add(managerObj);

    game.camera.threeCamera.position.set(12, 64, 50);

    const damageOverlay = new GameObject(GameObjectName.BlockDamageOverlay);
    damageOverlay.addComponent(new BlockDamageOverlay());
    game.add(damageOverlay);

    const placementPreview = new GameObject(GameObjectName.BlockPlacementPreview);
    placementPreview.addComponent(new BlockPlacementPreview());
    game.add(placementPreview);

    const breakParticles = new GameObject(GameObjectName.BlockBreakParticles);
    breakParticles.addComponent(new BlockBreakParticles());
    game.add(breakParticles);

    const droppedItems = new GameObject(GameObjectName.DroppedItems);
    droppedItems.addComponent(new DroppedItems());
    game.add(droppedItems);

    const chunkBoundaryOverlay = new GameObject(GameObjectName.ChunkBoundaryOverlay);
    chunkBoundaryOverlay.addComponent(new ChunkBoundaryOverlay());
    game.add(chunkBoundaryOverlay);
}
