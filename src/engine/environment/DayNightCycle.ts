import * as THREE from "three";
import { Sky } from "three/addons/objects/Sky.js";
import game from "engine/Game";
import Component from "engine/core/Component";

const DAY_DURATION_SECONDS = 2 * 24 * 60; // 2min -> 1hr in game
const UPDATE_FREQUENCY = 1; // 1s
// Sun height (0 = horizon, 1 = zenith) below which light/fog blend toward the orange sunset colour.
// Higher = the sun reads orange while still well above the horizon, so the warm phase starts earlier
// and lasts longer.
const SUNSET_BLEND_HEIGHT = 0.55;
// The three.js Sky shader only renders sunset hues when the sun disc is near the horizon. We feed it
// a compressed sun elevation (|sunY| ^ exponent) so the disc sits low — and the sky turns orange —
// while the real sun, which still drives lighting and day length, is higher. >1 pulls the apparent
// sun toward the horizon for most of the arc; noon (1) and the horizon (0) are unchanged.
const SKY_SUN_ELEVATION_EXPONENT = 2.5;
const STAR_COUNT = 2000;
const STAR_RADIUS = 900;
const SKY_SCALE = 450000;

export default class DayNightCycle extends Component {
    private _timeOfDay = 0.5;
    private accumulator = 0;
    private sky!: InstanceType<typeof Sky>;
    private dirLight!: THREE.DirectionalLight;
    private ambientLight!: THREE.AmbientLight;
    private starField!: THREE.Points;

    get timeOfDay(): number {
        return this._timeOfDay;
    }

    set timeOfDay(value: number) {
        this._timeOfDay = value % 1;
        if (this.ambientLight) {
            this.updateLighting();
        }
    }

    start() {
        this.sky = new Sky();
        this.sky.scale.setScalar(SKY_SCALE);
        // Bias the direction vector upward in the fragment shader so the horizon gradient
        // appears lower in the viewport — without this the white band sits at eye level.
        this.sky.material.onBeforeCompile = shader => {
            shader.fragmentShader =
                "uniform float horizonBias;\n" +
                shader.fragmentShader.replace(
                    "vec3 direction = normalize( vWorldPosition - cameraPosition );",
                    "vec3 direction = normalize( vWorldPosition - cameraPosition + vec3( 0.0, horizonBias, 0.0 ) );",
                );
            shader.uniforms.horizonBias = { value: SKY_SCALE * 0.15 };
        };
        game.threeScene.add(this.sky);
        game.threeScene.background = null;

        this.dirLight = new THREE.DirectionalLight();
        game.threeScene.add(this.dirLight);

        this.ambientLight = new THREE.AmbientLight();
        game.threeScene.add(this.ambientLight);

        this.starField = this.createStarField();
        game.threeScene.add(this.starField);

        this.updateLighting();
    }

    update(deltaTime: number) {
        this._timeOfDay = (this._timeOfDay + deltaTime / DAY_DURATION_SECONDS) % 1;

        // Stars must follow the camera so they appear fixed in the sky,
        // offset downward to match the sky shader's horizon bias
        const cameraPosition = game.camera.threeCamera.position;
        this.starField.position.set(cameraPosition.x, cameraPosition.y - STAR_RADIUS * 0.3, cameraPosition.z);

        this.accumulator += deltaTime;
        if (this.accumulator >= UPDATE_FREQUENCY) {
            this.accumulator = 0;
            this.updateLighting();
        }
    }

    private createStarField(): THREE.Points {
        const positions = new Float32Array(STAR_COUNT * 3);

        for (let i = 0; i < STAR_COUNT; i++) {
            const theta = Math.random() * Math.PI * 2;
            // acos(1 - u) gives uniform distribution over the upper hemisphere (y >= 0).
            // Full sphere would use acos(1 - 2u); halving the range keeps only y >= 0,
            // which is all that's ever visible — terrain occludes everything below the horizon.
            const phi = Math.acos(1 - Math.random());
            positions[i * 3] = STAR_RADIUS * Math.sin(phi) * Math.cos(theta);
            positions[i * 3 + 1] = STAR_RADIUS * Math.cos(phi);
            positions[i * 3 + 2] = STAR_RADIUS * Math.sin(phi) * Math.sin(theta);
        }

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));

        const material = new THREE.PointsMaterial({
            color: 0xffffff,
            size: 1.5,
            sizeAttenuation: false,
            transparent: true,
            opacity: 0,
            depthWrite: false,
        });

        return new THREE.Points(geometry, material);
    }

    private updateLighting() {
        const sunAngle = (this._timeOfDay - 0.5) * Math.PI * 2;
        const sunY = Math.cos(sunAngle);
        const sunX = Math.sin(sunAngle);
        const sunDirection = new THREE.Vector3(sunX, sunY, 0.5).normalize();

        // Apparent sun for the sky shader/atmosphere: same azimuth, but pulled toward the horizon so
        // sunset colours appear while the real sun is still up. Lighting/day length use sunY untouched.
        const skySunY = Math.sign(sunY) * Math.pow(Math.abs(sunY), SKY_SUN_ELEVATION_EXPONENT);
        const skySunDirection = new THREE.Vector3(sunX, skySunY, 0.5).normalize();

        const sunHeight = Math.max(0, sunY);
        const horizonProximity = Math.max(0, 1 - Math.abs(skySunY) / 0.6);
        const nightFactor = Math.max(0, -skySunY);

        // Rayleigh fades toward 0 at night, which darkens the sky shader significantly
        const rayleigh = (0.3 + horizonProximity * 2.7) * (1 - nightFactor * 0.95);
        const turbidity = 1.0 + horizonProximity * 11;

        // Larger mie halo near horizon spreads sun glow through orange-tinted atmosphere;
        // softer mieDirectionalG blends the disc into surrounding sky colour
        const mieCoefficient = 0.002 + horizonProximity * 0.005;
        const mieDirectionalG = 0.97 - horizonProximity * 0.04;

        const uniforms = this.sky.material.uniforms;
        uniforms["turbidity"].value = turbidity;
        uniforms["rayleigh"].value = rayleigh;
        uniforms["mieCoefficient"].value = mieCoefficient;
        uniforms["mieDirectionalG"].value = mieDirectionalG;
        uniforms["sunPosition"].value.copy(skySunDirection);

        // The Sky shader can't produce a blue night sky — it just renders grey/black
        // once the sun is below the horizon. Switch to a solid background color at night.
        if (sunY < -0.1) {
            this.sky.visible = false;
            game.threeScene.background = new THREE.Color(0x080e1f);
        } else {
            this.sky.visible = true;
            game.threeScene.background = null;
        }

        const lightIntensity = sunHeight * 1.2;
        const dayColor = new THREE.Color(0xfff5e0);
        const horizonColor = new THREE.Color(0xff8840);
        const lightColor = horizonColor.clone().lerp(dayColor, Math.min(1, sunHeight / SUNSET_BLEND_HEIGHT));
        this.dirLight.color.copy(lightColor);
        this.dirLight.intensity = lightIntensity;
        this.dirLight.position.copy(sunDirection);

        const dayFogColor = new THREE.Color(0x88b0d8);
        const sunsetFogColor = new THREE.Color(0xf4905a);
        const nightFogColor = new THREE.Color(0x0d1f38);
        const fogColor =
            sunY < 0
                ? nightFogColor
                : sunsetFogColor.clone().lerp(dayFogColor, Math.min(1, sunHeight / SUNSET_BLEND_HEIGHT));
        game.threeScene.fog = new THREE.FogExp2(fogColor.getHex(), 0.0008);

        const nightAmbient = new THREE.Color(0x2a4a7a);
        const dayAmbient = new THREE.Color(0xffffff);
        this.ambientLight.color.copy(nightAmbient.clone().lerp(dayAmbient, sunHeight));
        this.ambientLight.intensity = 0.7 + sunHeight * 0.22;

        (this.starField.material as THREE.PointsMaterial).opacity = Math.min(1, Math.max(0, -sunY * 3));
    }

    dispose() {
        game.threeScene.remove(this.sky);
        this.sky.geometry.dispose();
        (this.sky.material as THREE.ShaderMaterial).dispose();
        game.threeScene.remove(this.dirLight);
        game.threeScene.remove(this.ambientLight);
        game.threeScene.remove(this.starField);
        (this.starField.material as THREE.PointsMaterial).dispose();
        this.starField.geometry.dispose();
        game.threeScene.fog = null;
    }
}
