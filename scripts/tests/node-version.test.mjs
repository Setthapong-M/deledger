import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const repository = fileURLToPath(new URL("../../", import.meta.url));

for (const version of ["20.20.0", "21.7.3", "22.0.0", "22.23.0", "22.23.1", "23.0.0", "24.0.0", "26.0.0", "invalid"]) {
  test(`release runtime gate handles Node ${version}`, () => {
    const directory = mkdtempSync(join(tmpdir(), "deledger-node-gate-"));
    try {
      writeFileSync(join(directory, "node"), `#!/bin/sh\nprintf '%s\\n' 'v${version}'\n`, { mode: 0o755 });
      writeFileSync(join(directory, "pnpm"), "#!/bin/sh\nprintf '%s\\n' '10.34.7'\n", { mode: 0o755 });
      writeFileSync(join(directory, "docker"), "#!/bin/sh\nexit 99\n", { mode: 0o755 });
      const result = spawnSync("bash", ["scripts/verify-release.sh"], {
        cwd: repository,
        encoding: "utf8",
        env: {
          ...process.env,
          PATH: `${directory}:${process.env.PATH}`,
          DATABASE_URL: "test-only",
          IDENTITY_DATABASE_URL: "test-only",
          CLOUDFLARE_TEAM_DOMAIN: "test-only",
          CLOUDFLARE_ACCESS_AUD: "test-only",
          CLOUDFLARE_TUNNEL_TOKEN: "test-only",
          BACKUP_MODE: "disabled",
          DELEDGER_SECRET_DIR: join(directory, "missing-secrets"),
        },
      });
      assert.equal(result.status, 1);
      const [major, minor, patch] = version.split(".").map(Number);
      const supported = major > 22 || (major === 22 && (minor > 23 || (minor === 23 && patch >= 1)));
      assert.match(result.stderr, supported ? /Compose secret directory is required/ : /Node .* required/);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
}
