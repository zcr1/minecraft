import Component from "engine/core/Component";
import eventManager from "engine/core/EventManager";
import input from "engine/input/Input";
import { type InventoryItemStack, itemStacksEqual } from "engine/items/InventoryItem";

export const HOTBAR_SIZE = 9;
export const INVENTORY_SIZE = 27;
export const TOTAL_SLOTS = HOTBAR_SIZE + INVENTORY_SIZE;
export const MAX_STACK_SIZE = 64;

export type { InventoryItemStack };

export interface InventorySlot {
    item: InventoryItemStack;
    count: number;
}

export default class Inventory extends Component {
    private static readonly HOTBAR_KEYS = [
        "Digit1",
        "Digit2",
        "Digit3",
        "Digit4",
        "Digit5",
        "Digit6",
        "Digit7",
        "Digit8",
        "Digit9",
    ] as const;

    private readonly slots: (InventorySlot | null)[] = new Array(TOTAL_SLOTS).fill(null);

    selectedHotbarSlot = 0;

    // Add one item to the inventory. Returns true if the item was accepted, false if inventory is full.
    // Phase 1: stack onto an existing partial stack of the same type.
    // Phase 2: place in the first empty slot.
    // Phase 3: inventory full — reject without mutation.
    add(item: InventoryItemStack, count = 1): boolean {
        let firstOpenSlot: number | null = null;

        for (let index = 0; index < TOTAL_SLOTS; index++) {
            const slot = this.slots[index];
            if (
                slot !== null &&
                slot.item.kind === item.kind &&
                slot.item.type === item.type &&
                slot.count < MAX_STACK_SIZE
            ) {
                slot.count = Math.min(slot.count + count, MAX_STACK_SIZE);
                eventManager.emit("inventoryChanged", undefined);
                return true;
            }

            if (!slot && firstOpenSlot === null) {
                firstOpenSlot = index;
            }
        }

        if (firstOpenSlot !== null) {
            this.slots[firstOpenSlot] = { item, count: Math.min(count, MAX_STACK_SIZE) };
            eventManager.emit("inventoryChanged", undefined);
            return true;
        }

        return false;
    }

    // Returns true if add() would accept the item without mutation.
    canAdd(item: InventoryItemStack): boolean {
        for (let index = 0; index < TOTAL_SLOTS; index++) {
            const slot = this.slots[index];
            if (slot === null) {
                return true;
            }
            if (slot.item.kind === item.kind && slot.item.type === item.type && slot.count < MAX_STACK_SIZE) {
                return true;
            }
        }
        return false;
    }

    getSlot(index: number): InventorySlot | null {
        return this.slots[index] ?? null;
    }

    getSlots(): readonly (InventorySlot | null)[] {
        return this.slots;
    }

    // Bulk-replaces every slot from a saved snapshot, emitting a single change event
    loadSlots(slots: ReadonlyArray<InventorySlot | null>): void {
        for (let index = 0; index < TOTAL_SLOTS; index++) {
            this.slots[index] = slots[index] ?? null;
        }
        eventManager.emit("inventoryChanged", undefined);
    }

    update(_deltaTime: number) {
        for (let index = 0; index < Inventory.HOTBAR_KEYS.length; index++) {
            if (input.wasPressed(Inventory.HOTBAR_KEYS[index]) && index !== this.selectedHotbarSlot) {
                this.selectedHotbarSlot = index;
                eventManager.emit("hotbarSelectionChanged", index);
            }
        }
    }

    removeSlot(index: number): void {
        this.slots[index] = null;
        eventManager.emit("inventoryChanged", undefined);
    }

    setSlot(index: number, slot: InventorySlot | null): void {
        this.slots[index] = slot;
        eventManager.emit("inventoryChanged", undefined);
    }

    moveSlot(fromIndex: number, toIndex: number): void {
        const fromSlot = this.slots[fromIndex];
        const toSlot = this.slots[toIndex];

        if (fromSlot !== null && toSlot !== null && itemStacksEqual(fromSlot.item, toSlot.item)) {
            // Same item type: merge up to MAX_STACK_SIZE, leave any overflow in the source slot.
            const total = fromSlot.count + toSlot.count;
            toSlot.count = Math.min(total, MAX_STACK_SIZE);
            this.slots[fromIndex] = total > MAX_STACK_SIZE ? { ...fromSlot, count: total - MAX_STACK_SIZE } : null;
        } else {
            this.slots[fromIndex] = toSlot;
            this.slots[toIndex] = fromSlot;
        }

        eventManager.emit("inventoryChanged", undefined);
    }

    consumeSelectedSlot(): void {
        const slot = this.slots[this.selectedHotbarSlot];
        if (!slot) {
            return;
        }
        slot.count -= 1;
        if (slot.count <= 0) {
            this.slots[this.selectedHotbarSlot] = null;
        }
        eventManager.emit("inventoryChanged", undefined);
    }

    dispose() {
        this.slots.fill(null);
    }
}
