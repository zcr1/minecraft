import * as THREE from "three";

// Floor for the bake's contribution. At skylight 0 the diffuse is multiplied by this instead of
// going pitch black, so caves stay legible without a torch system.
const MIN_LIGHT = 0.1;

// Patches a MeshStandardMaterial so the final lit color is multiplied by a per-vertex `aLight`
// attribute (0-15, encoded as `aLight / 15.0`).
//
// The multiply targets `outgoingLight` immediately before <opaque_fragment>, AFTER the entire
// lighting pipeline (direct + indirect + emissive) has run. This means the bake attenuates the
// directional sun's contribution too, which is what lets tunnel interiors look uniformly dark
// instead of showing the sun's normal-based shading on their walls. Outdoor surfaces with
// skylight 15 multiply by 1.0 and look unchanged.
//
// Patching earlier (e.g. <color_fragment>) only dimmed the diffuse term, leaving the unshadowed
// directional light to shine into caves and on tunnel walls.
export function applyVertexLighting(material: THREE.MeshStandardMaterial): void {
    material.onBeforeCompile = shader => {
        shader.vertexShader = shader.vertexShader
            .replace(
                "#include <common>",
                `#include <common>
                attribute float aLight;
                varying float vLight;`,
            )
            .replace(
                "#include <begin_vertex>",
                `#include <begin_vertex>
                vLight = aLight / 15.0;`,
            );

        shader.fragmentShader = shader.fragmentShader
            .replace(
                "#include <common>",
                `#include <common>
                varying float vLight;`,
            )
            .replace(
                "#include <opaque_fragment>",
                `outgoingLight *= mix(${MIN_LIGHT.toFixed(2)}, 1.0, vLight);
                #include <opaque_fragment>`,
            );
    };
    material.needsUpdate = true;
}
