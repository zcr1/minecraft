import * as THREE from "three";
import game from "../Game";
import ChunkManager from "../chunk/ChunkManager";
import { BiomeType } from "../chunk/TerrainGenerator";
import Component from "../core/Component";
import DayNightCycle from "../environment/DayNightCycle";
import GameObjectName from "../utils/gameObjectNames";
import { ZombieHandle, createZombie } from "./Zombie";

const ZOMBIES_PER_FOREST_COLUMN_PER_NIGHT = 1;
// Blocks above the sampled surface to spawn at; gravity settles the zombie the rest of the way.
const SPAWN_HEIGHT_OFFSET = 2;

interface TrackedColumn {
    biome: BiomeType;
    hasSpawnedThisNight: boolean;
    spawnWorldX: number;
    spawnWorldZ: number;
    surface: number;
    zombies: ZombieHandle[];
}

export default class MobManager extends Component {
    private chunkManager!: ChunkManager;
    private dayNightCycle!: DayNightCycle;
    private chunkWidth!: number;
    private chunkDepth!: number;
    private readonly trackedColumns = new Map<string, TrackedColumn>();

    start() {
        this.chunkManager = game.getGameObject(GameObjectName.ChunkManager).getComponent(ChunkManager);
        this.dayNightCycle = game.getGameObject(GameObjectName.Sky).getComponent(DayNightCycle);
        this.chunkWidth = this.chunkManager.getChunkWidth();
        this.chunkDepth = this.chunkManager.getChunkDepth();
    }

    update() {
        const visibleColumns = this.chunkManager.getVisibleChunkColumns();
        const visibleColumnKeys = new Set(
            visibleColumns.map(column => this.getColumnKey(column.chunkX, column.chunkZ)),
        );

        // Despawn mobs on any tracked column that fell out of the visible render radius.
        for (const [columnKey, tracked] of this.trackedColumns) {
            if (visibleColumnKeys.has(columnKey)) {
                continue;
            }
            for (const zombie of tracked.zombies) {
                this.despawnZombie(zombie);
            }
            this.trackedColumns.delete(columnKey);
        }

        const isNight = this.dayNightCycle.isNight;

        for (const column of visibleColumns) {
            const columnKey = this.getColumnKey(column.chunkX, column.chunkZ);
            let tracked = this.trackedColumns.get(columnKey);
            if (!tracked) {
                const spawnWorldX = column.worldOriginX + Math.floor(Math.random() * this.chunkWidth);
                const spawnWorldZ = column.worldOriginZ + Math.floor(Math.random() * this.chunkDepth);
                const { surface, biome } = this.chunkManager.getTerrainColumn(spawnWorldX, spawnWorldZ);
                tracked = { hasSpawnedThisNight: false, zombies: [], spawnWorldX, spawnWorldZ, surface, biome };
                this.trackedColumns.set(columnKey, tracked);
            }

            // Reap zombies that burned to death during the day.
            tracked.zombies = tracked.zombies.filter(zombie => {
                if (!zombie.health.isDead) {
                    return true;
                }
                this.despawnZombie(zombie);
                return false;
            });

            if (!isNight) {
                tracked.hasSpawnedThisNight = false;
                continue;
            }
            if (tracked.hasSpawnedThisNight) {
                continue;
            }
            if (tracked.biome !== BiomeType.Forest) {
                continue;
            }

            for (let index = 0; index < ZOMBIES_PER_FOREST_COLUMN_PER_NIGHT; index++) {
                tracked.zombies.push(
                    this.spawnZombie(tracked.spawnWorldX, tracked.surface + SPAWN_HEIGHT_OFFSET, tracked.spawnWorldZ),
                );
            }
            tracked.hasSpawnedThisNight = true;
        }
    }

    private getColumnKey(chunkX: number, chunkZ: number): string {
        return `${chunkX}:${chunkZ}`;
    }

    private spawnZombie(worldX: number, worldY: number, worldZ: number): ZombieHandle {
        const zombie = createZombie(worldX, worldY, worldZ);
        game.threeScene.add(zombie.mesh);
        zombie.gameObject.start();
        game.add(zombie.gameObject);
        return zombie;
    }

    private despawnZombie(zombie: ZombieHandle): void {
        game.remove(zombie.gameObject);
        game.threeScene.remove(zombie.mesh);
        zombie.mesh.geometry.dispose();
        (zombie.mesh.material as THREE.Material).dispose();
        zombie.gameObject.dispose();
    }

    dispose() {
        for (const tracked of this.trackedColumns.values()) {
            for (const zombie of tracked.zombies) {
                this.despawnZombie(zombie);
            }
        }
        this.trackedColumns.clear();
    }
}
