import coalUrl from "assets/textures/items/coal.png";
import stickUrl from "assets/textures/items/stick.png";
import stonePickaxeUrl from "assets/textures/items/stone_pickaxe.png";
import stoneSwordUrl from "assets/textures/items/stone_sword.png";
import torchUrl from "assets/textures/items/torch.png";
import woodenPickaxeUrl from "assets/textures/items/wooden_pickaxe.png";
import woodenSwordUrl from "assets/textures/items/wooden_sword.png";
import * as THREE from "three";
import { MAX_LIGHT } from "engine/chunk/LightingSystem";
import { ItemType } from "engine/items/ItemType";
import { applyVertexLighting } from "engine/renderer/applyVertexLighting";

// Each opaque pixel in an item texture becomes a 1-voxel-deep cube. The whole mesh is
// centered on the origin and scaled so it spans TARGET_WORLD_SIZE across its longest edge,
// regardless of the source texture's pixel resolution. Consumers (held/dropped items) may
// apply their own mesh.scale on top of this to fine-tune on-screen size.
const TARGET_WORLD_SIZE = 0.42;

// Pixels with alpha at or below this (0-255) are treated as empty and produce no voxel.
const ALPHA_THRESHOLD = 127;

// Item textures that get voxelized into 3D meshes (the non-block "item" kind).
const ITEM_TEXTURE_URLS: Record<ItemType, string> = {
    [ItemType.Coal]: coalUrl,
    [ItemType.Stick]: stickUrl,
    [ItemType.Torch]: torchUrl,
    [ItemType.WoodenPickaxe]: woodenPickaxeUrl,
    [ItemType.StonePickaxe]: stonePickaxeUrl,
    [ItemType.WoodenSword]: woodenSwordUrl,
    [ItemType.StoneSword]: stoneSwordUrl,
};

// Cube faces expressed as 4 vertices (x,y,z relative to a unit-cube center), an outward
// normal, and the neighbor offset to test for face culling. Mirrors ChunkComponent.FACES.
const FACES = [
    // +X (right)
    {
        vertices: [0.5, -0.5, 0.5, 0.5, -0.5, -0.5, 0.5, 0.5, -0.5, 0.5, 0.5, 0.5],
        normal: [1, 0, 0],
        neighbor: [1, 0, 0],
    },
    // -X (left)
    {
        vertices: [-0.5, -0.5, -0.5, -0.5, -0.5, 0.5, -0.5, 0.5, 0.5, -0.5, 0.5, -0.5],
        normal: [-1, 0, 0],
        neighbor: [-1, 0, 0],
    },
    // +Y (top)
    {
        vertices: [-0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, -0.5, -0.5, 0.5, -0.5],
        normal: [0, 1, 0],
        neighbor: [0, 1, 0],
    },
    // -Y (bottom)
    {
        vertices: [-0.5, -0.5, -0.5, 0.5, -0.5, -0.5, 0.5, -0.5, 0.5, -0.5, -0.5, 0.5],
        normal: [0, -1, 0],
        neighbor: [0, -1, 0],
    },
    // +Z (front)
    {
        vertices: [-0.5, -0.5, 0.5, 0.5, -0.5, 0.5, 0.5, 0.5, 0.5, -0.5, 0.5, 0.5],
        normal: [0, 0, 1],
        neighbor: [0, 0, 1],
    },
    // -Z (back)
    {
        vertices: [0.5, -0.5, -0.5, -0.5, -0.5, -0.5, -0.5, 0.5, -0.5, 0.5, 0.5, -0.5],
        normal: [0, 0, -1],
        neighbor: [0, 0, -1],
    },
] as const;

interface MeshBuffers {
    positions: number[];
    normals: number[];
    colors: number[];
    lights: number[];
    indices: number[];
}

// Builds a voxelized BufferGeometry from decoded RGBA pixels. Each opaque pixel is one
// cube in a single (depth-1) layer; interior faces between adjacent opaque pixels are
// culled, front/back faces are always emitted. Per-vertex color carries the pixel's RGB.
class VoxelItemMeshes {
    private readonly geometries = new Map<ItemType, THREE.BufferGeometry>();
    private material: THREE.MeshStandardMaterial | null = null;

    // Decodes every item texture and builds its voxel geometry. Reading pixels from a PNG
    // requires the image to decode first (an inherently async browser step), so this must be
    // awaited during boot — before game.start() runs any component's start(). Once it resolves,
    // getGeometry() is guaranteed to return a geometry for every item.
    async load(): Promise<void> {
        this.getMaterial();
        await Promise.all(
            Object.entries(ITEM_TEXTURE_URLS).map(([itemType, url]) => this.decodeAndBuild(itemType as ItemType, url)),
        );
    }

    // Returns the cached voxel geometry for an item. load() must have resolved first.
    getGeometry(itemType: ItemType): THREE.BufferGeometry {
        const geometry = this.geometries.get(itemType);
        if (!geometry) {
            throw new Error(`VoxelItemMeshes: no geometry for ItemType ${itemType} (was load() awaited?)`);
        }
        return geometry;
    }

    // Single shared vertex-colored material for all voxel item meshes. Solid (no map, no
    // transparency); applyVertexLighting supplies the aLight-driven shading used elsewhere.
    getMaterial(): THREE.MeshStandardMaterial {
        if (!this.material) {
            const material = new THREE.MeshStandardMaterial({ vertexColors: true });
            applyVertexLighting(material);
            this.material = material;
        }
        return this.material;
    }

    private async decodeAndBuild(itemType: ItemType, url: string): Promise<void> {
        const imageData = await loadImageData(url);
        this.geometries.set(itemType, this.buildGeometry(imageData));
    }

    private buildGeometry(imageData: ImageData): THREE.BufferGeometry {
        const width = imageData.width;
        const height = imageData.height;
        const pixels = imageData.data;

        const isOpaque = (px: number, py: number): boolean => {
            if (px < 0 || px >= width || py < 0 || py >= height) {
                return false;
            }
            return pixels[(py * width + px) * 4 + 3] > ALPHA_THRESHOLD;
        };

        const buffers: MeshBuffers = { positions: [], normals: [], colors: [], lights: [], indices: [] };
        const voxelSize = TARGET_WORLD_SIZE / Math.max(width, height);
        const color = new THREE.Color();

        for (let py = 0; py < height; py++) {
            for (let px = 0; px < width; px++) {
                if (!isOpaque(px, py)) {
                    continue;
                }

                // Flip vertically so the texture's top row sits at the top of the mesh, and
                // center the grid on the origin. Grid coords are in voxel units.
                const gridX = px;
                const gridY = height - 1 - py;
                const centeredX = gridX - (width - 1) / 2;
                const centeredY = gridY - (height - 1) / 2;

                const base = (py * width + px) * 4;
                // Source pixels are sRGB; setRGB with SRGBColorSpace converts to the linear
                // values three.js expects for vertex colors so on-screen color matches the PNG.
                color.setRGB(pixels[base] / 255, pixels[base + 1] / 255, pixels[base + 2] / 255, THREE.SRGBColorSpace);

                for (const face of FACES) {
                    const neighborX = px + face.neighbor[0];
                    // Neighbor Y is in texture space (py grows downward), so a +Y face in mesh
                    // space (neighbor[1] = 1) checks the pixel above it: py - 1.
                    const neighborY = py - face.neighbor[1];
                    // Front/back faces (neighbor Z != 0) are always exposed on a single layer.
                    const exposed = face.neighbor[2] !== 0 || !isOpaque(neighborX, neighborY);
                    if (!exposed) {
                        continue;
                    }
                    this.pushFace(face, centeredX, centeredY, voxelSize, color, buffers);
                }
            }
        }

        return this.assembleGeometry(buffers);
    }

    private pushFace(
        face: (typeof FACES)[number],
        centeredX: number,
        centeredY: number,
        voxelSize: number,
        color: THREE.Color,
        buffers: MeshBuffers,
    ): void {
        const vertexBase = buffers.positions.length / 3;
        for (let v = 0; v < 4; v++) {
            buffers.positions.push(
                (face.vertices[v * 3] + centeredX) * voxelSize,
                (face.vertices[v * 3 + 1] + centeredY) * voxelSize,
                face.vertices[v * 3 + 2] * voxelSize,
            );
            buffers.normals.push(face.normal[0], face.normal[1], face.normal[2]);
            buffers.colors.push(color.r, color.g, color.b);
            buffers.lights.push(MAX_LIGHT);
        }
        buffers.indices.push(vertexBase, vertexBase + 1, vertexBase + 2, vertexBase, vertexBase + 2, vertexBase + 3);
    }

    private assembleGeometry(buffers: MeshBuffers): THREE.BufferGeometry {
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute("position", new THREE.Float32BufferAttribute(buffers.positions, 3));
        geometry.setAttribute("normal", new THREE.Float32BufferAttribute(buffers.normals, 3));
        geometry.setAttribute("color", new THREE.Float32BufferAttribute(buffers.colors, 3));
        geometry.setAttribute("aLight", new THREE.Float32BufferAttribute(buffers.lights, 1));
        geometry.setIndex(buffers.indices);
        return geometry;
    }
}

// Draws an image URL to an offscreen canvas and reads back its RGBA pixels.
function loadImageData(url: string): Promise<ImageData> {
    return new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => {
            const canvas = document.createElement("canvas");
            canvas.width = image.width;
            canvas.height = image.height;
            const context = canvas.getContext("2d");
            if (!context) {
                reject(new Error("VoxelItemMeshes: 2D canvas context unavailable"));
                return;
            }
            context.drawImage(image, 0, 0);
            resolve(context.getImageData(0, 0, image.width, image.height));
        };
        image.onerror = () => reject(new Error(`VoxelItemMeshes: failed to load image ${url}`));
        image.src = url;
    });
}

export default new VoxelItemMeshes();
