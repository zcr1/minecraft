import * as THREE from "three";
import Transform from "../components/Transform";
import GameObject from "../core/GameObject";
import ZombieAI from "./ZombieAI";
import ZombieHealth from "./ZombieHealth";
import ZombiePhysics from "./ZombiePhysics";

const ZOMBIE_CAPSULE_RADIUS = 0.4;
const ZOMBIE_CAPSULE_LENGTH = 1.0;
const ZOMBIE_COLOR = 0x2e5c2e;

export interface ZombieHandle {
    gameObject: GameObject;
    mesh: THREE.Mesh;
    health: ZombieHealth;
}

export function createZombie(worldX: number, worldY: number, worldZ: number): ZombieHandle {
    const geometry = new THREE.CapsuleGeometry(ZOMBIE_CAPSULE_RADIUS, ZOMBIE_CAPSULE_LENGTH, 4, 8);
    const material = new THREE.MeshStandardMaterial({ color: ZOMBIE_COLOR });
    const mesh = new THREE.Mesh(geometry, material);

    const gameObject = new GameObject("Zombie");
    gameObject.addComponent(new Transform(mesh, worldX, worldY, worldZ));
    gameObject.addComponent(new ZombiePhysics());
    gameObject.addComponent(new ZombieAI());
    const health = new ZombieHealth(material);
    gameObject.addComponent(health);

    return { gameObject, mesh, health };
}
