import "./SettingsMenu.scss";

export default function SettingsMenu({ onSave, onNewWorld }: { onSave: () => void; onNewWorld: () => void }) {
    return (
        <div className="settings-overlay">
            <div className="settings-panel">
                <h2 className="settings-title">Paused</h2>
                <button className="settings-button" onClick={onSave}>
                    Save
                </button>
                <button className="settings-button settings-button-danger" onClick={onNewWorld}>
                    New World
                </button>
            </div>
        </div>
    );
}
