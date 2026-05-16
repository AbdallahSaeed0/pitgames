import React, { useCallback, useEffect, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import SafeImage from '../components/common/SafeImage';
import GameCompatibilityModal from '../components/common/GameCompatibilityModal';
import { useToast } from '../hooks/useToast';
import type { FullGameData } from '../types';
import { isValidSteamAppId } from '../utils/steamAdvisorSearch';
import {
  ChevronLeft, Search, Cpu,
  ShieldCheck, RefreshCw, Gamepad2,
} from 'lucide-react';

interface AdvisorSearchHit {
  source: string;
  title: string;
  steamAppId: number | null;
  coverUrl: string | null;
}

interface PerformanceAdvisorProps {
  seedGameId: number | null;
  onClearSeed: () => void;
  onBack: () => void;
  onGoSettings: () => void;
}

function mapAdvisorError(e: unknown): string {
  const msg = String(e);
  if (/invalid args.*steamAppId|missing required key.*steamAppId/i.test(msg)) return 'Please select a game first.';
  if (msg.includes('No active hardware') || msg.includes('active hardware profile')) return 'Scan your PC first in Settings → Hardware Profile.';
  if (msg.includes('Requirements not loaded')) return 'Fetch requirements first, then compare.';
  return msg;
}

// ── Main page ────────────────────────────────────────────────────────────────

const PerformanceAdvisor: React.FC<PerformanceAdvisorProps> = ({
  seedGameId, onClearSeed, onBack, onGoSettings,
}) => {
  const { showError } = useToast();
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<AdvisorSearchHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [hasProfile, setHasProfile] = useState<boolean | null>(null);
  const [selectedHit, setSelectedHit] = useState<AdvisorSearchHit | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadHasProfile = useCallback(async () => {
    try {
      const rows = await invoke<Array<{ isActive?: boolean }>>('list_hardware_profiles');
      setHasProfile(rows.length > 0 && rows.some((r) => r.isActive));
    } catch { setHasProfile(false); }
  }, []);

  useEffect(() => { void loadHasProfile(); }, [loadHasProfile]);

  const runSearch = useCallback(async (q: string) => {
    const trimmed = q.trim();
    if (trimmed.length < 2) { setHits([]); return; }
    setSearching(true);
    try {
      const res = await invoke<AdvisorSearchHit[]>('search_performance_advisor_games', { query: trimmed });
      setHits(res);
    } catch (e) { showError(mapAdvisorError(e)); }
    finally { setSearching(false); }
  }, [showError]);

  // Debounced auto-search as user types
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (query.trim().length < 2) { setHits([]); return; }
    debounceRef.current = setTimeout(() => { void runSearch(query); }, 350);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, runSearch]);

  // Seed game from library
  useEffect(() => {
    if (seedGameId == null) return;
    let cancelled = false;
    (async () => {
      try {
        const game = await invoke<FullGameData>('get_game_full', { id: seedGameId });
        if (!cancelled) {
          setSelectedHit({ source: 'steam', title: game.title, steamAppId: (game as any).steamAppId ?? null, coverUrl: null });
        }
      } catch (e) { if (!cancelled) showError(mapAdvisorError(e)); }
      finally { onClearSeed(); }
    })();
    return () => { cancelled = true; };
  }, [seedGameId, onClearSeed, showError]);

  return (
    <div className="premium-page">
      {/* Page header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 32 }}>
        <button type="button" className="btn btn-secondary" onClick={onBack}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', flexShrink: 0 }}>
          <ChevronLeft size={15} /> Back
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 14, flexShrink: 0,
            background: 'rgba(var(--accent-rgb),0.12)',
            border: '1px solid rgba(var(--accent-rgb),0.22)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--accent)',
          }}>
            <ShieldCheck size={20} />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 900, letterSpacing: '-0.5px', lineHeight: 1.15 }}>Can I Run It?</h1>
            <p style={{ margin: 0, fontSize: 12, color: 'rgba(255,255,255,0.38)', marginTop: 3 }}>
              Check any game's Steam requirements against your hardware specs
            </p>
          </div>
        </div>
      </div>

      {/* No hardware profile — onboarding card */}
      {hasProfile === false && (
        <div style={{
          borderRadius: 16, marginBottom: 20,
          background: 'rgba(251,191,36,0.05)',
          border: '1px solid rgba(251,191,36,0.22)',
          overflow: 'hidden',
        }}>
          {/* Card header */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '12px 18px',
            background: 'rgba(251,191,36,0.09)',
            borderBottom: '1px solid rgba(251,191,36,0.14)',
          }}>
            <Cpu size={17} style={{ color: '#fbbf24', flexShrink: 0 }} />
            <span style={{ fontWeight: 800, fontSize: 14, color: '#fbbf24' }}>
              Hardware scan required to check compatibility
            </span>
          </div>
          {/* Steps */}
          <div style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
              <div style={{
                width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                background: 'rgba(251,191,36,0.18)', border: '1px solid rgba(251,191,36,0.35)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 11, fontWeight: 900, color: '#fbbf24',
              }}>1</div>
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)', lineHeight: 1.5, paddingTop: 2 }}>
                <strong style={{ color: 'rgba(255,255,255,0.9)', fontWeight: 700 }}>Go to Profile → Scan My PC</strong>
                <br />
                <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: 12 }}>
                  This detects your CPU, GPU, and RAM so we can compare them against game requirements.
                </span>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
              <div style={{
                width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                background: 'rgba(251,191,36,0.18)', border: '1px solid rgba(251,191,36,0.35)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 11, fontWeight: 900, color: '#fbbf24',
              }}>2</div>
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)', lineHeight: 1.5, paddingTop: 2 }}>
                <strong style={{ color: 'rgba(255,255,255,0.9)', fontWeight: 700 }}>Come back here to check any game</strong>
                <br />
                <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: 12 }}>
                  Search any PC game and get a detailed hardware compatibility report instantly.
                </span>
              </div>
            </div>
            <div style={{ marginTop: 4 }}>
              <button
                type="button" className="btn btn-secondary"
                style={{ flexShrink: 0, fontSize: 13, padding: '8px 18px', display: 'inline-flex', alignItems: 'center', gap: 7 }}
                onClick={onGoSettings}
              >
                <Cpu size={14} /> Go to Profile
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Search bar */}
      <div style={{ position: 'relative', marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ flex: 1, position: 'relative' }}>
            {searching
              ? <RefreshCw size={15} style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', opacity: 0.4, animation: 'spin 0.8s linear infinite', pointerEvents: 'none' }} />
              : <Search size={15} style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', opacity: 0.3, pointerEvents: 'none' }} />
            }
            <input
              type="search" value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && void runSearch(query)}
              placeholder="Start typing a game name… results appear automatically"
              style={{
                width: '100%', boxSizing: 'border-box',
                padding: '12px 14px 12px 40px',
                borderRadius: 12,
                border: '1px solid rgba(255,255,255,0.1)',
                background: 'rgba(255,255,255,0.05)',
                color: '#fff', fontSize: 14,
              }}
            />
          </div>
        </div>

        {/* Dropdown results */}
        {hits.length > 0 && (
          <div style={{
            position: 'absolute', top: 'calc(100% + 8px)', left: 0, right: 0,
            background: 'rgba(12,12,17,0.99)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 16, zIndex: 100,
            boxShadow: '0 16px 48px rgba(0,0,0,0.65)',
            overflow: 'hidden',
          }}>
            {/* Results header */}
            <div style={{ padding: '10px 16px 8px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1.2px', color: 'rgba(255,255,255,0.28)' }}>
                {hits.length} result{hits.length !== 1 ? 's' : ''} from Steam
              </span>
              <button type="button" onClick={() => setHits([])} style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                ✕ Close
              </button>
            </div>
            <div style={{ maxHeight: 380, overflowY: 'auto' }}>
              {hits.map((h, i) => {
                const valid = isValidSteamAppId(h.steamAppId);
                return (
                  <button
                    key={`${h.steamAppId ?? i}-${h.title}`}
                    type="button"
                    onClick={() => { setSelectedHit(h); setHits([]); }}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center', gap: 14,
                      padding: '12px 16px', textAlign: 'left',
                      border: 'none', borderBottom: '1px solid rgba(255,255,255,0.04)',
                      background: 'transparent', color: '#fff', cursor: 'pointer',
                      transition: 'background 0.15s',
                    }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)'; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                  >
                    {/* Game cover (portrait) */}
                    <div style={{ width: 42, height: 56, borderRadius: 8, flexShrink: 0, overflow: 'hidden', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.07)', display: 'grid', placeItems: 'center' }}>
                      {h.coverUrl
                        ? <SafeImage src={h.coverUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        : <Gamepad2 size={18} style={{ opacity: 0.2 }} />}
                    </div>
                    {/* Text */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginBottom: 4 }}>{h.title}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', fontFamily: 'monospace' }}>
                          App {h.steamAppId ?? '—'}
                        </span>
                        <span style={{
                          fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em',
                          padding: '1px 7px', borderRadius: 20,
                          background: 'rgba(24,140,226,0.14)', color: '#4db8ff',
                          border: '1px solid rgba(24,140,226,0.2)',
                        }}>Steam</span>
                      </div>
                    </div>
                    {/* Compatibility indicator */}
                    {valid
                      ? <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
                          <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#4ade80', boxShadow: '0 0 8px #4ade80' }} />
                          <span style={{ fontSize: 10, color: '#4ade80', fontWeight: 700 }}>PC Reqs</span>
                        </div>
                      : <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'rgba(255,255,255,0.18)', flexShrink: 0 }} title="No PC requirements found" />
                    }
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {query.trim().length >= 2 && !searching && hits.length === 0 && (
          <div style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0, background: 'rgba(16,16,20,0.98)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '14px 16px', fontSize: 13, color: 'rgba(255,255,255,0.45)', zIndex: 100 }}>
            No Steam results found for "{query.trim()}". Try the exact title from the Steam store.
          </div>
        )}
      </div>

      {/* Selected game preview (after closing dropdown) */}
      {selectedHit && hits.length === 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 16,
          padding: '14px 18px',
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 16, marginBottom: 0,
        }}>
          {/* Cover */}
          <div style={{ width: 52, height: 70, borderRadius: 10, overflow: 'hidden', flexShrink: 0, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', display: 'grid', placeItems: 'center' }}>
            {selectedHit.coverUrl
              ? <SafeImage src={selectedHit.coverUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : <Gamepad2 size={22} style={{ opacity: 0.2 }} />}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 800, fontSize: 16, color: '#fff', marginBottom: 5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{selectedHit.title}</div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', fontFamily: 'monospace' }}>App {selectedHit.steamAppId}</span>
              <span style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', padding: '1px 7px', borderRadius: 20, background: 'rgba(24,140,226,0.14)', color: '#4db8ff', border: '1px solid rgba(24,140,226,0.2)' }}>Steam</span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
            <button type="button" onClick={() => { setSelectedHit(null); setQuery(''); }}
              style={{ padding: '8px 14px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>
              Clear
            </button>
            <button type="button" className="btn btn-primary"
              onClick={() => setSelectedHit({ ...selectedHit })}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 13, padding: '8px 18px' }}>
              <ShieldCheck size={14} /> Check Compatibility
            </button>
          </div>
        </div>
      )}

      {/* Hint when nothing is selected */}
      {!selectedHit && hits.length === 0 && query.trim().length < 2 && (
        <div style={{ textAlign: 'center', padding: '80px 0 60px', color: 'rgba(255,255,255,0.2)' }}>
          <div style={{
            width: 72, height: 72, borderRadius: 20, margin: '0 auto 20px',
            background: 'rgba(var(--accent-rgb),0.07)',
            border: '1px solid rgba(var(--accent-rgb),0.15)',
            display: 'grid', placeItems: 'center',
          }}>
            <ShieldCheck size={32} style={{ color: 'var(--accent)', opacity: 0.5 }} />
          </div>
          <div style={{ fontSize: 17, fontWeight: 800, marginBottom: 8, color: 'rgba(255,255,255,0.45)' }}>Search any PC game</div>
          <div style={{ fontSize: 13, lineHeight: 1.6, maxWidth: 340, margin: '0 auto' }}>
            Search any PC game by name — results appear instantly as you type.<br />
            Click a result to see a detailed hardware compatibility report.
          </div>
        </div>
      )}

      {/* Modal */}
      {selectedHit && (
        <GameCompatibilityModal
          hit={selectedHit}
          hasProfile={hasProfile}
          onClose={() => setSelectedHit(null)}
          onGoSettings={onGoSettings}
        />
      )}
    </div>
  );
};

export default PerformanceAdvisor;
