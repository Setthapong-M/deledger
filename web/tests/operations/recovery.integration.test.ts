import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("backup and recovery safety", () => {
  it("refuses an unmounted or unexpected target before retention", async () => {
    const script = await readFile(new URL("../../../infra/backup/backup.sh", import.meta.url), "utf8");
    expect(script).toContain('[[ "$BACKUP_TARGET" == "/mnt/deledger-backups" ]]');
    expect(script).toContain("mountpoint -q");
    expect(script.indexOf("find \"$BACKUP_TARGET\" -maxdepth 1 -type f -name 'deledger-*.dump.age' -mtime +30 -delete")).toBeGreaterThan(script.indexOf("test -s \"$temporary_dump\""));
    expect(script).toContain('mv -- "$temporary_checksum_ready" "$checksum"');
  });

  it("isolates restore verification resources and cleans only its own label", async () => {
    const script = await readFile(new URL("../../../infra/backup/restore-verify.sh", import.meta.url), "utf8");
    expect(script).toContain("deledger-restore-verify-");
    expect(script).toContain("--network none");
    expect(script).toContain('DELEDGER_DB_IMAGE:-deledger-postgres:latest');
    expect(script).toContain("--exit-on-error");
    expect(script).toContain('docker rm -f "$label"');
    expect(script).toContain('docker volume rm "${label}-data"');
    expect(script).toContain("sha256sum --check");
    expect(script).toContain("relforcerowsecurity");
    expect(script).toContain("pg_extension");
    expect(script).toContain("row-count check failed");
    const backupDockerfile = await readFile(new URL("../../../infra/backup/Dockerfile", import.meta.url), "utf8");
    expect(backupDockerfile).toContain("postgres:18.6-bookworm");
    expect(backupDockerfile).toContain("apt-get install");
    expect(backupDockerfile).toContain("age");
  });
});
