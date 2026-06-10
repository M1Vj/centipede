import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname),
    },
  },
  test: {
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
    exclude: ["e2e/**"],
    environment: "node",
    environmentOptions: {
      jsdom: {
        url: "http://localhost:3000",
      },
    },
    environmentMatchGlobs: [["tests/ui/**/*.test.tsx", "jsdom"]],
    setupFiles: ["./tests/setup.ts"],
  },
});
