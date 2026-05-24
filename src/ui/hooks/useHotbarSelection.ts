import { useEffect, useState } from "react";
import eventManager from "engine/core/EventManager";

/** Tracks the currently selected hotbar slot index, kept in sync via event. */
export function useHotbarSelection(): number {
    const [selectedSlot, setSelectedSlot] = useState(0);
    useEffect(() => {
        const listener = (slotIndex: number) => setSelectedSlot(slotIndex);
        eventManager.subscribe("hotbarSelectionChanged", listener);
        return () => eventManager.unsubscribe("hotbarSelectionChanged", listener);
    }, []);
    return selectedSlot;
}
