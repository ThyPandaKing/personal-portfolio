import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["test/**/*.test.ts"],
    // Memory-server startup + Atlas-style timeouts need a little headroom.
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
