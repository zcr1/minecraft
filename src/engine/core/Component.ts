import type GameObject from "./GameObject";

export default abstract class Component {
    gameObject!: GameObject;
    abstract update(deltaTime: number): void;
}

export type ComponentConstructor<T extends Component> = new (...args: any[]) => T;
