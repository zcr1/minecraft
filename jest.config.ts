import type { Config } from "jest";

const config: Config = {
    preset: "ts-jest",
    testEnvironment: "node",
    testMatch: ["<rootDir>/test/**/*.test.(ts|tsx|js|jsx)"],
    moduleNameMapper: {
        "^@/(.*)$": "<rootDir>/src/$1",
        "^engine/(.*)$": "<rootDir>/src/engine/$1",
        "\\.(png|jpg|jpeg|gif|svg)$": "<rootDir>/test/fileMock.ts",
    },
};

export default config;
