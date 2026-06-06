import { BlockType } from "engine/chunk/ChunkComponent";
import { type CraftingGrid, type CraftingGrid3x3, matchRecipe, matchRecipe3x3 } from "engine/crafting/recipes";
import type { InventoryItemStack } from "engine/items/InventoryItem";
import { ItemType } from "engine/items/ItemType";

const planks: InventoryItemStack = { kind: "block", type: BlockType.OakPlanks };
const cobble: InventoryItemStack = { kind: "block", type: BlockType.Cobblestone };
const stick: InventoryItemStack = { kind: "item", type: ItemType.Stick };
const craftingTable: InventoryItemStack = { kind: "block", type: BlockType.CraftingTable };

// Build a 3×3 grid from positional shorthand. Accepts 9 values in row-major order.
function g3(
    r0c0: InventoryItemStack | null,
    r0c1: InventoryItemStack | null,
    r0c2: InventoryItemStack | null,
    r1c0: InventoryItemStack | null,
    r1c1: InventoryItemStack | null,
    r1c2: InventoryItemStack | null,
    r2c0: InventoryItemStack | null,
    r2c1: InventoryItemStack | null,
    r2c2: InventoryItemStack | null,
): CraftingGrid3x3 {
    return [r0c0, r0c1, r0c2, r1c0, r1c1, r1c2, r2c0, r2c1, r2c2];
}

const empty3x3: CraftingGrid3x3 = [null, null, null, null, null, null, null, null, null];

// ---------------------------------------------------------------------------
// Crafting table 2×2 recipe
// ---------------------------------------------------------------------------

describe("crafting_table (2×2 recipe)", () => {
    test("matches four planks filling the full 2×2 grid", () => {
        const grid: CraftingGrid = [planks, planks, planks, planks];
        const result = matchRecipe(grid);
        expect(result?.id).toBe("crafting_table");
        expect(result?.output).toEqual(craftingTable);
        expect(result?.outputCount).toBe(1);
    });

    test("does not match three planks", () => {
        const grid: CraftingGrid = [planks, planks, planks, null];
        expect(matchRecipe(grid)?.id).not.toBe("crafting_table");
    });

    test("does not match planks of a different block type", () => {
        const grid: CraftingGrid = [cobble, cobble, cobble, cobble];
        expect(matchRecipe(grid)?.id).not.toBe("crafting_table");
    });
});

// ---------------------------------------------------------------------------
// matchRecipe3x3 — empty and null-input behaviour
// ---------------------------------------------------------------------------

describe("matchRecipe3x3", () => {
    test("returns null for an empty 3×3 grid", () => {
        expect(matchRecipe3x3(empty3x3)).toBeNull();
    });

    // -----------------------------------------------------------------------
    // Wooden Pickaxe
    // -----------------------------------------------------------------------

    describe("wooden_pickaxe", () => {
        test("matches planks across top row with sticks in centre column", () => {
            const result = matchRecipe3x3(g3(planks, planks, planks, null, stick, null, null, stick, null));
            expect(result?.id).toBe("wooden_pickaxe");
            expect(result?.output).toEqual({ kind: "item", type: ItemType.WoodenPickaxe });
            expect(result?.outputCount).toBe(1);
        });

        test("does not match incomplete pickaxe shifted right (only 2 planks in top row)", () => {
            // Planks in cols 1–2, sticks in col 1 — only 2 planks wide, not 3.
            const shifted = g3(null, planks, planks, null, null, stick, null, null, stick);
            expect(matchRecipe3x3(shifted)).toBeNull();
        });

        test("does not match pickaxe shifted down with only one stick row", () => {
            // 3 planks in row 1, one stick in row 2 col 1 — missing the second stick.
            const shifted = g3(null, null, null, planks, planks, planks, null, stick, null);
            expect(matchRecipe3x3(shifted)).toBeNull();
        });

        test("normalises — matches pickaxe shifted down one row", () => {
            // Full pickaxe pattern (3 planks + 2 sticks) placed in rows 1–2 (not fitting):
            // there are only 2 rows left after row 1, so this is actually the same incomplete
            // pattern as above. A genuinely shifted full pattern needs 3 rows, which in a 3×3
            // grid means it can only sit at row 0. Verify the normaliser leaves it in place.
            const canonical = g3(planks, planks, planks, null, stick, null, null, stick, null);
            expect(matchRecipe3x3(canonical)?.id).toBe("wooden_pickaxe");
        });

        test("full pickaxe shifted to rows 0-2 col 0-2 (already normalised)", () => {
            // Canonical pattern — normalisation is a no-op.
            const result = matchRecipe3x3(g3(planks, planks, planks, null, stick, null, null, stick, null));
            expect(result?.id).toBe("wooden_pickaxe");
        });

        test("does not match pickaxe with only one stick", () => {
            expect(matchRecipe3x3(g3(planks, planks, planks, null, stick, null, null, null, null))).toBeNull();
        });

        test("does not match pickaxe with planks in wrong orientation", () => {
            // Planks in a column instead of a row.
            expect(matchRecipe3x3(g3(planks, null, null, planks, null, null, planks, stick, null))).toBeNull();
        });
    });

    // -----------------------------------------------------------------------
    // Stone Pickaxe
    // -----------------------------------------------------------------------

    describe("stone_pickaxe", () => {
        test("matches cobblestone across top row with sticks in centre column", () => {
            const result = matchRecipe3x3(g3(cobble, cobble, cobble, null, stick, null, null, stick, null));
            expect(result?.id).toBe("stone_pickaxe");
            expect(result?.output).toEqual({ kind: "item", type: ItemType.StonePickaxe });
        });

        test("does not match when planks substitute for cobblestone", () => {
            // Planks + sticks = wooden pickaxe, not stone.
            const result = matchRecipe3x3(g3(planks, planks, planks, null, stick, null, null, stick, null));
            expect(result?.id).toBe("wooden_pickaxe");
            expect(result?.id).not.toBe("stone_pickaxe");
        });

        test("does not match mixed cobble and planks in top row", () => {
            expect(matchRecipe3x3(g3(cobble, planks, cobble, null, stick, null, null, stick, null))).toBeNull();
        });
    });

    // -----------------------------------------------------------------------
    // Wooden Sword
    // -----------------------------------------------------------------------

    describe("wooden_sword", () => {
        test("matches two planks then stick in the left column", () => {
            const result = matchRecipe3x3(g3(planks, null, null, planks, null, null, stick, null, null));
            expect(result?.id).toBe("wooden_sword");
            expect(result?.output).toEqual({ kind: "item", type: ItemType.WoodenSword });
            expect(result?.outputCount).toBe(1);
        });

        test("normalises — matches sword placed in the centre column", () => {
            // After normalisation, the centre-column sword shifts to the left column.
            const result = matchRecipe3x3(g3(null, planks, null, null, planks, null, null, stick, null));
            expect(result?.id).toBe("wooden_sword");
        });

        test("normalises — matches sword placed in the right column", () => {
            const result = matchRecipe3x3(g3(null, null, planks, null, null, planks, null, null, stick));
            expect(result?.id).toBe("wooden_sword");
        });

        test("does not match sword with stick above planks (wrong order)", () => {
            expect(matchRecipe3x3(g3(stick, null, null, planks, null, null, planks, null, null))).toBeNull();
        });

        test("does not match sword with only one plank", () => {
            expect(matchRecipe3x3(g3(planks, null, null, null, null, null, stick, null, null))).toBeNull();
        });
    });

    // -----------------------------------------------------------------------
    // Stone Sword
    // -----------------------------------------------------------------------

    describe("stone_sword", () => {
        test("matches two cobblestone then stick in the left column", () => {
            const result = matchRecipe3x3(g3(cobble, null, null, cobble, null, null, stick, null, null));
            expect(result?.id).toBe("stone_sword");
            expect(result?.output).toEqual({ kind: "item", type: ItemType.StoneSword });
        });

        test("normalises — matches sword in right column", () => {
            const result = matchRecipe3x3(g3(null, null, cobble, null, null, cobble, null, null, stick));
            expect(result?.id).toBe("stone_sword");
        });
    });

    // -----------------------------------------------------------------------
    // No false positives
    // -----------------------------------------------------------------------

    describe("no false positives", () => {
        test("pickaxe pattern with extra items in empty slots does not match", () => {
            // Extra cobble in an otherwise valid wooden pickaxe slot.
            expect(matchRecipe3x3(g3(planks, planks, planks, cobble, stick, null, null, stick, null))).toBeNull();
        });

        test("sword pattern with extra items does not match", () => {
            expect(matchRecipe3x3(g3(planks, cobble, null, planks, null, null, stick, null, null))).toBeNull();
        });

        test("fully filled grid does not match any recipe", () => {
            const full = g3(planks, planks, planks, planks, planks, planks, planks, planks, planks);
            expect(matchRecipe3x3(full)).toBeNull();
        });
    });
});
