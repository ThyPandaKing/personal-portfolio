/** Escape a user-supplied string for safe use inside a MongoDB $regex. */
export function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
