import { readdirSync } from "node:fs";
import { join } from "node:path";
import pg from "pg";
import { TEST_DATABASE_URL, assertTestDatabaseUrl } from "./test-db";

export default async function setup() {
  assertTestDatabaseUrl(TEST_DATABASE_URL);
  const client = new pg.Client({ connectionString: TEST_DATABASE_URL });
  await client.connect();
  try {
    const { rows: names } = await client.query("SELECT current_database() AS name");
    if (!String(names[0].name).endsWith("_test")) {
      throw new Error(`Connected to "${names[0].name}", which is not a test database`);
    }

    const expected = readdirSync(join(process.cwd(), "prisma", "migrations"), { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name);
    const { rows } = await client.query(
      "SELECT migration_name FROM _prisma_migrations WHERE finished_at IS NOT NULL",
    );
    const applied = new Set(rows.map((r) => r.migration_name));
    const missing = expected.filter((m) => !applied.has(m));
    if (missing.length > 0) {
      throw new Error(
        `Test database is missing migrations: ${missing.join(", ")}. ` +
          `Run: DATABASE_URL=<test url> npx prisma migrate deploy`,
      );
    }
  } finally {
    await client.end();
  }
}