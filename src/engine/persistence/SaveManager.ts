import game from "engine/Game";
import ChunkManager from "engine/chunk/ChunkManager";
import Transform from "engine/components/Transform";
import DayNightCycle from "engine/environment/DayNightCycle";
import Inventory from "engine/player/Inventory";
import PlayerCamera from "engine/player/PlayerCamera";
import PlayerPhysics from "engine/player/PlayerPhysics";
import GameObjectName from "engine/utils/gameObjectNames";
import { SAVE_VERSION, type SaveData } from "./SaveData";
import { idbDelete, idbGet, idbPut } from "./idb";

// Single-slot world save. setup.ts reads the loaded seed + chunk deltas during scene construction;
// applyNonChunkSave restores player + time of day once the game objects exist.
const SAVE_KEY = "world";

// Returns the parsed save, or null if absent, corrupt, or from an incompatible version. Never
// throws — a bad save is deleted and treated as a fresh world so the game still starts.
export async function load(): Promise<SaveData | null> {
    let data: SaveData | undefined;
    try {
        data = await idbGet<SaveData>(SAVE_KEY);
    } catch (error) {
        console.warn("Failed to read save:", error);
        return null;
    }

    if (!data) {
        return null;
    }

    if (data.version !== SAVE_VERSION || typeof data.seed !== "number" || !Array.isArray(data.chunks)) {
        console.warn("Discarding incompatible or corrupt save (version/shape mismatch).");
        try {
            await idbDelete(SAVE_KEY);
        } catch {
            // Best-effort cleanup; ignore.
        }
        return null;
    }

    return data;
}

export async function hasSave(): Promise<boolean> {
    return (await load()) !== null;
}

// Reads the current live game state and persists it
export async function save(): Promise<void> {
    const player = game.getGameObject(GameObjectName.Player);
    const transform = player.getComponent(Transform);
    const camera = player.getComponent(PlayerCamera);
    const physics = player.getComponent(PlayerPhysics);
    const inventory = player.getComponent(Inventory);
    const chunkManager = game.getGameObject(GameObjectName.ChunkManager).getComponent(ChunkManager);
    const dayNight = game.getGameObject(GameObjectName.Sky).getComponent(DayNightCycle);

    const data: SaveData = {
        version: SAVE_VERSION,
        seed: chunkManager.getSeed(),
        timeOfDay: dayNight.timeOfDay,
        player: {
            x: transform.x,
            y: transform.y,
            z: transform.z,
            yaw: camera.yaw,
            pitch: camera.pitch,
            vx: physics.velocity.x,
            vy: physics.velocity.y,
            vz: physics.velocity.z,
            selectedHotbarSlot: inventory.selectedHotbarSlot,
            slots: inventory.getSlots().map(slot => (slot ? { item: slot.item, count: slot.count } : null)),
        },
        chunks: chunkManager.serializeChunks(),
    };

    await idbPut(SAVE_KEY, data);
}

// Restores everything except chunk deltas (those are staged into ChunkManager during setupScene
// so they apply as chunks generate). Must run after setupScene so the game objects exist.
export function applyNonChunkSave(data: SaveData): void {
    const player = game.getGameObject(GameObjectName.Player);
    const transform = player.getComponent(Transform);
    const camera = player.getComponent(PlayerCamera);
    const physics = player.getComponent(PlayerPhysics);
    const inventory = player.getComponent(Inventory);
    const dayNight = game.getGameObject(GameObjectName.Sky).getComponent(DayNightCycle);

    transform.x = data.player.x;
    transform.y = data.player.y;
    transform.z = data.player.z;
    camera.yaw = data.player.yaw;
    camera.pitch = data.player.pitch;
    physics.velocity.set(data.player.vx, data.player.vy, data.player.vz);
    inventory.selectedHotbarSlot = data.player.selectedHotbarSlot;
    inventory.loadSlots(data.player.slots);
    dayNight.timeOfDay = data.timeOfDay;
}
