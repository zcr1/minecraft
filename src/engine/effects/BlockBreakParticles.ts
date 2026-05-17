import * as THREE from "three";
import game from "engine/Game";
import { BlockType } from "engine/chunk/ChunkComponent";
import Component from "engine/core/Component";
import PlayerBlockInteraction, {
    type BlockBreakEvent,
    type StageAdvancedEvent,
} from "engine/player/PlayerBlockInteraction";
import GameObjectName from "engine/utils/gameObjectNames";

const POOL_SIZE = 96;
const PARTICLE_SIZE = 0.12;
const GRAVITY = 18;
const STAGE_PARTICLES_PER_HIT = 6;
const BREAK_PARTICLES = 16;

const BLOCK_COLORS: Record<BlockType, number> = {
    [BlockType.Air]: 0xffffff,
    [BlockType.Dirt]: 0x8a5a3b,
    [BlockType.Grass]: 0x6cb04c,
    [BlockType.Bedrock]: 0x3a3a3a,
};

interface Particle {
    mesh: THREE.Mesh;
    material: THREE.MeshBasicMaterial;
    velocity: THREE.Vector3;
    age: number;
    lifetime: number;
    index: number;
}

export default class BlockBreakParticles extends Component {
    private readonly geometry = new THREE.BoxGeometry(PARTICLE_SIZE, PARTICLE_SIZE, PARTICLE_SIZE);
    private readonly particles: Particle[] = [];
    private readonly freeIndices: number[] = [];
    private readonly activeIndices = new Set<number>();
    private readonly scratchTangentA = new THREE.Vector3();
    private readonly scratchTangentB = new THREE.Vector3();
    private readonly scratchCenter = new THREE.Vector3();
    private readonly scratchOmni = new THREE.Vector3(0, 1, 0);
    private interaction: PlayerBlockInteraction | null = null;

    start() {
        // Preallocate the full pool up front so a burst spawn doesn't allocate/GC mid-frame.
        // Each particle owns its own material so opacity can fade independently.
        for (let i = 0; i < POOL_SIZE; i++) {
            const material = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true });
            const mesh = new THREE.Mesh(this.geometry, material);
            mesh.visible = false;
            game.threeScene.add(mesh);
            this.particles.push({
                mesh,
                material,
                velocity: new THREE.Vector3(),
                age: 0,
                lifetime: 0,
                index: i,
            });
            this.freeIndices.push(i);
        }

        this.interaction = game.getGameObject(GameObjectName.Player).getComponent(PlayerBlockInteraction);
        this.interaction.onStageAdvanced = event => this.handleStageAdvanced(event);
        this.interaction.onBlockBroken = event => this.handleBlockBroken(event);
    }

    update(deltaTime: number) {
        // Iterate a snapshot since recycle() mutates activeIndices.
        const expired: number[] = [];
        for (const index of this.activeIndices) {
            const particle = this.particles[index];
            particle.age += deltaTime;
            if (particle.age >= particle.lifetime) {
                expired.push(index);
                continue;
            }
            particle.velocity.y -= GRAVITY * deltaTime;
            particle.mesh.position.x += particle.velocity.x * deltaTime;
            particle.mesh.position.y += particle.velocity.y * deltaTime;
            particle.mesh.position.z += particle.velocity.z * deltaTime;
            particle.material.opacity = 1 - particle.age / particle.lifetime;
        }
        for (const index of expired) {
            this.recycle(index);
        }
    }

    dispose() {
        if (this.interaction) {
            this.interaction.onStageAdvanced = null;
            this.interaction.onBlockBroken = null;
            this.interaction = null;
        }
        for (const particle of this.particles) {
            game.threeScene.remove(particle.mesh);
            particle.material.dispose();
        }
        this.geometry.dispose();
        this.particles.length = 0;
        this.freeIndices.length = 0;
        this.activeIndices.clear();
    }

    private handleStageAdvanced(event: StageAdvancedEvent): void {
        const color = BLOCK_COLORS[event.blockType] ?? 0xffffff;
        for (let i = 0; i < STAGE_PARTICLES_PER_HIT; i++) {
            this.spawn(event.hitPoint, event.hitNormal, color, 2, 4, 0.4, 0.7);
        }
    }

    private handleBlockBroken(event: BlockBreakEvent): void {
        const color = BLOCK_COLORS[event.blockType] ?? 0xffffff;
        this.scratchCenter.set(
            event.chunk.mesh.position.x + event.blockX,
            event.chunk.mesh.position.y + event.blockY,
            event.chunk.mesh.position.z + event.blockZ,
        );
        // No specific face to favor on full destruction, so seed with +Y and let the wide spread
        // factor in `spawn` scatter particles roughly omnidirectionally.
        for (let i = 0; i < BREAK_PARTICLES; i++) {
            this.spawn(this.scratchCenter, this.scratchOmni, color, 3, 6, 0.6, 0.9);
        }
    }

    private spawn(
        origin: THREE.Vector3,
        normal: THREE.Vector3,
        color: number,
        minSpeed: number,
        maxSpeed: number,
        minLifetime: number,
        maxLifetime: number,
    ): void {
        const index = this.freeIndices.pop();
        if (index === undefined) {
            return;
        }
        const particle = this.particles[index];
        this.activeIndices.add(index);

        // Bias velocity outward along the surface normal, plus a randomized spread on the
        // tangent plane so the puff fans rather than streams in a single line.
        buildTangentBasis(normal, this.scratchTangentA, this.scratchTangentB);

        const speed = minSpeed + Math.random() * (maxSpeed - minSpeed);
        const spreadA = (Math.random() - 0.5) * 1.5;
        const spreadB = (Math.random() - 0.5) * 1.5;
        const outward = 0.6 + Math.random() * 0.6;

        particle.velocity
            .copy(normal)
            .multiplyScalar(outward)
            .addScaledVector(this.scratchTangentA, spreadA)
            .addScaledVector(this.scratchTangentB, spreadB)
            .normalize()
            .multiplyScalar(speed);

        particle.mesh.position.copy(origin);
        particle.material.color.setHex(color);
        particle.material.opacity = 1;
        particle.lifetime = minLifetime + Math.random() * (maxLifetime - minLifetime);
        particle.age = 0;
        particle.mesh.visible = true;
    }

    private recycle(index: number): void {
        const particle = this.particles[index];
        particle.mesh.visible = false;
        this.activeIndices.delete(index);
        this.freeIndices.push(index);
    }
}

// Produces two orthonormal vectors perpendicular to `normal`, forming a basis for the surface's
// tangent plane. Used to scatter particles across the face rather than straight along the normal.
// The reference vector swaps from +Y to +X when the normal is near-vertical, since crossing two
// near-parallel vectors yields a near-zero result that `.normalize()` cannot rescue.
function buildTangentBasis(normal: THREE.Vector3, outA: THREE.Vector3, outB: THREE.Vector3): void {
    const reference = Math.abs(normal.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
    outA.copy(reference).cross(normal).normalize();
    outB.copy(normal).cross(outA).normalize();
}
