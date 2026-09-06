import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: {
    projects: [{
      extends: true,
      test: {
        name: "unit", include: ["tests/domain/**/*.test.ts", "tests/components/**/*.test.tsx", "tests/auth/**/*.unit.test.ts"],
        environment: "jsdom", setupFiles: ["src/test/setup.ts"], fileParallelism: false,
      },
    }],
    coverage: {
      provider: "v8", reporter: ["text", "json", "html"],
      thresholds: { statements: 90, lines: 90, functions: 90, branches: 85 },
      include: ["src/components/theme-control.tsx", "src/components/money-field.tsx", "src/components/status-badge.tsx", "src/lib/format.ts"],
    },
  },
});
