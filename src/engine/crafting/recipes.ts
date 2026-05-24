import { BlockType } from "engine/chunk/ChunkComponent";
import { type InventoryItemStack, itemStacksEqual } from "engine/items/InventoryItem";
import { ItemType } from "engine/items/ItemType";

// A single slot in a 2×2 crafting grid. null means the slot is empty.
export type RecipeSlot = InventoryItemStack | null;

// 2×2 crafting grid in row-major order: [top-left, top-right, bottom-left, bottom-right].
export type CraftingGrid = [RecipeSlot, RecipeSlot, RecipeSlot, RecipeSlot];

export interface CraftingRecipe {
    id: string;
    // Full 2×2 pattern. Shaped recipes are normalized to the top-left before matching,
    // so the player can place ingredients anywhere in the grid.
    pattern: CraftingGrid;
    shapeless: boolean;
    output: InventoryItemStack;
    outputCount: number;
}

// Shift all non-null ingredients to the top-left corner so shaped recipes match
// regardless of where in the 2×2 grid the player places them.
function normalizeGrid(grid: CraftingGrid): CraftingGrid {
    const hasTopRow = grid[0] !== null || grid[1] !== null;
    const hasLeftCol = grid[0] !== null || grid[2] !== null;
    const rowShift = hasTopRow ? 0 : 1;
    const colShift = hasLeftCol ? 0 : 1;
    if (rowShift === 0 && colShift === 0) {
        return grid;
    }
    const result: CraftingGrid = [null, null, null, null];
    for (let row = 0; row < 2; row++) {
        for (let col = 0; col < 2; col++) {
            const sourceRow = row + rowShift;
            const sourceCol = col + colShift;
            if (sourceRow < 2 && sourceCol < 2) {
                result[row * 2 + col] = grid[sourceRow * 2 + sourceCol];
            }
        }
    }
    return result;
}

function matchShaped(grid: CraftingGrid, recipe: CraftingRecipe): boolean {
    const normalized = normalizeGrid(grid);
    return (
        itemStacksEqual(normalized[0], recipe.pattern[0]) &&
        itemStacksEqual(normalized[1], recipe.pattern[1]) &&
        itemStacksEqual(normalized[2], recipe.pattern[2]) &&
        itemStacksEqual(normalized[3], recipe.pattern[3])
    );
}

function matchShapeless(grid: CraftingGrid, recipe: CraftingRecipe): boolean {
    const recipeIngredients = recipe.pattern.filter((slot): slot is InventoryItemStack => slot !== null);
    const gridIngredients = grid.filter((slot): slot is InventoryItemStack => slot !== null);
    if (recipeIngredients.length !== gridIngredients.length) {
        return false;
    }
    const used = new Array<boolean>(gridIngredients.length).fill(false);
    for (const recipeItem of recipeIngredients) {
        const matchIndex = gridIngredients.findIndex(
            (gridItem, index) => !used[index] && itemStacksEqual(gridItem, recipeItem),
        );
        if (matchIndex === -1) {
            return false;
        }
        used[matchIndex] = true;
    }
    return true;
}

// Returns the first recipe whose pattern matches the given grid, or null if none match.
export function matchRecipe(grid: CraftingGrid): CraftingRecipe | null {
    for (const recipe of CRAFTING_RECIPES) {
        const matches = recipe.shapeless ? matchShapeless(grid, recipe) : matchShaped(grid, recipe);
        if (matches) {
            return recipe;
        }
    }
    return null;
}

export const CRAFTING_RECIPES: readonly CraftingRecipe[] = [
    // 1 Oak Log → 4 Oak Planks (shapeless; works in any single slot)
    {
        id: "oak_planks",
        pattern: [{ kind: "block", type: BlockType.OakLog }, null, null, null],
        shapeless: true,
        output: { kind: "block", type: BlockType.OakPlanks },
        outputCount: 4,
    },

    // 2 Oak Planks stacked vertically → 4 Sticks
    {
        id: "sticks",
        pattern: [
            { kind: "block", type: BlockType.OakPlanks },
            null,
            { kind: "block", type: BlockType.OakPlanks },
            null,
        ],
        shapeless: false,
        output: { kind: "item", type: ItemType.Stick },
        outputCount: 4,
    },

    // Coal above Stick → 4 Torches
    {
        id: "torch",
        pattern: [{ kind: "item", type: ItemType.Coal }, null, { kind: "item", type: ItemType.Stick }, null],
        shapeless: false,
        output: { kind: "item", type: ItemType.Torch },
        outputCount: 4,
    },
];
