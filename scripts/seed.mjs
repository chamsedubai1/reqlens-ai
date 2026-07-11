// Seeds a rich demo workspace (idempotent — resets the "Demo Org" tenant first)
// so the dashboard, projects, and admin pages look populated.
// Plain Node script (no app imports). Usage: npm run db:seed  (needs DATABASE_URL)
import pg from "pg";
import bcrypt from "bcryptjs";
import { randomUUID } from "node:crypto";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}
const pool = new pg.Pool({ connectionString: url });
const passwordHash = await bcrypt.hash("password123", 10);

const daysAgo = (n) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
};
const readiness = (s) => (s >= 90 ? "Excellent" : s >= 80 ? "Ready" : s >= 65 ? "Needs Improvement" : "Not Ready");
const MAX = { roleClarity: 10, businessValue: 15, functionalClarity: 15, acceptanceCriteria: 20, invest: 20, edgeCases: 10, testability: 10 };
const clamp = (v, m) => Math.max(0, Math.min(m, Math.round(v)));
function catsFor(final, weakAcc, weakEdge) {
  const f = final / 100;
  return {
    roleClarity: clamp(MAX.roleClarity * f * 1.05, MAX.roleClarity),
    businessValue: clamp(MAX.businessValue * f * 1.0, MAX.businessValue),
    functionalClarity: clamp(MAX.functionalClarity * f * 0.95, MAX.functionalClarity),
    acceptanceCriteria: clamp(MAX.acceptanceCriteria * f * (weakAcc ? 0.55 : 0.92), MAX.acceptanceCriteria),
    invest: clamp(MAX.invest * f * 1.0, MAX.invest),
    edgeCases: clamp(MAX.edgeCases * f * (weakEdge ? 0.45 : 0.85), MAX.edgeCases),
    testability: clamp(MAX.testability * f * 0.85, MAX.testability),
  };
}

const USERS = [
  { key: "admin", name: "Demo Admin", email: "demo@reqlens.test", role: "TENANT_ADMIN" },
  { key: "anita", name: "Anita Verma", email: "anita@demo.test", role: "BA_PO" },
  { key: "rohit", name: "Rohit Mehra", email: "rohit@demo.test", role: "BA_PO" },
  { key: "neha", name: "Neha Iyer", email: "neha@demo.test", role: "PROJECT_MANAGER" },
  { key: "sandeep", name: "Sandeep Rao", email: "sandeep@demo.test", role: "BA_PO" },
  { key: "vikram", name: "Vikram Singh", email: "vikram@demo.test", role: "BA_PO" },
];
const PROJECTS = ["Mobile Banking App", "Payments Platform", "Security", "Risk Mgmt", "Accounts"];
const DOMAINS = ["Payments", "Security", "Risk Management", "Accounts", "Onboarding"];

// [title, project, domain, ownerKey, first, final, weakAcc, weakEdge, dayAgo]
const STORIES = [
  ["Fund transfer to another bank", "Mobile Banking App", "Payments", "anita", 55, 88, false, false, 28],
  ["Beneficiary management", "Mobile Banking App", "Payments", "rohit", 60, 90, false, false, 26],
  ["Login with biometric", "Mobile Banking App", "Security", "neha", 58, 85, false, true, 24],
  ["Transaction limit setup", "Risk Mgmt", "Risk Management", "sandeep", 52, 78, true, true, 22],
  ["Account statement download", "Accounts", "Accounts", "vikram", 66, 92, false, false, 20],
  ["Scheduled payments", "Payments Platform", "Payments", "anita", 62, 84, true, false, 18],
  ["Card freeze / unfreeze", "Security", "Security", "rohit", 57, 80, false, true, 16],
  ["KYC re-verification", "Accounts", "Onboarding", "neha", 64, 86, false, false, 14],
  ["Fraud alert notifications", "Security", "Security", "sandeep", 59, 72, true, true, 12],
  ["Loan eligibility check", "Risk Mgmt", "Risk Management", "vikram", 68, 88, false, false, 10],
  ["Standing instructions", "Payments Platform", "Payments", "anita", 70, 90, false, false, 8],
  ["Statement dispute flow", "Accounts", "Accounts", "rohit", 61, 76, true, false, 6],
  ["Device management", "Mobile Banking App", "Security", "neha", 72, 91, false, false, 4],
  ["Bill payments", "Payments Platform", "Payments", "sandeep", 74, 93, false, false, 3],
  ["Spending insights", "Mobile Banking App", "Accounts", "vikram", 76, 89, false, true, 1],
];

const client = await pool.connect();
try {
  await client.query("begin");

  const existing = await client.query("select id from tenants where name = $1", ["Demo Org"]);
  for (const { id: tid } of existing.rows) {
    for (const t of ["story_reviews", "user_stories", "domain_documents", "business_domains", "projects", "audit_logs", "user_profiles"]) {
      await client.query(`delete from ${t} where tenant_id = $1`, [tid]);
    }
    await client.query("delete from tenants where id = $1", [tid]);
  }

  const tenantId = randomUUID();
  await client.query("insert into tenants (id, name) values ($1, $2)", [tenantId, "Demo Org"]);

  const userIds = {};
  for (const u of USERS) {
    userIds[u.key] = randomUUID();
    await client.query(
      "insert into user_profiles (id, tenant_id, full_name, email, password_hash, role) values ($1,$2,$3,$4,$5,$6)",
      [userIds[u.key], tenantId, u.name, u.email, passwordHash, u.role],
    );
  }

  const projectIds = {};
  for (const name of PROJECTS) {
    projectIds[name] = randomUUID();
    await client.query("insert into projects (id, tenant_id, name, created_by) values ($1,$2,$3,$4)", [projectIds[name], tenantId, name, userIds.admin]);
  }
  const domainIds = {};
  for (const name of DOMAINS) {
    domainIds[name] = randomUUID();
    await client.query("insert into business_domains (id, tenant_id, name, description, created_by) values ($1,$2,$3,$4,$5)", [domainIds[name], tenantId, name, `${name} domain reference`, userIds.admin]);
  }
  await client.query(
    "insert into domain_documents (id, tenant_id, domain_id, title, content_text, processing_status, uploaded_by) values ($1,$2,$3,$4,$5,$6,$7)",
    [randomUUID(), tenantId, domainIds["Payments"], "Transfer Policy", "Transfers above 50,000 require OTP. Daily transfer limit is 200,000.", "PROCESSED", userIds.admin],
  );

  let ref = 0;
  for (const [title, project, domain, owner, first, final, weakAcc, weakEdge, day] of STORIES) {
    const storyId = randomUUID();
    const ownerId = userIds[owner];
    ref += 1;
    await client.query(
      `insert into user_stories (id, reference, tenant_id, project_id, domain_id, title, user_role, goal, business_value, description, status, created_by, created_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'REVIEWED',$11,$12)`,
      [storyId, ref, tenantId, projectIds[project], domainIds[domain], title, "Retail banking customer", `use ${title.toLowerCase()}`, "it is fast and secure", `As a customer, I want to ${title.toLowerCase()}.`, ownerId, daysAgo(day)],
    );
    const c = catsFor(final, weakAcc, weakEdge);
    const gap = final - first;
    const weak = [];
    if (weakAcc) weak.push("Acceptance Criteria");
    if (weakEdge) weak.push("Edge Cases");
    if (weak.length === 0) weak.push("Testability");
    await client.query(
      `insert into story_reviews (id, tenant_id, project_id, domain_id, story_id, user_id,
        first_submission_score, final_score, improvement_gap, ai_dependency_level, readiness_status,
        role_clarity_score, business_value_score, functional_clarity_score, acceptance_criteria_score,
        invest_score, edge_case_score, testability_score, domain_alignment_score,
        strengths, weaknesses, missing_domain_rules, domain_specific_risks, improved_user_story,
        improved_acceptance_criteria, suggested_business_rules, suggested_edge_cases, referenced_documents,
        recommendation, created_at)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30)`,
      [
        randomUUID(), tenantId, projectIds[project], domainIds[domain], storyId, ownerId,
        first, final, gap, gap >= 20 ? "High" : gap >= 10 ? "Medium" : "Low", readiness(final),
        c.roleClarity, c.businessValue, c.functionalClarity, c.acceptanceCriteria,
        c.invest, c.edgeCases, c.testability, domain === "Payments" ? 90 : 74,
        JSON.stringify(["Clear user role", "Business value is articulated"]),
        JSON.stringify(weak), JSON.stringify([]), JSON.stringify(["Verify limits against policy"]),
        `As a Retail banking customer, I want to ${title.toLowerCase()} so that it is fast and secure.`,
        JSON.stringify(["Given valid input, when the action is performed, then the expected outcome occurs"]),
        JSON.stringify(["Apply thresholds from the referenced documents"]),
        JSON.stringify(["What happens on invalid input?", "What happens when a limit is exceeded?"]),
        JSON.stringify(["Transfer Policy"]),
        final >= 80 ? "Ready with minor improvements." : "Needs improvement before sprint planning.",
        daysAgo(day),
      ],
    );
  }

  await client.query("commit");
  console.log(`Seeded ${STORIES.length} reviewed stories across ${PROJECTS.length} projects and ${USERS.length} users.`);
  console.log("Login: demo@reqlens.test / password123");
} catch (e) {
  await client.query("rollback");
  throw e;
} finally {
  client.release();
  await pool.end();
}
