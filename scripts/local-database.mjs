import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

export function localDatabaseConfiguration(environment = process.env) {
  const name = environment.LOCAL_DATABASE_NAME ?? "deledger_local";
  if (name.length > 63 || !/^deledger_local(?:_[a-z0-9]+)*$/.test(name)) {
    throw new Error("LOCAL_DATABASE_NAME must be deledger_local or deledger_local_<lowercase suffix>, at most 63 characters");
  }
  const port = environment.LOCAL_POSTGRES_PORT ?? "55433";
  const makeUrl = (role, password) => `postgresql://${role}:${encodeURIComponent(password)}@127.0.0.1:${port}/${name}`;
  const admin = environment.LOCAL_ADMIN_DATABASE_URL ?? makeUrl("postgres", environment.LOCAL_POSTGRES_PASSWORD ?? "deledger-local-postgres");
  const web = environment.LOCAL_DATABASE_URL ?? makeUrl("deledger_web", environment.LOCAL_WEB_PASSWORD ?? "deledger-local-web");
  const identity = environment.LOCAL_IDENTITY_DATABASE_URL ?? makeUrl("deledger_identity", environment.LOCAL_IDENTITY_PASSWORD ?? "deledger-local-identity");
  let endpoint;
  for (const [key, value, role] of [["LOCAL_ADMIN_DATABASE_URL", admin, "postgres"], ["LOCAL_DATABASE_URL", web, "deledger_web"], ["LOCAL_IDENTITY_DATABASE_URL", identity, "deledger_identity"]]) {
    let url;
    try { url = new URL(value); } catch { throw new Error(`${key} must be a valid PostgreSQL URL`); }
    if (url.protocol !== "postgresql:" || !["127.0.0.1", "localhost"].includes(url.hostname) || url.pathname !== `/${name}` || url.username !== role || url.search || url.hash) {
      throw new Error(`${key} must use ${role} on loopback at /${name}, without query parameters or fragments`);
    }
    const target = `${url.hostname}:${url.port || "5432"}`;
    if (endpoint !== undefined && endpoint !== target) throw new Error("Local database URLs must use the same host and port");
    endpoint = target;
  }
  return { name, admin, web, identity, volume: environment.DELEDGER_LOCAL_PGDATA_VOLUME || `${name}_pgdata` };
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  try {
    const config = localDatabaseConfiguration();
    process.stdout.write([config.name, config.admin, config.web, config.identity, config.volume].join("\n"));
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Invalid local database configuration");
    process.exitCode = 1;
  }
}
