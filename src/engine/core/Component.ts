export default abstract class Component {
    abstract update(deltaTime: number): void;
}

export type ComponentConstructor<T extends Component> = new (...args: any[]) => T;
