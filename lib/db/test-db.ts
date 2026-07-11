import { PGlite } from "@electric-sql/pglite";
import { drizzle, type PgliteDatabase } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import * as schema from "@/lib/db/schema";

// Spins up an isolated in-memory Postgres (PGlite), applies the committed SQL
// migrations, and returns a Drizzle handle. Used by every data-layer test so CI
// exercises the real schema without a database server.
export async function createTestDb(): Promise<{
  db: PgliteDatabase<typeof schema>;
  close: () => Promise<void>;
}> {
  const client = new PGlite();
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: "./db/migrations" });
  return {
    db,
    close: async () => {
      await client.close();
    },
  };
}
