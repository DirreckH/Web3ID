import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    exclude: ["tests/stage*.spec.ts", "node_modules/**", "dist/**"],
  },
});
