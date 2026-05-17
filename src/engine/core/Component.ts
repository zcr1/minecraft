import type GameObject from "./GameObject";

export default class Component {
    gameObject!: GameObject;
    enabled = true;

    update(_deltaTime: number) {}
    start() {}
    dispose() {}
}

export type ComponentConstructor<T extends Component> = new (...args: any[]) => T;
