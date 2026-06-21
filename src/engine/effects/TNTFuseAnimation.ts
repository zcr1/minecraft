import * as THREE from "three";
import game from "engine/Game";
import Component from "engine/core/Component";
import TNTManager from "engine/effects/TNTManager";
import GameObjectName from "engine/utils/gameObjectNames";

// Slightly larger than a block so the white flash reads as a shell over the textured TNT.
const OVERLAY_SIZE = 1.02;
// Most primed TNT we render the flash for at once; extras (huge chains) simply go un-flashed.
const POOL_SIZE = 16;
// Seconds the "pop-in" scale plays for right after placement.
const POP_IN_DURATION = 0.15;
const POP_IN_START_SCALE = 0.6;
// Peak white opacity at the top of each blink — kept low so the TNT texture stays visible.
const MAX_BLINK_OPACITY = 0.55;
// Blink angular speed (rad/s) at the start of the fuse vs. the moment before detonation.
const MIN_BLINK_RATE = 7;
const MAX_BLINK_RATE = 32;

// easeOutBack: rises to slightly past 1 then settles back, giving the pop a springy overshoot.
function easeOutBack(t: number): number {
    const overshoot = 1.70158;
    const shifted = t - 1;
    return 1 + (overshoot + 1) * shifted * shifted * shifted + overshoot * shifted * shifted;
}

// Drives the placement pop-in and accelerating white blink for every primed TNT, reading live fuse
// state straight off TNTManager each frame (mirrors how BlockDamageOverlay follows the targeted block).
export default class TNTFuseAnimation extends Component {
    private readonly geometry = new THREE.BoxGeometry(OVERLAY_SIZE, OVERLAY_SIZE, OVERLAY_SIZE);
    private readonly meshes: THREE.Mesh[] = [];
    private readonly materials: THREE.MeshBasicMaterial[] = [];
    private tntManager!: TNTManager;

    start() {
        for (let i = 0; i < POOL_SIZE; i++) {
            const material = new THREE.MeshBasicMaterial({
                color: 0xffffff,
                transparent: true,
                opacity: 0,
                depthWrite: false,
            });

            const mesh = new THREE.Mesh(this.geometry, material);
            mesh.visible = false;
            game.threeScene.add(mesh);
            this.meshes.push(mesh);
            this.materials.push(material);
        }

        this.tntManager = game.getGameObject(GameObjectName.TNTManager).getComponent(TNTManager);
    }

    update() {
        const fuses = this.tntManager.activeFuses;
        const rendered = Math.min(fuses.length, POOL_SIZE);

        for (let i = 0; i < rendered; i++) {
            const fuse = fuses[i];
            const mesh = this.meshes[i];
            const material = this.materials[i];
            const elapsed = fuse.totalFuse - fuse.fuseRemaining;

            // Pop-in: spring from a small shell up to full size over the first fraction of a second.
            let scale = 1;
            if (elapsed < POP_IN_DURATION) {
                const progress = elapsed / POP_IN_DURATION;
                scale = POP_IN_START_SCALE + (1 - POP_IN_START_SCALE) * easeOutBack(progress);
            }
            mesh.scale.setScalar(scale);

            // Blink: a white pulse whose speed ramps up as the fuse burns down toward zero.
            const fuseProgress = 1 - fuse.fuseRemaining / fuse.totalFuse;
            const blinkRate = MIN_BLINK_RATE + (MAX_BLINK_RATE - MIN_BLINK_RATE) * fuseProgress;
            const blink = 0.5 + 0.5 * Math.sin(elapsed * blinkRate);
            material.opacity = MAX_BLINK_OPACITY * blink;

            mesh.position.set(fuse.worldX, fuse.worldY, fuse.worldZ);
            mesh.visible = true;
        }

        for (let i = rendered; i < POOL_SIZE; i++) {
            this.meshes[i].visible = false;
        }
    }

    dispose() {
        for (let i = 0; i < this.meshes.length; i++) {
            game.threeScene.remove(this.meshes[i]);
            this.materials[i].dispose();
        }

        this.geometry.dispose();
        this.meshes.length = 0;
        this.materials.length = 0;
    }
}
