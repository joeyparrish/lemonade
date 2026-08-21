// defineConfig comes from vitest/config, not vite, so the `test` block below
// type checks. The plan's Task 1 listed the vite import; this is the fix.
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: { globals: true, environment: "node" },
});
