import { BlockType } from "engine/chunk/ChunkComponent";
import Component from "engine/core/Component";

export default class Inventory extends Component {
    private readonly counts = new Map<BlockType, number>();
    private readonly changeListeners: Array<() => void> = [];

    add(blockType: BlockType, count = 1): void {
        const current = this.counts.get(blockType) ?? 0;
        this.counts.set(blockType, current + count);
        for (const listener of this.changeListeners) {
            listener();
        }
    }

    get(blockType: BlockType): number {
        return this.counts.get(blockType) ?? 0;
    }

    entries(): IterableIterator<[BlockType, number]> {
        return this.counts.entries();
    }

    addChangeListener(listener: () => void): void {
        this.changeListeners.push(listener);
    }

    removeChangeListener(listener: () => void): void {
        const index = this.changeListeners.indexOf(listener);
        if (index !== -1) {
            this.changeListeners.splice(index, 1);
        }
    }

    dispose() {
        this.counts.clear();
        this.changeListeners.length = 0;
    }
}
