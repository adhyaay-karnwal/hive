import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import * as schema from "./schema";
import { relations } from "./relations";
import { join } from "path";
import { mkdirSync } from "fs";

const dataDir = join(
  process.env.HOME || process.env.USERPROFILE || ".",
  ".local",
  "share",
  "hive",
);

mkdirSync(dataDir, { recursive: true });

const sqlite = new Database(join(dataDir, "hive.db"));
sqlite.pragma("journal_mode = WAL");

export const db = drizzle({ client: sqlite, schema, relations });

migrate(db, {
  migrationsFolder: join(process.cwd(), "server/database/migrations"),
});
