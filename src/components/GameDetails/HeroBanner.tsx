import React, { useEffect, useState } from 'react';
import theme from '../../theme';
import { Play, Film, Pin, MapPin, MoreHorizontal, Clock, Calendar, Trophy, FolderPlus, ChevronLeft } from 'lucide-react';
import SafeImage from '../common/SafeImage';
import { openUrl } from '@tauri-apps/plugin-opener';

interface HeroBannerProps {
  title: string;
  description?: string | null;
  coverUrl: string | null;
  artworkUrl: string | null;
  screenshotUrl: string | null;
  trailerUrl?: string | null;
  logoUrl?: string | null;
  rating: number | null;
  releaseYear: string | null;
  genres: string | null;
  isRunning: boolean;
  playtimeSeconds: number;
  lastPlayed?: string | null;
  completionPercentage?: number;
  /** Saved completion_status from DB */
  currentStatus?: string;
  onLaunch: () => void;
  onDelete: () => void;
  onBack: () => void;
  onTogglePin?: () => void;
  onStatusChange?: (status: string) => void;
  onMediaChange?: (type: 'cover' | 'artwork') => void;
  onAddToPlaylist?: () => void;
  isPinned?: boolean;
  onShowTrailers?: () => void;
}

const STATUS_OPTIONS: { id: string; label: string }[] = [
  { id: 'in_progress', label: 'Playing' },
  { id: 'not_started', label: 'Not started' },
  { id: 'backlog', label: 'Backlog' },
  { id: 'completed', label: 'Completed' },
  { id: 'dropped', label: 'Dropped' },
];

const actionBtn: React.CSSProperties = {
  height: 44,
  minWidth: 44,
  padding: '0 22px',
  borderRadius: 12,
  fontWeight: 800,
  fontSize: 14,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 10,
  border: '1px solid rgba(255,255,255,0.12)',
  cursor: 'pointer',
  transition: 'background 0.2s, border-color 0.2s, transform 0.15s',
};

const HeroBanner: React.FC<HeroBannerProps> = ({
  title, description, coverUrl, artworkUrl, screenshotUrl, trailerUrl, logoUrl,
  genres, isRunning, playtimeSeconds,
  lastPlayed, completionPercentage = 0,
  currentStatus,
  onLaunch, onDelete, onBack, onTogglePin, onStatusChange, onMediaChange, onAddToPlaylist, isPinned, onShowTrailers
}) => {
  const [showDropdown, setShowDropdown] = useState(false);
  const bgImage = artworkUrl || screenshotUrl || coverUrl;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (showDropdown && !target.closest('.dropdown-container')) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showDropdown]);

  const formatPlaytime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return `${h}h ${m}m`;
  };

  const heroStyle: React.CSSProperties = {
    height: 'auto',
    position: 'relative',
    width: '100%',
    maxWidth: '100%',
    boxSizing: 'border-box',
    backgroundColor: '#07080a',
    overflow: 'hidden',
  };

  const bgStyle: React.CSSProperties = {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundImage: bgImage ? `url(${bgImage})` : 'none',
    backgroundSize: 'cover',
    backgroundPosition: 'center 20%',
    filter: 'none',
    zIndex: 0,
  };

  const overlayStyle: React.CSSProperties = {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    // Left-to-right readable tint + bottom-to-top fade
    background: [
      'linear-gradient(90deg, rgba(7,8,10,0.70) 0%, rgba(7,8,10,0) 55%)',
      'linear-gradient(0deg, rgba(7,8,10,0.92) 0%, rgba(7,8,10,0) 60%)',
    ].join(', '),
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'flex-end',
    padding: '48px clamp(16px, 4vw, 64px) 64px',
    gap: '32px',
    zIndex: 1,
    overflow: 'hidden',
  };

  const backBtnStyle: React.CSSProperties = {
    position: 'absolute',
    top: 'clamp(40px, 5vw, 56px)',
    left: 40,
    zIndex: 4,
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '7px 14px',
    borderRadius: 8,
    border: '1px solid rgba(255,255,255,0.10)',
    background: 'rgba(7,8,10,0.48)',
    backdropFilter: 'blur(12px)',
    color: 'rgba(255,255,255,0.75)',
    fontSize: 12,
    fontWeight: 700,
    cursor: 'pointer',
    transition: 'background 0.2s, border-color 0.2s, color 0.2s',
  };

  const genreChipStyle: React.CSSProperties = {
    padding: '4px 12px',
    backgroundColor: 'rgba(var(--accent-rgb), 0.12)',
    borderRadius: 999,
    fontSize: 11,
    fontWeight: 700,
    color: 'var(--accent)',
    letterSpacing: '0.04em',
    whiteSpace: 'nowrap',
  };

  const statBlockStyle: React.CSSProperties = {
    display: 'flex',
    gap: 10,
    alignItems: 'center',
  };

  return (
    <div className="game-details-hero-wrap" style={heroStyle}>
      <div style={bgStyle} />
      <button type="button" onClick={onBack} style={backBtnStyle} aria-label="Back to library">
        <ChevronLeft size={15} /> Back
      </button>
      <div style={overlayStyle}>
        <div style={{ maxWidth: 'min(720px, 92%)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {logoUrl ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', alignItems: 'flex-start' }}>
              <SafeImage
                src={logoUrl}
                alt=""
                fallbackText=" "
                style={{
                  maxWidth: 'min(480px, 100%)',
                  maxHeight: '160px',
                  width: 'auto',
                  height: 'auto',
                  objectFit: 'contain',
                  filter: 'drop-shadow(0 4px 20px rgba(0,0,0,0.8))',
                  backgroundColor: 'transparent',
                }}
              />
              {/* <h1
                style={{
                  margin: 0,
                  fontSize: 'clamp(20px, 2.4vw, 34px)',
                  fontWeight: 800,
                  letterSpacing: '-0.02em',
                  lineHeight: 1.15,
                  color: '#fff',
                  textShadow: '0 2px 24px rgba(0,0,0,0.85)',
                }}
              >
                {title}
              </h1> */}
            </div>
          ) : (
            <h1 style={{
              ...theme.typography.hero,
              fontSize: 'clamp(28px, 3.5vw, 52px)',
              fontWeight: 900,
              letterSpacing: '-2px',
              margin: 0,
              textTransform: 'uppercase',
              lineHeight: 1.05,
              wordBreak: 'break-word',
            }}>{title}</h1>
          )}

          {/* Genre chips */}
          {genres && (
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '2px' }}>
              {genres.split(',').slice(0, 4).map((g, i) => (
                <span key={i} style={genreChipStyle}>{g.trim()}</span>
              ))}
            </div>
          )}

          <p style={{
            fontSize: '15px',
            color: 'rgba(255, 255, 255, 0.65)',
            lineHeight: 1.6,
            margin: '4px 0 8px 0',
            display: '-webkit-box',
            WebkitLineClamp: 3,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden'
          }}>
            {description || 'Explore this amazing title in your library.'}
          </p>

          {/* Stat blocks */}
          <div style={{ display: 'flex', gap: '28px', flexWrap: 'wrap', alignItems: 'flex-start' }}>
            <div style={statBlockStyle}>
              <Clock size={20} style={{ color: 'var(--accent)', opacity: 0.75, flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', fontWeight: 800, letterSpacing: '0.08em' }}>Playtime</div>
                <div style={{ fontSize: 15, fontWeight: 800, color: '#fff' }}>{formatPlaytime(playtimeSeconds)}</div>
              </div>
            </div>
            <div style={statBlockStyle}>
              <Calendar size={20} style={{ color: 'var(--accent)', opacity: 0.75, flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', fontWeight: 800, letterSpacing: '0.08em' }}>Last Played</div>
                <div style={{ fontSize: 15, fontWeight: 800, color: '#fff' }}>{lastPlayed || 'Never'}</div>
              </div>
            </div>
          </div>

          {/* Completion progress bar */}
          {completionPercentage > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, maxWidth: 360 }}>
              <Trophy size={16} style={{ color: 'var(--accent)', opacity: 0.8, flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', fontWeight: 800, letterSpacing: '0.08em' }}>Completion</span>
                  <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--accent)' }}>{completionPercentage}%</span>
                </div>
                <div style={{ height: 4, background: 'rgba(255,255,255,0.08)', borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{ width: `${completionPercentage}%`, height: '100%', background: 'var(--accent)', borderRadius: 2 }} />
                </div>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: '12px', marginTop: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={onLaunch}
              style={{
                ...actionBtn,
                background: isRunning ? '#22c55e' : 'var(--accent-grad)',
                color: isRunning ? '#fff' : 'var(--accent-on-fill)',
                border: 'none',
                boxShadow: isRunning
                  ? '0 8px 28px rgba(34,197,94,0.35)'
                  : '0 8px 28px rgba(var(--accent-rgb), 0.35)',
              }}
            >
              <Play size={18} fill="currentColor" />
              {isRunning ? 'Running' : 'Play'}
            </button>

            <button
              type="button"
              onClick={() => {
                if (trailerUrl) void openUrl(trailerUrl);
                else onShowTrailers?.();
              }}
              style={{ ...actionBtn, background: 'rgba(255,255,255,0.08)', color: '#fff' }}
            >
              <Film size={18} />
              Trailers
            </button>

            <button
              type="button"
              onClick={onTogglePin}
              title={isPinned ? 'Unpin' : 'Pin to sidebar'}
              style={{
                ...actionBtn,
                width: 44,
                padding: 0,
                background: isPinned ? 'rgba(var(--accent-rgb), 0.22)' : 'rgba(255,255,255,0.08)',
                borderColor: isPinned ? 'rgba(var(--accent-rgb), 0.55)' : 'rgba(255,255,255,0.12)',
                color: '#fff',
              }}
            >
              {isPinned ? <Pin size={18} fill="currentColor" /> : <MapPin size={18} />}
            </button>

            <button
              type="button"
              onClick={onAddToPlaylist}
              title="Add to playlist"
              style={{ ...actionBtn, width: 44, padding: 0, background: 'rgba(255,255,255,0.08)', color: '#fff' }}
            >
              <FolderPlus size={18} />
            </button>

            <div style={{ position: 'relative' }} className="dropdown-container">
              <button
                type="button"
                title="More"
                onClick={() => setShowDropdown(!showDropdown)}
                style={{ ...actionBtn, width: 44, padding: 0, background: 'rgba(255,255,255,0.08)', color: '#fff' }}
              >
                <MoreHorizontal size={18} />
              </button>

              {showDropdown && (
                <div className="game-hero-dropdown" style={{
                  position: 'absolute',
                  bottom: '100%',
                  right: 0,
                  marginBottom: '8px',
                  backgroundColor: '#0c0e12',
                  borderRadius: '14px',
                  border: '1px solid rgba(255,255,255,0.08)',
                  boxShadow: '0 16px 40px rgba(0,0,0,0.65)',
                  zIndex: 2000,
                  width: '220px',
                  overflow: 'hidden'
                }}>
                  <div style={{ padding: '8px' }}>
                    <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', fontWeight: 800, padding: '8px 12px' }}>Status</div>
                    {STATUS_OPTIONS.map((status) => (
                      <div
                        key={status.id}
                        onClick={() => { onStatusChange?.(status.id); setShowDropdown(false); }}
                        style={{
                          padding: '10px 12px',
                          fontSize: '13px',
                          cursor: 'pointer',
                          borderRadius: '8px',
                          transition: 'background 0.2s',
                          color: currentStatus === status.id ? '#fff' : 'rgba(255,255,255,0.72)',
                          fontWeight: currentStatus === status.id ? 800 : 600,
                          background: currentStatus === status.id ? 'rgba(var(--accent-rgb), 0.16)' : 'transparent',
                        }}
                        onMouseEnter={(e) => {
                          if (currentStatus !== status.id) e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.06)';
                        }}
                        onMouseLeave={(e) => {
                          if (currentStatus !== status.id) e.currentTarget.style.backgroundColor = 'transparent';
                        }}
                      >
                        {status.label}
                      </div>
                    ))}
                    <div style={{ height: '1px', backgroundColor: 'rgba(255,255,255,0.05)', margin: '8px 0' }} />
                    <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', fontWeight: 800, padding: '8px 12px' }}>Media</div>
                    <div
                      onClick={() => { onMediaChange?.('cover'); setShowDropdown(false); }}
                      style={{ padding: '10px 12px', fontSize: '13px', cursor: 'pointer', borderRadius: '8px', transition: 'background 0.2s', color: 'rgba(255,255,255,0.7)' }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      Change Poster
                    </div>
                    <div
                      onClick={() => { onMediaChange?.('artwork'); setShowDropdown(false); }}
                      style={{ padding: '10px 12px', fontSize: '13px', cursor: 'pointer', borderRadius: '8px', transition: 'background 0.2s', color: 'rgba(255,255,255,0.7)' }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      Change Background
                    </div>
                    <div style={{ height: '1px', backgroundColor: 'rgba(255,255,255,0.05)', margin: '8px 0' }} />
                    <div
                      onClick={() => { onDelete(); setShowDropdown(false); }}
                      style={{ padding: '10px 12px', fontSize: '13px', cursor: 'pointer', borderRadius: '8px', color: '#ff4444' }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,68,68,0.1)'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      Delete Game
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HeroBanner;
