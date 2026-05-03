import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import * as THREE from "three";

import Component from "../core/Component";

const EMPTY_RATE = 0.15;

export default class ChunkComponent extends Component {
    readonly mesh: THREE.Mesh;

    constructor(
        width: number,
        height: number,
        depth: number,
        material: THREE.Material,
    ) {
        super();

        const template = new THREE.BoxGeometry(1, 1, 1);
        const geometries: THREE.BufferGeometry[] = [];

        for (let x = 0; x < width; x++) {
            for (let y = 0; y < height; y++) {
                for (let z = 0; z < depth; z++) {
                    if (Math.random() < EMPTY_RATE) continue;

                    const geo = template.clone();
                    geo.applyMatrix4(
                        new THREE.Matrix4().makeTranslation(x, y, z),
                    );
                    geometries.push(geo);
                }
            }
        }

        template.dispose();

        const merged =
            geometries.length > 0
                ? (mergeGeometries(geometries) ?? new THREE.BufferGeometry())
                : new THREE.BufferGeometry();

        geometries.forEach((g) => g.dispose());

        this.mesh = new THREE.Mesh(merged, material);
    }

    update() {}
}
