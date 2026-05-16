import { NoiseFunction2D, createNoise2D } from "simplex-noise";
import { BlockType } from "engine/chunk/ChunkComponent";
import Singleton from "../core/Singleton";

export type TerrainConfig = {
    seed?: number;
    // Average surface height (world Y) — output of the noise centers here.
    baseHeight: number;
    // Peak-to-trough swing around baseHeight. Surface lands in [baseHeight - amp, baseHeight + amp].
    heightAmplitude: number;
    // Frequency of the lowest octave (e.g. 1/32 means one full wave every 32 blocks).
    // Lower = broader features; higher = noisier surface.
    baseFrequency: number;
    // Number of noise layers summed together for fBm. More octaves = more fine detail.
    octaves: number;
    // Per-octave amplitude multiplier. <1 means higher octaves contribute less (classic value: 0.5).
    persistence: number;
    // Per-octave frequency multiplier. >1 means higher octaves wiggle faster (classic value: 2.0).
    lacunarity: number;
};

// Tiny seeded PRNG. simplex-noise's createNoise2D wants a () => number in [0, 1) to seed
// its permutation table; Math.random is unseeded so we'd lose determinism. mulberry32 is a
// well-known 32-bit-state generator that's a few lines and good enough for terrain.
function mulberry32(seed: number): () => number {
    let state = seed >>> 0;
    return () => {
        state = (state + 0x6d2b79f5) >>> 0;
        let result = state;
        result = Math.imul(result ^ (result >>> 15), result | 1);
        result ^= result + Math.imul(result ^ (result >>> 7), result | 61);
        return ((result ^ (result >>> 14)) >>> 0) / 4294967296;
    };
}

export default class TerrainGenerator extends Singleton {
    static override get instance(): TerrainGenerator {
        return super.instance as TerrainGenerator;
    }

    static init(config: TerrainConfig): TerrainGenerator {
        return this._init(() => new TerrainGenerator(config));
    }

    private readonly noise2D: NoiseFunction2D;
    private readonly config: TerrainConfig;

    private constructor(config: TerrainConfig) {
        super();
        this.config = config;
        const prng = mulberry32(config.seed ?? 1);
        this.noise2D = createNoise2D(prng);
    }

    // Fractal Brownian motion (fBm): sum several octaves of noise, each at a higher
    // frequency and lower amplitude than the last. This is what gives terrain both
    // broad shape (low-frequency octaves) and fine detail (high-frequency octaves)
    // from a single underlying noise function.
    getHeight(worldX: number, worldZ: number): number {
        const { baseFrequency, octaves, persistence, lacunarity, baseHeight, heightAmplitude } = this.config;

        let frequency = baseFrequency;
        let amplitude = 1;
        let sum = 0;
        let amplitudeSum = 0;

        for (let octave = 0; octave < octaves; octave++) {
            sum += this.noise2D(worldX * frequency, worldZ * frequency) * amplitude;
            amplitudeSum += amplitude;
            amplitude *= persistence;
            frequency *= lacunarity;
        }

        // Dividing by amplitudeSum normalizes the result back into [-1, 1] regardless
        // of how many octaves we summed, so heightAmplitude maps cleanly to world units.
        const normalized = sum / amplitudeSum;
        return baseHeight + normalized * heightAmplitude;
    }

    getBlock(worldX: number, worldY: number, worldZ: number): BlockType {
        const surface = Math.floor(this.getHeight(worldX, worldZ));

        if (worldY > surface) {
            return BlockType.Air;
        }

        if (worldY === surface) {
            return BlockType.Grass;
        }

        return BlockType.Dirt;
    }
}
