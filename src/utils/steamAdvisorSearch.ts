/** Normalize titles for fuzzy matching (Performance Advisor search UX only). */

const EDITION_WORDS =
  /\b(deluxe|ultimate|complete|goty|game\s+of\s+the\s+year|remastered|remake|definitive|gold|premium)\b/gi;

export function normalizeGameTitle(s: string): string {
  let t = s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[''`´]/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ');
  t = t.replace(EDITION_WORDS, ' ');
  t = t.replace(/\bedition\b/gi, ' ');
  return t.replace(/\s+/g, ' ').trim();
}

function tokenSet(s: string): Set<string> {
  const n = normalizeGameTitle(s);
  return new Set(n.split(/\s+/).filter(Boolean));
}

/** Jaccard-like similarity 0..1 */
export function steamTitleSimilarity(queryNorm: string, candidateTitle: string): number {
  const a = tokenSet(queryNorm);
  const b = tokenSet(candidateTitle);
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const x of a) {
    if (b.has(x)) inter += 1;
  }
  const union = a.size + b.size - inter;
  let j = union > 0 ? inter / union : 0;
  const bn = normalizeGameTitle(candidateTitle);
  if (bn.includes(queryNorm) || queryNorm.includes(bn)) {
    j = Math.max(j, 0.72);
  }
  return j;
}

export function isValidSteamAppId(id: number | null | undefined): boolean {
  return typeof id === 'number' && Number.isFinite(id) && id > 0 && Number.isInteger(id);
}

/**
 * Auto-pick one Steam row when confidence is high; otherwise user must click.
 */
export function pickAutoSteamHit<T extends { title: string; steamAppId: number | null }>(
  query: string,
  steamHits: T[]
): T | null {
  const valid = steamHits.filter((h) => isValidSteamAppId(h.steamAppId));
  if (valid.length === 0) return null;
  const qRaw = query.trim();
  const q = normalizeGameTitle(qRaw);
  if (valid.length === 1) {
    return valid[0];
  }
  const scored = valid
    .map((h) => ({
      h,
      s: steamTitleSimilarity(q, h.title),
    }))
    .sort((a, b) => b.s - a.s);
  const best = scored[0];
  const second = scored[1];
  if (best.s >= 0.58 && (!second || best.s - second.s >= 0.12)) {
    return best.h;
  }
  return null;
}
