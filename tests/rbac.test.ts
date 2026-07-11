import { describe, it, expect } from "vitest";
import { can } from "@/lib/rbac";

describe("can()", () => {
  it("lets TENANT_ADMIN manage the tenant", () => {
    expect(can("TENANT_ADMIN", "manage_tenant")).toBe(true);
  });

  it("forbids PROJECT_MANAGER from managing the tenant", () => {
    expect(can("PROJECT_MANAGER", "manage_tenant")).toBe(false);
  });

  it("lets PROJECT_MANAGER create a project but not a domain", () => {
    expect(can("PROJECT_MANAGER", "create_project")).toBe(true);
    expect(can("PROJECT_MANAGER", "create_domain")).toBe(false);
  });

  it("lets BA_PO create and submit stories but not create projects", () => {
    expect(can("BA_PO", "create_story")).toBe(true);
    expect(can("BA_PO", "submit_review")).toBe(true);
    expect(can("BA_PO", "create_project")).toBe(false);
  });

  it("forbids VIEWER from creating stories but allows viewing", () => {
    expect(can("VIEWER", "create_story")).toBe(false);
    expect(can("VIEWER", "view_review")).toBe(true);
    expect(can("VIEWER", "view_personal_dashboard")).toBe(true);
  });

  it("restricts team dashboard to admins and project managers", () => {
    expect(can("TENANT_ADMIN", "view_team_dashboard")).toBe(true);
    expect(can("PROJECT_MANAGER", "view_team_dashboard")).toBe(true);
    expect(can("BA_PO", "view_team_dashboard")).toBe(false);
    expect(can("VIEWER", "view_team_dashboard")).toBe(false);
  });

  it("allows only admin and project manager to delete stories", () => {
    expect(can("TENANT_ADMIN", "delete_story")).toBe(true);
    expect(can("PROJECT_MANAGER", "delete_story")).toBe(true);
    expect(can("BA_PO", "delete_story")).toBe(false);
    expect(can("VIEWER", "delete_story")).toBe(false);
  });
});
