import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("private deployment boundary", () => {
  it("keeps production services off host ports and separates edge/data access", async () => {
    const compose = await readFile(new URL("../../../infra/compose.yaml", import.meta.url), "utf8");
    expect(compose).not.toMatch(/^\s+ports:/m);
    expect(compose).toContain("internal: true");
    expect(compose).toContain("cloudflare/cloudflared:2026.7.2");
    expect(compose).toContain("read_only: true");
    expect(compose).toContain("cap_drop: [ALL]");
    expect(compose).toContain("aliases: [deledger.internal]");
    expect(compose).toContain("CLOUDFLARE_TUNNEL_TOKEN");
  });

  it("documents exact private WARP and Access controls", async () => {
    const checklist = await readFile(new URL("../../../infra/cloudflare/access-policy-checklist.md", import.meta.url), "utf8");
    expect(checklist).toContain("Authenticate with Cloudflare One Client");
    expect(checklist).toContain("no public DNS or Quick Tunnel");
    expect(checklist).toContain("wildcard domain");
  });
});
