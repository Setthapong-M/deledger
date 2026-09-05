import { z } from "zod";

const environmentSchema = z.enum(["local", "qas", "prod"]);
export type AppEnvironment = z.infer<typeof environmentSchema>;

const schema = z.object({
  DELEDGER_ENV: environmentSchema,
  APP_ORIGIN: z.string().url(),
  BUSINESS_TIME_ZONE: z.literal("Asia/Bangkok"),
  DATABASE_URL: z.string().url().refine((value) => value.startsWith("postgresql://"), "DATABASE_URL must use PostgreSQL"),
  CLOUDFLARE_TEAM_DOMAIN: z.string().url().optional().superRefine((value, context) => {
    if (value === undefined) return;
    const parsed = new URL(value);
    const local = parsed.hostname === "127.0.0.1" || parsed.hostname === "localhost";
    if (parsed.protocol !== "https:" && !local) context.addIssue({ code: "custom", message: "Cloudflare team domain must use HTTPS" });
    if (parsed.pathname !== "/" || parsed.search !== "" || parsed.hash !== "") context.addIssue({ code: "custom", message: "Cloudflare team domain must be an origin" });
  }),
  CLOUDFLARE_ACCESS_AUD: z.string().min(1).optional(),
}).strict();

export type AppConfig = Omit<z.infer<typeof schema>, "DELEDGER_ENV"> & { environment: AppEnvironment };
export type ConfigEnvironment = Record<string, string | undefined>;

export function loadConfig(environment: ConfigEnvironment = process.env): AppConfig {
  const result = schema.safeParse({
    DELEDGER_ENV: environment.DELEDGER_ENV ?? "qas",
    APP_ORIGIN: environment.APP_ORIGIN,
    BUSINESS_TIME_ZONE: environment.BUSINESS_TIME_ZONE,
    DATABASE_URL: environment.DATABASE_URL,
    CLOUDFLARE_TEAM_DOMAIN: environment.CLOUDFLARE_TEAM_DOMAIN,
    CLOUDFLARE_ACCESS_AUD: environment.CLOUDFLARE_ACCESS_AUD,
  });
  if (!result.success) {
    throw new Error(`invalid configuration: ${result.error.issues.map((issue) => issue.path.join(".")).join(", ")}`);
  }
  if (result.data.DELEDGER_ENV === "prod") throw new Error("prod environment is unsupported in this release");
  const origin = new URL(result.data.APP_ORIGIN);
  const loopback = origin.protocol === "http:" && (origin.hostname === "127.0.0.1" || origin.hostname === "localhost");
  if (result.data.DELEDGER_ENV === "local" && !loopback) {
    throw new Error("APP_ORIGIN must use a loopback host in local environment");
  }
  if (result.data.DELEDGER_ENV === "local") {
    const database = new URL(result.data.DATABASE_URL);
    const localPath = database.pathname === "/deledger_local" || (environment.NODE_ENV === "test" && database.pathname === "/deledger_test");
    const localDatabase = ["127.0.0.1", "localhost"].includes(database.hostname) && database.username === "deledger_web" && localPath;
    if (!localDatabase) throw new Error("DATABASE_URL must use the deledger_web role on the local loopback /deledger_local database");
  }
  if (result.data.DELEDGER_ENV === "qas" && result.data.APP_ORIGIN !== "http://deledger.internal") {
    throw new Error("APP_ORIGIN must be http://deledger.internal in QAS");
  }
  if (result.data.DELEDGER_ENV === "qas" && (!result.data.CLOUDFLARE_TEAM_DOMAIN || !result.data.CLOUDFLARE_ACCESS_AUD)) {
    throw new Error("QAS requires CLOUDFLARE_TEAM_DOMAIN and CLOUDFLARE_ACCESS_AUD");
  }
  if (result.data.DELEDGER_ENV === "local" && (result.data.CLOUDFLARE_TEAM_DOMAIN || result.data.CLOUDFLARE_ACCESS_AUD)) {
    throw new Error("local environment must not configure Cloudflare authentication");
  }
  const { DELEDGER_ENV, ...config } = result.data;
  return { ...config, environment: DELEDGER_ENV };
}
