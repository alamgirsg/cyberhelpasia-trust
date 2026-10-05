import { readFileSync, existsSync } from "node:fs";

for (const f of [".env.local", ".env"]) {
  if (!existsSync(f)) continue;
  for (const line of readFileSync(f, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

async function main() {
  const { getDb, schema } = await import("../src/db");
  const { FRAMEWORKS } = await import("../src/content/frameworks");
  const { sql } = await import("drizzle-orm");
  const db = await getDb();

  for (const fw of FRAMEWORKS) {
    await db
      .insert(schema.frameworks)
      .values({ id: fw.id, name: fw.name, version: fw.version, description: fw.description, refLabel: fw.refLabel ?? "ISO/IEC 27001:2022 (indicative)" })
      .onConflictDoUpdate({
        target: schema.frameworks.id,
        set: { name: fw.name, version: fw.version, description: fw.description, refLabel: fw.refLabel ?? "ISO/IEC 27001:2022 (indicative)" },
      });

    for (const [i, c] of fw.controls.entries()) {
      await db
        .insert(schema.controls)
        .values({ ...c, isoRefs: c.isoRefs ?? null, frameworkId: fw.id, sortOrder: i })
        .onConflictDoUpdate({
          target: schema.controls.id,
          set: {
            domain: sql`excluded.domain`,
            ref: sql`excluded.ref`,
            title: sql`excluded.title`,
            guidance: sql`excluded.guidance`,
            evidenceHint: sql`excluded.evidence_hint`,
            isoRefs: sql`excluded.iso_refs`,
            sortOrder: sql`excluded.sort_order`,
          },
        });
    }
    console.log(`Seeded ${fw.id}: ${fw.controls.length} controls`);
  }
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
