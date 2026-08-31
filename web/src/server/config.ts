import { z } from "zod";

const schema = z.object({
  APP_ORIGIN: z.string().url(),
  BUSINESS_TIME_ZONE: z.literal("Asia/Bangkok"),
  DATABASE_URL: z.string().url().refine((value) => value.startsWith("postgresql://"), "DATABASE_URL must use PostgreSQL"),
  CLOUDFLARE_TEAM_DOMAIN: z.string().url().refine((value) => value.startsWith("https://"), "Cloudflare team domain must use HTTPS"),
  CLOUDFLARE_ACCESS_AUD: z.string().min(1),
});

export type AppConfig = z.infer<typeof schema>;

export function loadConfig(environment: NodeJS.ProcessEnv = process.env): AppConfig {
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
  if (result.data.APP_ORIGIN !== "http://deledger.internal" && !result.data.APP_ORIGIN.startsWith("http://127.0.0.1:")) {
    throw new Error("APP_ORIGIN must be http://deledger.internal outside loopback tests");
  }
  return result.data;
}
