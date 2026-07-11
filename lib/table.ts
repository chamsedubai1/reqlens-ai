export type SortDir = "asc" | "desc";

// Compares two cell values for table sorting. Numbers sort numerically; strings
// use a natural (numeric-aware) locale compare so "STORY-2" < "STORY-10".
export function compareValues(
  a: string | number | null | undefined,
  b: string | number | null | undefined,
  dir: SortDir,
): number {
  const av = a ?? "";
  const bv = b ?? "";
  let r: number;
  if (typeof av === "number" && typeof bv === "number") {
    r = av - bv;
  } else {
    r = String(av).localeCompare(String(bv), undefined, { numeric: true, sensitivity: "base" });
  }
  return dir === "asc" ? r : -r;
}
