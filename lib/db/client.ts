import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import type { PgliteDatabase } from "drizzle-orm/pglite";
import { Pool } from "pg";
import * as schema from "@/lib/db/schema";

// A Db handle is satisfied by either the production node-postgres driver or the
// PGlite test driver — both expose the same Drizzle query API over our schema.
export type Db =
  | NodePgDatabase<typeof schema>
  | PgliteDatabase<typeof schema>;

let pool: Pool | undefined;
let db: NodePgDatabase<typeof schema> | undefined;

// Lazy singleton so importing this module never requires DATABASE_URL until a query runs.
export function getDb(): NodePgDatabase<typeof schema> {
  if (!db) {
    const url = process.env.DATABASE_URL;
    if (!url) {
      throw new Error("DATABASE_URL is not set");
    }
    pool = new Pool({ connectionString: url });
    db = drizzle(pool, { schema });
  }
  return db;
}
