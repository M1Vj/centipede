import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname),
    },
  },
  test: {
    environment: "node",
    environmentMatchGlobs: [["tests/ui/**/*.test.tsx", "jsdom"]],
    setupFiles: ["./tests/setup.ts"],
  },
});
