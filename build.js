// build.js
import { build } from "esbuild";

const baseConfig = {
  entryPoints: ["src/index.ts"],
  bundle: true,
  platform: "node",
  format: "esm",
  target: "esnext",
  sourcemap: true,
};

// Un minify version
await build({
  ...baseConfig,
  outfile: "dist/fetch-event-source.js",
});

// Minify version
await build({
  ...baseConfig,
  outfile: "dist/fetch-event-source.min.js",
  minify: true,
  sourcemap: false,
});

console.log("✅ Packaging completed：dist/fetch-event-source.esm.js 和 fetch-event-source.esm.min.js");
