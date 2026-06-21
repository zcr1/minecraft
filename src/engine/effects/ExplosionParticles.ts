import * as THREE from "three";
import game from "engine/Game";
import Component from "engine/core/Component";
import eventManager, { type TntExplodedEvent } from "engine/core/EventManager";

// Sized for a single blast (flash + fire + smoke) with headroom for chained detonations.
const POOL_SIZE = 160;

const FLASH_PARTICLES = 2;
const FIRE_PARTICLES = 30;
const SMOKE_PARTICLES = 20;

// How far the expanding flash shell grows to (roughly the blast diameter).
const FLASH_MAX_SCALE = 8;

const FIRE_COLORS = [0xffcc33, 0xff6600, 0xcc3300];
const SMOKE_COLORS = [0x555555, 0x3a3a3a];

interface ExplosionParticle {
    age: number;
    baseScale: number;
    gravity: number;
    growthScale: number;
    index: number;
    lifetime: number;
    material: THREE.MeshBasicMaterial;
    maxOpacity: number;
    mesh: THREE.Mesh;
    velocity: THREE.Vector3;
}

interface SpawnConfig {
    additive: boolean;
    baseScale: number;
    colors: number[];
    gravity: number;
    growthScale: number;
    maxLifetime: number;
    maxOpacity: number;
    maxSpeed: number;
    minLifetime: number;
    minSpeed: number;
    upwardBias: number;
}

// Listens for tntExploded and fires a unit-cube particle burst at the blast center: a fast-growing
// additive flash shell, an omnidirectional fire burst, and slower-rising dark smoke. Built on the
// same free-list pool pattern as BlockBreakParticles so a burst never allocates mid-frame.
export default class ExplosionParticles extends Component {
    private readonly geometry = new THREE.BoxGeometry(1, 1, 1);
    private readonly particles: ExplosionParticle[] = [];
    private readonly freeIndices: number[] = [];
    private readonly activeIndices = new Set<number>();
    private readonly scratchOrigin = new THREE.Vector3();
    private readonly scratchDirection = new THREE.Vector3();
    private readonly explodedListener = (event: TntExplodedEvent) => this.handleExploded(event);

    start() {
        for (let i = 0; i < POOL_SIZE; i++) {
            const material = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true });
            const mesh = new THREE.Mesh(this.geometry, material);
            mesh.visible = false;
            game.threeScene.add(mesh);

            this.particles.push({
                mesh,
                material,
                velocity: new THREE.Vector3(),
                gravity: 0,
                age: 0,
                lifetime: 0,
                baseScale: 1,
                growthScale: 0,
                maxOpacity: 1,
                index: i,
            });

            this.freeIndices.push(i);
        }

        eventManager.subscribe("tntExploded", this.explodedListener);
    }

    update(deltaTime: number) {
        const expired: number[] = [];

        for (const index of this.activeIndices) {
            const particle = this.particles[index];
            particle.age += deltaTime;

            if (particle.age >= particle.lifetime) {
                expired.push(index);
                continue;
            }

            particle.velocity.y -= particle.gravity * deltaTime;
            particle.mesh.position.x += particle.velocity.x * deltaTime;
            particle.mesh.position.y += particle.velocity.y * deltaTime;
            particle.mesh.position.z += particle.velocity.z * deltaTime;

            const lifeFraction = particle.age / particle.lifetime;
            particle.mesh.scale.setScalar(particle.baseScale + particle.growthScale * lifeFraction);
            particle.material.opacity = particle.maxOpacity * (1 - lifeFraction);
        }

        for (const index of expired) {
            this.recycle(index);
        }
    }

    dispose() {
        eventManager.unsubscribe("tntExploded", this.explodedListener);

        for (const particle of this.particles) {
            game.threeScene.remove(particle.mesh);
            particle.material.dispose();
        }

        this.geometry.dispose();
        this.particles.length = 0;
        this.freeIndices.length = 0;
        this.activeIndices.clear();
    }

    private handleExploded(event: TntExplodedEvent): void {
        this.scratchOrigin.set(event.worldX, event.worldY, event.worldZ);

        for (let i = 0; i < FLASH_PARTICLES; i++) {
            this.spawn({
                minSpeed: 0,
                maxSpeed: 0,
                upwardBias: 0,
                gravity: 0,
                minLifetime: 0.18,
                maxLifetime: 0.28,
                baseScale: 0.5,
                growthScale: FLASH_MAX_SCALE,
                maxOpacity: 0.9,
                additive: true,
                colors: [0xffddaa],
            });
        }

        for (let i = 0; i < FIRE_PARTICLES; i++) {
            this.spawn({
                minSpeed: 5,
                maxSpeed: 9,
                upwardBias: 0.2,
                gravity: 14,
                minLifetime: 0.4,
                maxLifetime: 0.7,
                baseScale: 0.3,
                growthScale: 0,
                maxOpacity: 1,
                additive: true,
                colors: FIRE_COLORS,
            });
        }

        for (let i = 0; i < SMOKE_PARTICLES; i++) {
            this.spawn({
                minSpeed: 1,
                maxSpeed: 2.5,
                upwardBias: 1,
                // Negative gravity so smoke drifts upward instead of falling.
                gravity: -3,
                minLifetime: 0.8,
                maxLifetime: 1.4,
                baseScale: 0.5,
                growthScale: 0.4,
                maxOpacity: 0.7,
                additive: false,
                colors: SMOKE_COLORS,
            });
        }
    }

    private spawn(config: SpawnConfig): void {
        const index = this.freeIndices.pop();
        if (index === undefined) {
            return;
        }

        const particle = this.particles[index];
        this.activeIndices.add(index);

        this.scratchDirection.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize();
        this.scratchDirection.y += config.upwardBias;
        this.scratchDirection.normalize();

        const speed = config.minSpeed + Math.random() * (config.maxSpeed - config.minSpeed);
        particle.velocity.copy(this.scratchDirection).multiplyScalar(speed);
        particle.gravity = config.gravity;
        particle.lifetime = config.minLifetime + Math.random() * (config.maxLifetime - config.minLifetime);
        particle.age = 0;
        particle.baseScale = config.baseScale;
        particle.growthScale = config.growthScale;
        particle.maxOpacity = config.maxOpacity;

        const color = config.colors[Math.floor(Math.random() * config.colors.length)];
        particle.material.color.setHex(color);
        particle.material.opacity = config.maxOpacity;
        particle.material.blending = config.additive ? THREE.AdditiveBlending : THREE.NormalBlending;
        particle.material.depthWrite = !config.additive;
        particle.material.needsUpdate = true;

        particle.mesh.position.copy(this.scratchOrigin);
        particle.mesh.scale.setScalar(config.baseScale);
        particle.mesh.visible = true;
    }

    private recycle(index: number): void {
        const particle = this.particles[index];
        particle.mesh.visible = false;
        this.activeIndices.delete(index);
        this.freeIndices.push(index);
    }
}
