import { type Dispatch, type SetStateAction, useMemo, useState } from "react";
import type { CraftingGrid } from "engine/crafting/recipes";
import { matchRecipe } from "engine/crafting/recipes";
import type Inventory from "engine/player/Inventory";
import type { InventorySlot } from "engine/player/Inventory";

const EMPTY_CRAFTING_GRID: (InventorySlot | null)[] = [null, null, null, null];

export interface CraftingState {
    craftingGrid: (InventorySlot | null)[];
    setCraftingGrid: Dispatch<SetStateAction<(InventorySlot | null)[]>>;
    craftingOutput: InventorySlot | null;
    handleCraft: () => void;
}

/**
 * Manages the 2×2 crafting grid state, derives the current recipe output,
 * and provides a handler that consumes one of each ingredient on craft.
 */
export function useCraftingState(inventory: Inventory): CraftingState {
    const [craftingGrid, setCraftingGrid] = useState<(InventorySlot | null)[]>([...EMPTY_CRAFTING_GRID]);

    const craftingOutput = useMemo(() => {
        const grid = craftingGrid.map(slot => slot?.item ?? null) as CraftingGrid;
        const recipe = matchRecipe(grid);
        if (!recipe) {
            return null;
        }
        return { item: recipe.output, count: recipe.outputCount } satisfies InventorySlot;
    }, [craftingGrid]);

    const handleCraft = () => {
        if (!craftingOutput || !inventory.canAdd(craftingOutput.item)) {
            return;
        }
        inventory.add(craftingOutput.item, craftingOutput.count);
        setCraftingGrid(previous =>
            previous.map(slot => {
                if (!slot) {
                    return null;
                }
                return slot.count > 1 ? { ...slot, count: slot.count - 1 } : null;
            }),
        );
    };

    return { craftingGrid, setCraftingGrid, craftingOutput, handleCraft };
}
