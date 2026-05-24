import {
    type Dispatch,
    type MouseEvent as ReactMouseEvent,
    type RefObject,
    type SetStateAction,
    useCallback,
    useEffect,
    useRef,
    useState,
} from "react";
import eventManager from "engine/core/EventManager";
import type Inventory from "engine/player/Inventory";
import type { InventorySlot } from "engine/player/Inventory";
import { CRAFTING_OUTPUT_SLOT, CRAFTING_SLOT_OFFSET } from "../CraftingPanel";

export interface DragState {
    sourceSlot: number;
    item: InventorySlot;
}

export interface DragSystem {
    dragState: DragState | null;
    dragCursorRef: RefObject<HTMLDivElement | null>;
    /** Cancel any in-progress drag without applying it. */
    cancelDrag: () => void;
    /** Begin dragging the item in the given slot. Ignores empty slots. */
    startDrag: (slotIndex: number, event: ReactMouseEvent) => void;
    onSlotMouseEnter: (slotIndex: number) => void;
    onSlotMouseLeave: () => void;
}

/**
 * Manages the full drag-and-drop lifecycle for inventory and crafting slots.
 *
 * - Tracks which slot is being dragged and which slot the cursor is over.
 * - Updates the floating cursor element via direct DOM manipulation on mousemove
 *   to avoid triggering re-renders on every frame.
 * - On mouseup, resolves the move: drop outside world-spawns the item; drop on
 *   a valid target moves or swaps, handling inventory↔crafting-grid transitions.
 */
export function useDragSystem(
    inventory: Inventory,
    craftingGrid: (InventorySlot | null)[],
    setCraftingGrid: Dispatch<SetStateAction<(InventorySlot | null)[]>>,
): DragSystem {
    const [dragState, setDragState] = useState<DragState | null>(null);
    const hoveredSlotRef = useRef<number | null>(null);
    const dragCursorRef = useRef<HTMLDivElement>(null);

    // useCallback with stable deps so useInventoryToggle can take this as a dependency
    // without re-registering its keydown listener on every render.
    const cancelDrag = useCallback(() => {
        setDragState(null);
        hoveredSlotRef.current = null;
    }, []);

    // Update the floating cursor position on every mousemove without re-rendering.
    useEffect(() => {
        if (!dragState) {
            return;
        }
        const handleMouseMove = (event: MouseEvent) => {
            if (dragCursorRef.current) {
                dragCursorRef.current.style.left = `${event.clientX}px`;
                dragCursorRef.current.style.top = `${event.clientY}px`;
            }
        };
        document.addEventListener("mousemove", handleMouseMove);
        return () => document.removeEventListener("mousemove", handleMouseMove);
    }, [dragState]);

    // Resolve the drag on mouseup: move item to target slot, or world-drop if released outside.
    useEffect(() => {
        if (!dragState) {
            return;
        }
        const handleMouseUp = () => {
            const targetSlot = hoveredSlotRef.current;
            const sourceSlot = dragState.sourceSlot;

            if (targetSlot === null) {
                // Released outside all slots — remove from source and spawn in the world.
                if (sourceSlot < CRAFTING_SLOT_OFFSET) {
                    inventory.removeSlot(sourceSlot);
                } else {
                    setCraftingGrid(previous => {
                        const next = [...previous];
                        next[sourceSlot - CRAFTING_SLOT_OFFSET] = null;
                        return next;
                    });
                }
                eventManager.emit("itemDropped", dragState.item);
            } else if (targetSlot !== sourceSlot) {
                resolveDrop(sourceSlot, targetSlot, dragState.item, inventory, craftingGrid, setCraftingGrid);
            }

            setDragState(null);
            hoveredSlotRef.current = null;
        };
        document.addEventListener("mouseup", handleMouseUp);
        return () => document.removeEventListener("mouseup", handleMouseUp);
    }, [dragState, inventory, craftingGrid, setCraftingGrid]);

    const startDrag = (slotIndex: number, event: ReactMouseEvent) => {
        const slot =
            slotIndex < CRAFTING_SLOT_OFFSET
                ? inventory.getSlot(slotIndex)
                : craftingGrid[slotIndex - CRAFTING_SLOT_OFFSET];

        if (!slot) {
            return;
        }
        event.preventDefault();
        if (dragCursorRef.current) {
            dragCursorRef.current.style.left = `${event.clientX}px`;
            dragCursorRef.current.style.top = `${event.clientY}px`;
        }
        setDragState({ sourceSlot: slotIndex, item: slot });
    };

    const onSlotMouseEnter = (slotIndex: number) => {
        hoveredSlotRef.current = slotIndex;
    };

    const onSlotMouseLeave = () => {
        hoveredSlotRef.current = null;
    };

    return { dragState, dragCursorRef, cancelDrag, startDrag, onSlotMouseEnter, onSlotMouseLeave };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function resolveDrop(
    sourceSlot: number,
    targetSlot: number,
    draggedItem: InventorySlot,
    inventory: Inventory,
    craftingGrid: (InventorySlot | null)[],
    setCraftingGrid: Dispatch<SetStateAction<(InventorySlot | null)[]>>,
): void {
    const sourceIsInventory = sourceSlot < CRAFTING_SLOT_OFFSET;
    const targetIsInventory = targetSlot < CRAFTING_SLOT_OFFSET;
    const targetIsCraftingGrid = targetSlot >= CRAFTING_SLOT_OFFSET && targetSlot < CRAFTING_OUTPUT_SLOT;
    const targetIsOutput = targetSlot === CRAFTING_OUTPUT_SLOT;

    if (targetIsOutput) {
        // Cannot drop onto the output slot.
        return;
    }

    if (sourceIsInventory && targetIsInventory) {
        inventory.moveSlot(sourceSlot, targetSlot);
        return;
    }

    if (sourceIsInventory && targetIsCraftingGrid) {
        moveToCraftingGrid(sourceSlot, targetSlot, draggedItem, inventory, craftingGrid, setCraftingGrid);
        return;
    }

    if (!sourceIsInventory && targetIsInventory) {
        moveFromCraftingGrid(sourceSlot, targetSlot, draggedItem, inventory, setCraftingGrid);
        return;
    }

    // Both slots are in the crafting grid — swap them.
    const sourceCraftingIndex = sourceSlot - CRAFTING_SLOT_OFFSET;
    const targetCraftingIndex = targetSlot - CRAFTING_SLOT_OFFSET;
    setCraftingGrid(previous => {
        const next = [...previous];
        [next[sourceCraftingIndex], next[targetCraftingIndex]] = [next[targetCraftingIndex], next[sourceCraftingIndex]];
        return next;
    });
}

/** Move one item from an inventory slot into a crafting grid cell. Displaces the existing cell item back to inventory. */
function moveToCraftingGrid(
    sourceSlot: number,
    targetSlot: number,
    draggedItem: InventorySlot,
    inventory: Inventory,
    craftingGrid: (InventorySlot | null)[],
    setCraftingGrid: Dispatch<SetStateAction<(InventorySlot | null)[]>>,
): void {
    const craftingIndex = targetSlot - CRAFTING_SLOT_OFFSET;
    const displaced = craftingGrid[craftingIndex];

    // Skip if the displaced crafting item has nowhere to go.
    if (displaced && !inventory.canAdd(displaced.item)) {
        return;
    }

    if (draggedItem.count > 1) {
        inventory.setSlot(sourceSlot, { ...draggedItem, count: draggedItem.count - 1 });
    } else {
        inventory.removeSlot(sourceSlot);
    }

    setCraftingGrid(previous => {
        const next = [...previous];
        next[craftingIndex] = { item: draggedItem.item, count: 1 };
        return next;
    });

    if (displaced) {
        inventory.add(displaced.item, displaced.count);
    }
}

/** Swap a crafting grid slot with an inventory slot. */
function moveFromCraftingGrid(
    sourceSlot: number,
    targetSlot: number,
    draggedItem: InventorySlot,
    inventory: Inventory,
    setCraftingGrid: Dispatch<SetStateAction<(InventorySlot | null)[]>>,
): void {
    const craftingIndex = sourceSlot - CRAFTING_SLOT_OFFSET;
    const displaced = inventory.getSlot(targetSlot);
    inventory.setSlot(targetSlot, draggedItem);
    setCraftingGrid(previous => {
        const next = [...previous];
        next[craftingIndex] = displaced;
        return next;
    });
}
