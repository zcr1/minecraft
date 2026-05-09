import Singleton from "../core/Singleton";
import type { KeyCode } from "engine/utils/keyCode";

export default class InputManager extends Singleton {
    static override get instance(): InputManager {
        return super.instance as InputManager;
    }

    static init(canvas: HTMLCanvasElement): InputManager {
        return this._init(() => new InputManager(canvas));
    }

    private readonly canvas: HTMLCanvasElement;

    private readonly heldKeys = new Set<KeyCode>();
    private readonly pressedKeys = new Set<KeyCode>();
    private readonly releasedKeys = new Set<KeyCode>();

    private readonly heldButtons = new Set<number>();
    private readonly pressedButtons = new Set<number>();
    private readonly releasedButtons = new Set<number>();

    private _mouseX = 0;
    private _mouseY = 0;
    private _deltaX = 0;
    private _deltaY = 0;
    private _scrollDX = 0;
    private _scrollDY = 0;

    private constructor(canvas: HTMLCanvasElement) {
        super();
        this.canvas = canvas;
        window.addEventListener("keydown", this.onKeyDown);
        window.addEventListener("keyup", this.onKeyUp);
        window.addEventListener("blur", this.onBlur);
        canvas.addEventListener("mousemove", this.onMouseMove);
        canvas.addEventListener("mousedown", this.onMouseDown);
        canvas.addEventListener("mouseup", this.onMouseUp);
        window.addEventListener("mouseup", this.onWindowMouseUp);
        canvas.addEventListener("wheel", this.onWheel, { passive: false });
        canvas.addEventListener("contextmenu", this.onContextMenu);
    }

    // ── Keyboard ──────────────────────────────────────────────────────────

    isHeld(code: KeyCode): boolean {
        return this.heldKeys.has(code);
    }
    wasPressed(code: KeyCode): boolean {
        return this.pressedKeys.has(code);
    }
    wasReleased(code: KeyCode): boolean {
        return this.releasedKeys.has(code);
    }

    // ── Mouse buttons ─────────────────────────────────────────────────────

    isMouseHeld(button: number): boolean {
        return this.heldButtons.has(button);
    }
    wasMousePressed(button: number): boolean {
        return this.pressedButtons.has(button);
    }
    wasMouseReleased(button: number): boolean {
        return this.releasedButtons.has(button);
    }

    // ── Mouse position ────────────────────────────────────────────────────

    get mouseX(): number {
        return this._mouseX;
    }
    get mouseY(): number {
        return this._mouseY;
    }

    // Converts the raw pixel mouse position (in canvas-space) into the
    // coordinate system Three.js uses for raycasting and projection
    // math — where (-1, -1) is the bottom-left of the canvas and (+1, +1)
    // is the top-right.
    get mouseNDC(): { x: number; y: number } {
        return {
            x: (this._mouseX / this.canvas.clientWidth) * 2 - 1,
            y: -(this._mouseY / this.canvas.clientHeight) * 2 + 1,
        };
    }

    get mouseDeltaX(): number {
        return this._deltaX;
    }
    get mouseDeltaY(): number {
        return this._deltaY;
    }
    get scrollDeltaX(): number {
        return this._scrollDX;
    }
    get scrollDeltaY(): number {
        return this._scrollDY;
    }

    // ── Frame lifecycle ───────────────────────────────────────────────────

    flush() {
        this.pressedKeys.clear();
        this.releasedKeys.clear();
        this.pressedButtons.clear();
        this.releasedButtons.clear();
        this._deltaX = 0;
        this._deltaY = 0;
        this._scrollDX = 0;
        this._scrollDY = 0;
    }

    dispose() {
        window.removeEventListener("keydown", this.onKeyDown);
        window.removeEventListener("keyup", this.onKeyUp);
        window.removeEventListener("blur", this.onBlur);
        this.canvas.removeEventListener("mousemove", this.onMouseMove);
        this.canvas.removeEventListener("mousedown", this.onMouseDown);
        this.canvas.removeEventListener("mouseup", this.onMouseUp);
        window.removeEventListener("mouseup", this.onWindowMouseUp);
        this.canvas.removeEventListener("wheel", this.onWheel);
        this.canvas.removeEventListener("contextmenu", this.onContextMenu);
        this._destroy();
    }

    // ── Event handlers (arrow fields preserve `this`) ─────────────────────

    private onKeyDown = (e: KeyboardEvent) => {
        if (!this.heldKeys.has(e.code as any)) {
            this.pressedKeys.add(e.code as any);
        }
        this.heldKeys.add(e.code as any);
    };

    private onKeyUp = (e: KeyboardEvent) => {
        this.heldKeys.delete(e.code as any);
        this.releasedKeys.add(e.code as any);
    };

    private onBlur = () => {
        this.heldKeys.clear();
        this.pressedKeys.clear();
        this.heldButtons.clear();
        this.pressedButtons.clear();
    };

    // TODO: normalize deltaMode
    private onMouseMove = (e: MouseEvent) => {
        this._mouseX = e.offsetX;
        this._mouseY = e.offsetY;
        this._deltaX += e.movementX;
        this._deltaY += e.movementY;
    };

    private onMouseDown = (e: MouseEvent) => {
        this.heldButtons.add(e.button);
        this.pressedButtons.add(e.button);
    };

    private onMouseUp = (e: MouseEvent) => {
        this.heldButtons.delete(e.button);
        this.releasedButtons.add(e.button);
    };

    private onWindowMouseUp = (e: MouseEvent) => {
        if (this.heldButtons.has(e.button)) {
            this.heldButtons.delete(e.button);
            this.releasedButtons.add(e.button);
        }
    };

    private onWheel = (e: WheelEvent) => {
        e.preventDefault();
        this._scrollDX += e.deltaX;
        this._scrollDY += e.deltaY;
    };

    private onContextMenu = (e: Event) => {
        e.preventDefault();
    };
}
