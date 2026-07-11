import { describe, it, expect } from "vitest";
import { buildReviewPrompt } from "@/lib/ai/prompt";
import type { ReviewInput } from "@/lib/ai/types";

const base: ReviewInput = {
  story: {
    title: "Transfer money to a saved beneficiary",
    userRole: "Retail banking customer",
    goal: "transfer money to a saved beneficiary",
    businessValue: "so payments are fast and secure",
    description: "As a customer I want to transfer money...",
    acceptanceCriteria: "User can pick a saved beneficiary.",
  },
  domain: { name: "Payments", description: "Fund transfers" },
  documents: [{ title: "Transfer Policy", contentText: "Transfers over 50000 require OTP." }],
};

describe("buildReviewPrompt", () => {
  it("includes the story title and fields", () => {
    const { user } = buildReviewPrompt(base);
    expect(user).toContain("Transfer money to a saved beneficiary");
    expect(user).toContain("Retail banking customer");
    expect(user).toContain("User can pick a saved beneficiary.");
  });
  it("includes the scoring model categories", () => {
    const { user } = buildReviewPrompt(base);
    expect(user).toContain("acceptanceCriteria");
    expect(user).toContain("investCompliance");
  });
  it("includes the domain name and document text", () => {
    const { user } = buildReviewPrompt(base);
    expect(user).toContain("Payments");
    expect(user).toContain("Transfers over 50000 require OTP.");
  });
  it("instructs the model not to invent references and to return JSON", () => {
    const { system } = buildReviewPrompt(base);
    expect(system.toLowerCase()).toContain("json");
    expect(system.toLowerCase()).toContain("do not invent");
  });
  it("states general-agile-only when there are no documents", () => {
    const { user } = buildReviewPrompt({ ...base, documents: [] });
    expect(user.toLowerCase()).toContain("general agile");
  });
});
