import { defineConfig } from "drizzle-kit";

// `drizzle-kit generate` only reads the schema, so no database URL is needed here.
// Migrations are applied by scripts/migrate.ts.
export default defineConfig({
  dialect: "mysql",
  schema: "./src/server/db/schema.ts",
  out: "./drizzle",
});
