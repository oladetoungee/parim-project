import { execFileSync } from "node:child_process";

/**
 * Migrates and reseeds the test database before the server starts, so every
 * run begins from the same 42 shifts. Output is swallowed on success and
 * trimmed on failure: the scripts' errors can include the connection string.
 */
export default function globalSetup() {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) throw new Error("TEST_DATABASE_URL is not set. The e2e specs need their own database.");
  const name = new URL(url).pathname.slice(1);
  if (!name.includes("test")) throw new Error("TEST_DATABASE_URL doesn't look like a test database. Refusing to reseed it.");

  for (const script of ["scripts/migrate.ts", "scripts/seed.ts"]) {
    try {
      execFileSync("npx", ["tsx", script, "--test"], { stdio: "pipe", env: process.env });
    } catch (error) {
      const stderr = String((error as { stderr?: Buffer }).stderr ?? "").replaceAll(url, "<TEST_DATABASE_URL>");
      throw new Error(`${script} --test failed:\n${stderr.slice(0, 2000)}`);
    }
  }
}
