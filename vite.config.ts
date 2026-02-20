import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
  base: "/scripter/",
  resolve: {
    alias: {
      "@poqpoq/types": resolve(__dirname, "src/types"),
      "@poqpoq/api": resolve(__dirname, "src/api"),
      "@poqpoq/runtime": resolve(__dirname, "src/runtime"),
      "@poqpoq/transpiler": resolve(__dirname, "src/transpiler"),
      "@poqpoq/editor": resolve(__dirname, "src/editor"),
    },
  },
  build: {
    target: "es2022",
    outDir: "dist-app",
  },
});
