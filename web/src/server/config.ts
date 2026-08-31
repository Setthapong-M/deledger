import { z } from "zod";

const schema = z.object({
  APP_ORIGIN: z.string().url(),
  BUSINESS_TIME_ZONE: z.literal("Asia/Bangkok"),
  DATABASE_URL: z.string().url().refine((value) => value.startsWith("postgresql://"), "DATABASE_URL must use PostgreSQL"),
  CLOUDFLARE_TEAM_DOMAIN: z.string().url().superRefine((value, context) => {
    const parsed = new URL(value);
    const local = parsed.hostname === "127.0.0.1" || parsed.hostname === "localhost";
    if (parsed.protocol !== "https:" && !local) context.addIssue({ code: "custom", message: "Cloudflare team domain must use HTTPS" });
    if (parsed.pathname !== "/" || parsed.search !== "" || parsed.hash !== "") context.addIssue({ code: "custom", message: "Cloudflare team domain must be an origin" });
  }),
  CLOUDFLARE_ACCESS_AUD: z.string().min(1),
}).strict();

export type AppConfig = z.infer<typeof schema>;
export type ConfigEnvironment = Record<string, string | undefined>;

export function loadConfig(environment: ConfigEnvironment = process.env): AppConfig {
  const result = schema.safeParse({
    APP_ORIGIN: environment.APP_ORIGIN,
    BUSINESS_TIME_ZONE: environment.BUSINESS_TIME_ZONE,
    DATABASE_URL: environment.DATABASE_URL,
    CLOUDFLARE_TEAM_DOMAIN: environment.CLOUDFLARE_TEAM_DOMAIN,
    CLOUDFLARE_ACCESS_AUD: environment.CLOUDFLARE_ACCESS_AUD,
  });
  if (!result.success) {
    throw new Error(`invalid configuration: ${result.error.issues.map((issue) => issue.path.join(".")).join(", ")}`);
  }
  const origin = new URL(result.data.APP_ORIGIN);
  const loopback = origin.protocol === "http:" && (origin.hostname === "127.0.0.1" || origin.hostname === "localhost");
  if (result.data.APP_ORIGIN !== "http://deledger.internal" && !loopback) {
    throw new Error("APP_ORIGIN must be http://deledger.internal outside loopback tests");
  }
  return result.data;
}
