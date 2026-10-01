import { drizzle as drizzlePostgres, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import * as schema from "./schema";

export type DB = PostgresJsDatabase<typeof schema>;

type GlobalWithDb = typeof globalThis & { __trustDb?: Promise<DB> };
const g = globalThis as GlobalWithDb;

/**
 * Production uses PostgreSQL via DATABASE_URL.
 * When DATABASE_URL is empty, an embedded PGlite database in ./.data is used
 * so the app can run locally with zero setup. PGlite is NOT for production.
 */
async function create(): Promise<DB> {
  const url = process.env.DATABASE_URL;
  if (url) {
    const postgres = (await import("postgres")).default;
    const client = postgres(url, { max: 10 });
    return drizzlePostgres(client, { schema });
  }
  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle: drizzlePglite } = await import("drizzle-orm/pglite");
  const client = new PGlite(process.env.PGLITE_DIR ?? "./.data/pglite");
  return drizzlePglite(client, { schema }) as unknown as DB;
}

export function getDb(): Promise<DB> {
  if (!g.__trustDb) g.__trustDb = create();
  return g.__trustDb;
}

export { schema };
