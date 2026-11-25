import { drizzle } from "drizzle-orm/mysql2";
import { migrate } from "drizzle-orm/mysql2/migrator";
import mysql from "mysql2/promise";
import path from "node:path";
import { pathToFileURL } from "node:url";

const migrationsFolder = path.join(import.meta.dirname, "..", "drizzle");

const TRANSIENT = new Set(["ECONNRESET", "ETIMEDOUT", "ECONNREFUSED", "PROTOCOL_CONNECTION_LOST"]);

/** Railway's public proxy drops the odd connection, so scripts retry the connect a few times. */
export async function connectWithRetry(url: string, attempts = 3): Promise<mysql.Connection> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await mysql.createConnection({ uri: url, timezone: "Z", connectTimeout: 10_000 });
    } catch (error) {
      const code = (error as { code?: string }).code ?? "";
      if (attempt >= attempts || !TRANSIENT.has(code)) throw error;
      await new Promise((resolve) => setTimeout(resolve, 500 * attempt));
    }
  }
}

export async function migrateDatabase(url: string) {
  const connection = await connectWithRetry(url);
  try {
    await migrate(drizzle({ client: connection }), { migrationsFolder });
  } finally {
    await connection.end();
  }
}

// Usage: tsx --env-file=.env.local scripts/migrate.ts [--test]
// --test migrates TEST_DATABASE_URL instead of DATABASE_URL.
async function main() {
  const useTest = process.argv.includes("--test");
  const name = useTest ? "TEST_DATABASE_URL" : "DATABASE_URL";
  const url = process.env[name];
  if (!url) throw new Error(`${name} is not set`);
  await migrateDatabase(url);
  console.log(`Migrations applied to ${name}.`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
