import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, type Prisma } from "../../generated/prisma/client.js";
import { loadConfig } from "../config.js";

export type DatabaseClient = Prisma.TransactionClient;
let regular: PrismaClient | undefined;
let identity: PrismaClient | undefined;
function getClient(privileged: boolean): PrismaClient {
  const existing = privileged ? identity : regular;
  if (existing) return existing;
  const config = loadConfig();
  const client = new PrismaClient({ adapter: new PrismaPg({
    connectionString: privileged ? config.IDENTITY_DATABASE_URL : config.DATABASE_URL,
    max: 10, idleTimeoutMillis: 10_000, connectionTimeoutMillis: 5_000, allowExitOnIdle: true,
  }), transactionOptions: { maxWait: 10_000, timeout: 30_000 } });
  if (privileged) identity = client; else regular = client;
  return client;
}
function lazyClient(privileged: boolean): PrismaClient {
  return new Proxy({} as PrismaClient, {
    get(_target, property) {
      const client = getClient(privileged);
      const value = Reflect.get(client, property);
      return typeof value === "function" ? value.bind(client) : value;
    },
  });
}
export const prisma = lazyClient(false);
export const identityPrisma = lazyClient(true);
export async function disconnectDatabase(): Promise<void> {
  await Promise.all([regular?.$disconnect(), identity?.$disconnect()]);
  regular = undefined;
  identity = undefined;
}
