import { afterEach, expect, it, vi } from "vitest";

afterEach(() => { vi.unstubAllEnvs(); vi.resetModules(); });

it.each([
  ["development", "local", true],
  ["production", "local", false],
  ["development", "qas", false],
  ["production", "qas", false],
])("limits eval to local development: %s / %s", async (nodeEnv, environment, allowed) => {
  vi.stubEnv("NODE_ENV", nodeEnv);
  vi.stubEnv("DELEDGER_ENV", environment);
  vi.resetModules();
  const { default: config } = await import("../../next.config");
  const rules = await config.headers!();
  const policy = rules[0].headers.find((header) => header.key === "Content-Security-Policy")!.value;
  expect(policy.includes("'unsafe-eval'")).toBe(allowed);
});
