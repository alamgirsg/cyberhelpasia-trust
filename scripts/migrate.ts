import { readFileSync, existsSync } from "node:fs";

/** Minimal .env loader for CLI scripts (Next.js loads .env itself). */
function loadEnv() {
  for (const f of [".env.local", ".env"]) {
    if (!existsSync(f)) continue;
    for (const line of readFileSync(f, "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
}
loadEnv();

async function main() {
  const url = process.env.DATABASE_URL;
  if (url) {
    const postgres = (await import("postgres")).default;
    const { drizzle } = await import("drizzle-orm/postgres-js");
    const { migrate } = await import("drizzle-orm/postgres-js/migrator");
    const client = postgres(url, { max: 1 });
    await migrate(drizzle(client), { migrationsFolder: "./drizzle" });
    await client.end();
  } else {
    const { mkdirSync } = await import("node:fs");
    const { PGlite } = await import("@electric-sql/pglite");
    const { drizzle } = await import("drizzle-orm/pglite");
    const { migrate } = await import("drizzle-orm/pglite/migrator");
    const dir = process.env.PGLITE_DIR ?? "./.data/pglite";
    mkdirSync(dir, { recursive: true });
    const client = new PGlite(dir);
    await migrate(drizzle(client), { migrationsFolder: "./drizzle" });
    await client.close();
  }
  console.log("Migrations applied.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
