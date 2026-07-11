// Demo seed for local/dev use. Plain Node script (no TypeScript, no app imports) so it
// can run against any Postgres reachable via DATABASE_URL without a build step.
//
// Usage: npm run db:seed
import pg from "pg";
import bcrypt from "bcryptjs";
import { randomUUID } from "node:crypto";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: url });

const email = "demo@reqlens.test";
const passwordHash = await bcrypt.hash("password123", 10);
const tenantId = randomUUID();
const userId = randomUUID();

const client = await pool.connect();
try {
  await client.query("begin");

  await client.query("insert into tenants (id, name) values ($1, $2)", [
    tenantId,
    "Demo Org",
  ]);

  await client.query(
    "insert into user_profiles (id, tenant_id, full_name, email, password_hash, role) values ($1,$2,$3,$4,$5,$6)",
    [userId, tenantId, "Demo Admin", email, passwordHash, "TENANT_ADMIN"],
  );

  const projectId = randomUUID();
  await client.query(
    "insert into projects (id, tenant_id, name, created_by) values ($1,$2,$3,$4)",
    [projectId, tenantId, "Mobile Banking App", userId],
  );

  const domainId = randomUUID();
  await client.query(
    "insert into business_domains (id, tenant_id, name, description, created_by) values ($1,$2,$3,$4,$5)",
    [domainId, tenantId, "Payments", "Fund transfers and limits", userId],
  );

  await client.query(
    "insert into domain_documents (id, tenant_id, domain_id, title, content_text, processing_status, uploaded_by) values ($1,$2,$3,$4,$5,$6,$7)",
    [
      randomUUID(),
      tenantId,
      domainId,
      "Transfer Policy",
      "Transfers above 50000 require OTP. Daily limit is 200000.",
      "PROCESSED",
      userId,
    ],
  );

  await client.query("commit");
  console.log(`Seeded. Login: ${email} / password123`);
} catch (e) {
  await client.query("rollback");
  throw e;
} finally {
  client.release();
  await pool.end();
}
