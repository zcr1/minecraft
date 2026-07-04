import * as THREE from "three";
import { ItemType } from "../items/ItemType";
import voxelItemMeshes from "../items/VoxelItemMeshes";

// The direction of the solid block a torch is attached to, one per blockMeta value.
// Index 0 = floor (solid below); indices 1-4 = the four walls. Exported so ChunkManager can walk
// adjacent positions when a support block is destroyed.
export const TORCH_ATTACHMENT_OFFSETS: ReadonlyArray<readonly [number, number, number]> = [
    [0, -1, 0], // floor — solid below
    [-1, 0, 0], // wall −X — solid to the left
    [1, 0, 0], // wall +X — solid to the right
    [0, 0, -1], // wall −Z — solid behind
    [0, 0, 1], // wall +Z — solid in front
];

// Wall torches lean their top away from the wall by this much so the head clears the surface.
const TORCH_WALL_TILT_RADIANS = THREE.MathUtils.degToRad(22.5);
// How far the torch centre sits from the block centre toward the wall (negative = toward the wall
// face at -0.5) and how far it drops below centre, so the base mounts low on the wall.
const TORCH_WALL_OUT_SHIFT = -0.3;
const TORCH_WALL_UP_SHIFT = 0.1;

// Orientation matrix per blockMeta (0 = floor, 1-4 = walls), built lazily on first use because it
// depends on the torch voxel geometry's bounding box, which only exists after VoxelItemMeshes.load()
// has resolved during boot.
const torchOrientationMatrices: (THREE.Matrix4 | null)[] = [null, null, null, null, null];

function buildTorchOrientationMatrix(meta: number): THREE.Matrix4 {
    const geometry = voxelItemMeshes.getGeometry(ItemType.Torch);
    geometry.computeBoundingBox();
    const baseY = geometry.boundingBox!.min.y;

    const matrix = new THREE.Matrix4();
    if (meta === 0) {
        // Floor: stand upright, base flush with the block floor (y = -0.5).
        matrix.makeTranslation(0, -0.5 - baseY, 0);
        return matrix;
    }

    const [offsetX, offsetY, offsetZ] = TORCH_ATTACHMENT_OFFSETS[meta] ?? TORCH_ATTACHMENT_OFFSETS[0];
    // Outward horizontal direction (away from the wall the torch is mounted on).
    const out = new THREE.Vector3(-offsetX, -offsetY, -offsetZ).normalize();
    const up = new THREE.Vector3(0, 1, 0);

    // Yaw so the slab's front (+Z) faces the room, then tilt the top outward about the wall tangent.
    const yaw = new THREE.Quaternion().setFromAxisAngle(up, Math.atan2(out.x, out.z));
    const tiltAxis = new THREE.Vector3().crossVectors(up, out).normalize();
    const tilt = new THREE.Quaternion().setFromAxisAngle(tiltAxis, TORCH_WALL_TILT_RADIANS);
    const rotation = tilt.multiply(yaw);

    const position = new THREE.Vector3()
        .copy(out)
        .multiplyScalar(TORCH_WALL_OUT_SHIFT)
        .addScaledVector(up, TORCH_WALL_UP_SHIFT);
    matrix.compose(position, rotation, new THREE.Vector3(1, 1, 1));
    return matrix;
}

export function getTorchOrientationMatrix(meta: number): THREE.Matrix4 {
    const index = meta >= 0 && meta < torchOrientationMatrices.length ? meta : 0;
    let matrix = torchOrientationMatrices[index];
    if (!matrix) {
        matrix = buildTorchOrientationMatrix(index);
        torchOrientationMatrices[index] = matrix;
    }
    return matrix;
}

// Maps a placement hit-normal to the torch attachment index (blockMeta value) for that direction.
// The hit normal is the outward face of the clicked block; the torch attaches on the opposite
// side, so its support offset equals −hitNormal. Returns −1 for the bottom face (ceiling),
// which has no attachment entry and should be rejected at the call site.
export function torchQuadIndexFromHitNormal(normalX: number, normalY: number, normalZ: number): number {
    if (normalY === 1) {
        return 0; // top face hit → torch sits on floor (solid below)
    }
    if (normalX === 1) {
        return 1; // +X face hit → torch on −X wall (solid to its left)
    }
    if (normalX === -1) {
        return 2; // −X face hit → torch on +X wall (solid to its right)
    }
    if (normalZ === 1) {
        return 3; // +Z face hit → torch on −Z wall (solid behind)
    }
    if (normalZ === -1) {
        return 4; // −Z face hit → torch on +Z wall (solid in front)
    }
    return -1; // bottom face hit (ceiling) — no torch geometry for this case
}
