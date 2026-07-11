// Tiny classnames joiner — no dependency. Filters falsy values and joins.
export function clsx(
  ...parts: Array<string | false | null | undefined>
): string {
  return parts.filter(Boolean).join(" ");
}
