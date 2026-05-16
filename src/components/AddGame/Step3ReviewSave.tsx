import React, { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { getFileUrl } from '../../utils/fileUtils';
import { useToast } from '../../hooks/useToast';
import GamePoster from '../common/GamePoster';
import { ChevronLeft, Plus, Star, Calendar, Code, Users, Tag } from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────

interface IgdbCover   { image_id: string; url: string; thumb_url: string; }
interface IgdbImage   { id: string; image_id: string; url: string; thumb_url: string; source: string; }
interface IgdbTrailer { id: string; name: string; video_id: string; youtube_url: string; thumbnail_url: string; source: string; }
interface IgdbSimilarGame { id: number; name: string; cover?: IgdbCover; first_release_date?: number; rating?: number; }
interface IgdbTimeToBeat  { main_story: number | null; main_extras: number | null; completionist: number | null; }

interface IgdbGame {
  igdb_id: number | null;
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

interface Step3Props {
  exePath: string;
  metadata: IgdbGame;
  onBack: () => void;
  onSuccess: (id?: number) => void;
  onSaveStart?: () => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const MetaRow: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
}> = ({ icon, label, value }) => (
  <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
    <div style={{ color: 'rgba(255,255,255,0.28)', flexShrink: 0, marginTop: 1 }}>{icon}</div>
    <div style={{ minWidth: 0 }}>
      <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'rgba(255,255,255,0.28)', marginBottom: 2 }}>
        {label}
      </div>
      <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.8)', lineHeight: 1.4 }}>{value}</div>
    </div>
  </div>
);

const Chip: React.FC<{ children: React.ReactNode; accent?: boolean }> = ({ children, accent }) => (
  <span style={{
    fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20,
    background: accent ? 'rgba(var(--accent-rgb),0.14)' : 'rgba(255,255,255,0.06)',
    color: accent ? 'var(--accent)' : 'rgba(255,255,255,0.65)',
    border: `1px solid ${accent ? 'rgba(var(--accent-rgb),0.28)' : 'rgba(255,255,255,0.09)'}`,
    whiteSpace: 'nowrap' as const,
  }}>
    {children}
  </span>
);

// ── Main component ────────────────────────────────────────────────────────────

const Step3ReviewSave: React.FC<Step3Props> = ({
  exePath, metadata, onBack, onSuccess, onSaveStart,
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const { showSuccess, showError } = useToast();

  const handleSave = async () => {
    setLoading(true);
    onSaveStart?.();
    setError('');
    try {
      const fileName = exePath.split(/[\\/]/).pop()?.toLowerCase() || '';

      const payload = {
        exe_path:               exePath,
        process_name:           fileName,
        title:                  metadata.title,
        igdb_id:                metadata.igdb_id,
        metadata_provider:      metadata.igdb_id ? 'igdb' : 'manual',
        summary:                metadata.summary,
        storyline:              metadata.storyline,
        release_date:           metadata.release_date
                                  ? new Date(metadata.release_date * 1000).toISOString()
                                  : null,
        developer:              metadata.developers?.join(', ') || null,
        publisher:              metadata.publishers?.join(', ') || null,
        platforms:              metadata.platforms?.join(', ')  || null,
        genres:                 metadata.genres?.join(', ')     || null,
        artwork_url:            metadata.artworks?.[0]?.url    || null,
        screenshot_url:         metadata.screenshots?.[0]?.url || null,
        trailer_url:            metadata.trailers?.[0]?.youtube_url || null,
        rating_count:           metadata.rating_count,
        total_rating:           metadata.total_rating,
        total_rating_count:     metadata.total_rating_count,
        similar_games:          JSON.stringify(metadata.similar_games  ?? []),
        cover_url:              metadata.cover?.url || null,
        rating:                 metadata.rating,
        hltb_main_story:        metadata.time_to_beat?.main_story,
        hltb_main_extras:       metadata.time_to_beat?.main_extras,
        hltb_completionist:     metadata.time_to_beat?.completionist,
        artworks:               JSON.stringify(metadata.artworks   ?? []),
        screenshots:            JSON.stringify(metadata.screenshots ?? []),
        videos:                 JSON.stringify(metadata.trailers   ?? []),
      };

      const id = await invoke<number>('add_game', { payload });
      showSuccess('Game added successfully!');
      onSuccess(id);
    } catch (e) {
      const msg = `Failed to add game: ${e}`;
      setError(msg);
      showError(msg);
      setLoading(false);
    }
  };

  const year = metadata.release_date
    ? new Date(metadata.release_date * 1000).getFullYear()
    : null;

  const coverSrc = getFileUrl(metadata.cover?.url || '');
  const fallbackSrcs = [
    getFileUrl(metadata.artworks?.[0]?.url   || ''),
    getFileUrl(metadata.screenshots?.[0]?.url || ''),
  ].filter(Boolean) as string[];

  const isManual = !metadata.igdb_id;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* ── Game card preview ── */}
      <div style={{
        display: 'flex', gap: 22,
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: 18, padding: 20,
      }}>
        {/* Cover */}
        <div style={{ flexShrink: 0 }}>
          <GamePoster
            src={coverSrc || undefined}
            fallbackSrcs={fallbackSrcs}
            title={metadata.title}
            variant="portrait"
            style={{
              width: 110, height: 150,
              borderRadius: 12,
              boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
              border: '1px solid rgba(255,255,255,0.08)',
            }}
          />
        </div>

        {/* Details */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Title row */}
          <div>
            <h3 style={{ margin: '0 0 8px', fontSize: 19, fontWeight: 800, color: '#fff', lineHeight: 1.2 }}>
              {metadata.title}
            </h3>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
              {year && <Chip>{year}</Chip>}
              {metadata.rating != null && (
                <Chip>
                  <span style={{ color: '#fbbf24' }}>★</span> {(metadata.rating / 20).toFixed(1)}
                </Chip>
              )}
              {isManual ? (
                <Chip>Manual</Chip>
              ) : (
                <Chip accent>IGDB</Chip>
              )}
            </div>
          </div>

          {/* Meta rows */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {metadata.developers?.length > 0 && (
              <MetaRow
                icon={<Users size={13} />}
                label="Developer"
                value={metadata.developers.join(', ')}
              />
            )}
            {year && (
              <MetaRow
                icon={<Calendar size={13} />}
                label="Release Year"
                value={year}
              />
            )}
            {metadata.genres?.length > 0 && (
              <MetaRow
                icon={<Tag size={13} />}
                label="Genres"
                value={
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 2 }}>
                    {metadata.genres.slice(0, 5).map(g => (
                      <Chip key={g}>{g}</Chip>
                    ))}
                  </div>
                }
              />
            )}
          </div>

          {/* Summary */}
          {metadata.summary && (
            <p style={{
              margin: 0, fontSize: 12, lineHeight: 1.55,
              color: 'rgba(255,255,255,0.45)',
              display: '-webkit-box',
              WebkitLineClamp: 3,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}>
              {metadata.summary}
            </p>
          )}
        </div>
      </div>

      {/* ── Executable path ── */}
      <div style={{
        background: 'rgba(255,255,255,0.025)',
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: 12, padding: '12px 16px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <Code size={12} style={{ color: 'rgba(255,255,255,0.3)' }} />
          <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'rgba(255,255,255,0.28)' }}>
            Executable
          </span>
        </div>
        <div style={{
          fontSize: 12, color: 'rgba(255,255,255,0.55)',
          fontFamily: 'monospace', wordBreak: 'break-all', lineHeight: 1.5,
        }}>
          {exePath}
        </div>
      </div>

      {/* IGDB badge + rating bar */}
      {!isManual && metadata.rating != null && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 14,
          padding: '10px 16px',
          background: 'rgba(255,255,255,0.025)',
          border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: 12,
        }}>
          <Star size={14} style={{ color: '#fbbf24', flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginBottom: 5 }}>
              IGDB Community Rating
            </div>
            <div style={{
              height: 4, background: 'rgba(255,255,255,0.08)', borderRadius: 2, overflow: 'hidden',
            }}>
              <div style={{
                height: '100%',
                width: `${metadata.rating}%`,
                background: metadata.rating >= 75 ? '#4ade80' : metadata.rating >= 50 ? '#fbbf24' : '#f87171',
                borderRadius: 2,
                transition: 'width 0.6s ease',
              }} />
            </div>
          </div>
          <div style={{ fontWeight: 800, fontSize: 15, color: '#fff', flexShrink: 0 }}>
            {metadata.rating.toFixed(0)}
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', fontWeight: 400 }}>/100</span>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={{
          padding: '10px 14px', borderRadius: 10, fontSize: 13,
          background: 'rgba(239,68,68,0.08)',
          border: '1px solid rgba(239,68,68,0.2)',
          color: '#fca5a5',
        }}>
          {error}
        </div>
      )}

      {/* ── Navigation ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
        <button type="button" onClick={onBack} className="wz-nav-btn wz-nav-btn--secondary">
          <ChevronLeft size={16} /> Back
        </button>
        <button
          type="button"
          disabled={loading}
          onClick={() => void handleSave()}
          className="wz-nav-btn wz-nav-btn--primary"
          style={{ paddingLeft: 28, paddingRight: 28, gap: 8 }}
        >
          <Plus size={16} />
          {loading ? 'Adding…' : 'Add to Library'}
        </button>
      </div>
    </div>
  );
};

export default Step3ReviewSave;
