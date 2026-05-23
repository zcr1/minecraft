import * as THREE from "three";
import { Sky } from "three/addons/objects/Sky.js";
import game from "engine/Game";
import Component from "engine/core/Component";

const SKY_SCALE = 450000;

export interface SkyPreset {
    turbidity: number;
    rayleigh: number;
    mieCoefficient: number;
    mieDirectionalG: number;
    /** Normalised direction from origin toward the sun. */
    sunDirection: THREE.Vector3;
    /** Colour of the scene directional (sun) light. */
    lightColor: THREE.ColorRepresentation;
    lightIntensity: number;
    /** Exponential fog density. Set to 0 to disable fog. */
    fogDensity: number;
    /** Fog colour — should match the mid-sky colour of the preset. */
    fogColor: THREE.ColorRepresentation;
}

export const DAYTIME_PRESET: SkyPreset = {
    turbidity: 1.0,
    rayleigh: 0.3,
    mieCoefficient: 0.002,
    mieDirectionalG: 0.97,
    sunDirection: new THREE.Vector3(0.3, 3, 1).normalize(),
    lightColor: 0xfff5e0,
    lightIntensity: 1.0,
    fogDensity: 0.0008,
    fogColor: 0x88b0d8,
};

export const SUNSET_PRESET: SkyPreset = {
    turbidity: 12,
    rayleigh: 3,
    mieCoefficient: 0.002,
    mieDirectionalG: 0.98,
    sunDirection: new THREE.Vector3(1, 0.2, 3).normalize(),
    lightColor: 0xffa060,
    lightIntensity: 1.2,
    fogDensity: 0.0008,
    fogColor: 0xd4845a,
};

export default class SkyComponent extends Component {
    private sky!: InstanceType<typeof Sky>;
    private dirLight!: THREE.DirectionalLight;
    private currentPreset: SkyPreset;

    constructor(preset: SkyPreset = DAYTIME_PRESET) {
        super();
        this.currentPreset = preset;
    }

    start() {
        this.sky = new Sky();
        this.sky.scale.setScalar(SKY_SCALE);
        game.threeScene.add(this.sky);

        // Sky mesh covers the entire background, so the solid color is not needed
        game.threeScene.background = null;

        this.dirLight = new THREE.DirectionalLight();
        game.threeScene.add(this.dirLight);

        this.applyPreset(this.currentPreset);
    }

    applyPreset(preset: SkyPreset) {
        this.currentPreset = preset;

        const uniforms = this.sky.material.uniforms;
        uniforms["turbidity"].value = preset.turbidity;
        uniforms["rayleigh"].value = preset.rayleigh;
        uniforms["mieCoefficient"].value = preset.mieCoefficient;
        uniforms["mieDirectionalG"].value = preset.mieDirectionalG;
        uniforms["sunPosition"].value.copy(preset.sunDirection);

        this.dirLight.color.set(preset.lightColor);
        this.dirLight.intensity = preset.lightIntensity;
        this.dirLight.position.copy(preset.sunDirection);

        if (preset.fogDensity > 0) {
            game.threeScene.fog = new THREE.FogExp2(preset.fogColor, preset.fogDensity);
        } else {
            game.threeScene.fog = null;
        }
    }

    dispose() {
        game.threeScene.remove(this.sky);
        this.sky.geometry.dispose();
        (this.sky.material as THREE.ShaderMaterial).dispose();
        game.threeScene.remove(this.dirLight);
        game.threeScene.fog = null;
    }
}
