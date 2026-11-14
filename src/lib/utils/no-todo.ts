/** Matches an internal "TODO(client): …" note left in catalog copy. */
const TODO = /\s*TODO\([^)]*\):[^.<]*\.?/g;

export const hasTodo = (s?: string | null) => !!s && /TODO\(/.test(s);

/**
 * Customer-facing copy without internal TODO notes. Returns undefined when nothing real is left,
 * so the block that shows it can hide.
 */
export function noTodo(s?: string | null): string | undefined {
  if (!s) return undefined;
  const out = s.replace(TODO, "").replace(/<p>\s*<\/p>/g, "").trim();
  return out && out.replace(/<[^>]+>/g, "").trim() ? out : undefined;
}
