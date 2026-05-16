/** Chosen library game id → that game's `cover_url` is a Home hero fallback. */
export const HOME_HERO_BG_KEY = 'pitgames.homeHeroGameId';
/** User-picked wide hero image URL (IGDB / SteamGridDB / library asset). */
export const HOME_HERO_CUSTOM_URL_KEY = 'pitgames.homeHeroCustomImageUrl';
/** @deprecated migrated once at runtime */
const LEGACY_PATH_KEY = 'pitgames.homeHeroBackgroundPath';

export const HOME_HERO_BG_CHANGED_EVENT = 'pitgames-home-hero-bg-changed';

export type LibraryGameTuple = [number, string, string | null, unknown?];

export function readStoredHeroGameId(): number | null {
  try {
    const raw = localStorage.getItem(HOME_HERO_BG_KEY);
    if (!raw) return null;
    const o = JSON.parse(raw) as { gameId?: number };
    if (typeof o.gameId === 'number' && Number.isFinite(o.gameId)) return o.gameId;
  } catch {
    /* ignore */
  }
  return null;
}

export function writeStoredHeroGameId(gameId: number | null) {
  if (gameId == null) localStorage.removeItem(HOME_HERO_BG_KEY);
  else localStorage.setItem(HOME_HERO_BG_KEY, JSON.stringify({ gameId }));
}

export function readHomeHeroCustomImageUrl(): string | null {
  try {
    const raw = localStorage.getItem(HOME_HERO_CUSTOM_URL_KEY);
    if (!raw) return null;
    const o = JSON.parse(raw) as { url?: string };
    if (typeof o.url === 'string' && o.url.trim().length > 8) return o.url.trim();
  } catch {
    /* ignore */
  }
  return null;
}

export function writeHomeHeroCustomImageUrl(url: string | null) {
  if (url == null || url.trim() === '') localStorage.removeItem(HOME_HERO_CUSTOM_URL_KEY);
  else localStorage.setItem(HOME_HERO_CUSTOM_URL_KEY, JSON.stringify({ url: url.trim() }));
}

/** Clear custom image + pinned game cover; Home uses automatic fallbacks. */
export function resetHomeHeroToAuto() {
  localStorage.removeItem(HOME_HERO_CUSTOM_URL_KEY);
  localStorage.removeItem(HOME_HERO_BG_KEY);
}

export function migrateLegacyHeroBackgroundPath(library: LibraryGameTuple[]) {
  try {
    const raw = localStorage.getItem(LEGACY_PATH_KEY);
    if (!raw) return;
    const o = JSON.parse(raw) as { path?: string };
    localStorage.removeItem(LEGACY_PATH_KEY);
    const path = o.path;
    if (!path) return;
    const row = library.find((g) => g[2] === path);
    if (row) {
      writeStoredHeroGameId(row[0]);
      window.dispatchEvent(new CustomEvent(HOME_HERO_BG_CHANGED_EVENT));
    }
  } catch {
    /* ignore */
  }
}

export function notifyHomeHeroBgChanged() {
  window.dispatchEvent(new CustomEvent(HOME_HERO_BG_CHANGED_EVENT));
}

/** ~16:9 … ~21:9 for hero strips; excludes portrait covers when dimensions exist. */
export function isWideHeroAspect(width?: number | null, height?: number | null, url?: string): boolean {
  if (width && height && width > 0 && height > 0) {
    const r = width / height;
    return r >= 1.45 && r <= 3.85;
  }
  if (url) {
    const u = url.toLowerCase();
    if (u.includes('t_cover') || u.includes('cover_big') || u.includes('cover_small')) return false;
    if (
      u.includes('screenshot') ||
      u.includes('1080p') ||
      u.includes('artwork') ||
      u.includes('hero') ||
      u.includes('steamgriddb.com') ||
      u.includes('/heroes/')
    )
      return true;
  }
  return false;
}
