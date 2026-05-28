import * as THREE from "three";
import game from "engine/Game";
import ChunkComponent from "engine/chunk/ChunkComponent";
import ChunkManager from "engine/chunk/ChunkManager";
import Component from "engine/core/Component";
import GameObjectName from "engine/utils/gameObjectNames";

export default class ChunkBoundaryOverlay extends Component {
    showBoundaries = false;
    private chunkManager!: ChunkManager;
    private sharedGeometry: THREE.EdgesGeometry | null = null;
    private readonly material = new THREE.LineBasicMaterial({ color: 0xff0000 });
    private readonly boundaryLines = new Map<ChunkComponent, THREE.LineSegments>();

    start() {
        this.chunkManager = game.getGameObject(GameObjectName.ChunkManager).getComponent(ChunkManager);
    }

    update() {
        if (!this.showBoundaries) {
            for (const lines of this.boundaryLines.values()) {
                lines.visible = false;
            }
            return;
        }

        for (const chunk of this.chunkManager.getLoadedChunks()) {
            if (!this.sharedGeometry) {
                const box = new THREE.BoxGeometry(chunk.width, chunk.height, chunk.depth);
                this.sharedGeometry = new THREE.EdgesGeometry(box);
                box.dispose();
            }

            if (!this.boundaryLines.has(chunk)) {
                const lines = new THREE.LineSegments(this.sharedGeometry, this.material);
                lines.position.set(
                    chunk.worldOriginX + (chunk.width - 1) / 2,
                    chunk.worldOriginY + (chunk.height - 1) / 2,
                    chunk.worldOriginZ + (chunk.depth - 1) / 2,
                );
                game.threeScene.add(lines);
                this.boundaryLines.set(chunk, lines);
            }

            this.boundaryLines.get(chunk)!.visible = chunk.mesh.visible;
        }
    }

    dispose() {
        for (const lines of this.boundaryLines.values()) {
            game.threeScene.remove(lines);
        }
        this.boundaryLines.clear();
        this.sharedGeometry?.dispose();
        this.material.dispose();
    }
}
