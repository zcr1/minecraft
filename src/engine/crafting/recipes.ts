import { BlockType } from "engine/chunk/ChunkComponent";
import { type InventoryItemStack, itemStacksEqual } from "engine/items/InventoryItem";
import { ItemType } from "engine/items/ItemType";

// A single slot in a crafting grid. null means the slot is empty.
export type RecipeSlot = InventoryItemStack | null;

// 2×2 crafting grid in row-major order: [top-left, top-right, bottom-left, bottom-right].
export type CraftingGrid = [RecipeSlot, RecipeSlot, RecipeSlot, RecipeSlot];

// 3×3 crafting grid in row-major order (9 slots, rows top to bottom, cols left to right).
export type CraftingGrid3x3 = [
    RecipeSlot,
    RecipeSlot,
    RecipeSlot,
    RecipeSlot,
    RecipeSlot,
    RecipeSlot,
    RecipeSlot,
    RecipeSlot,
    RecipeSlot,
];

export interface CraftingRecipe {
    id: string;
    // Full 2×2 pattern. Shaped recipes are normalized to the top-left before matching,
    // so the player can place ingredients anywhere in the grid.
    pattern: CraftingGrid;
    shapeless: boolean;
    output: InventoryItemStack;
    outputCount: number;
}

export interface CraftingRecipe3x3 {
    id: string;
    // Full 3×3 pattern, normalized to top-left. The player can place ingredients anywhere
    // in the 3×3 grid and the pattern shifts to match.
    pattern: CraftingGrid3x3;
    shapeless: boolean;
    output: InventoryItemStack;
    outputCount: number;
}

// ---------------------------------------------------------------------------
// 2×2 helpers
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// 3×3 helpers
// ---------------------------------------------------------------------------

// Shift all non-null ingredients toward the top-left of the 3×3 grid.
function normalizeGrid3x3(grid: CraftingGrid3x3): CraftingGrid3x3 {
    const WIDTH = 3;
    const HEIGHT = 3;

    let minRow = HEIGHT;
    let minCol = WIDTH;
    for (let row = 0; row < HEIGHT; row++) {
        for (let col = 0; col < WIDTH; col++) {
            if (grid[row * WIDTH + col] !== null) {
                if (row < minRow) {
                    minRow = row;
                }
                if (col < minCol) {
                    minCol = col;
                }
            }
        }
    }

    if (minRow === 0 && minCol === 0) {
        return grid;
    }

    const result: CraftingGrid3x3 = [null, null, null, null, null, null, null, null, null];
    for (let row = 0; row < HEIGHT; row++) {
        for (let col = 0; col < WIDTH; col++) {
            const sourceRow = row + minRow;
            const sourceCol = col + minCol;
            if (sourceRow < HEIGHT && sourceCol < WIDTH) {
                result[row * WIDTH + col] = grid[sourceRow * WIDTH + sourceCol];
            }
        }
    }
    return result;
}

function matchShaped3x3(grid: CraftingGrid3x3, recipe: CraftingRecipe3x3): boolean {
    const normalized = normalizeGrid3x3(grid);
    for (let i = 0; i < 9; i++) {
        if (!itemStacksEqual(normalized[i], recipe.pattern[i])) {
            return false;
        }
    }
    return true;
}

function matchShapeless3x3(grid: CraftingGrid3x3, recipe: CraftingRecipe3x3): boolean {
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

export function matchRecipe3x3(grid: CraftingGrid3x3): CraftingRecipe3x3 | null {
    for (const recipe of CRAFTING_TABLE_RECIPES) {
        const matches = recipe.shapeless ? matchShapeless3x3(grid, recipe) : matchShaped3x3(grid, recipe);
        if (matches) {
            return recipe;
        }
    }
    return null;
}

// ---------------------------------------------------------------------------
// Recipe shorthand helpers
// ---------------------------------------------------------------------------

const oakLog: RecipeSlot = { kind: "block", type: BlockType.OakLog };
const oakPlanks: RecipeSlot = { kind: "block", type: BlockType.OakPlanks };
const cobblestone: RecipeSlot = { kind: "block", type: BlockType.Cobblestone };
const coal: RecipeSlot = { kind: "item", type: ItemType.Coal };
const stick: RecipeSlot = { kind: "item", type: ItemType.Stick };

// ---------------------------------------------------------------------------
// 2×2 recipes (inventory crafting)
// ---------------------------------------------------------------------------

export const CRAFTING_RECIPES: readonly CraftingRecipe[] = [
    // 1 Oak Log → 4 Oak Planks (shapeless; works in any single slot)
    {
        id: "oak_planks",
        pattern: [oakLog, null, null, null],
        shapeless: true,
        output: { kind: "block", type: BlockType.OakPlanks },
        outputCount: 4,
    },

    // 2 Oak Planks stacked vertically → 4 Sticks
    {
        id: "sticks",
        pattern: [oakPlanks, null, oakPlanks, null],
        shapeless: false,
        output: { kind: "item", type: ItemType.Stick },
        outputCount: 4,
    },

    // Coal above Stick → 4 Torches
    {
        id: "torch",
        pattern: [coal, null, stick, null],
        shapeless: false,
        output: { kind: "item", type: ItemType.Torch },
        outputCount: 4,
    },

    // 4 Oak Planks (full 2×2) → 1 Crafting Table
    {
        id: "crafting_table",
        pattern: [oakPlanks, oakPlanks, oakPlanks, oakPlanks],
        shapeless: false,
        output: { kind: "block", type: BlockType.CraftingTable },
        outputCount: 1,
    },
];

// ---------------------------------------------------------------------------
// 3×3 recipes (crafting table)
// ---------------------------------------------------------------------------

export const CRAFTING_TABLE_RECIPES: readonly CraftingRecipe3x3[] = [
    // Wooden Pickaxe: 3 planks across top, 2 sticks down center
    {
        id: "wooden_pickaxe",
        pattern: [oakPlanks, oakPlanks, oakPlanks, null, stick, null, null, stick, null],
        shapeless: false,
        output: { kind: "item", type: ItemType.WoodenPickaxe },
        outputCount: 1,
    },

    // Stone Pickaxe: 3 cobblestone across top, 2 sticks down center
    {
        id: "stone_pickaxe",
        pattern: [cobblestone, cobblestone, cobblestone, null, stick, null, null, stick, null],
        shapeless: false,
        output: { kind: "item", type: ItemType.StonePickaxe },
        outputCount: 1,
    },

    // Wooden Sword: 2 planks then stick down left column
    {
        id: "wooden_sword",
        pattern: [oakPlanks, null, null, oakPlanks, null, null, stick, null, null],
        shapeless: false,
        output: { kind: "item", type: ItemType.WoodenSword },
        outputCount: 1,
    },

    // Stone Sword: 2 cobblestone then stick down left column
    {
        id: "stone_sword",
        pattern: [cobblestone, null, null, cobblestone, null, null, stick, null, null],
        shapeless: false,
        output: { kind: "item", type: ItemType.StoneSword },
        outputCount: 1,
    },
];
