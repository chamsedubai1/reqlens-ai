import { describe, it, expect } from "vitest";
import { storyRef, projectPrefix } from "@/lib/story-ref";

describe("projectPrefix", () => {
  it("takes the first three letters, uppercased", () => {
    expect(projectPrefix("Mobile Banking App")).toBe("MOB");
    expect(projectPrefix("Payments Platform")).toBe("PAY");
    expect(projectPrefix("Risk Mgmt")).toBe("RIS");
    expect(projectPrefix("Security")).toBe("SEC");
  });
  it("ignores non-letters and falls back to STORY", () => {
    expect(projectPrefix("42 - !")).toBe("STORY");
    expect(projectPrefix(null)).toBe("STORY");
  });
});

describe("storyRef", () => {
  it("formats as <PROJECT>-<n>", () => {
    expect(storyRef(42, "abc", "Mobile Banking App")).toBe("MOB-42");
    expect(storyRef(7, "abc", "Payments Platform")).toBe("PAY-7");
  });
  it("falls back to a short UUID when no reference exists", () => {
    expect(storyRef(null, "c447c652-f4e4-4456", "Mobile Banking App")).toBe("#c447c652");
    expect(storyRef(undefined, "abcdef1234567890", null)).toBe("#abcdef12");
  });
});
