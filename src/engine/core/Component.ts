import type GameObject from "./GameObject";

export default class Component {
    gameObject!: GameObject;

    update(deltaTime: number) {}
    start() {}
}

export type ComponentConstructor<T extends Component> = new (...args: any[]) => T;
