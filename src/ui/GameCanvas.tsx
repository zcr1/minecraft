import GameObject from 'engine/core/GameObject';
import MeshComponent from 'engine/components/MeshComponent';
import Scene from 'engine/core/Scene';
import { useEffect, useRef } from 'react';
import * as THREE from 'three';

export default function GameCanvas() {
	const mountRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		const mount = mountRef.current;
		if (!mount) return;

		const renderer = new THREE.WebGLRenderer({ antialias: true });
		renderer.setPixelRatio(window.devicePixelRatio);
		renderer.setSize(mount.clientWidth, mount.clientHeight);
		mount.appendChild(renderer.domElement);

		const threeScene = new THREE.Scene();
		threeScene.background = new THREE.Color(0x1a1a2e);

		const camera = new THREE.PerspectiveCamera(75, mount.clientWidth / mount.clientHeight, 0.1, 1000);
		camera.position.z = 5;

		threeScene.add(new THREE.AmbientLight(0xffffff, 0.4));
		const dirLight = new THREE.DirectionalLight(0xffffff, 1);
		dirLight.position.set(1, 2, 3);
		threeScene.add(dirLight);

		const geometry = new THREE.BoxGeometry();
		const material = new THREE.MeshStandardMaterial({ color: 0x44aa88 });
		const mesh = new THREE.Mesh(geometry, material);
		threeScene.add(mesh);

		const scene = new Scene();
		const cube = new GameObject('Cube');
		cube.addComponent(new MeshComponent(mesh));
		scene.gameObjects.push(cube);

		let rafId: number;
		const animate = () => {
			rafId = requestAnimationFrame(animate);
			scene.update();
			renderer.render(threeScene, camera);
		};
		animate();

		const observer = new ResizeObserver(() => {
			renderer.setSize(mount.clientWidth, mount.clientHeight);
			camera.aspect = mount.clientWidth / mount.clientHeight;
			camera.updateProjectionMatrix();
		});
		observer.observe(mount);

		return () => {
			cancelAnimationFrame(rafId);
			observer.disconnect();
			geometry.dispose();
			material.dispose();
			renderer.dispose();
			mount.removeChild(renderer.domElement);
		};
	}, []);

	return <div ref={mountRef} style={{ width: '100vw', height: '100vh' }} />;
}
