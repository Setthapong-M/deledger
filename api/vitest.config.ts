import { defineConfig } from "vitest/config";
export default defineConfig({ test: {
  environment: "node", fileParallelism: false, testTimeout: 30000, hookTimeout: 60000,
  coverage: { provider: "v8", reporter: ["text", "json", "html"], include: ["src/server/domain/**/*.ts"], thresholds: { statements: 90, lines: 90, functions: 90, branches: 85 } },
} });
