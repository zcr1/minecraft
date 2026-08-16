import { defineConfig } from "@rsbuild/core";
import { pluginReact } from "@rsbuild/plugin-react";
import { pluginSass } from "@rsbuild/plugin-sass";
import path from "path";

const isProduction = process.env.NODE_ENV === "production";
const basePath = isProduction ? "/minecraft/" : "/";

export default defineConfig({
    plugins: [pluginReact(), pluginSass()],
    resolve: {
        alias: {
            engine: path.resolve(__dirname, "src/engine"),
        },
    },
    output: {
        assetPrefix: basePath,
    },
    server: {
        base: basePath,
    },
    html: {
        title: "MineCraft",
        tags: [
            {
                tag: "link",
                attrs: {
                    rel: "stylesheet",
                    href: "https://cdn.jsdelivr.net/npm/normalize.css@8.0.1/normalize.css",
                },
                head: true,
            },
        ],
    },
});
