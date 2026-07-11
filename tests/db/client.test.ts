import { describe, it, expect } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { sql } from "drizzle-orm";

describe("db stack connectivity", () => {
  it("runs a query through Drizzle on an in-memory PGlite database", async () => {
    const client = new PGlite();
    const db = drizzle(client);
    const rows = await db.execute(sql`select 1 as one`);
    // PGlite returns rows on the `.rows` property.
    expect(rows.rows[0]).toEqual({ one: 1 });
    await client.close();
  });
});
