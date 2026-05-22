import { BlockType } from "engine/chunk/ChunkComponent";
import Component from "engine/core/Component";
import eventManager from "engine/core/EventManager";

export const HOTBAR_SIZE = 9;
export const INVENTORY_SIZE = 27;
export const TOTAL_SLOTS = HOTBAR_SIZE + INVENTORY_SIZE;
export const MAX_STACK_SIZE = 64;

export interface InventorySlot {
    blockType: BlockType;
    count: number;
}

export default class Inventory extends Component {
    private readonly slots: (InventorySlot | null)[] = new Array(TOTAL_SLOTS).fill(null);

    // Add one item to the inventory. Returns true if the item was accepted, false if inventory is full.
    // Phase 1: stack onto an existing partial stack of the same type.
    // Phase 2: place in the first empty slot.
    // Phase 3: inventory full — reject without mutation.
    add(blockType: BlockType, count = 1): boolean {
        let firstOpenSlot: number | null = null;

        for (let index = 0; index < TOTAL_SLOTS; index++) {
            const slot = this.slots[index];
            if (slot?.blockType === blockType && slot.count < MAX_STACK_SIZE) {
                slot.count = Math.min(slot.count + count, MAX_STACK_SIZE);
                eventManager.emit("inventoryChanged", undefined);
                return true;
            }

            if (!slot && firstOpenSlot === null) {
                firstOpenSlot = index;
            }
        }

        if (firstOpenSlot !== null) {
            this.slots[firstOpenSlot] = { blockType, count: Math.min(count, MAX_STACK_SIZE) };
            eventManager.emit("inventoryChanged", undefined);
            return true;
        }

        return false;
    }

    getSlot(index: number): InventorySlot | null {
        return this.slots[index] ?? null;
    }

    getSlots(): readonly (InventorySlot | null)[] {
        return this.slots;
    }

    dispose() {
        this.slots.fill(null);
    }
}
