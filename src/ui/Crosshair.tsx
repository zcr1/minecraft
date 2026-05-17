import crosshairUrl from "../assets/textures/crosshair.png";

export default function Crosshair() {
    return (
        <img
            src={crosshairUrl}
            alt=""
            style={{
                position: "absolute",
                top: "50%",
                left: "50%",
                transform: "translate(-50%, -50%)",
                width: 64,
                height: 64,
                opacity: 0.7,
                pointerEvents: "none",
                imageRendering: "pixelated",
            }}
        />
    );
}
