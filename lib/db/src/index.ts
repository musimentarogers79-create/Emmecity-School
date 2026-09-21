import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

const databaseUrl =
  process.env.NEON_DATABASE_URL?.trim() || process.env.DATABASE_URL?.trim();

if (!databaseUrl) {
  throw new Error(
    "NEON_DATABASE_URL or DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const pool = new Pool({ connectionString: databaseUrl });

if (process.env.NEON_DATABASE_URL?.trim()) {
  pool.on("connect", (client) => {
    void client.query("SET search_path TO public").catch((error) => {
      console.error("Failed to configure the Neon PostgreSQL search path.", error);
      client.release(true);
    });
  });
}
export const db = drizzle(pool, { schema });

export * from "./schema";
