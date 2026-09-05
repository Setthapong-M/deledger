import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

const srcRoot = fileURLToPath(new URL("./src", import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@": srcRoot,
    },
  },
  test: {
    passWithNoTests: true,
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          include: ["tests/domain/**/*.test.ts", "tests/components/**/*.test.tsx", "tests/auth/**/*.unit.test.ts"],
          environment: "jsdom",
          setupFiles: ["src/test/setup.ts"],
          fileParallelism: false,
        },
      },
      {
        extends: true,
        test: {
          name: "integration",
          include: ["tests/database/**/*.integration.test.ts", "tests/auth/**/*.integration.test.ts", "tests/services/**/*.integration.test.ts", "tests/api/**/*.integration.test.ts"],
          environment: "node",
          setupFiles: ["src/test/setup.ts"],
          sequence: { concurrent: false, setupFiles: "list" },
          fileParallelism: false,
        },
      },
      {
        extends: true,
        test: {
          name: "operations",
          include: ["tests/operations/**/*.integration.test.ts"],
          environment: "node",
          setupFiles: ["src/test/setup.ts"],
          sequence: { concurrent: false, setupFiles: "list" },
          fileParallelism: false,
        },
      },
    ],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      thresholds: { statements: 90, lines: 90, functions: 90, branches: 85 },
      include: ["src/server/domain/**/*.ts", "src/components/theme-control.tsx", "src/components/money-field.tsx", "src/components/status-badge.tsx", "src/lib/format.ts"],
      exclude: ["src/app/api/**", "src/test/**"],
    },
  },
});
