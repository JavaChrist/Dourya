/**
 * With Cache Components, generateStaticParams must return at least one param
 * (an empty list fails the build). On dourya.fr a list can be empty (e.g. no
 * collection once the demo ones are hidden): a placeholder slug is returned
 * instead, matches no record, so its page answers notFound() (404).
 */
export const PLACEHOLDER_SLUG = "__aucun__";

export function slugParams(slugs: readonly string[]): { slug: string }[] {
  return slugs.length > 0 ? slugs.map((slug) => ({ slug })) : [{ slug: PLACEHOLDER_SLUG }];
}
