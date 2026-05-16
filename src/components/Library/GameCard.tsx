import React, { useEffect, useRef, useState } from 'react';
import GamePoster from '../common/GamePoster';
import {
  MoreVertical,
  Play,
  Eye,
  Image as ImageIcon,
  ImagePlus,
  ListMusic,
  RefreshCw,
  Trash2,
} from 'lucide-react';

const statusBadgeLabel = (s: string | undefined, isRunning: boolean) => {
  if (isRunning) return 'Running';
  switch (s) {
    case 'in_progress':  return 'Playing';
    case 'completed':    return 'Completed';
    case 'backlog':      return 'Backlog';
    case 'dropped':      return 'Dropped';
    case 'not_started':
    default:             return 'Not Started';
  }
};

const statusBadgeStyle = (s: string | undefined, isRunning: boolean): React.CSSProperties => {
  if (isRunning) return { background: 'var(--success)', border: 'none', color: '#fff' };
  switch (s) {
    case 'in_progress':
      return { background: 'rgba(var(--accent-rgb),0.85)', border: 'none', color: '#fff' };
    case 'completed':
      return { background: 'rgba(74,222,128,0.15)', border: '1px solid rgba(74,222,128,0.35)', color: '#4ade80' };
    case 'backlog':
      return { background: 'rgba(251,191,36,0.12)', border: '1px solid rgba(251,191,36,0.3)', color: '#fbbf24' };
    case 'dropped':
      return { background: 'rgba(248,113,113,0.12)', border: '1px solid rgba(248,113,113,0.3)', color: '#f87171' };
    default:
      return { background: 'rgba(7,8,10,0.72)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.55)' };
  }
};

interface GameCardProps {
  id: number;
  title: string;
  coverUrl: string | null;
  fallbackSrcs?: string[];
  rating: number | null;
  playtime: number;
  isRunning: boolean;
  onClick: () => void;
  completionStatus?: string;
  selectMode?: boolean;
  selected?: boolean;
  onSelectToggle?: (id: number) => void;
  onPlay?: () => void;
  onViewDetails?: () => void;
  onChangePoster?: () => void;
  onChangeBackground?: () => void;
  onAddToPlaylist?: () => void;
  onRefreshMetadata?: () => void;
  onDelete?: () => void;
  /** Short preset hint from Performance Advisor (optional, unobtrusive). */
  performanceTier?: string | null;
}

const menuBtnStyle: React.CSSProperties = {
  width: 36,
  height: 36,
  borderRadius: 10,
  border: '1px solid rgba(255,255,255,0.12)',
  background: 'rgba(7,8,10,0.75)',
  backdropFilter: 'blur(10px)',
  color: '#fff',
  display: 'grid',
  placeItems: 'center',
  cursor: 'pointer',
  padding: 0,
};

const GameCard: React.FC<GameCardProps> = ({
  id,
  title,
  coverUrl,
  fallbackSrcs = [],
  rating,
  playtime,
  isRunning,
  onClick,
  completionStatus,
  selectMode,
  selected,
  onSelectToggle,
  onPlay,
  onViewDetails,
  onChangePoster,
  onChangeBackground,
  onAddToPlaylist,
  onRefreshMetadata,
  onDelete,
  performanceTier,
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [menuOpen]);

  const formatTime = (sec: number) => {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    return `${h}h ${m}m`;
  };

  const cardStyle: React.CSSProperties = {
    position: 'relative',
    aspectRatio: '3/4',
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderRadius: '16px',
    border: `1px solid ${isRunning ? 'var(--success)' : 'rgba(255, 255, 255, 0.05)'}`,
    overflow: 'hidden',
    cursor: 'pointer',
    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    boxShadow: isRunning ? `0 0 20px rgba(16, 185, 129, 0.2)` : '0 10px 30px rgba(0,0,0,0.3)',
  };

  const overlayStyle: React.CSSProperties = {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: '20px',
    background: 'linear-gradient(to top, rgba(7, 8, 10, 0.95) 0%, rgba(7, 8, 10, 0.6) 60%, transparent 100%)',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    zIndex: 2,
    transform: 'translateY(0)',
    transition: 'transform 0.3s ease',
  };

  const playButtonOverlayStyle: React.CSSProperties = {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(7, 8, 10, 0.4)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0,
    transition: 'all 0.3s ease',
    zIndex: 4,
    backdropFilter: 'blur(4px)',
  };

  const row = (key: string, icon: React.ReactNode, label: string, onPick: () => void, danger?: boolean) => (
    <button
      type="button"
      key={key}
      onClick={(e) => {
        e.stopPropagation();
        setMenuOpen(false);
        onPick();
      }}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        width: '100%',
        textAlign: 'left',
        padding: '10px 12px',
        border: 'none',
        borderRadius: 10,
        background: 'transparent',
        color: danger ? '#ff8a86' : 'rgba(255,255,255,0.88)',
        fontSize: 13,
        fontWeight: 600,
        cursor: 'pointer',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = danger ? 'rgba(239,68,68,0.12)' : 'rgba(255,255,255,0.06)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'transparent';
      }}
    >
      {icon}
      {label}
    </button>
  );

  return (
    <div
      style={cardStyle}
      className={`game-card ${isRunning ? 'running' : ''} ${selected ? 'game-card-selected' : ''}`}
      onClick={onClick}
    >
      {selectMode && (
        <div
          style={{ position: 'absolute', top: 10, left: 10, zIndex: 25 }}
          onClick={(e) => {
            e.stopPropagation();
            onSelectToggle?.(id);
          }}
        >
          <input
            type="checkbox"
            checked={!!selected}
            readOnly
            style={{ width: 18, height: 18, accentColor: 'var(--accent)', cursor: 'pointer' }}
          />
        </div>
      )}

      {performanceTier ? (
        <div
          style={{
            position: 'absolute',
            bottom: 96,
            left: 10,
            zIndex: 14,
            pointerEvents: 'none',
          }}
        >
          <span
            style={{
              backgroundColor: 'rgba(7, 8, 10, 0.82)',
              color: 'rgba(255,255,255,0.88)',
              padding: '3px 8px',
              borderRadius: 6,
              fontSize: 9,
              fontWeight: 800,
              letterSpacing: '0.04em',
              border: '1px solid rgba(255,255,255,0.1)',
            }}
          >
            {performanceTier}
          </span>
        </div>
      ) : null}

      {!selectMode && (
        <div
          ref={menuRef}
          style={{ position: 'absolute', top: 10, right: 10, zIndex: 50 }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            aria-label={`More actions for ${title}`}
            style={menuBtnStyle}
            onClick={() => setMenuOpen((o) => !o)}
          >
            <MoreVertical size={18} />
          </button>
          {menuOpen ? (
            <div
              className="game-card-kebab-menu"
              role="menu"
              style={{
                position: 'absolute',
                top: 44,
                right: 0,
                minWidth: 200,
                padding: 6,
                borderRadius: 14,
                background: '#0c0e12',
                border: '1px solid rgba(255,255,255,0.1)',
                boxShadow: '0 18px 48px rgba(0,0,0,0.75)',
                zIndex: 60,
                display: 'flex',
                flexDirection: 'column',
                gap: 2,
              }}
            >
              {onPlay ? row('play', <Play size={16} />, 'Play', onPlay) : null}
              {onViewDetails ? row('details', <Eye size={16} />, 'View Details', onViewDetails) : null}
              {onChangePoster ? row('poster', <ImageIcon size={16} />, 'Change Poster', onChangePoster) : null}
              {onChangeBackground ? row('bg', <ImagePlus size={16} />, 'Change Background', onChangeBackground) : null}
              {onAddToPlaylist ? row('pl', <ListMusic size={16} />, 'Add to Playlist', onAddToPlaylist) : null}
              {onRefreshMetadata ? row('ref', <RefreshCw size={16} />, 'Refresh Metadata', onRefreshMetadata) : null}
              {onDelete ? row('del', <Trash2 size={16} />, 'Delete', onDelete, true) : null}
            </div>
          ) : null}
        </div>
      )}

      <div
        style={{
          position: 'absolute',
          top: 10,
          right: selectMode ? 10 : 52,
          zIndex: 12,
          pointerEvents: 'none',
        }}
      >
        <span
          style={{
            ...statusBadgeStyle(completionStatus, isRunning),
            padding: '4px 10px',
            borderRadius: 8,
            fontSize: 10,
            fontWeight: 800,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            backdropFilter: 'blur(8px)',
            display: 'inline-block',
            maxWidth: selectMode ? 100 : 120,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {statusBadgeLabel(completionStatus, isRunning)}
        </span>
      </div>

      <GamePoster
        src={coverUrl}
        fallbackSrcs={fallbackSrcs}
        title={title}
        variant="portrait"
        className="library-card-poster"
      />

      <div style={playButtonOverlayStyle} className="play-overlay">
        <div
          style={{
            backgroundColor: 'var(--accent)',
            color: 'var(--accent-on-fill)',
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '28px',
            boxShadow: '0 0 30px rgba(var(--accent-rgb), 0.5)',
            border: '2px solid rgba(255, 255, 255, 0.2)',
            transform: 'scale(0.8)',
            transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          }}
          className="play-icon"
        >
          ▶
        </div>
      </div>

      <div style={overlayStyle} className="card-content">
        <h3
          style={{
            fontSize: '18px',
            fontWeight: 900,
            margin: 0,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            color: '#ffffff',
            letterSpacing: '-0.5px',
          }}
        >
          {title}
        </h3>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: '12px',
            fontWeight: 700,
            color: 'rgba(255, 255, 255, 0.5)',
          }}
        >
          <span>{isRunning ? 'Running' : `${formatTime(playtime)}`}</span>
          {rating != null ? (
            <span style={{ color: '#ffc107', display: 'flex', alignItems: 'center', gap: '4px' }}>
              ★ {rating.toFixed(1)}
            </span>
          ) : null}
        </div>
      </div>

      <style>{`
        .game-card:hover {
          transform: translateY(-8px);
          box-shadow: 0 20px 40px rgba(0,0,0,0.6);
          border-color: var(--accent);
        }
        .game-card:hover .play-overlay {
          opacity: 1;
        }
        .game-card:hover .play-icon {
          transform: scale(1);
        }
        .game-card:hover .card-content {
          transform: translateY(-10px);
        }
        .game-card:hover .library-card-poster img {
          transform: scale(1.1);
          filter: brightness(0.5);
        }
        .library-card-poster img {
          transition: all 0.5s cubic-bezier(0.4, 0, 0.2, 1);
        }
      `}</style>
    </div>
  );
};

export default GameCard;
