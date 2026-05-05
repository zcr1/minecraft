export default abstract class Singleton {
    private static readonly _instances = new Map<Function, Singleton>();

    protected static _init<T extends Singleton>(create: () => T): T {
        const existing = Singleton._instances.get(this) as (T & { dispose?(): void }) | undefined;
        existing?.dispose?.();
        const inst = create();
        Singleton._instances.set(this, inst);
        return inst;
    }

    static get instance(): Singleton {
        const inst = Singleton._instances.get(this);
        if (!inst) throw new Error(`${this.name} is not initialized`);
        return inst;
    }

    protected _destroy(): void {
        Singleton._instances.delete(this.constructor as Function);
    }
}
