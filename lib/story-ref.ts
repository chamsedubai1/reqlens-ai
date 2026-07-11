// Human-readable story identifier, Jira-style: <PROJECT>-<n>, where PROJECT is
// the first three letters of the project name (e.g. "Mobile Banking App" -> MOB)
// and n is the per-tenant sequential `reference`. Falls back to a short UUID
// slice for stories created before the reference column existed.
export function projectPrefix(projectName: string | null | undefined): string {
  const letters = (projectName ?? "").replace(/[^A-Za-z]/g, "").slice(0, 3).toUpperCase();
  return letters || "STORY";
}

export function storyRef(
  reference: number | null | undefined,
  id: string,
  projectName?: string | null,
): string {
  if (reference == null) return `#${id.slice(0, 8)}`;
  return `${projectPrefix(projectName)}-${reference}`;
}
