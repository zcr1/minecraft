import { BlockType } from "engine/chunk/ChunkComponent";
import Component from "engine/core/Component";
import eventManager from "engine/core/EventManager";

export default class Inventory extends Component {
    private readonly counts = new Map<BlockType, number>();

    add(blockType: BlockType, count = 1): void {
        const current = this.counts.get(blockType) ?? 0;
        this.counts.set(blockType, current + count);
        eventManager.emit("inventoryChanged", undefined);
    }

    get(blockType: BlockType): number {
        return this.counts.get(blockType) ?? 0;
    }

    entries(): IterableIterator<[BlockType, number]> {
        return this.counts.entries();
    }

    dispose() {
        this.counts.clear();
    }
}
