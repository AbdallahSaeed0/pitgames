import type { GameMediaResponse, Trailer } from '../types';

function dedupeByUrl<T extends { url: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const it of items) {
    if (!it.url || seen.has(it.url)) continue;
    seen.add(it.url);
    out.push(it);
  }
  return out;
}

function dedupeTrailers(items: Trailer[]): Trailer[] {
  const seen = new Set<string>();
  const out: Trailer[] = [];
  for (const t of items) {
    const key = t.youtube_url || t.video_id || t.name || '';
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(t);
  }
  return out;
}

/** Merge SteamGridDB / API enrichment into DB-backed media without duplicate URLs. */
export function mergeGameMediaResponses(base: GameMediaResponse, enriched: GameMediaResponse): GameMediaResponse {
  return {
    covers: dedupeByUrl([...base.covers, ...enriched.covers]),
    artworks: dedupeByUrl([...base.artworks, ...enriched.artworks]),
    screenshots: dedupeByUrl([...base.screenshots, ...enriched.screenshots]),
    trailers: dedupeTrailers([...base.trailers, ...enriched.trailers]),
    logos: dedupeByUrl([...(base.logos || []), ...(enriched.logos || [])]),
    icons: dedupeByUrl([...(base.icons || []), ...(enriched.icons || [])]),
    stats: enriched.stats ?? base.stats,
  };
}
