import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    passWithNoTests: true,
    projects: [
      {
        test: {
          name: "unit",
          include: ["tests/domain/**/*.test.ts", "tests/components/**/*.test.tsx"],
          environment: "node",
          setupFiles: ["src/test/setup.ts"],
        },
      },
      {
        test: {
          name: "integration",
          include: ["tests/database/**/*.integration.test.ts", "tests/auth/**/*.integration.test.ts", "tests/services/**/*.integration.test.ts", "tests/api/**/*.integration.test.ts"],
          environment: "node",
          setupFiles: ["src/test/setup.ts"],
          sequence: { concurrent: false, setupFiles: "list" },
        },
      },
      {
        test: {
          name: "operations",
          include: ["tests/operations/**/*.integration.test.ts"],
          environment: "node",
          setupFiles: ["src/test/setup.ts"],
          sequence: { concurrent: false, setupFiles: "list" },
        },
      },
    ],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      thresholds: { statements: 90, lines: 90, functions: 90, branches: 85 },
      include: ["src/server/domain/**/*.ts", "src/server/services/**/*.ts", "src/components/**/*.tsx"],
      exclude: ["src/app/api/**", "src/test/**"],
    },
  },
});
