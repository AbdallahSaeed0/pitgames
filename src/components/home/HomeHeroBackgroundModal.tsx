import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { getFileUrl } from '../../utils/fileUtils';
import {
  isWideHeroAspect,
  notifyHomeHeroBgChanged,
  readHomeHeroCustomImageUrl,
  readStoredHeroGameId,
  writeHomeHeroCustomImageUrl,
  writeStoredHeroGameId,
} from '../../utils/homeHeroBackground';
import ActionButton from '../common/ActionButton';
import GlassCard from '../common/GlassCard';
import SafeImage from '../common/SafeImage';
import { CheckCircle2, Loader2, Sparkles, X } from 'lucide-react';

export type HomeHeroCandidate = {
  url: string;
  thumb_url: string;
  source: string;
  game_id: number;
  game_title: string;
  width?: number | null;
  height?: number | null;
};

interface HomeHeroBackgroundModalProps {
  libraryGames: [number, string, string | null, number | null][];
  onClose: () => void;
  onApplied: () => void;
}

const HomeHeroBackgroundModal: React.FC<HomeHeroBackgroundModalProps> = ({
  libraryGames,
  onClose,
  onApplied,
}) => {
  const [loading, setLoading] = useState(true);
  const [includeSgdb, setIncludeSgdb] = useState(false);
  const [candidates, setCandidates] = useState<HomeHeroCandidate[]>([]);
  const [selectedUrl, setSelectedUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const currentCustom = readHomeHeroCustomImageUrl();
  const currentGameId = readStoredHeroGameId();

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await invoke<HomeHeroCandidate[]>('list_home_hero_candidate_images', {
        includeSteamgriddb: includeSgdb,
      });
      setCandidates(rows);
    } catch (e) {
      setError(String(e));
      setCandidates([]);
    } finally {
      setLoading(false);
    }
  }, [includeSgdb]);

  useEffect(() => {
    void load();
  }, [load]);

  const wideCandidates = useMemo(() => {
    const extras: HomeHeroCandidate[] = [];
    if (currentCustom) {
      extras.push({
        url: currentCustom,
        thumb_url: currentCustom,
        source: 'current_selection',
        game_id: -1,
        game_title: 'Current background',
      });
    }
    for (const g of libraryGames) {
      const gid = g[0];
      const gtitle = g[1];
      const cover = g[2];
      if (cover && currentGameId === gid) {
        extras.push({
          url: cover,
          thumb_url: cover,
          source: 'pinned_game_cover',
          game_id: gid,
          game_title: gtitle,
        });
      }
    }
    const merged = [...extras, ...candidates];
    const seen = new Set<string>();
    return merged.filter((c) => {
      if (seen.has(c.url)) return false;
      seen.add(c.url);
      if (c.source === 'pinned_game_cover' || c.source === 'current_selection') return true;
      return isWideHeroAspect(c.width ?? undefined, c.height ?? undefined, c.url);
    });
  }, [candidates, currentCustom, currentGameId, libraryGames]);

  const selected = wideCandidates.find((c) => c.url === selectedUrl) ?? null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.88)',
        backdropFilter: 'blur(12px)',
        zIndex: 12000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
      role="dialog"
      aria-modal
      aria-labelledby="home-hero-modal-title"
    >
      <GlassCard
        style={{
          width: '100%',
          maxWidth: 1180,
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          padding: 0,
          overflow: 'hidden',
          border: '1px solid rgba(255,255,255,0.08)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 16,
            padding: '24px 28px',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          <div>
            <h2 id="home-hero-modal-title" style={{ margin: 0, fontSize: 22, fontWeight: 900 }}>
              Home hero background
            </h2>
            <p className="muted-label" style={{ margin: '10px 0 0', maxWidth: 640, lineHeight: 1.5 }}>
              Wide images only (~16:9–21:9). Sources include IGDB artworks and screenshots, library hero URLs, and
              optionally SteamGridDB heroes for top-played games.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              border: 'none',
              background: 'rgba(255,255,255,0.06)',
              color: '#fff',
              borderRadius: 10,
              width: 40,
              height: 40,
              cursor: 'pointer',
              display: 'grid',
              placeItems: 'center',
            }}
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, padding: '14px 28px', alignItems: 'center' }}>
          <label
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 10,
              fontSize: 13,
              fontWeight: 700,
              color: 'rgba(255,255,255,0.75)',
              cursor: loading ? 'wait' : 'pointer',
            }}
          >
            <input
              type="checkbox"
              checked={includeSgdb}
              disabled={loading}
              onChange={(e) => setIncludeSgdb(e.target.checked)}
            />
            <Sparkles size={16} style={{ opacity: 0.85 }} />
            Load SteamGridDB heroes (top games, slower)
          </label>
          {loading ? (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13, opacity: 0.7 }}>
              <Loader2 size={16} className="spin" /> Loading…
            </span>
          ) : null}
        </div>

        {error ? (
          <div style={{ padding: '0 28px 12px', color: '#ff9f9d', fontSize: 13 }}>{error}</div>
        ) : null}

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.1fr) minmax(280px, 0.45fr)', gap: 0, flex: 1, minHeight: 0 }}>
          <div style={{ overflowY: 'auto', padding: '12px 20px 24px 28px', maxHeight: 'min(62vh, 640px)' }}>
            {wideCandidates.length === 0 && !loading ? (
              <p className="muted-label" style={{ padding: '40px 0' }}>
                No wide images found. Try enabling SteamGridDB or refresh metadata for your games.
              </p>
            ) : (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                  gap: 14,
                }}
              >
                {wideCandidates.map((c) => {
                  const sel = selectedUrl === c.url;
                  const thumb = getFileUrl(c.thumb_url) || getFileUrl(c.url);
                  return (
                    <button
                      key={`${c.source}-${c.url}`}
                      type="button"
                      onClick={() => setSelectedUrl(c.url)}
                      style={{
                        position: 'relative',
                        borderRadius: 14,
                        overflow: 'hidden',
                        border: sel ? '2px solid var(--accent)' : '1px solid rgba(255,255,255,0.08)',
                        padding: 0,
                        cursor: 'pointer',
                        background: '#0a0b0e',
                        aspectRatio: '16 / 9',
                        textAlign: 'left',
                      }}
                    >
                      <SafeImage
                        src={thumb || undefined}
                        fallbackText="?"
                        alt=""
                        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                      />
                      <div
                        style={{
                          position: 'absolute',
                          left: 0,
                          right: 0,
                          bottom: 0,
                          padding: '8px 10px',
                          background: 'linear-gradient(transparent, rgba(0,0,0,0.85))',
                          fontSize: 10,
                          fontWeight: 800,
                          color: 'rgba(255,255,255,0.9)',
                        }}
                      >
                        {c.game_title}
                        <span style={{ opacity: 0.55, marginLeft: 6 }}>{c.source.replace(/_/g, ' ')}</span>
                      </div>
                      {sel ? (
                        <div
                          style={{
                            position: 'absolute',
                            top: 10,
                            right: 10,
                            background: 'var(--accent)',
                            borderRadius: '50%',
                            padding: 2,
                          }}
                        >
                          <CheckCircle2 size={20} color="#fff" />
                        </div>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          <div
            style={{
              borderLeft: '1px solid rgba(255,255,255,0.06)',
              padding: '20px 24px',
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
              background: 'rgba(0,0,0,0.25)',
            }}
          >
            <div style={{ fontSize: 11, fontWeight: 800, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase' }}>
              Preview
            </div>
            <div
              style={{
                borderRadius: 16,
                overflow: 'hidden',
                aspectRatio: '16 / 9',
                border: '1px solid rgba(255,255,255,0.1)',
                background: '#111',
              }}
            >
              {selected ? (
                <SafeImage
                  src={getFileUrl(selected.url) || undefined}
                  fallbackText="?"
                  alt=""
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                />
              ) : (
                <div style={{ height: '100%', display: 'grid', placeItems: 'center', color: 'rgba(255,255,255,0.35)', fontSize: 13 }}>
                  Select an image
                </div>
              )}
            </div>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', margin: 0, lineHeight: 1.5 }}>
              Saves to local app storage. Home tries your pick first, then pinned game cover, then last played / most
              played wide art, then gradient.
            </p>
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'flex-end',
            gap: 12,
            padding: '18px 28px',
            borderTop: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          <ActionButton variant="secondary" onClick={onClose}>
            Cancel
          </ActionButton>
          <ActionButton
            variant="primary"
            disabled={!selected}
            onClick={() => {
              if (!selected) return;
              writeStoredHeroGameId(null);
              writeHomeHeroCustomImageUrl(selected.url);
              notifyHomeHeroBgChanged();
              onApplied();
              onClose();
            }}
          >
            Use on Home
          </ActionButton>
        </div>
      </GlassCard>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .spin { animation: spin 0.9s linear infinite; }
      `}</style>
    </div>
  );
};

export default HomeHeroBackgroundModal;
