import { describe, it, expect } from "vitest";
import { compareValues } from "@/lib/table";

describe("compareValues", () => {
  it("sorts numbers numerically", () => {
    expect(compareValues(2, 10, "asc")).toBeLessThan(0);
    expect(compareValues(10, 2, "asc")).toBeGreaterThan(0);
    expect(compareValues(10, 2, "desc")).toBeLessThan(0);
  });
  it("sorts strings naturally (STORY-2 before STORY-10)", () => {
    const items = ["STORY-10", "STORY-2", "STORY-1"];
    expect([...items].sort((a, b) => compareValues(a, b, "asc"))).toEqual(["STORY-1", "STORY-2", "STORY-10"]);
  });
  it("honors direction", () => {
    const items = ["b", "a", "c"];
    expect([...items].sort((a, b) => compareValues(a, b, "desc"))).toEqual(["c", "b", "a"]);
  });
  it("treats null/undefined as empty", () => {
    expect(compareValues(null, "a", "asc")).toBeLessThan(0);
    expect(compareValues(undefined, undefined, "asc")).toBe(0);
  });
});
