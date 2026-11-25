// Imported first by every integration test. Points the app's DATABASE_URL at
// TEST_DATABASE_URL, because these tests truncate and reseed the database.
import { existsSync } from "node:fs";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");

const testUrl = process.env.TEST_DATABASE_URL;
if (!testUrl) throw new Error("TEST_DATABASE_URL is not set. Integration tests need their own MySQL database.");

const databaseName = new URL(testUrl).pathname.slice(1);
if (!databaseName.includes("test")) {
  throw new Error(`Refusing to run: TEST_DATABASE_URL points at "${databaseName}", which doesn't look like a test database.`);
}

process.env.DATABASE_URL = testUrl;
export const TEST_DATABASE_URL = testUrl;
