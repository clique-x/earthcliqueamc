import { migrate } from "drizzle-orm/postgres-js/migrator";
import { fileURLToPath } from "node:url";
import { db, sqlClient } from "./client";

await migrate(db, { migrationsFolder: fileURLToPath(new URL("../drizzle", import.meta.url)) });
console.log("Migrations applied");
await sqlClient.end();
