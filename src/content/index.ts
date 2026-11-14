import { content, type ContentKind } from "./registry";

export { content, type ContentEntry, type ContentKind } from "./registry";


export function getEntry(kind: ContentKind, slug: string) {
  return content[kind].find((e) => e.slug === slug);
}

export async function loadMdx(kind: ContentKind, slug: string) {
  if (!getEntry(kind, slug)) return null;
  const mod = (await import(`./${kind}/${slug}.mdx`)) as { default: React.ComponentType };
  return mod.default;
}
