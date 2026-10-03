export function slugify(text, fallback = 'page') {
  if (!text) return fallback;
  const slug = String(text)
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '');
  return slug || fallback;
}