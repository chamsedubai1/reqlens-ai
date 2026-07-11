// Extracts a JSON object from a model's text response. Robust to output that
// open-weight models (e.g. Qwen) commonly produce: ```json fenced blocks, or a
// JSON object with surrounding prose. Throws if no valid JSON object is found.
export function extractJsonObject(content: string): unknown {
  const trimmed = content.trim();

  // 1) Prefer a fenced ```json ... ``` (or ``` ... ```) block if present.
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = fence ? fence[1].trim() : trimmed;

  // 2) Otherwise take the outermost { ... } span.
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  const candidate = start !== -1 && end > start ? body.slice(start, end + 1) : body;

  return JSON.parse(candidate);
}
