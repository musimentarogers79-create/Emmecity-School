import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

const databaseUrl =
  process.env.NEON_DATABASE_URL?.trim() || process.env.DATABASE_URL?.trim();
const usingNeon = Boolean(process.env.NEON_DATABASE_URL?.trim());

if (!databaseUrl) {
  throw new Error(
    "NEON_DATABASE_URL or DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const pool = new Pool({
  connectionString: databaseUrl,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
  keepAlive: true,
  ...(usingNeon
    ? {
        verify: (client: { query: (text: string, callback: (error: Error | undefined) => void) => void }, callback: (error?: Error) => void) => {
          client.query("SET search_path TO public", (error) => callback(error));
        },
      }
    : {}),
});
export const db = drizzle(pool, { schema });

export * from "./schema";
