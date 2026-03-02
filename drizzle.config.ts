import { defineConfig } from "drizzle-kit";
import { mkdirSync } from "fs";
import { join } from "path";

const dbDir = join(process.env.HOME ?? ".", ".local", "share", "hive");
mkdirSync(dbDir, { recursive: true });

export default defineConfig({
  schema: "./server/database/schema.ts",
  out: "./server/database/migrations",
  dialect: "sqlite",
  dbCredentials: {
    url: join(dbDir, "hive.db"),
  },
});
