import React, { useEffect, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Search, ChevronLeft, ChevronRight, RefreshCw, SkipForward, Check } from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────

interface IgdbCover    { image_id: string; url: string; thumb_url: string; }
interface IgdbImage    { id: string; image_id: string; url: string; thumb_url: string; source: string; }
interface IgdbTrailer  { id: string; name: string; video_id: string; youtube_url: string; thumbnail_url: string; source: string; }
interface IgdbSimilarGame { id: number; name: string; cover?: IgdbCover; first_release_date?: number; rating?: number; }
interface IgdbTimeToBeat  { main_story: number | null; main_extras: number | null; completionist: number | null; }

export interface IgdbGame {
  igdb_id: number;
  title: string;
  summary: string | null;
  storyline: string | null;
  release_date: number | null;
  cover?: IgdbCover;
  rating: number | null;
  rating_count: number | null;
  total_rating: number | null;
  total_rating_count: number | null;
  genres: string[];
  platforms: string[];
  developers: string[];
  publishers: string[];
  similar_games: IgdbSimilarGame[];
  time_to_beat: IgdbTimeToBeat | null;
  artworks: IgdbImage[];
  screenshots: IgdbImage[];
  trailers: IgdbTrailer[];
}

interface Step2Props {
  guessedTitle: string;
  onBack: () => void;
  onNext: (metadata: IgdbGame | ManualGame) => void;
}

// A minimal game object used when the user skips IGDB lookup
export interface ManualGame {
  igdb_id: null;
  title: string;
  summary: null; storyline: null; release_date: null;
  cover: undefined; rating: null; rating_count: null;
  total_rating: null; total_rating_count: null;
  genres: []; platforms: []; developers: []; publishers: [];
  similar_games: []; time_to_beat: null;
  artworks: []; screenshots: []; trailers: [];
}

// ── Sub-components ────────────────────────────────────────────────────────────

const SkeletonCard: React.FC = () => (
  <div style={{
    display: 'flex', gap: 14, padding: 14,
    background: 'rgba(255,255,255,0.025)',
    border: '1.5px solid rgba(255,255,255,0.06)',
    borderRadius: 14,
  }}>
    <div className="wz-skel" style={{ width: 62, height: 88, flexShrink: 0 }} />
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 9, paddingTop: 4 }}>
      <div className="wz-skel" style={{ height: 13, width: '78%' }} />
      <div className="wz-skel" style={{ height: 11, width: '38%' }} />
      <div className="wz-skel" style={{ height: 11, width: '55%' }} />
      <div style={{ display: 'flex', gap: 5, marginTop: 2 }}>
        <div className="wz-skel" style={{ height: 18, width: 34, borderRadius: 20 }} />
        <div className="wz-skel" style={{ height: 18, width: 54, borderRadius: 20 }} />
      </div>
    </div>
  </div>
);

const StarRating: React.FC<{ rating: number }> = ({ rating }) => {
  const stars = Math.round(rating / 20); // 0-100 → 0-5
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
      {Array.from({ length: 5 }, (_, i) => (
        <span key={i} style={{
          fontSize: 11,
          color: i < stars ? '#fbbf24' : 'rgba(255,255,255,0.15)',
          lineHeight: 1,
        }}>★</span>
      ))}
      <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.38)', marginLeft: 3 }}>
        {(rating / 20).toFixed(1)}
      </span>
    </span>
  );
};

const PC_KEYWORDS = ['pc (microsoft windows)', 'windows', 'mac', 'linux', 'pc'];

const PlatformChips: React.FC<{ platforms: string[] }> = ({ platforms }) => {
  const lc = platforms.map(p => p.toLowerCase());
  const hasPC = lc.some(p => PC_KEYWORDS.some(k => p.includes(k)));
  const others = platforms
    .filter(p => !PC_KEYWORDS.some(k => p.toLowerCase().includes(k)))
    .slice(0, 2);

  return (
    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
      {hasPC && (
        <span style={{
          fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 20,
          background: 'rgba(var(--accent-rgb),0.14)', color: 'var(--accent)',
          border: '1px solid rgba(var(--accent-rgb),0.28)',
        }}>PC</span>
      )}
      {others.map(p => (
        <span key={p} style={{
          fontSize: 10, padding: '2px 7px', borderRadius: 20,
          background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.38)',
          border: '1px solid rgba(255,255,255,0.08)',
        }}>
          {p.length > 12 ? p.slice(0, 12) + '…' : p}
        </span>
      ))}
    </div>
  );
};

// ── Main component ────────────────────────────────────────────────────────────

const Step2SearchMetadata: React.FC<Step2Props> = ({ guessedTitle, onBack, onNext }) => {
  const [query, setQuery]     = useState(guessedTitle);
  const [results, setResults] = useState<IgdbGame[]>([]);
  const [selected, setSelected] = useState<IgdbGame | null>(null);
  const [loading, setLoading]   = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError]       = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const runSearch = async (q: string) => {
    const trimmed = q.trim();
    if (trimmed.length < 2) return;
    setLoading(true); setError(''); setResults([]); setSelected(null); setSearched(false);
    try {
      const games = await invoke<IgdbGame[]>('search_igdb_games', { query: trimmed });
      setResults(games);
      setSearched(true);
      if (games.length === 0) setError('No results found on IGDB.');
    } catch (e) {
      const msg = typeof e === 'string' ? e : e instanceof Error ? e.message : String(e);
      setError(
        msg.includes('IGDB') || msg.includes('Twitch') || msg.includes('Settings')
          ? msg
          : `Search failed: ${msg}. Check Settings → API Keys and add your IGDB credentials.`
      );
      setSearched(true);
    } finally { setLoading(false); }
  };

  // Debounced auto-search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.trim().length >= 2) {
      debounceRef.current = setTimeout(() => { void runSearch(query); }, 500);
    } else {
      setResults([]); setSearched(false); setError('');
    }
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query]);

  // Auto-search on mount when guessedTitle is provided
  useEffect(() => {
    if (guessedTitle) { setQuery(guessedTitle); }
  }, [guessedTitle]);

  const handleSkip = () => {
    const manual: ManualGame = {
      igdb_id: null, title: guessedTitle,
      summary: null, storyline: null, release_date: null,
      cover: undefined, rating: null, rating_count: null,
      total_rating: null, total_rating_count: null,
      genres: [], platforms: [], developers: [], publishers: [],
      similar_games: [], time_to_beat: null,
      artworks: [], screenshots: [], trailers: [],
    };
    onNext(manual);
  };

  const getYear = (g: IgdbGame) =>
    g.release_date ? new Date(g.release_date * 1000).getFullYear().toString() : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

      {/* ── Search bar ── */}
      <div style={{ position: 'relative' }}>
        <div style={{
          position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)',
          pointerEvents: 'none', color: 'rgba(255,255,255,0.3)',
        }}>
          {loading
            ? <RefreshCw size={15} style={{ animation: 'wz-spin 0.8s linear infinite' }} />
            : <Search size={15} />}
        </div>
        <input
          type="search"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && void runSearch(query)}
          placeholder="Search IGDB by game title…"
          style={{
            width: '100%', boxSizing: 'border-box',
            padding: '12px 14px 12px 42px',
            background: 'rgba(255,255,255,0.05)',
            border: '1.5px solid rgba(255,255,255,0.09)',
            borderRadius: 12, color: '#fff', fontSize: 14,
            outline: 'none', transition: 'border-color 0.2s',
          }}
          onFocus={e  => (e.currentTarget.style.borderColor = 'rgba(var(--accent-rgb),0.45)')}
          onBlur={e   => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.09)')}
        />
      </div>

      {/* ── Results / skeletons / error ── */}
      <div style={{
        overflowY: 'auto', maxHeight: 370,
        paddingRight: 4,
        scrollbarWidth: 'thin',
      }}>
        {loading ? (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {Array.from({ length: 6 }, (_, i) => <SkeletonCard key={i} />)}
          </div>
        ) : error ? (
          <div style={{
            padding: '24px 20px', textAlign: 'center', fontSize: 13,
            color: 'rgba(255,255,255,0.45)',
            background: 'rgba(239,68,68,0.06)',
            border: '1px solid rgba(239,68,68,0.15)',
            borderRadius: 12,
          }}>
            {error}
          </div>
        ) : results.length > 0 ? (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {results.map(game => {
              const isSel = selected?.igdb_id === game.igdb_id;
              const year  = getYear(game);
              return (
                <div
                  key={game.igdb_id}
                  className={`wz-card${isSel ? ' wz-card--selected' : ''}`}
                  onClick={() => setSelected(isSel ? null : game)}
                  style={{
                    display: 'flex', gap: 14, padding: 14, position: 'relative',
                    background: isSel ? 'rgba(var(--accent-rgb),0.1)' : 'rgba(255,255,255,0.03)',
                    border: `1.5px solid ${isSel ? 'var(--accent)' : 'rgba(255,255,255,0.07)'}`,
                    borderRadius: 14,
                  }}
                >
                  {/* Cover */}
                  <div style={{
                    width: 62, minWidth: 62, height: 88,
                    borderRadius: 8, overflow: 'hidden', flexShrink: 0,
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.06)',
                  }}>
                    {game.cover?.url && (
                      <img
                        src={game.cover.url} alt=""
                        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                        onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                      />
                    )}
                  </div>

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 5 }}>
                    <div style={{
                      fontWeight: 700, fontSize: 13, color: '#fff',
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                      paddingRight: isSel ? 22 : 0,
                    }}>
                      {game.title}
                    </div>

                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.38)' }}>
                      {year ?? 'TBA'}
                    </div>

                    {game.rating != null && (
                      <StarRating rating={game.rating} />
                    )}

                    {game.platforms?.length > 0 && (
                      <PlatformChips platforms={game.platforms} />
                    )}
                  </div>

                  {/* Selected badge */}
                  {isSel && (
                    <div style={{
                      position: 'absolute', top: 10, right: 10,
                      width: 20, height: 20, borderRadius: '50%',
                      background: 'var(--accent)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0,
                    }}>
                      <Check size={11} strokeWidth={3.5} color="var(--accent-on-fill, #000)" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : searched && !loading ? (
          <div style={{
            textAlign: 'center', padding: '32px 20px',
            fontSize: 13, color: 'rgba(255,255,255,0.35)',
          }}>
            No results for "{query.trim()}" — try the exact title from Steam or IGDB.
          </div>
        ) : query.trim().length < 2 ? (
          <div style={{
            textAlign: 'center', padding: '32px 20px',
            fontSize: 13, color: 'rgba(255,255,255,0.3)',
          }}>
            Start typing to search IGDB…
          </div>
        ) : null}
      </div>

      {/* ── Selection indicator ── */}
      {selected && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '10px 14px', borderRadius: 10,
          background: 'rgba(var(--accent-rgb),0.08)',
          border: '1px solid rgba(var(--accent-rgb),0.2)',
          fontSize: 13,
        }}>
          <Check size={14} style={{ color: 'var(--accent)', flexShrink: 0 }} />
          <span style={{ color: 'rgba(255,255,255,0.7)' }}>
            Selected: <strong style={{ color: '#fff' }}>{selected.title}</strong>
          </span>
        </div>
      )}

      {/* ── Navigation ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 2 }}>
        <button type="button" onClick={onBack} className="wz-nav-btn wz-nav-btn--secondary">
          <ChevronLeft size={16} /> Back
        </button>

        <div style={{ display: 'flex', gap: 10 }}>
          <button
            type="button"
            onClick={handleSkip}
            className="wz-nav-btn wz-nav-btn--secondary"
            title="Add without IGDB metadata"
            style={{ gap: 6 }}
          >
            <SkipForward size={14} /> Skip
          </button>
          <button
            type="button"
            disabled={!selected}
            onClick={() => selected && onNext(selected)}
            className="wz-nav-btn wz-nav-btn--primary"
          >
            Next <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default Step2SearchMetadata;
