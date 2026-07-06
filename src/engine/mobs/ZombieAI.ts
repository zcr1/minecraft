import game from "../Game";
import Transform from "../components/Transform";
import Component from "../core/Component";
import GameObjectName from "../utils/gameObjectNames";
import ZombiePhysics from "./ZombiePhysics";

const ZOMBIE_AGGRO_RANGE = 10;
const ZOMBIE_MOVE_SPEED = 2;

export default class ZombieAI extends Component {
    private transform!: Transform;
    private physics!: ZombiePhysics;
    private playerTransform!: Transform;

    start() {
        this.transform = this.gameObject.getComponent(Transform);
        this.physics = this.gameObject.getComponent(ZombiePhysics);
        this.playerTransform = game.getGameObject(GameObjectName.Player).getComponent(Transform);
    }

    update() {
        const deltaX = this.playerTransform.x - this.transform.x;
        const deltaZ = this.playerTransform.z - this.transform.z;
        const distanceSquared = deltaX * deltaX + deltaZ * deltaZ;

        if (distanceSquared === 0 || distanceSquared > ZOMBIE_AGGRO_RANGE * ZOMBIE_AGGRO_RANGE) {
            this.physics.velocity.x = 0;
            this.physics.velocity.z = 0;
            return;
        }

        const distance = Math.sqrt(distanceSquared);
        this.physics.velocity.x = (deltaX / distance) * ZOMBIE_MOVE_SPEED;
        this.physics.velocity.z = (deltaZ / distance) * ZOMBIE_MOVE_SPEED;
    }
}
