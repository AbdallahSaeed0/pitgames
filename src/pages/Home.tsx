import React, { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { DashboardStats } from '../types';
import { getFileUrl } from '../utils/fileUtils';
import GamePoster from '../components/common/GamePoster';
import ActionButton from '../components/common/ActionButton';
import GlassCard from '../components/common/GlassCard';
import ProgressBar from '../components/common/ProgressBar';
import { Play, Plus, LayoutGrid, BarChart3, CheckCircle2, Clock, Trophy, ChevronRight, Gamepad2, ShieldCheck } from 'lucide-react';
import {
  HOME_HERO_BG_CHANGED_EVENT,
  isWideHeroAspect,
  migrateLegacyHeroBackgroundPath,
  notifyHomeHeroBgChanged,
  readHomeHeroCustomImageUrl,
  readStoredHeroGameId,
  writeStoredHeroGameId,
} from '../utils/homeHeroBackground';

type GameRow = [
  number,
  string,
  string | null,
  number | null,
  number,
  string,
  string | null,
  string | null,
  number | null,
  string | null,
];

/** From `list_games`: id, title, cover_url, rating */
type LibraryGameRow = [number, string, string | null, number | null];

interface HomeProps {
  onAddGame: () => void;
  onViewLibrary: () => void;
  onViewStats: () => void;
  onViewCompatibility: () => void;
  onSelectGame: (id: number) => void;
}

// ─── Greeting helpers ────────────────────────────────────────────────────────

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function getFormattedDate(): string {
  return new Date().toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

// ─── Component ───────────────────────────────────────────────────────────────

const Home: React.FC<HomeProps> = ({
  onAddGame,
  onViewLibrary,
  onViewStats,
  onViewCompatibility,
  onSelectGame,
}) => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentGames, setRecentGames] = useState<GameRow[]>([]);
  const [libraryGames, setLibraryGames] = useState<LibraryGameRow[]>([]);
  const [running, setRunning] = useState<string[]>([]);
  const [userName, setUserName] = useState('Player');
  const [heroGameId, setHeroGameId] = useState<number | null>(() => readStoredHeroGameId());
  const [heroCustomUrl, setHeroCustomUrl] = useState<string | null>(() => readHomeHeroCustomImageUrl());
  const [heroImgFailed, setHeroImgFailed] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [dashboardStats, recent, runningNames, profile, library] = await Promise.all([
          invoke<DashboardStats>('get_dashboard_stats'),
          invoke<GameRow[]>('list_games_with_time'),
          invoke<string[]>('detect_running_games'),
          invoke<any>('get_user_profile'),
          invoke<LibraryGameRow[]>('list_games'),
        ]);
        setStats(dashboardStats);
        setRunning(runningNames);
        setUserName(profile?.name || 'Player');
        setLibraryGames(library);
        migrateLegacyHeroBackgroundPath(library);
        setHeroGameId(readStoredHeroGameId());
        setHeroCustomUrl(readHomeHeroCustomImageUrl());

        const sorted = [...recent].sort((a, b) => {
          const aRunning = runningNames.includes(a[5].toLowerCase()) ? 1 : 0;
          const bRunning = runningNames.includes(b[5].toLowerCase()) ? 1 : 0;
          if (bRunning !== aRunning) return bRunning - aRunning;
          const ta = a[9] ? new Date(a[9]).getTime() : 0;
          const tb = b[9] ? new Date(b[9]).getTime() : 0;
          if (tb !== ta) return tb - ta;
          return b[4] - a[4];
        });
        setRecentGames(sorted);
      } catch (e) {
        console.error('Failed to load home data', e);
      }
    };
    loadData();
    const interval = setInterval(loadData, 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (heroGameId == null || libraryGames.length === 0) return;
    if (!libraryGames.some((g) => g[0] === heroGameId)) {
      setHeroGameId(null);
      writeStoredHeroGameId(null);
      notifyHomeHeroBgChanged();
    }
  }, [libraryGames, heroGameId]);

  useEffect(() => {
    const sync = () => {
      setHeroGameId(readStoredHeroGameId());
      setHeroCustomUrl(readHomeHeroCustomImageUrl());
    };
    window.addEventListener(HOME_HERO_BG_CHANGED_EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(HOME_HERO_BG_CHANGED_EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  useEffect(() => {
    setHeroImgFailed(false);
  }, [heroCustomUrl, heroGameId, recentGames]);

  const formatTime = (sec: number) => {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    if (h <= 0) return `${m}m`;
    return `${h}h ${m}m`;
  };

  const formatLastPlayed = (iso: string | null | undefined) => {
    if (!iso) return 'Never';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return 'Recently';
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const calculateProgress = (game: GameRow) => {
    const playtimeSeconds = game[4];
    const targetSeconds = (game[8] || 0) * 3600;
    if (targetSeconds > 0) return Math.min(100, (playtimeSeconds / targetSeconds) * 100);
    return 0;
  };

  // ─── Artwork resolution ────────────────────────────────────────────────────

  const firstWideFromRow = (game: GameRow | undefined): string | null => {
    if (!game) return null;
    for (const u of [game[7], game[6]]) {
      if (u && isWideHeroAspect(undefined, undefined, u)) return u;
    }
    return null;
  };

  const featuredGame = recentGames[0] ?? null;
  const mostPlayed = [...recentGames].sort((a, b) => b[4] - a[4])[0] ?? null;

  // Resolve the blurred backdrop for the featured card
  const pickedCover =
    heroGameId != null ? (libraryGames.find((g) => g[0] === heroGameId)?.[2] ?? null) : null;
  const featuredWide = firstWideFromRow(featuredGame);

  const effectiveHeroBgRaw =
    heroCustomUrl ??
    pickedCover ??
    featuredWide ??
    firstWideFromRow(mostPlayed) ??
    featuredGame?.[2] ??
    null;
  const featuredBackdrop = heroImgFailed ? null : effectiveHeroBgRaw;

  // Backdrop URL for the featured card (can be cover if no wide art)
  const featuredBackdropUrl = featuredBackdrop ? getFileUrl(featuredBackdrop) : null;

  const isRunning = (game: GameRow) => running.includes(game[5].toLowerCase());

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="premium-page" style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

      {/* ── GREETING BAR ──────────────────────────────────────────────────── */}
      <div
        style={{
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          padding: '0 32px',
          height: 60,
          background: 'rgba(255,255,255,0.02)',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          gap: 16,
        }}
      >
        {/* Left: greeting */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <span
            style={{
              fontSize: 15,
              fontWeight: 700,
              color: '#fff',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {getGreeting()},{' '}
            <span style={{ color: 'var(--accent)' }}>{userName}</span>
          </span>
        </div>

        {/* Center: date */}
        <div
          style={{
            fontSize: 13,
            color: 'rgba(255,255,255,0.42)',
            fontWeight: 600,
            whiteSpace: 'nowrap',
            flexShrink: 0,
          }}
        >
          {getFormattedDate()}
        </div>

        {/* Right: running chip */}
        <div style={{ flex: 1, display: 'flex', justifyContent: 'flex-end', minWidth: 0 }}>
          {running.length > 0 && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 7,
                padding: '4px 12px',
                borderRadius: 20,
                background: 'rgba(74,222,128,0.10)',
                border: '1px solid rgba(74,222,128,0.22)',
              }}
            >
              <div
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: '50%',
                  background: 'var(--success)',
                  boxShadow: '0 0 7px var(--success)',
                  animation: 'pulse 1.5s infinite',
                  flexShrink: 0,
                }}
              />
              <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--success)', whiteSpace: 'nowrap' }}>
                {running.length} running
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ── MAIN BODY (scrollable) ─────────────────────────────────────────── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px 32px 32px' }}>

        {/* ── TWO-COLUMN ROW ──────────────────────────────────────────────── */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 360px',
            gap: 20,
            alignItems: 'stretch',
            marginBottom: 28,
          }}
        >

          {/* ── LEFT: FEATURED GAME CARD ───────────────────────────────────── */}
          <div
            style={{
              position: 'relative',
              borderRadius: 20,
              overflow: 'hidden',
              minHeight: 280,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'flex-end',
              background: '#0d1117',
              border: '1px solid rgba(255,255,255,0.07)',
            }}
          >
            {featuredGame ? (
              <>
                {/* Blurred backdrop */}
                {featuredBackdropUrl && (
                  <img
                    src={featuredBackdropUrl}
                    alt=""
                    onError={() => setHeroImgFailed(true)}
                    style={{
                      position: 'absolute',
                      inset: 0,
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      filter: 'blur(18px) brightness(0.35) saturate(1.4)',
                      transform: 'scale(1.08)',
                      pointerEvents: 'none',
                      userSelect: 'none',
                    }}
                  />
                )}

                {/* Bottom gradient for text readability */}
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    background:
                      'linear-gradient(to top, rgba(7,8,10,0.96) 0%, rgba(7,8,10,0.55) 55%, rgba(7,8,10,0.10) 100%)',
                    pointerEvents: 'none',
                  }}
                />

                {/* Content row */}
                <div
                  style={{
                    position: 'relative',
                    zIndex: 2,
                    display: 'flex',
                    alignItems: 'flex-end',
                    gap: 20,
                    padding: '24px 24px 24px',
                  }}
                >
                  {/* Cover poster */}
                  <div
                    style={{
                      width: 80,
                      height: 108,
                      borderRadius: 10,
                      overflow: 'hidden',
                      flexShrink: 0,
                      boxShadow: '0 8px 28px rgba(0,0,0,0.6)',
                      border: '1px solid rgba(255,255,255,0.12)',
                    }}
                  >
                    <GamePoster
                      src={getFileUrl(featuredGame[2])}
                      fallbackSrcs={[featuredGame[6], featuredGame[7]]
                        .map((u) => getFileUrl(u))
                        .filter((u): u is string => u !== null)}
                      title={featuredGame[1]}
                      variant="portrait"
                    />
                  </div>

                  {/* Text info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: 'var(--accent)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.08em',
                        marginBottom: 5,
                      }}
                    >
                      {isRunning(featuredGame) ? 'Now Playing' : 'Continue Playing'}
                    </div>
                    <div
                      style={{
                        fontSize: 22,
                        fontWeight: 900,
                        letterSpacing: '-0.5px',
                        lineHeight: 1.15,
                        marginBottom: 8,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {featuredGame[1]}
                    </div>
                    <div
                      style={{
                        display: 'flex',
                        gap: 18,
                        marginBottom: 16,
                        flexWrap: 'wrap',
                      }}
                    >
                      <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', fontWeight: 600 }}>
                        <Clock size={11} style={{ marginRight: 4, verticalAlign: 'middle' }} />
                        {formatTime(featuredGame[4])} played
                      </span>
                      <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', fontWeight: 600 }}>
                        Last played {formatLastPlayed(featuredGame[9])}
                      </span>
                    </div>

                    {/* Progress bar (only if HLTB data exists) */}
                    {featuredGame[8] && featuredGame[8] > 0 ? (
                      <div style={{ marginBottom: 16, maxWidth: 280 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                          <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', fontWeight: 600 }}>
                            Completion
                          </span>
                          <span style={{ fontSize: 10, fontWeight: 800, color: 'var(--accent)' }}>
                            {Math.round(calculateProgress(featuredGame))}%
                          </span>
                        </div>
                        <ProgressBar progress={calculateProgress(featuredGame)} height={4} />
                      </div>
                    ) : null}

                    {/* Action buttons */}
                    <div style={{ display: 'flex', gap: 10 }}>
                      <ActionButton
                        onClick={() => onSelectGame(featuredGame[0])}
                        icon={<Play size={14} fill="currentColor" />}
                        style={{ padding: '9px 22px', fontSize: 13 }}
                      >
                        {isRunning(featuredGame) ? 'View Game' : 'Play Now'}
                      </ActionButton>
                      <button
                        type="button"
                        onClick={() => onSelectGame(featuredGame[0])}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 5,
                          padding: '9px 18px',
                          background: 'rgba(255,255,255,0.06)',
                          border: '1px solid rgba(255,255,255,0.1)',
                          borderRadius: 10,
                          color: 'rgba(255,255,255,0.7)',
                          fontSize: 13,
                          fontWeight: 700,
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = 'rgba(255,255,255,0.11)';
                          e.currentTarget.style.color = '#fff';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'rgba(255,255,255,0.06)';
                          e.currentTarget.style.color = 'rgba(255,255,255,0.7)';
                        }}
                      >
                        Details <ChevronRight size={13} />
                      </button>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              /* Empty state */
              <div
                style={{
                  position: 'relative',
                  zIndex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flex: 1,
                  gap: 16,
                  padding: 40,
                  textAlign: 'center',
                  minHeight: 280,
                }}
              >
                <div
                  style={{
                    width: 64,
                    height: 64,
                    borderRadius: 20,
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.09)',
                    display: 'grid',
                    placeItems: 'center',
                    color: 'rgba(255,255,255,0.25)',
                  }}
                >
                  <Gamepad2 size={28} />
                </div>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 6 }}>No games yet</div>
                  <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.38)', marginBottom: 20 }}>
                    Add your first game to get started
                  </div>
                  <ActionButton onClick={onAddGame} icon={<Plus size={15} />}>
                    Add Your First Game
                  </ActionButton>
                </div>
              </div>
            )}
          </div>

          {/* ── RIGHT COLUMN ────────────────────────────────────────────────── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* QUICK ACTIONS 2×2 grid */}
            <div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: 10,
                }}
              >
                {[
                  {
                    label: 'Library',
                    sub: `${stats?.total_games ?? 0} games`,
                    icon: LayoutGrid,
                    color: '#818cf8',
                    onClick: onViewLibrary,
                  },
                  {
                    label: 'Add Game',
                    sub: 'Import or search',
                    icon: Plus,
                    color: '#34d399',
                    onClick: onAddGame,
                  },
                  {
                    label: 'Analytics',
                    sub: 'Playtime & trends',
                    icon: BarChart3,
                    color: '#f59e0b',
                    onClick: onViewStats,
                  },
                  {
                    label: 'Can I Run It?',
                    sub: 'Check specs',
                    icon: ShieldCheck,
                    color: '#60a5fa',
                    onClick: onViewCompatibility,
                  },
                ].map(({ label, sub, icon: Icon, color, onClick }) => (
                  <button
                    key={label}
                    type="button"
                    onClick={onClick}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 10,
                      padding: '16px 14px',
                      background: 'rgba(255,255,255,0.03)',
                      border: '1px solid rgba(255,255,255,0.07)',
                      borderRadius: 14,
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'all 0.18s cubic-bezier(0.4,0,0.2,1)',
                      color: '#fff',
                    }}
                    onMouseEnter={(e) => {
                      const el = e.currentTarget;
                      el.style.background = 'rgba(255,255,255,0.065)';
                      el.style.borderColor = `color-mix(in srgb, ${color} 38%, transparent)`;
                      el.style.transform = 'translateY(-2px)';
                      el.style.boxShadow = `0 6px 20px rgba(0,0,0,0.28)`;
                    }}
                    onMouseLeave={(e) => {
                      const el = e.currentTarget;
                      el.style.background = 'rgba(255,255,255,0.03)';
                      el.style.borderColor = 'rgba(255,255,255,0.07)';
                      el.style.transform = 'translateY(0)';
                      el.style.boxShadow = 'none';
                    }}
                  >
                    <div
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 10,
                        background: `color-mix(in srgb, ${color} 14%, transparent)`,
                        border: `1px solid color-mix(in srgb, ${color} 30%, transparent)`,
                        display: 'grid',
                        placeItems: 'center',
                        color,
                        flexShrink: 0,
                      }}
                    >
                      <Icon size={16} />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div
                        style={{
                          fontWeight: 800,
                          fontSize: 13,
                          lineHeight: 1.2,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {label}
                      </div>
                      <div
                        style={{
                          fontSize: 10,
                          color: 'rgba(255,255,255,0.38)',
                          marginTop: 2,
                          fontWeight: 600,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {sub}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* DIVIDER */}
            <div style={{ height: 1, background: 'rgba(255,255,255,0.06)' }} />

            {/* OVERVIEW STATS — 3 horizontal mini tiles */}
            <div>
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 800,
                  color: 'rgba(255,255,255,0.3)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                  marginBottom: 10,
                }}
              >
                Overview
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                {[
                  {
                    label: 'Total Games',
                    value: String(stats?.total_games ?? 0),
                    icon: LayoutGrid,
                    color: '#818cf8',
                  },
                  {
                    label: 'Hours Played',
                    value: formatTime(stats?.total_playtime_seconds ?? 0),
                    icon: Clock,
                    color: '#60a5fa',
                  },
                  {
                    label: 'Completed',
                    value: String(stats?.games_completed ?? 0),
                    icon: CheckCircle2,
                    color: '#34d399',
                  },
                ].map(({ label, value, icon: Icon, color }) => (
                  <div
                    key={label}
                    style={{
                      flex: 1,
                      background: 'rgba(255,255,255,0.03)',
                      border: '1px solid rgba(255,255,255,0.07)',
                      borderRadius: 12,
                      padding: '12px 10px',
                      textAlign: 'center',
                      minWidth: 0,
                    }}
                  >
                    <Icon
                      size={15}
                      style={{ color, marginBottom: 6, display: 'block', margin: '0 auto 6px' }}
                    />
                    <div
                      style={{
                        fontWeight: 900,
                        fontSize: 15,
                        lineHeight: 1,
                        marginBottom: 4,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {value}
                    </div>
                    <div
                      style={{
                        fontSize: 9,
                        color: 'rgba(255,255,255,0.35)',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '0.06em',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {label}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* DIVIDER */}
            <div style={{ height: 1, background: 'rgba(255,255,255,0.06)' }} />

            {/* MOST PLAYED */}
            {(stats?.most_played_game || mostPlayed) && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '14px 16px',
                  background: 'rgba(255,193,7,0.05)',
                  border: '1px solid rgba(255,193,7,0.13)',
                  borderRadius: 14,
                }}
              >
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    background: 'rgba(255,193,7,0.12)',
                    border: '1px solid rgba(255,193,7,0.25)',
                    display: 'grid',
                    placeItems: 'center',
                    flexShrink: 0,
                    color: '#ffc107',
                  }}
                >
                  <Trophy size={16} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 9,
                      fontWeight: 800,
                      color: 'rgba(255,255,255,0.35)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.09em',
                      marginBottom: 3,
                    }}
                  >
                    Most Played
                  </div>
                  <div
                    style={{
                      fontWeight: 800,
                      fontSize: 14,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      color: '#fff',
                    }}
                  >
                    {stats?.most_played_game || mostPlayed?.[1] || '—'}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onViewStats}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    fontSize: 11,
                    fontWeight: 700,
                    color: 'rgba(255,255,255,0.45)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '4px 0',
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                    transition: 'color 0.15s',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = '#fff'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = 'rgba(255,255,255,0.45)'; }}
                >
                  Analytics <ChevronRight size={12} />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ── RECENTLY PLAYED RAIL ─────────────────────────────────────────── */}
        <section>
          {/* Section header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 16,
            }}
          >
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>Recently Played</h2>
            <button
              type="button"
              onClick={onViewLibrary}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                fontSize: 12,
                fontWeight: 700,
                color: 'rgba(255,255,255,0.45)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '4px 0',
                transition: 'color 0.15s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.color = '#fff'; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = 'rgba(255,255,255,0.45)'; }}
            >
              View All <ChevronRight size={13} />
            </button>
          </div>

          {/* Rail content */}
          {recentGames.length <= 1 ? (
            <GlassCard style={{ padding: '40px', textAlign: 'center' }}>
              <p className="muted-label">No other recent activity</p>
            </GlassCard>
          ) : (
            <div
              className="home-rail"
              style={{
                display: 'flex',
                gap: 16,
                overflowX: 'auto',
                paddingBottom: 8,
              }}
            >
              {recentGames.slice(1, 9).map((game) => (
                <article
                  key={game[0]}
                  className="home-rail-item"
                  onClick={() => onSelectGame(game[0])}
                  style={{
                    minWidth: 140,
                    maxWidth: 140,
                    cursor: 'pointer',
                    flexShrink: 0,
                  }}
                >
                  <div
                    style={{
                      position: 'relative',
                      borderRadius: 12,
                      overflow: 'hidden',
                      boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
                    }}
                  >
                    <GamePoster
                      src={getFileUrl(game[2])}
                      fallbackSrcs={[game[6], game[7]]
                        .map((u) => getFileUrl(u))
                        .filter((u): u is string => u !== null)}
                      title={game[1]}
                      variant="portrait"
                    />
                    {isRunning(game) && (
                      <div
                        style={{
                          position: 'absolute',
                          top: 9,
                          right: 9,
                          width: 10,
                          height: 10,
                          borderRadius: '50%',
                          background: 'var(--success)',
                          boxShadow: '0 0 12px var(--success)',
                          border: '2px solid #000',
                        }}
                      />
                    )}
                  </div>
                  <div
                    className="rail-title"
                    style={{
                      marginTop: 10,
                      fontWeight: 800,
                      fontSize: 13,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {game[1]}
                  </div>
                  <div
                    className="rail-meta"
                    style={{ fontSize: 11, opacity: 0.45, marginTop: 2, fontWeight: 600 }}
                  >
                    {formatTime(game[4])} played
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default Home;
