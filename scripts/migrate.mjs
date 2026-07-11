// Applies committed SQL migrations to the database in DATABASE_URL.
// Usage: npm run db:migrate  (requires tsx: npx is invoked via the package script)
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: url });
const db = drizzle(pool);
await migrate(db, { migrationsFolder: "./db/migrations" });
await pool.end();
console.log("Migrations applied.");
