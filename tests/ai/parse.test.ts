import { describe, it, expect } from "vitest";
import { extractJsonObject } from "@/lib/ai/parse";

describe("extractJsonObject", () => {
  it("parses a plain JSON object", () => {
    expect(extractJsonObject('{"a":1}')).toEqual({ a: 1 });
  });

  it("parses a ```json fenced block (common with Qwen/open models)", () => {
    const content = 'Sure, here is the review:\n```json\n{"overallScore": 82}\n```';
    expect(extractJsonObject(content)).toEqual({ overallScore: 82 });
  });

  it("parses a bare fenced block without the json tag", () => {
    expect(extractJsonObject("```\n{\"b\": true}\n```")).toEqual({ b: true });
  });

  it("extracts the object when surrounded by prose", () => {
    const content = 'Here you go: {"c": [1,2,3]} — hope that helps!';
    expect(extractJsonObject(content)).toEqual({ c: [1, 2, 3] });
  });

  it("throws on content with no JSON object", () => {
    expect(() => extractJsonObject("no json here")).toThrow();
  });
});
