import type { BlockType } from "engine/block/BlockType";
import type { InventorySlot } from "engine/player/Inventory";
import type { BlockBreakEvent, StageAdvancedEvent, TargetedBlock } from "engine/player/PlayerBlockInteraction";

export interface BlockPlacedEvent {
    blockType: BlockType;
    worldX: number;
    worldY: number;
    worldZ: number;
}

export interface GameEventMap {
    blockBroken: BlockBreakEvent;
    blockDamageStageAdvanced: StageAdvancedEvent;
    blockPlaced: BlockPlacedEvent;
    inventoryChanged: void;
    hotbarSelectionChanged: number;
    itemDropped: InventorySlot;
    targetedBlockChanged: TargetedBlock | null;
    craftingTableOpened: void;
}

type Listener<K extends keyof GameEventMap> = (event: GameEventMap[K]) => void;

class EventManager {
    private readonly listeners = new Map<keyof GameEventMap, Array<Listener<keyof GameEventMap>>>();

    subscribe<K extends keyof GameEventMap>(eventName: K, listener: Listener<K>): void {
        let bucket = this.listeners.get(eventName);
        if (!bucket) {
            bucket = [];
            this.listeners.set(eventName, bucket);
        }
        bucket.push(listener as Listener<keyof GameEventMap>);
    }

    unsubscribe<K extends keyof GameEventMap>(eventName: K, listener: Listener<K>): void {
        const bucket = this.listeners.get(eventName);
        if (!bucket) {
            return;
        }
        const index = bucket.indexOf(listener as Listener<keyof GameEventMap>);
        if (index !== -1) {
            bucket.splice(index, 1);
        }
    }

    emit<K extends keyof GameEventMap>(eventName: K, event: GameEventMap[K]): void {
        const bucket = this.listeners.get(eventName);
        if (!bucket) {
            return;
        }
        // Iterate a snapshot so a listener that removes itself (or another) mid-dispatch
        // can't shift indices and skip the next listener.
        for (const listener of [...bucket]) {
            (listener as Listener<K>)(event);
        }
    }

    clear(): void {
        this.listeners.clear();
    }
}

export default new EventManager();
