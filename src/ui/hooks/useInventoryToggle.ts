import { useEffect, useRef, useState } from "react";

/**
 * Toggles the inventory open/closed when E is pressed.
 * Releases pointer lock on open so the cursor becomes visible.
 * Calls `onClose` when the inventory is dismissed — use this to cancel any active drag.
 */
export function useInventoryToggle(onClose: () => void): boolean {
    const [inventoryOpen, setInventoryOpen] = useState(false);

    // Store callback in a ref so the keydown listener never needs to be re-registered
    // when the caller's function identity changes between renders.
    const onCloseRef = useRef(onClose);
    useEffect(() => {
        onCloseRef.current = onClose;
    });

    // Skip side effects on mount — only react to actual toggles.
    const hasMountedRef = useRef(false);

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key !== "e" && event.key !== "E") {
                return;
            }
            setInventoryOpen(previous => !previous);
        };
        document.addEventListener("keydown", handleKeyDown);
        return () => document.removeEventListener("keydown", handleKeyDown);
    }, []);

    // Side effects on open/close — kept outside the state updater so the updater stays pure.
    useEffect(() => {
        if (!hasMountedRef.current) {
            hasMountedRef.current = true;
            return;
        }
        if (inventoryOpen && document.pointerLockElement) {
            document.exitPointerLock();
        }
        if (!inventoryOpen) {
            onCloseRef.current();
        }
    }, [inventoryOpen]);

    return inventoryOpen;
}
