// @refresh reset
import { useEffect, useRef, useState } from "react";
import game from "engine/Game";
import VoxelItemMeshes from "engine/items/VoxelItemMeshes";
import * as SaveManager from "engine/persistence/SaveManager";
import { idbDelete } from "engine/persistence/idb";
import { setupScene } from "../game/setup";
import Crosshair from "./Crosshair";
import DebugMenu from "./DebugMenu";
import "./GameCanvas.scss";
import { GameProvider } from "./GameContext";
import InventoryHUD from "./InventoryHUD";
import SettingsMenu from "./SettingsMenu";
import UnderwaterOverlay from "./UnderwaterOverlay";

const AUTOSAVE_INTERVAL_MS = 30_000;

export default function GameCanvas() {
    const gameContainer = useRef<HTMLDivElement>(null);
    const [ready, setReady] = useState(false);
    const [saveBannerVisible, setSaveBannerVisible] = useState(false);
    const [settingsOpen, setSettingsOpen] = useState(false);
    const settingsOpenRef = useRef(false);

    const handleSettingsSave = () => {
        (async () => {
            await SaveManager.save();
            settingsOpenRef.current = false;
            setSettingsOpen(false);
            game.resume();
        })();
    };

    const handleNewWorld = () => {
        idbDelete("world").then(() => window.location.reload());
    };

    useEffect(() => {
        // ref is always set by mount time; null check required by TypeScript
        const mount = gameContainer.current;
        if (!mount) {
            return;
        }

        // Loading the save is async; the StrictMode-safe disposed flag prevents a cleaned-up
        // mount from initializing the game after the effect has already torn down. initialized
        // guards cleanup so we never call game.stop() before game.init() has actually run (which
        // would dereference an undefined ResizeObserver).
        let disposed = false;
        let initialized = false;
        let isSaving = false;
        let saveInterval: number | undefined;
        let bannerTimeout: number | undefined;

        async function saveState() {
            isSaving = true;
            try {
                await SaveManager.save();
            } finally {
                isSaving = false;
            }
        }

        const onKeyDown = (event: KeyboardEvent) => {
            if (event.code === "Escape") {
                if (settingsOpenRef.current) {
                    settingsOpenRef.current = false;
                    setSettingsOpen(false);
                    game.resume();
                } else {
                    settingsOpenRef.current = true;
                    setSettingsOpen(true);
                    game.pause();
                }
                return;
            }

            // Ctrl+S (or Cmd+S) forces an immediate save
            if (event.code !== "KeyS" || !(event.ctrlKey || event.metaKey)) {
                return;
            }

            event.preventDefault();
            if (isSaving) {
                return;
            }

            (async () => {
                await saveState();

                setSaveBannerVisible(true);
                window.clearTimeout(bannerTimeout);
                bannerTimeout = window.setTimeout(() => setSaveBannerVisible(false), 2000);
            })();
        };

        (async () => {
            const save = await SaveManager.load();
            if (disposed) {
                return;
            }

            game.init(mount);
            initialized = true;
            setupScene(save);

            if (save) {
                SaveManager.applyNonChunkSave(save);
            }
            // Decode item textures into voxel geometries before the loop starts, so component
            // start() methods can build item meshes synchronously.
            await VoxelItemMeshes.load();
            if (disposed) {
                return;
            }

            game.start();
            setReady(true);

            window.addEventListener("keydown", onKeyDown);
            saveInterval = window.setInterval(() => {
                if (isSaving) {
                    return;
                }

                saveState();
            }, AUTOSAVE_INTERVAL_MS);
        })();

        return () => {
            disposed = true;
            window.clearInterval(saveInterval);
            window.clearTimeout(bannerTimeout);
            window.removeEventListener("keydown", onKeyDown);
            if (initialized) {
                game.stop();
            }
        };
    }, []);

    return (
        <GameProvider value={ready ? game : null}>
            <div ref={gameContainer} style={{ width: "100vw", height: "100vh" }} />

            {ready && (
                <>
                    <DebugMenu />
                    <InventoryHUD />
                    <Crosshair />
                    <UnderwaterOverlay />
                    {settingsOpen && <SettingsMenu onSave={handleSettingsSave} onNewWorld={handleNewWorld} />}
                </>
            )}

            {saveBannerVisible && <div className="save-banner">Save Successful</div>}
        </GameProvider>
    );
}
