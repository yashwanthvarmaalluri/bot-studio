import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "iife"],
  splitting: false,
  sourcemap: true,
  minify: true,
  clean: true,
  dts: true,
  target: "es2019"
});

