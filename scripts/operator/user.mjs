import { createCipheriv, randomBytes } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile, rename } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { withOperatorClient } from "./db.mjs";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export async function run(argv, dependencies = {}) {
  const [command, ...flags] = argv;
  const values = parseFlags(flags);
  if (!new Set(["invite", "archive", "restore", "transfer-email", "export"]).has(command)) throw new Error("usage: invite|archive|restore|transfer-email|export");
  if (command === "invite") {
    const email = normalizeEmail(required(values, "email"));
    const ownerId = await withOperatorClient((client) => callUuid(client, "operator_invite", [email]), dependencies.environment);
    output.write(`invited ${ownerId}\n`);
    return ownerId;
  }
  if (command === "transfer-email") {
    const oldEmail = normalizeEmail(required(values, "old-email"));
    const newEmail = normalizeEmail(required(values, "new-email"));
    await confirmDestructive("transfer-email", dependencies);
    const ownerId = await withOperatorClient((client) => callUuid(client, "operator_transfer_email", [oldEmail, newEmail]), dependencies.environment);
    output.write(`transferred ${ownerId}\n`);
    return ownerId;
  }
  const ownerId = required(values, "owner-id");
  if (!UUID.test(ownerId)) throw new Error("owner-id must be a UUID");
  if (command === "archive") {
    await confirmDestructive("archive", dependencies);
    const archiveId = await withOperatorClient((client) => callValue(client, "operator_archive", [ownerId]), dependencies.environment);
    output.write(`archived ${archiveId}\n`);
    return archiveId;
  }
  if (command === "restore") {
    await confirmDestructive("restore", dependencies);
    const crossed = await withOperatorClient(async (client) => {
      await client.query("SELECT public.catch_up_owner_reporting_months($1, public.current_business_date())", [ownerId]);
      return callValue(client, "operator_restore", [ownerId]);
    }, dependencies.environment);
    output.write(`restored ${crossed ? "resume-required" : "ready"}\n`);
    return crossed;
  }
  const outputDir = required(values, "output-dir");
  return exportUser(ownerId, outputDir, dependencies);
}

export async function exportUser(ownerId, outputDir, dependencies = {}) {
  if (!UUID.test(ownerId)) throw new Error("owner-id must be a UUID");
  const keyValue = dependencies.environment?.DELEDGER_EXPORT_KEY ?? process.env.DELEDGER_EXPORT_KEY;
  if (!keyValue) throw new Error("DELEDGER_EXPORT_KEY is required");
  const key = Buffer.from(keyValue, "base64");
  if (key.length !== 32) throw new Error("DELEDGER_EXPORT_KEY must be a base64 32-byte key");
  const payload = await withOperatorClient((client) => callValue(client, "operator_export", [ownerId]), dependencies.environment);
  const temporary = await mkdtemp(join(tmpdir(), "deledger-export-"));
  const plainPath = join(temporary, "export.json");
  const encryptedTemp = join(temporary, "export.enc.tmp");
  const outputPath = join(outputDir, `deledger-${ownerId}.json.enc`);
  try {
    await writeFile(plainPath, JSON.stringify(payload), { mode: 0o600 });
    const plaintext = await readFile(plainPath);
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", key, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    const result = Buffer.concat([Buffer.from("DELEDGER-EXPORT-1\n"), iv, cipher.getAuthTag(), encrypted]);
    await writeFile(encryptedTemp, result, { mode: 0o600 });
    await rename(encryptedTemp, outputPath);
    output.write(`exported ${outputPath}\n`);
    return outputPath;
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
}

function parseFlags(flags) {
  const values = {};
  for (let index = 0; index < flags.length; index += 1) {
    const flag = flags[index];
    if (!flag?.startsWith("--")) throw new Error("unknown flag");
    const name = flag.slice(2);
    if (!["email", "old-email", "new-email", "owner-id", "output-dir"].includes(name)) throw new Error(`unknown flag: ${name}`);
    const value = flags[index + 1];
    if (!value || value.startsWith("--")) throw new Error(`missing value: ${name}`);
    values[name] = value;
    index += 1;
  }
  return values;
}

function required(values, name) {
  const value = values[name];
  if (!value) throw new Error(`--${name} is required`);
  return value;
}

function normalizeEmail(value) {
  const email = value.trim().toLowerCase();
  if (!EMAIL.test(email)) throw new Error("invalid email");
  return email;
}

async function confirmDestructive(action, dependencies) {
  const isTTY = dependencies.isTTY ?? Boolean(input.isTTY && output.isTTY);
  if (!isTTY) throw new Error(`${action} requires an interactive TTY confirmation`);
  if (dependencies.confirm) {
    if (!(await dependencies.confirm(action))) throw new Error("confirmation declined");
    return;
  }
  const readline = createInterface({ input, output });
  try {
    const answer = await readline.question(`Type ${action} to continue: `);
    if (answer !== action) throw new Error("confirmation declined");
  } finally {
    readline.close();
  }
}

async function callUuid(client, functionName, parameters) {
  const result = await client.query(`SELECT public.${functionName}(${parameters.map((_, index) => `$${index + 1}`).join(", ")})::text AS value`, parameters);
  return result.rows[0]?.value;
}

async function callValue(client, functionName, parameters) {
  const result = await client.query(`SELECT public.${functionName}(${parameters.map((_, index) => `$${index + 1}`).join(", ")}) AS value`, parameters);
  return result.rows[0]?.value;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  run(process.argv.slice(2)).catch((error) => {
    console.error(error instanceof Error ? error.message : "operator command failed");
    process.exitCode = 1;
  });
}
