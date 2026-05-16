import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { getFileUrl } from '../utils/fileUtils';
import GameCard from '../components/Library/GameCard';
import GameCardSkeleton from '../components/Library/GameCardSkeleton';
import EmptyState from '../components/common/EmptyState';
import ActionButton from '../components/common/ActionButton';
import AddToPlaylistModal from '../components/common/AddToPlaylistModal';
import ImagePickerModal from '../components/common/ImagePickerModal';
import { useToast } from '../hooks/useToast';
import { FullGameData, GameMediaResponse, MediaImage } from '../types';
import { Search, ChevronLeft, ListChecks, Trash2, Download, RefreshCw } from 'lucide-react';
import GamePoster from '../components/common/GamePoster';

const PAGE_SIZE = 36;

function shortenPerfPreset(label: string): string {
  const t = label.toLowerCase();
  if (t.includes('ultra')) return 'Ultra';
  if (t.includes('high')) return 'High';
  if (t.includes('medium')) return 'Med';
  if (t.includes('low')) return 'Low';
  if (t.includes('not supported')) return 'No';
  if (t.includes('unknown')) return '?';
  return label.length > 6 ? `${label.slice(0, 5)}…` : label;
}

type GameRow = [number, string, string | null, number | null, number, string, string | null, string | null, number | null, string | null, string];
type RunningSession = [string, string];

interface LibraryProps {
  onSelectGame: (id: number) => void;
  onAddGame: () => void;
  onBack: () => void;
}

const Library: React.FC<LibraryProps> = ({ onSelectGame, onAddGame, onBack }) => {
  const { showSuccess, showError } = useToast();
  const [games, setGames] = useState<GameRow[]>([]);
  const [running, setRunning] = useState<string[]>([]);
  const [runningSessions, setRunningSessions] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");
  
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<'all' | 'not_started' | 'in_progress' | 'completed'>('all');
  const [sortBy, setSortBy] = useState<"recent" | "title" | "playtime">("recent");
  const [addToPlaylistGame, setAddToPlaylistGame] = useState<{ id: number; title: string } | null>(null);
  const [imagePicker, setImagePicker] = useState<{
    id: number;
    title: string;
    type: 'cover' | 'artwork';
    images: MediaImage[];
  } | null>(null);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(() => new Set());
  const [page, setPage] = useState(0);
  const [perfByGameId, setPerfByGameId] = useState<Record<number, string>>({});

  const toggleSelect = useCallback((id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const exitSelectMode = useCallback(() => {
    setSelectMode(false);
    setSelectedIds(new Set());
  }, []);

  const loadGames = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    try {
      setError("");
      const [data, active, sessions] = await Promise.all([
        invoke<GameRow[]>("list_games_with_time_full"),
        invoke<string[]>("detect_running_games"),
        invoke<RunningSession[]>("get_running_sessions"),
      ]);
      setGames(data);
      setRunning(active);
      const map: Record<string, string> = {};
      for (const [processName, startedAt] of sessions) {
        map[processName.toLowerCase()] = startedAt;
      }
      setRunningSessions(map);
      try {
        const summaries = await invoke<Array<{ gameId: number; presetLabel: string }>>(
          'list_library_performance_summaries'
        );
        const m: Record<number, string> = {};
        for (const s of summaries) {
          m[s.gameId] = shortenPerfPreset(s.presetLabel);
        }
        setPerfByGameId(m);
      } catch {
        setPerfByGameId({});
      }
    } catch (e) {
      try {
        const [data, active, sessions] = await Promise.all([
          invoke<any[]>("list_games_with_time"),
          invoke<string[]>("detect_running_games"),
          invoke<RunningSession[]>("get_running_sessions"),
        ]);
        const mappedData: GameRow[] = data.map((g: any[]) => [
          g[0],
          g[1],
          g[2],
          g[3],
          g[4],
          g[5],
          g[6] ?? null,
          g[7] ?? null,
          g[8] ?? null,
          g[9] ?? null,
          'not_started' as string,
        ]);
        setGames(mappedData);
        setRunning(active);
        const map: Record<string, string> = {};
        for (const [processName, startedAt] of sessions) {
          map[processName.toLowerCase()] = startedAt;
        }
        setRunningSessions(map);
        try {
          const summaries = await invoke<Array<{ gameId: number; presetLabel: string }>>(
            'list_library_performance_summaries'
          );
          const m: Record<number, string> = {};
          for (const s of summaries) {
            m[s.gameId] = shortenPerfPreset(s.presetLabel);
          }
          setPerfByGameId(m);
        } catch {
          setPerfByGameId({});
        }
      } catch (err) {
        console.error("Failed to load library", err);
        setError("Could not load your game library. Please refresh.");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadGames();
    const interval = setInterval(() => loadGames(false), 10000);
    return () => clearInterval(interval);
  }, []);

  const filteredAndSortedGames = useMemo(() => {
    return games
      .filter(g => {
        const matchesSearch = g[1].toLowerCase().includes(searchQuery.toLowerCase());
        const matchesStatus = filterStatus === 'all' || g[10] === filterStatus;
        return matchesSearch && matchesStatus;
      })
      .sort((a, b) => {
        if (sortBy === "title") return a[1].localeCompare(b[1]);
        if (sortBy === "playtime") return b[4] - a[4];
        return b[0] - a[0];
      });
  }, [games, searchQuery, filterStatus, sortBy]);

  const pageCount = Math.max(1, Math.ceil(filteredAndSortedGames.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const pagedGames = useMemo(
    () => filteredAndSortedGames.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE),
    [filteredAndSortedGames, safePage],
  );

  useEffect(() => {
    setPage(0);
  }, [searchQuery, filterStatus, sortBy]);

  const handleBulkDelete = async () => {
    if (!selectedIds.size || !confirm(`Delete ${selectedIds.size} games?`)) return;
    try {
      await invoke('delete_games_bulk', { ids: Array.from(selectedIds) });
      showSuccess('Games removed');
      exitSelectMode();
      await loadGames(false);
    } catch (e) {
      showError(`Delete failed: ${e}`);
    }
  };

  const handleBulkRefresh = async () => {
    const ids = Array.from(selectedIds);
    if (!ids.length) return;
    try {
      for (const id of ids) {
        await invoke('refresh_game_metadata', { gameId: id });
      }
      showSuccess('Metadata refreshed');
      await loadGames(false);
    } catch (e) {
      showError(`Refresh failed: ${e}`);
    }
  };

  const openMediaPicker = async (gameId: number, gameTitle: string, type: 'cover' | 'artwork') => {
    try {
      const opt = await invoke<GameMediaResponse>('get_game_media_options', {
        gameId,
        forceMoreOptions: true,
      });
      const images =
        type === 'cover' ? opt.covers : [...(opt.artworks ?? []), ...(opt.screenshots ?? [])];
      setImagePicker({
        id: gameId,
        title: type === 'cover' ? `Choose poster — ${gameTitle}` : `Choose background — ${gameTitle}`,
        type,
        images: images as MediaImage[],
      });
    } catch (e) {
      showError(`Could not load images: ${e}`);
    }
  };

  const savePickedImage = async (img: MediaImage) => {
    if (!imagePicker) return;
    const url = img.url;
    try {
      if (imagePicker.type === 'cover') {
        await invoke('update_game_poster', { gameId: imagePicker.id, imageUrl: url });
      } else {
        await invoke('update_game_cover', { gameId: imagePicker.id, imageUrl: url });
      }
      showSuccess(imagePicker.type === 'cover' ? 'Poster updated' : 'Background updated');
      setImagePicker(null);
      await loadGames(false);
    } catch (e) {
      showError(String(e));
    }
  };

  const handlePlayFromLibrary = async (gameId: number) => {
    try {
      const data = await invoke<FullGameData>('get_game_full', { id: gameId });
      const ok = await invoke<boolean>('verify_exe_path', { path: data.exe_path });
      if (!ok) {
        showError('Executable not found. Fix the path from game details.');
        return;
      }
      await invoke('launch_game', { exePath: data.exe_path });
      showSuccess(`Launched ${data.title}`);
    } catch (e) {
      showError(`Launch failed: ${e}`);
    }
  };

  const handleRefreshOne = async (gameId: number) => {
    try {
      await invoke('refresh_game_metadata', { gameId });
      showSuccess('Metadata refreshed');
      await loadGames(false);
    } catch (e) {
      showError(`Refresh failed: ${e}`);
    }
  };

  const handleBulkExport = async () => {
    const ids = Array.from(selectedIds);
    if (!ids.length) return;
    try {
      const json = await invoke<string>('export_games_snapshot', { ids });
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `pitgames-export-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showSuccess('Export downloaded');
    } catch (e) {
      showError(`Export failed: ${e}`);
    }
  };

  // Stats computations
  const totalPlaytimeSeconds = games.reduce((acc, g) => acc + g[4], 0);
  const totalHours = Math.floor(totalPlaytimeSeconds / 3600);
  const completedCount = games.filter(g => g[10] === 'completed').length;
  const completionRate = games.length > 0 ? Math.round((completedCount / games.length) * 100) : 0;
  const runningCount = running.length;

  const nowPlayingGame = games.find(g => running.includes(g[5].toLowerCase()));
  const inProgressGames = games.filter(g => g[10] === 'in_progress');
  const showContinuePlaying = inProgressGames.length > 0 && !searchQuery && filterStatus === 'all';

  return (
    <div className="premium-page">
      {/* Page header */}
      <div style={{ padding: '36px clamp(16px, 3vw, 48px) 0', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 style={{ fontSize: 40, fontWeight: 900, letterSpacing: '-1.5px', margin: 0 }}>Library</h1>
          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', fontWeight: 700, marginTop: 4, display: 'block' }}>
            {games.length} games
          </span>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <ActionButton onClick={onAddGame} style={{ borderRadius: 10, padding: '10px 24px' }}>+ Add Game</ActionButton>
          <ActionButton
            variant="secondary"
            onClick={() => selectMode ? exitSelectMode() : setSelectMode(true)}
            style={{ borderRadius: 10, padding: '10px 16px' }}
            icon={<ListChecks size={16} />}
          >
            {selectMode ? 'Cancel' : 'Select'}
          </ActionButton>
        </div>
      </div>

      <div className="premium-page-content" style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
        {/* Stats bar */}
        <div style={{ padding: '20px clamp(16px, 3vw, 48px) 0', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {[
            { label: 'Total Games', value: games.length },
            { label: 'Hours Played', value: `${totalHours}h` },
            { label: 'Completed', value: `${completedCount} (${completionRate}%)` },
            ...(runningCount > 0 ? [{ label: 'Running Now', value: runningCount, highlight: true }] : []),
          ].map((stat, i) => (
            <div key={i} style={{
              padding: '10px 18px', borderRadius: 12,
              background: stat.highlight ? 'rgba(34,197,94,0.12)' : 'rgba(255,255,255,0.04)',
              border: `1px solid ${stat.highlight ? 'rgba(34,197,94,0.25)' : 'rgba(255,255,255,0.07)'}`,
              display: 'flex', flexDirection: 'column', gap: 2,
            }}>
              <div style={{ fontSize: 11, color: stat.highlight ? '#22c55e' : 'rgba(255,255,255,0.4)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{stat.label}</div>
              <div style={{ fontSize: 18, fontWeight: 900, color: stat.highlight ? '#22c55e' : '#fff' }}>{stat.value}</div>
            </div>
          ))}
        </div>

        {/* Now Playing */}
        {nowPlayingGame && (
          <div style={{ padding: '24px clamp(16px, 3vw, 48px) 0' }}>
            <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#22c55e', marginBottom: 14 }}>⬤ Now Playing</div>
            <div
              onClick={() => onSelectGame(nowPlayingGame[0])}
              style={{
                position: 'relative', borderRadius: 20, overflow: 'hidden', cursor: 'pointer',
                border: '1px solid rgba(34,197,94,0.3)',
                background: 'linear-gradient(135deg, rgba(7,8,10,0.95) 0%, rgba(7,8,10,0.8) 100%)',
                padding: '24px 32px', display: 'flex', alignItems: 'center', gap: 24,
                boxShadow: '0 0 40px rgba(34,197,94,0.1)',
              }}
            >
              <GamePoster
                src={getFileUrl(nowPlayingGame[2])}
                fallbackSrcs={[nowPlayingGame[6], nowPlayingGame[7]].map(u => getFileUrl(u)).filter((u): u is string => u !== null)}
                title={nowPlayingGame[1]}
                variant="portrait"
                style={{ width: 64, borderRadius: 10, flexShrink: 0, boxShadow: '0 8px 24px rgba(0,0,0,0.5)' }}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 22, fontWeight: 900, color: '#fff', letterSpacing: '-0.5px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{nowPlayingGame[1]}</div>
                <div style={{ fontSize: 13, color: '#22c55e', fontWeight: 700, marginTop: 4 }}>Running now</div>
              </div>
              <div style={{
                padding: '10px 22px', borderRadius: 12, background: '#22c55e', color: '#000',
                fontSize: 13, fontWeight: 800, flexShrink: 0,
              }}>View Details →</div>
            </div>
          </div>
        )}

        {/* Continue Playing */}
        {showContinuePlaying && (
          <div style={{ padding: '32px clamp(16px, 3vw, 48px) 0' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.4)' }}>Continue Playing</div>
              <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', fontWeight: 700 }}>{inProgressGames.length} games in progress</span>
            </div>
            <div style={{ display: 'flex', gap: 16, overflowX: 'auto', paddingBottom: 12 }}>
              {inProgressGames.slice(0, 10).map(g => {
                const isRunning = running.includes(g[5].toLowerCase());
                const startedAt = runningSessions[g[5].toLowerCase()];
                const runningSeconds = startedAt ? Math.max(0, Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000)) : 0;
                return (
                  <div key={g[0]} style={{ flexShrink: 0, width: 160, cursor: 'pointer' }} onClick={() => onSelectGame(g[0])}>
                    <GameCard
                      id={g[0]}
                      title={g[1]}
                      coverUrl={getFileUrl(g[2])}
                      fallbackSrcs={[g[6], g[7]].map(url => getFileUrl(url)).filter((url): url is string => url !== null)}
                      rating={g[3]}
                      playtime={isRunning ? runningSeconds : g[4]}
                      isRunning={isRunning}
                      completionStatus={g[10]}
                      onClick={() => onSelectGame(g[0])}
                      onPlay={() => void handlePlayFromLibrary(g[0])}
                      onViewDetails={() => onSelectGame(g[0])}
                      onChangePoster={() => void openMediaPicker(g[0], g[1], 'cover')}
                      onChangeBackground={() => void openMediaPicker(g[0], g[1], 'artwork')}
                      onAddToPlaylist={() => setAddToPlaylistGame({ id: g[0], title: g[1] })}
                      onRefreshMetadata={() => void handleRefreshOne(g[0])}
                      performanceTier={perfByGameId[g[0]] ?? null}
                      onDelete={async () => {
                        if (!confirm(`Delete ${g[1]} from library?`)) return;
                        await invoke("delete_game", { id: g[0] });
                        await loadGames(false);
                      }}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Divider */}
        <div style={{ height: 1, background: 'rgba(255,255,255,0.05)', margin: '24px clamp(16px,3vw,48px)' }} />

        {/* Your Library section */}
        <div style={{ padding: '0 clamp(16px, 3vw, 48px) 48px' }}>
          {/* Section header + controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 24, flexWrap: 'wrap' }}>
            <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.4)', whiteSpace: 'nowrap' }}>
              Your Library {searchQuery || filterStatus !== 'all' ? `· ${filteredAndSortedGames.length} results` : `· ${games.length} games`}
            </div>
            <div style={{ flex: 1, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              <div className="search-bar" style={{ width: 280 }}>
                <Search className="icon" size={14} />
                <input type="text" placeholder="Search games..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
              </div>
              <select value={filterStatus} onChange={e => setFilterStatus(e.target.value as any)} className="app-select"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 10, padding: '10px 16px', fontWeight: 700, fontSize: 13 }}>
                <option value="all">All Status</option>
                <option value="not_started">Not Started</option>
                <option value="in_progress">Playing</option>
                <option value="completed">Completed</option>
                <option value="backlog">Backlog</option>
                <option value="dropped">Dropped</option>
              </select>
              <select value={sortBy} onChange={e => setSortBy(e.target.value as any)} className="app-select"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 10, padding: '10px 16px', fontWeight: 700, fontSize: 13 }}>
                <option value="recent">Recently Added</option>
                <option value="title">Title A–Z</option>
                <option value="playtime">Most Played</option>
              </select>
            </div>
          </div>

          {/* Bulk bar */}
          {selectMode && (
            <div className="library-bulk-bar">
              <span style={{ fontWeight: 800, color: '#fff' }}>{selectedIds.size} selected</span>
              <ActionButton variant="secondary" icon={<Trash2 size={14} />} onClick={handleBulkDelete} disabled={!selectedIds.size}>
                Delete
              </ActionButton>
              <ActionButton variant="secondary" icon={<RefreshCw size={14} />} onClick={handleBulkRefresh} disabled={!selectedIds.size}>
                Refresh metadata
              </ActionButton>
              <ActionButton variant="secondary" icon={<Download size={14} />} onClick={handleBulkExport} disabled={!selectedIds.size}>
                Export JSON
              </ActionButton>
            </div>
          )}

          {/* Pagination */}
          {filteredAndSortedGames.length > PAGE_SIZE && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, justifyContent: 'flex-end' }}>
              <span className="muted-label" style={{ fontSize: 12 }}>
                Page {safePage + 1} / {pageCount}
              </span>
              <button type="button" className="stats-back-btn" disabled={safePage <= 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>
                Prev
              </button>
              <button type="button" className="stats-back-btn" disabled={safePage >= pageCount - 1} onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}>
                Next
              </button>
            </div>
          )}

          {error ? <div className="error-banner" style={{ marginBottom: '24px' }}>{error}</div> : null}

          {/* Grid or empty state */}
          {loading && games.length === 0 ? (
            <div className="library-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '24px' }}>
              {[...Array(12)].map((_, i) => <GameCardSkeleton key={i} />)}
            </div>
          ) : filteredAndSortedGames.length === 0 ? (
            searchQuery || filterStatus !== 'all' ? (
              <div className="premium-card" style={{ padding: '80px 20px', textAlign: 'center' }}>
                <EmptyState
                  icon="🔍"
                  title="No games found"
                  description={`No games match "${searchQuery || filterStatus}". Try adjusting your search or filters.`}
                  actionLabel="Clear Filters"
                  onAction={() => { setSearchQuery(''); setFilterStatus('all'); }}
                />
              </div>
            ) : (
              <div style={{ padding: '48px 0' }}>
                {/* Welcome banner */}
                <div style={{
                  maxWidth: 620, margin: '0 auto 40px',
                  background: 'rgba(var(--accent-rgb),0.06)',
                  border: '1px solid rgba(var(--accent-rgb),0.18)',
                  borderRadius: 24, padding: '40px 44px', textAlign: 'center',
                }}>
                  <div style={{ fontSize: 56, marginBottom: 18, lineHeight: 1 }}>🎮</div>
                  <h2 style={{ fontSize: 24, fontWeight: 900, letterSpacing: '-0.5px', margin: '0 0 10px', color: '#fff' }}>
                    Welcome to your Library!
                  </h2>
                  <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.5)', margin: '0 0 28px', lineHeight: 1.6 }}>
                    Add your games to track playtime, set completion goals, and keep everything organized in one place.
                  </p>
                  <button
                    type="button"
                    onClick={onAddGame}
                    style={{
                      background: 'var(--accent)', color: '#fff', border: 'none',
                      borderRadius: 12, padding: '14px 36px',
                      fontSize: 15, fontWeight: 800, cursor: 'pointer',
                      boxShadow: '0 4px 20px rgba(var(--accent-rgb),0.4)',
                      transition: 'all 0.2s ease',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.88'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.transform = 'translateY(0)'; }}
                  >
                    + Add Your First Game
                  </button>
                </div>

                {/* How-it-works steps */}
                <div style={{ maxWidth: 620, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16 }}>
                  {[
                    { step: '1', icon: '🔍', title: 'Search or Import', desc: 'Find your game by name — we pull metadata from IGDB automatically.' },
                    { step: '2', icon: '⏱', title: 'Track Playtime', desc: 'Launch games directly from PitGames to track every session automatically.' },
                    { step: '3', icon: '📊', title: 'View Analytics', desc: 'See playtime charts, completion rates, and insights in the Analytics page.' },
                  ].map(({ step, icon, title, desc }) => (
                    <div key={step} style={{
                      background: 'rgba(255,255,255,0.03)',
                      border: '1px solid rgba(255,255,255,0.07)',
                      borderRadius: 16, padding: '22px 20px', textAlign: 'center',
                    }}>
                      <div style={{ fontSize: 28, marginBottom: 10 }}>{icon}</div>
                      <div style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px', color: 'var(--accent)', marginBottom: 6 }}>Step {step}</div>
                      <div style={{ fontSize: 14, fontWeight: 800, color: '#fff', marginBottom: 6 }}>{title}</div>
                      <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.42)', lineHeight: 1.55 }}>{desc}</div>
                    </div>
                  ))}
                </div>
              </div>
            )
          ) : (
            <div className="library-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '24px' }}>
              {pagedGames.map((g) => {
                const isRunning = running.includes(g[5].toLowerCase());
                const processName = g[5].toLowerCase();
                const startedAt = runningSessions[processName];
                const runningSeconds = startedAt
                  ? Math.max(0, Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000))
                  : 0;

                return (
                  <GameCard
                    key={g[0]}
                    id={g[0]}
                    title={g[1]}
                    coverUrl={getFileUrl(g[2])}
                    fallbackSrcs={[g[6], g[7]].map(url => getFileUrl(url)).filter((url): url is string => url !== null)}
                    rating={g[3]}
                    playtime={isRunning ? runningSeconds : g[4]}
                    isRunning={isRunning}
                    completionStatus={g[10]}
                    selectMode={selectMode}
                    selected={selectedIds.has(g[0])}
                    onSelectToggle={toggleSelect}
                    onClick={() => {
                      if (selectMode) toggleSelect(g[0]);
                      else onSelectGame(g[0]);
                    }}
                    onPlay={() => void handlePlayFromLibrary(g[0])}
                    onViewDetails={() => onSelectGame(g[0])}
                    onChangePoster={() => void openMediaPicker(g[0], g[1], 'cover')}
                    onChangeBackground={() => void openMediaPicker(g[0], g[1], 'artwork')}
                    onAddToPlaylist={() => setAddToPlaylistGame({ id: g[0], title: g[1] })}
                    onRefreshMetadata={() => void handleRefreshOne(g[0])}
                    performanceTier={perfByGameId[g[0]] ?? null}
                    onDelete={async () => {
                      if (!confirm(`Delete ${g[1]} from library?`)) return;
                      await invoke("delete_game", { id: g[0] });
                      await loadGames(false);
                    }}
                  />
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      {addToPlaylistGame && (
        <AddToPlaylistModal
          gameId={addToPlaylistGame.id}
          gameTitle={addToPlaylistGame.title}
          onClose={() => setAddToPlaylistGame(null)}
        />
      )}

      {imagePicker && (
        <ImagePickerModal
          title={imagePicker.title}
          images={imagePicker.images}
          type={imagePicker.type === 'cover' ? 'cover' : 'artwork'}
          onClose={() => setImagePicker(null)}
          onSelect={(img) => void savePickedImage(img)}
        />
      )}
    </div>
  );
};

export default Library;
