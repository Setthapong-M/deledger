export function register(): void {
  if (process.env.NEXT_PHASE === "phase-production-build") return;
  if (process.env.DELEDGER_ENV === "prod") throw new Error("prod environment is unsupported in this release");
  const target = new URL(process.env.API_ORIGIN ?? "");
  const local = process.env.DELEDGER_ENV === "local";
  if (target.protocol !== "http:" || target.username || target.password || target.pathname !== "/" || target.search || target.hash) throw new Error("invalid API_ORIGIN");
  if (local && !["127.0.0.1", "localhost"].includes(target.hostname)) throw new Error("local API_ORIGIN must be loopback");
  if (!local && target.hostname !== "api") throw new Error("QAS API_ORIGIN must use the internal api service");
}
