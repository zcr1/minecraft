import { BlockType } from "engine/chunk/ChunkComponent";
import type { InventoryItemStack } from "engine/items/InventoryItem";
import { ItemType } from "engine/items/ItemType";
import Inventory, { MAX_STACK_SIZE } from "engine/player/Inventory";

const coal: InventoryItemStack = { kind: "item", type: ItemType.Coal };
const stick: InventoryItemStack = { kind: "item", type: ItemType.Stick };
const dirt: InventoryItemStack = { kind: "block", type: BlockType.Dirt };
const stone: InventoryItemStack = { kind: "block", type: BlockType.Stone };

describe("Inventory", () => {
    let inventory: Inventory;

    beforeEach(() => {
        inventory = new Inventory();
    });

    // -------------------------------------------------------------------------
    // add
    // -------------------------------------------------------------------------

    describe("add", () => {
        test("places item in the first empty slot", () => {
            inventory.add(coal);
            expect(inventory.getSlot(0)).toEqual({ item: coal, count: 1 });
        });

        test("stacks onto an existing partial stack of the same type", () => {
            inventory.add(coal, 10);
            inventory.add(coal, 5);
            expect(inventory.getSlot(0)).toEqual({ item: coal, count: 15 });
            expect(inventory.getSlot(1)).toBeNull();
        });

        test("does not stack items of different types", () => {
            inventory.add(coal);
            inventory.add(stick);
            expect(inventory.getSlot(0)?.item).toEqual(coal);
            expect(inventory.getSlot(1)?.item).toEqual(stick);
        });

        test("opens a new slot once the first stack reaches MAX_STACK_SIZE", () => {
            inventory.add(coal, MAX_STACK_SIZE);
            inventory.add(coal, 10);
            expect(inventory.getSlot(0)?.count).toBe(MAX_STACK_SIZE);
            expect(inventory.getSlot(1)?.count).toBe(10);
        });

        test("returns true when the item is accepted", () => {
            expect(inventory.add(coal)).toBe(true);
        });

        test("returns false when every slot is full", () => {
            for (let index = 0; index < 36; index++) {
                inventory.setSlot(index, { item: coal, count: MAX_STACK_SIZE });
            }
            expect(inventory.add(coal)).toBe(false);
        });

        test("fills with the supplied count", () => {
            inventory.add(dirt, 7);
            expect(inventory.getSlot(0)?.count).toBe(7);
        });
    });

    // -------------------------------------------------------------------------
    // canAdd
    // -------------------------------------------------------------------------

    describe("canAdd", () => {
        test("returns true for an empty inventory", () => {
            expect(inventory.canAdd(coal)).toBe(true);
        });

        test("returns true when a partial stack of the same type exists", () => {
            inventory.add(coal, 10);
            expect(inventory.canAdd(coal)).toBe(true);
        });

        test("returns true when there is an empty slot even if same-type stacks are full", () => {
            inventory.setSlot(0, { item: coal, count: MAX_STACK_SIZE });
            expect(inventory.canAdd(coal)).toBe(true);
        });

        test("returns false when all slots are occupied at max count", () => {
            for (let index = 0; index < 36; index++) {
                inventory.setSlot(index, { item: coal, count: MAX_STACK_SIZE });
            }
            expect(inventory.canAdd(coal)).toBe(false);
        });

        test("returns true for a different item type when an empty slot exists", () => {
            inventory.setSlot(0, { item: coal, count: MAX_STACK_SIZE });
            expect(inventory.canAdd(stick)).toBe(true);
        });
    });

    // -------------------------------------------------------------------------
    // moveSlot
    // -------------------------------------------------------------------------

    describe("moveSlot", () => {
        test("moves a stack to an empty target slot", () => {
            inventory.setSlot(0, { item: coal, count: 5 });
            inventory.moveSlot(0, 5);
            expect(inventory.getSlot(0)).toBeNull();
            expect(inventory.getSlot(5)).toEqual({ item: coal, count: 5 });
        });

        test("swaps stacks of different types", () => {
            inventory.setSlot(0, { item: coal, count: 3 });
            inventory.setSlot(1, { item: stick, count: 7 });
            inventory.moveSlot(0, 1);
            expect(inventory.getSlot(0)).toEqual({ item: stick, count: 7 });
            expect(inventory.getSlot(1)).toEqual({ item: coal, count: 3 });
        });

        test("swaps a block and an item type", () => {
            inventory.setSlot(0, { item: coal, count: 1 });
            inventory.setSlot(1, { item: dirt, count: 2 });
            inventory.moveSlot(0, 1);
            expect(inventory.getSlot(0)?.item).toEqual(dirt);
            expect(inventory.getSlot(1)?.item).toEqual(coal);
        });

        test("merges stacks of the same type", () => {
            inventory.setSlot(0, { item: coal, count: 10 });
            inventory.setSlot(1, { item: coal, count: 5 });
            inventory.moveSlot(0, 1);
            expect(inventory.getSlot(0)).toBeNull();
            expect(inventory.getSlot(1)).toEqual({ item: coal, count: 15 });
        });

        test("caps the target at MAX_STACK_SIZE and leaves overflow in the source", () => {
            inventory.setSlot(0, { item: coal, count: 40 });
            inventory.setSlot(1, { item: coal, count: 40 });
            inventory.moveSlot(0, 1);
            expect(inventory.getSlot(1)?.count).toBe(MAX_STACK_SIZE);
            expect(inventory.getSlot(0)?.count).toBe(16); // 80 - 64
        });

        test("clears the source when total exactly equals MAX_STACK_SIZE", () => {
            inventory.setSlot(0, { item: coal, count: 24 });
            inventory.setSlot(1, { item: coal, count: 40 });
            inventory.moveSlot(0, 1);
            expect(inventory.getSlot(0)).toBeNull();
            expect(inventory.getSlot(1)?.count).toBe(MAX_STACK_SIZE);
        });

        test("swaps a non-empty slot onto an empty slot (null target)", () => {
            inventory.setSlot(2, { item: dirt, count: 3 });
            inventory.moveSlot(2, 10);
            expect(inventory.getSlot(2)).toBeNull();
            expect(inventory.getSlot(10)).toEqual({ item: dirt, count: 3 });
        });
    });

    // -------------------------------------------------------------------------
    // removeSlot / setSlot
    // -------------------------------------------------------------------------

    describe("removeSlot", () => {
        test("clears the slot", () => {
            inventory.add(coal);
            inventory.removeSlot(0);
            expect(inventory.getSlot(0)).toBeNull();
        });

        test("is a no-op on an already-empty slot", () => {
            expect(() => inventory.removeSlot(0)).not.toThrow();
            expect(inventory.getSlot(0)).toBeNull();
        });
    });

    describe("setSlot", () => {
        test("places an arbitrary slot at the given index", () => {
            inventory.setSlot(3, { item: stone, count: 12 });
            expect(inventory.getSlot(3)).toEqual({ item: stone, count: 12 });
        });

        test("clears a slot when given null", () => {
            inventory.setSlot(3, { item: stone, count: 12 });
            inventory.setSlot(3, null);
            expect(inventory.getSlot(3)).toBeNull();
        });
    });
});
