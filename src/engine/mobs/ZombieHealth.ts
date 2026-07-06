import * as THREE from "three";
import game from "../Game";
import Component from "../core/Component";
import DayNightCycle from "../environment/DayNightCycle";
import GameObjectName from "../utils/gameObjectNames";

const ZOMBIE_MAX_HEALTH = 20;
const FIRE_DAMAGE_PER_SECOND = 4;
const BURN_TINT_COLOR = new THREE.Color(0xff3300);

export default class ZombieHealth extends Component {
    private health = ZOMBIE_MAX_HEALTH;
    private dayNightCycle!: DayNightCycle;
    private readonly material: THREE.MeshStandardMaterial;
    private readonly baseColor: THREE.Color;

    constructor(material: THREE.MeshStandardMaterial) {
        super();
        this.material = material;
        this.baseColor = material.color.clone();
    }

    get isDead(): boolean {
        return this.health <= 0;
    }

    start() {
        this.dayNightCycle = game.getGameObject(GameObjectName.Sky).getComponent(DayNightCycle);
    }

    update(deltaTime: number) {
        if (this.isDead || this.dayNightCycle.isNight) {
            return;
        }

        this.health = Math.max(0, this.health - FIRE_DAMAGE_PER_SECOND * deltaTime);
        const burnFraction = 1 - this.health / ZOMBIE_MAX_HEALTH;
        this.material.color.copy(this.baseColor).lerp(BURN_TINT_COLOR, burnFraction);
    }
}
