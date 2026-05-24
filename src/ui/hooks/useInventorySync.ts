import { useEffect, useReducer } from "react";
import eventManager from "engine/core/EventManager";

/**
 * Forces a re-render whenever the inventory contents change.
 * The Inventory class mutates in place and emits "inventoryChanged" after each write.
 */
export function useInventorySync(): void {
    const [, forceRender] = useReducer((value: number) => value + 1, 0);
    useEffect(() => {
        const listener = () => forceRender();
        eventManager.subscribe("inventoryChanged", listener);
        return () => eventManager.unsubscribe("inventoryChanged", listener);
    }, []);
}
