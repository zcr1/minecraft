import { BlockType } from "engine/chunk/ChunkComponent";
import { type CraftingGrid, matchRecipe } from "engine/crafting/recipes";
import type { InventoryItemStack } from "engine/items/InventoryItem";
import { ItemType } from "engine/items/ItemType";

const log: InventoryItemStack = { kind: "block", type: BlockType.OakLog };
const planks: InventoryItemStack = { kind: "block", type: BlockType.OakPlanks };
const stick: InventoryItemStack = { kind: "item", type: ItemType.Stick };
const coal: InventoryItemStack = { kind: "item", type: ItemType.Coal };
const torch: InventoryItemStack = { kind: "item", type: ItemType.Torch };

// Helpers to build grids without repeating nulls every time.
// Row-major: [top-left, top-right, bottom-left, bottom-right].
const empty: CraftingGrid = [null, null, null, null];

function grid(
    tl: InventoryItemStack | null,
    tr: InventoryItemStack | null,
    bl: InventoryItemStack | null,
    br: InventoryItemStack | null,
): CraftingGrid {
    return [tl, tr, bl, br];
}

describe("matchRecipe", () => {
    // -------------------------------------------------------------------------
    // Empty grid
    // -------------------------------------------------------------------------

    test("returns null for an empty grid", () => {
        expect(matchRecipe(empty)).toBeNull();
    });

    // -------------------------------------------------------------------------
    // Oak Planks (shapeless, 1 ingredient)
    // -------------------------------------------------------------------------

    describe("oak_planks", () => {
        test("matches a log in the top-left slot", () => {
            const result = matchRecipe(grid(log, null, null, null));
            expect(result?.id).toBe("oak_planks");
            expect(result?.output).toEqual(planks);
            expect(result?.outputCount).toBe(4);
        });

        test("matches a log in the top-right slot", () => {
            expect(matchRecipe(grid(null, log, null, null))?.id).toBe("oak_planks");
        });

        test("matches a log in the bottom-left slot", () => {
            expect(matchRecipe(grid(null, null, log, null))?.id).toBe("oak_planks");
        });

        test("matches a log in the bottom-right slot", () => {
            expect(matchRecipe(grid(null, null, null, log))?.id).toBe("oak_planks");
        });

        test("does not match a non-log block", () => {
            const stone: InventoryItemStack = { kind: "block", type: BlockType.Stone };
            expect(matchRecipe(grid(stone, null, null, null))).toBeNull();
        });
    });

    // -------------------------------------------------------------------------
    // Sticks (shaped, vertical pair of planks)
    // -------------------------------------------------------------------------

    describe("sticks", () => {
        test("matches planks stacked in the left column", () => {
            const result = matchRecipe(grid(planks, null, planks, null));
            expect(result?.id).toBe("sticks");
            expect(result?.output).toEqual(stick);
            expect(result?.outputCount).toBe(4);
        });

        test("matches planks stacked in the right column (normalization)", () => {
            expect(matchRecipe(grid(null, planks, null, planks))?.id).toBe("sticks");
        });

        test("does not match planks placed horizontally", () => {
            expect(matchRecipe(grid(planks, planks, null, null))).toBeNull();
        });

        test("does not match a single plank", () => {
            expect(matchRecipe(grid(planks, null, null, null))).toBeNull();
        });

        test("does not match planks of the wrong item type", () => {
            expect(matchRecipe(grid(coal, null, coal, null))).toBeNull();
        });
    });

    // -------------------------------------------------------------------------
    // Torch (shaped: coal above stick)
    // -------------------------------------------------------------------------

    describe("torch", () => {
        test("matches coal over stick in the left column", () => {
            const result = matchRecipe(grid(coal, null, stick, null));
            expect(result?.id).toBe("torch");
            expect(result?.output).toEqual(torch);
            expect(result?.outputCount).toBe(4);
        });

        test("matches coal over stick in the right column (normalization)", () => {
            expect(matchRecipe(grid(null, coal, null, stick))?.id).toBe("torch");
        });

        test("does not match stick over coal (wrong order)", () => {
            expect(matchRecipe(grid(stick, null, coal, null))).toBeNull();
        });

        test("does not match coal alone", () => {
            expect(matchRecipe(grid(coal, null, null, null))).toBeNull();
        });

        test("does not match stick alone", () => {
            expect(matchRecipe(grid(stick, null, null, null))).toBeNull();
        });
    });

    // -------------------------------------------------------------------------
    // No false positives with extra items
    // -------------------------------------------------------------------------

    test("does not match sticks recipe when extra items fill unused slots", () => {
        // planks in all four slots is not the sticks pattern (which needs exactly two)
        expect(matchRecipe(grid(planks, planks, planks, planks))?.id).not.toBe("sticks");
    });

    test("does not match oak_planks recipe when two logs are present", () => {
        // shapeless oak_planks needs exactly 1 ingredient
        expect(matchRecipe(grid(log, log, null, null))?.id).not.toBe("oak_planks");
    });
});
