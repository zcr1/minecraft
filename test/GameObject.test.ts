import GameObject from '../src/engine/GameObject';
import Component from '../src/engine/Component';

class Component1 extends Component {}
class Component2 extends Component {}
class Component3 extends Component {}

describe('GameObject', () => {
	let gameObject: GameObject;

	beforeEach(() => {
		gameObject = new GameObject();
	});

	test('addComponent', () => {
		gameObject.addComponent(new Component1());
		gameObject.addComponent(new Component2());
		gameObject.addComponent(new Component3());

		expect(() => gameObject.addComponent(new Component3())).toThrow();
	});

	test('getComponent', () => {
		const component1 = new Component1();
		const component2 = new Component2();

		gameObject.addComponent(component1);
		gameObject.addComponent(component2);

		expect(gameObject.getComponent(Component1)).toBe(component1);
		expect(gameObject.getComponent(Component2)).toBe(component2);
		expect(() => gameObject.getComponent(Component3)).toThrow();
	});

	test('removeComponent', () => {
		const component1 = new Component1();
		const component2 = new Component2();

		gameObject.addComponent(component1);
		gameObject.addComponent(component2);
		gameObject.removeComponent(Component1);

		expect(() => gameObject.getComponent(Component1)).toThrow();
	});
});
