import React, { useEffect, useState, useMemo } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { getFileUrl } from '../utils/fileUtils';
import HeroBanner from '../components/GameDetails/HeroBanner';
import GameDetailsSkeleton from '../components/GameDetails/GameDetailsSkeleton';
import GamePoster from '../components/common/GamePoster';
import { FullGameData, MediaImage, Trailer, GameMediaResponse } from '../types';
import { mergeGameMediaResponses } from '../utils/mergeGameMedia';
import { useToast } from '../hooks/useToast';
import theme from '../theme';
import { getBestPoster, getBestBackground } from '../utils/imageFallback';
import ActionButton from '../components/common/ActionButton';
import ImagePickerModal from '../components/common/ImagePickerModal';
import AddToPlaylistModal from '../components/common/AddToPlaylistModal';
import MediaCarousel from '../components/common/MediaCarousel';
import SafeImage from '../components/common/SafeImage';
import TrackingInfoCard from '../components/GameDetails/TrackingInfoCard';
import GameCompatibilityModal, { type AdvisorHit } from '../components/common/GameCompatibilityModal';
import PerformanceAdvisorCard, {
  type PerfSummary,
} from '../components/GameDetails/PerformanceAdvisorCard';
import { ResponsiveContainer, BarChart, Bar, XAxis, Tooltip, Cell, CartesianGrid } from 'recharts';
import {
  Calendar, Star, History, Film, Image as ImageIcon, Camera,
  BarChart3, Gamepad2, User, ChevronLeft, RefreshCw, Play,
  Clock, Crosshair,
} from 'lucide-react';

interface GameDetailsProps {
  gameId: number;
  onBack: () => void;
  onDeleted: () => void;
  onSelectGame?: (id: number) => void;
  onGoSettings?: () => void;
}

const GameDetails: React.FC<GameDetailsProps> = ({
  gameId,
  onBack,
  onDeleted,
  onSelectGame,
  onGoSettings,
}) => {
  const [gameData, setGameData] = useState<FullGameData | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [isPinned, setIsPinned] = useState(false);
  const [activeMediaTab, setActiveMediaTab] = useState<'screenshots' | 'artwork' | 'trailers'>('screenshots');
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [recentSessions, setRecentSessions] = useState<any[]>([]);
  const [imagePicker, setImagePicker] = useState<{ type: 'cover' | 'artwork' | 'screenshot', title: string, images: MediaImage[] } | null>(null);
  const [showAllSimilar, setShowAllSimilar] = useState(false);
  const [showAddToPlaylist, setShowAddToPlaylist] = useState(false);
  const [mediaData, setMediaData] = useState<GameMediaResponse | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [compactMedia, setCompactMedia] = useState(false);
  const [perfSummary, setPerfSummary] = useState<PerfSummary | null>(null);
  const [perfLoading, setPerfLoading] = useState(true);
  const [perfNoHw, setPerfNoHw] = useState(false);
  const [perfNoReq, setPerfNoReq] = useState(false);
  const [fetchingReqs, setFetchingReqs] = useState(false);
  const [hasProfile, setHasProfile] = useState<boolean | null>(null);
  const [compatModal, setCompatModal] = useState<AdvisorHit | null>(null);
  const [hoveredSimilar, setHoveredSimilar] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'media' | 'activity' | 'similar'>('overview');
  const { showSuccess, showError, showInfo } = useToast();

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 720px)');
    const fn = () => setCompactMedia(mq.matches);
    fn();
    mq.addEventListener('change', fn);
    return () => mq.removeEventListener('change', fn);
  }, []);

  const buildMediaFromGameRow = (data: FullGameData): GameMediaResponse | null => {
    try {
      const artworks: MediaImage[] = data.artworks ? JSON.parse(data.artworks) : [];
      const screenshots: MediaImage[] = data.screenshots ? JSON.parse(data.screenshots) : [];
      const trailers: Trailer[] = data.videos ? JSON.parse(data.videos) : [];
      const covers: MediaImage[] = [];
      if (data.cover_url) {
        covers.push({ id: `current_cover_${data.id}`, url: data.cover_url, thumb_url: data.cover_url, source: 'current' });
      }
      covers.push(...artworks);
      return {
        covers, artworks, screenshots, trailers, logos: [],
        stats: {
          igdb_cover: data.cover_url ? 1 : 0,
          igdb_artworks: artworks.filter((a) => a.source === 'igdb').length,
          igdb_screenshots: screenshots.filter((s) => s.source === 'igdb').length,
          igdb_trailers: trailers.filter((t) => t.source === 'igdb').length,
          fallback_source: null, fallback_posters: 0, fallback_backgrounds: 0,
          final_poster_options: covers.length,
          final_background_options: artworks.length + screenshots.length,
        },
      };
    } catch { return null; }
  };

  const loadData = async (opts?: { forceSgdbMedia?: boolean }) => {
    try {
      const [data, running] = await Promise.all([
        invoke<FullGameData>('get_game_full', { id: gameId }),
        invoke<string[]>('detect_running_games'),
      ]);
      setGameData(data);
      setIsPinned(Boolean((data as any).is_pinned));
      setIsRunning(running.includes(data.process_name.toLowerCase()));
      const realHistory = await invoke<any[]>('get_game_sessions', { processName: data.process_name });
      setRecentSessions(realHistory);

      setPerfLoading(true);
      try {
        const profiles = await invoke<Array<{ isActive?: boolean }>>('list_hardware_profiles');
        const hasActive = profiles.some((p) => p.isActive);
        setHasProfile(hasActive);
        const sum = await invoke<PerfSummary | null>('get_performance_summary_for_game', { gameId });
        setPerfNoHw(!hasActive);
        setPerfSummary(sum);
        setPerfNoReq(hasActive && !sum);
      } catch {
        setPerfSummary(null);
        setPerfNoHw(true);
        setPerfNoReq(false);
        setHasProfile(false);
      } finally { setPerfLoading(false); }

      const baseMedia = buildMediaFromGameRow(data);
      if (baseMedia) {
        try {
          const opt = await invoke<GameMediaResponse>('get_game_media_options', { gameId, forceMoreOptions: Boolean(opts?.forceSgdbMedia) });
          setMediaData(mergeGameMediaResponses(baseMedia, opt));
        } catch { setMediaData(baseMedia); }
      }
    } catch (e) {
      const message = String(e ?? '');
      if (message.toLowerCase().includes('row not found')) setNotFound(true);
      else console.error('Failed to load game details', e);
    } finally { setLoading(false); }
  };

  const handleRefreshMetadata = async () => {
    if (!gameData) return;
    setRefreshing(true);
    try {
      await invoke('refresh_game_metadata', { gameId });
      await loadData({ forceSgdbMedia: true });
      showSuccess('Metadata refreshed successfully');
    } catch (e) { showError(`Failed to refresh metadata: ${e}`); }
    finally { setRefreshing(false); }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(() => loadData(), 5000);
    return () => clearInterval(interval);
  }, [gameId]);

  const activityByDay = useMemo(() => {
    const keys: string[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - i);
      keys.push(d.toISOString().slice(0, 10));
    }
    const map = new Map<string, number>();
    keys.forEach((k) => map.set(k, 0));
    for (const s of recentSessions) {
      const day = new Date(s[0]).toISOString().slice(0, 10);
      if (map.has(day)) map.set(day, (map.get(day) || 0) + Number(s[1]));
    }
    return keys.map((k) => ({ label: k.slice(5), seconds: map.get(k) || 0 }));
  }, [recentSessions]);

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this game from your library?')) return;
    try {
      await invoke('delete_game', { id: gameId });
      showSuccess('Game deleted');
      onDeleted();
    } catch (e) { showError(`Delete failed: ${e}`); }
  };

  const handleFetchGameRequirements = async () => {
    setFetchingReqs(true);
    try {
      await invoke('fetch_game_requirements', { gameId });
      await loadData();
      showSuccess('Requirements updated from Steam when a match was found.');
    } catch (e) { showError(String(e)); }
    finally { setFetchingReqs(false); }
  };

  const handleLaunch = async () => {
    if (!gameData) return;
    try {
      const ok = await invoke<boolean>('verify_exe_path', { path: gameData.exe_path });
      if (!ok) { showError('Game executable not found. Update the EXE path in tracking settings.'); return; }
      await invoke('launch_game', { exePath: gameData.exe_path });
      showSuccess(`Launched ${gameData.title}`);
    } catch (e) { showError(`Could not launch game: ${e}`); }
  };

  const handleTogglePin = async () => {
    try {
      await invoke('toggle_game_pin', { id: gameId });
      setIsPinned(!isPinned);
      showSuccess(isPinned ? 'Game unpinned' : 'Game pinned to sidebar');
    } catch { showError('Failed to pin game'); }
  };

  const handleStatusChange = async (newStatus: string) => {
    try {
      await invoke('update_game_status', { id: gameId, status: newStatus });
      setGameData(prev => prev ? { ...prev, completion_status: newStatus as any } : null);
      showSuccess(`Status updated to ${newStatus.replace('_', ' ')}`);
    } catch { showError('Failed to update status'); }
  };

  const handleMediaChange = async (type: 'cover' | 'artwork') => {
    if (!mediaData) return;
    let enrichedMedia = mediaData;
    try {
      const refreshed = await invoke<GameMediaResponse>('get_game_media_options', { gameId, forceMoreOptions: true });
      if (refreshed) { enrichedMedia = refreshed; setMediaData(refreshed); }
    } catch (e) { console.warn('Failed to load SteamGridDB fallback media', e); }

    if (type === 'cover') {
      const posterImages = [...enrichedMedia.covers, ...enrichedMedia.artworks];
      if (posterImages.length === 0) { showError('No poster images available. Try refreshing metadata.'); return; }
      setImagePicker({ type: 'cover', title: 'Change Poster', images: posterImages });
    } else {
      const bgImages = [...enrichedMedia.artworks, ...enrichedMedia.screenshots];
      if (gameData?.cover_url) bgImages.unshift({ id: `cover_${gameData.id}`, url: gameData.cover_url, thumb_url: gameData.cover_url, source: 'current' });
      if (bgImages.length === 0) { showError('No background images available. Try refreshing metadata.'); return; }
      setImagePicker({ type: 'artwork', title: 'Change Background', images: bgImages });
    }
  };

  const handleImageSelect = async (selectedImage: MediaImage) => {
    if (!imagePicker) return;
    try {
      const url = selectedImage.url;
      if (imagePicker.type === 'cover') {
        await invoke('update_game_poster', { gameId, imageUrl: url });
        setGameData(prev => prev ? { ...prev, cover_url: url } : null);
      } else {
        await invoke('update_game_cover', { gameId, imageUrl: url });
        setGameData(prev => prev ? { ...prev, artwork_url: url } : null);
      }
      showSuccess(`${imagePicker.title} updated`);
      setImagePicker(null);
    } catch { showError('Failed to update image'); }
  };

  const openSimilarGameModal = async (sg: any) => {
    // First check if it's in library
    try {
      const id = await invoke<number | null>('get_game_id_by_igdb', { igdbId: sg.id });
      if (id != null) { onSelectGame?.(id); return; }
    } catch { /* not in library, fall through */ }

    // Search Steam by name and open compatibility modal
    try {
      const hits = await invoke<Array<{ title: string; steamAppId: number | null; coverUrl: string | null }>>
        ('search_performance_advisor_games', { query: sg.name ?? '' });
      const best = hits.find((h) => h.steamAppId != null) ?? hits[0] ?? null;
      if (best) {
        setCompatModal({ title: best.title, steamAppId: best.steamAppId, coverUrl: best.coverUrl });
      } else {
        showInfo(`"${sg.name}" not found on Steam. Add it to your library first.`);
      }
    } catch {
      showInfo('Add this game to your library to open it from here.');
    }
  };

  const openPerfModal = () => {
    if (!gameData) return;
    const steamAppId = gameData.steam_app_id ?? null;
    setCompatModal({
      title: gameData.title,
      steamAppId: typeof steamAppId === 'number' ? steamAppId : null,
      coverUrl: gameData.cover_url ?? null,
    });
  };

  if (loading && !gameData) return <GameDetailsSkeleton />;
  if (notFound || !gameData) {
    return (
      <div style={{ padding: '48px', textAlign: 'center' }}>
        <h2>Game not found</h2>
        <ActionButton onClick={onBack} variant="primary" style={{ marginTop: '24px' }}>Back to Library</ActionButton>
      </div>
    );
  }

  const releaseYear = gameData.release_date ? new Date(gameData.release_date).getFullYear().toString() : 'N/A';
  const similarGames = gameData.similar_games ? JSON.parse(gameData.similar_games) : [];
  const completionPercentage = gameData.target_hours ? Math.min(100, Math.round((gameData.total_time / 3600 / gameData.target_hours) * 100)) : 0;
  const shotTrackH = compactMedia ? 150 : 200;
  const artTrackH = compactMedia ? 108 : 132;
  const trailerTrackH = compactMedia ? 150 : 200;

  const formatTime = (sec: number) => {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    if (h <= 0) return `${m}m`;
    return `${h}h ${m}m`;
  };

  const cardStyle = {
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: 20,
    padding: '28px 32px',
    boxShadow: '0 2px 16px rgba(0,0,0,0.2)',
  };

  const sectionLabel = {
    fontSize: 11, fontWeight: 800, textTransform: 'uppercase' as const,
    letterSpacing: '0.1em', color: 'rgba(255,255,255,0.4)', marginBottom: 20,
    display: 'flex', alignItems: 'center', gap: 7,
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

  return (
    <div className="premium-page game-details-page">
      <HeroBanner
        title={gameData.title}
        description={gameData.summary}
        coverUrl={getFileUrl(getBestPoster(gameData, mediaData))}
        artworkUrl={getFileUrl(getBestBackground(gameData, mediaData))}
        screenshotUrl={null}
        trailerUrl={gameData.trailer_url}
        logoUrl={mediaData?.logos?.[0] ? getFileUrl(mediaData.logos[0].url) : null}
        rating={gameData.rating}
        releaseYear={releaseYear}
        genres={gameData.genres}
        isRunning={isRunning}
        playtimeSeconds={gameData.total_time}
        lastPlayed={gameData.last_played ? new Date(gameData.last_played).toLocaleDateString() : null}
        completionPercentage={completionPercentage}
        currentStatus={gameData.completion_status}
        onLaunch={handleLaunch}
        onDelete={handleDelete}
        onBack={onBack}
        onTogglePin={handleTogglePin}
        onStatusChange={handleStatusChange}
        onMediaChange={handleMediaChange}
        onAddToPlaylist={() => setShowAddToPlaylist(true)}
        isPinned={isPinned}
        onShowTrailers={() => setActiveMediaTab('trailers')}
      />

      <div className="premium-page-content" style={{ display: 'flex', flexDirection: 'column', maxWidth: '100%', boxSizing: 'border-box' }}>

        {/* ── Sticky Tab Bar ── */}
        <div style={{
          display: 'flex', gap: 0, borderBottom: '1px solid rgba(255,255,255,0.07)',
          marginBottom: 32, position: 'sticky', top: 0, zIndex: 30,
          background: 'rgba(7,8,10,0.92)', backdropFilter: 'blur(20px)',
          padding: '0 clamp(16px, 3vw, 48px)',
        }}>
          {(['overview', 'media', 'activity', 'similar'] as const).map(tab => {
            const labels: Record<string, string> = { overview: 'Overview', media: 'Media', activity: 'Activity', similar: 'Similar' };
            const isActive = activeTab === tab;
            return (
              <button key={tab} onClick={() => setActiveTab(tab)} style={{
                background: 'none', border: 'none', cursor: 'pointer',
                padding: '16px 24px', fontSize: 13, fontWeight: 800,
                color: isActive ? 'var(--accent)' : 'rgba(255,255,255,0.4)',
                position: 'relative', transition: 'color 0.2s',
                textTransform: 'uppercase', letterSpacing: '0.06em',
              }}>
                {labels[tab]}
                {isActive && <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 2, background: 'var(--accent)', borderRadius: '2px 2px 0 0' }} />}
              </button>
            );
          })}
        </div>

        {/* ── Tab Content ── */}
        <div style={{ padding: '0 clamp(16px, 3vw, 48px) 48px' }}>

          {/* OVERVIEW TAB */}
          {activeTab === 'overview' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 32, alignItems: 'start' }}>

              {/* Left column */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>

                {/* Overview card: cover + description + metadata + genres */}
                <div style={cardStyle}>
                  <div style={{ display: 'flex', gap: '28px' }}>
                    <div style={{ width: '140px', flexShrink: 0 }}>
                      <GamePoster
                        src={getFileUrl(getBestPoster(gameData, mediaData))}
                        fallbackSrcs={[getFileUrl(gameData.cover_url)].filter(Boolean) as string[]}
                        title={gameData.title}
                        variant="portrait"
                        style={{ borderRadius: '12px', boxShadow: '0 12px 30px rgba(0,0,0,0.5)' }}
                      />
                    </div>
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '20px', minWidth: 0 }}>
                      <div style={sectionLabel}><Gamepad2 size={13} />Overview</div>
                      <div style={{ color: 'rgba(255,255,255,0.68)', lineHeight: 1.65, fontSize: '14px' }}>
                        {gameData.storyline || gameData.summary || 'No description available.'}
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                        {[
                          { label: 'Developer', value: gameData.developer, icon: <User size={10} /> },
                          { label: 'Publisher', value: gameData.publisher, icon: null },
                          { label: 'Release', value: gameData.release_date ? new Date(gameData.release_date).toLocaleDateString() : null, icon: <Calendar size={10} /> },
                          { label: 'Platforms', value: gameData.platforms, icon: <Gamepad2 size={10} /> },
                        ].map((m, i) => m.value && (
                          <div key={i}>
                            <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(255,255,255,0.3)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4 }}>{m.icon}{m.label}</div>
                            <div style={{ color: '#fff', fontWeight: 700, fontSize: '13px' }}>{m.value}</div>
                          </div>
                        ))}
                      </div>
                      {gameData.genres && (
                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                          {gameData.genres.split(',').map((g, i) => (
                            <span key={i} style={genreChipStyle}>{g.trim()}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Performance Advisor (bottom of left col) */}
                <PerformanceAdvisorCard
                  loading={perfLoading}
                  summary={perfSummary}
                  noHardware={perfNoHw}
                  noRequirements={perfNoReq}
                  onFetchRequirements={handleFetchGameRequirements}
                  fetchingRequirements={fetchingReqs}
                  onFullReport={openPerfModal}
                />
              </div>

              {/* Right sidebar 380px */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

                {/* Playtime */}
                <div style={cardStyle}>
                  <div style={sectionLabel}><Clock size={13} />Playtime</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
                    <div>
                      <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(255,255,255,0.3)', marginBottom: 6 }}>Total</div>
                      <div style={{ color: '#fff', fontSize: '28px', fontWeight: 900, lineHeight: 1.1 }}>{formatTime(gameData.total_time)}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(255,255,255,0.3)', marginBottom: 6 }}>Sessions</div>
                      <div style={{ color: '#fff', fontSize: '28px', fontWeight: 900, lineHeight: 1.1 }}>{recentSessions.length}</div>
                    </div>
                  </div>
                  <TrackingInfoCard
                    game={{
                      id: gameData.id, title: gameData.title, cover_url: gameData.cover_url,
                      rating: gameData.rating, total_playtime_seconds: gameData.total_time,
                      process_name: gameData.process_name, process_name_aliases: gameData.process_name_aliases ?? null,
                      hltb_main_story: gameData.hltb_main_story, hltb_main_extras: gameData.hltb_main_extras,
                      hltb_completionist: gameData.hltb_completionist, target_hours: gameData.target_hours,
                      completion_status: gameData.completion_status,
                    }}
                    exe_path={gameData.exe_path}
                    onUpdate={() => void loadData()}
                  />
                </div>

                {/* Time To Beat */}
                <div style={cardStyle}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                    <div style={sectionLabel}><Crosshair size={13} />Time To Beat</div>
                    <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.18)', fontWeight: 800, letterSpacing: '0.06em' }}>HLTB</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {[
                      { label: 'Main Story', val: gameData.hltb_main_story },
                      { label: 'Main + Extras', val: gameData.hltb_main_extras },
                      { label: 'Completionist', val: gameData.hltb_completionist },
                    ].map(({ label, val }) => (
                      <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.45)', fontWeight: 600 }}>{label}</span>
                        <span style={{ fontSize: '17px', fontWeight: 900, color: val ? '#fff' : 'rgba(255,255,255,0.18)' }}>{val ? `${val}h` : '—'}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Ratings */}
                <div style={cardStyle}>
                  <div style={sectionLabel}><Star size={13} />Ratings</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                      <div style={{ width: '56px', height: '56px', borderRadius: '14px', border: '2px solid var(--accent)', display: 'grid', placeItems: 'center', fontSize: '22px', fontWeight: 900, boxShadow: '0 0 16px rgba(var(--accent-rgb), 0.25)', flexShrink: 0 }}>
                        {gameData.total_rating ? Math.round(gameData.total_rating) : '—'}
                      </div>
                      <div>
                        <div style={{ fontSize: '14px', fontWeight: 800 }}>Total Rating</div>
                        <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>{gameData.rating_count || 0} reviews</div>
                      </div>
                    </div>
                    {gameData.rating != null && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(255,193,7,0.1)', display: 'grid', placeItems: 'center', border: '1px solid rgba(255,193,7,0.2)', flexShrink: 0 }}>
                          <Star size={18} fill="#ffc107" color="#ffc107" />
                        </div>
                        <div>
                          <div style={{ fontSize: '16px', fontWeight: 900 }}>{(gameData.rating / 10).toFixed(1)}<span style={{ fontSize: '11px', opacity: 0.35, marginLeft: '3px' }}>/10</span></div>
                          <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.35)' }}>IGDB Rating</div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Similar Games mini 2-col grid */}
                {similarGames.length > 0 && (
                  <div style={cardStyle}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                      <div style={sectionLabel}><Gamepad2 size={13} />Games Like This</div>
                      {similarGames.length > 6 && (
                        <button onClick={() => setShowAllSimilar(true)} style={{ background: 'none', border: 'none', fontSize: '11px', color: 'var(--accent)', fontWeight: 800, cursor: 'pointer', padding: '4px 8px', borderRadius: '6px' }}>
                          View All ({similarGames.length})
                        </button>
                      )}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                      {similarGames.slice(0, 6).map((sg: any, idx: number) => {
                        const primary = sg.cover?.url || sg.cover_url;
                        const fb = [sg.cover?.thumb_url].map((u: string | undefined) => getFileUrl(u)).filter((u): u is string => u !== null);
                        const isHovered = hoveredSimilar === idx;
                        return (
                          <div
                            key={`similar-overview-${sg.id}-${idx}`}
                            style={{
                              cursor: 'pointer',
                              transform: isHovered ? 'scale(1.05)' : 'scale(1)',
                              transition: 'transform 0.18s ease',
                            }}
                            onClick={() => void openSimilarGameModal(sg)}
                            onMouseEnter={() => setHoveredSimilar(idx)}
                            onMouseLeave={() => setHoveredSimilar(null)}
                          >
                            <GamePoster src={getFileUrl(primary)} fallbackSrcs={fb} title={sg.name} variant="portrait"
                              style={{ borderRadius: '9px', boxShadow: '0 4px 12px rgba(0,0,0,0.4)', width: '80px', maxWidth: 80 }} />
                            <div style={{ marginTop: '6px', fontSize: '11px', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: 'rgba(255,255,255,0.8)' }}>{sg.name}</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* MEDIA TAB */}
          {activeTab === 'media' && (
            <div style={{ ...cardStyle, padding: '28px 32px' }}>
              {/* Count summary */}
              <div style={{ marginBottom: 16, fontSize: 12, color: 'rgba(255,255,255,0.35)', fontWeight: 600 }}>
                {mediaData?.screenshots.length || 0} screenshots · {mediaData?.artworks.length || 0} artworks · {mediaData?.trailers.length || 0} trailers
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, gap: 12, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                  {(['screenshots', 'artwork', 'trailers'] as const).map(tab => {
                    const count = tab === 'screenshots' ? (mediaData?.screenshots.length || 0) : tab === 'artwork' ? (mediaData?.artworks.length || 0) : (mediaData?.trailers.length || 0);
                    const isActive = activeMediaTab === tab;
                    return (
                      <button key={tab} onClick={() => setActiveMediaTab(tab)} style={{
                        background: 'none', border: 'none',
                        color: isActive ? 'var(--accent)' : 'rgba(255,255,255,0.35)',
                        fontWeight: 800, fontSize: 11, cursor: 'pointer',
                        position: 'relative',
                        padding: '4px 0',
                        paddingBottom: 6,
                        textTransform: 'uppercase', letterSpacing: '0.06em',
                        display: 'flex', alignItems: 'center', gap: '5px',
                        transition: 'color 0.2s',
                      }}>
                        {tab === 'screenshots' && <Camera size={11} />}
                        {tab === 'artwork' && <ImageIcon size={11} />}
                        {tab === 'trailers' && <Film size={11} />}
                        {tab} ({count})
                        {isActive && (
                          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '2px', background: 'var(--accent)', borderRadius: '2px' }} />
                        )}
                      </button>
                    );
                  })}
                </div>
                <button type="button" onClick={handleRefreshMetadata} disabled={refreshing} style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: '8px', padding: '6px 12px', color: 'rgba(255,255,255,0.6)',
                  fontSize: '11px', fontWeight: 700, cursor: refreshing ? 'not-allowed' : 'pointer',
                  opacity: refreshing ? 0.5 : 1, flexShrink: 0,
                }}>
                  <RefreshCw size={12} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
                  {refreshing ? 'Refreshing...' : 'Refresh Media'}
                </button>
              </div>

              <div className="game-media-track-wrap" style={{
                ...(activeMediaTab === 'artwork' && (mediaData?.artworks?.length ?? 0) > 0 ? { height: 200, maxHeight: 200 }
                  : activeMediaTab === 'artwork' ? { minHeight: 200, height: 'auto' }
                  : activeMediaTab === 'trailers' ? { height: 280, maxHeight: 280 }
                  : { height: 280, maxHeight: 280 }),
              }}>
                {activeMediaTab === 'artwork' && (
                  <MediaCarousel visibleSlots={5} trackHeight={200} responsive minItemWidth={88}>
                    {(mediaData?.artworks || []).map((img, i) => (
                      <div key={`artwork-${img.id}-${i}`} onClick={() => setPreviewImage(img.url)}
                        style={{ width: '100%', height: '100%', borderRadius: '8px', overflow: 'hidden', position: 'relative', backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', cursor: 'pointer' }}>
                        <SafeImage src={getFileUrl(img.thumb_url || img.url) || undefined} alt="" fallbackText=" " loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      </div>
                    ))}
                  </MediaCarousel>
                )}
                {activeMediaTab === 'screenshots' && (
                  <MediaCarousel visibleSlots={4} trackHeight={280} responsive minItemWidth={120}>
                    {(mediaData?.screenshots || []).map((img, i) => (
                      <div key={`screenshot-${img.id}-${i}`} onClick={() => setPreviewImage(img.url)}
                        style={{ width: '100%', height: '100%', borderRadius: '12px', overflow: 'hidden', position: 'relative', backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', cursor: 'pointer' }}>
                        <SafeImage src={getFileUrl(img.thumb_url || img.url) || undefined} alt="" fallbackText=" " loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      </div>
                    ))}
                  </MediaCarousel>
                )}
                {activeMediaTab === 'trailers' && (
                  <MediaCarousel visibleSlots={3} trackHeight={280} responsive minItemWidth={160}>
                    {(mediaData?.trailers || []).map((trailer, i) => (
                      <div key={`trailer-${trailer.id}-${i}`} onClick={() => trailer.youtube_url && window.open(trailer.youtube_url, '_blank')}
                        style={{ width: '100%', height: '100%', borderRadius: '12px', overflow: 'hidden', position: 'relative', backgroundColor: 'rgba(255,255,255,0.05)', display: 'grid', placeItems: 'center', border: '1px solid rgba(255,255,255,0.08)', cursor: 'pointer' }}>
                        <SafeImage src={getFileUrl(trailer.thumbnail_url) || undefined} alt="" fallbackText=" " loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.6 }} />
                        <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}>
                          <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'rgba(255,255,255,0.18)', backdropFilter: 'blur(8px)', display: 'grid', placeItems: 'center', border: '1px solid rgba(255,255,255,0.2)' }}>
                            <Play size={20} fill="white" color="white" />
                          </div>
                        </div>
                        <div style={{ position: 'absolute', bottom: '10px', left: '10px', right: '10px' }}>
                          <div style={{ fontSize: '12px', color: '#fff', fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{trailer.name}</div>
                        </div>
                      </div>
                    ))}
                  </MediaCarousel>
                )}
                {((activeMediaTab === 'artwork' && !mediaData?.artworks.length) ||
                  (activeMediaTab === 'screenshots' && !mediaData?.screenshots.length) ||
                  (activeMediaTab === 'trailers' && !mediaData?.trailers.length)) && (
                  <div style={{ color: 'rgba(255,255,255,0.3)', padding: '50px', textAlign: 'center', width: '100%', backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: '12px', border: '1px dashed rgba(255,255,255,0.07)' }}>
                    <div style={{ fontSize: '13px' }}>No {activeMediaTab} available</div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ACTIVITY TAB */}
          {activeTab === 'activity' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

              {/* Full-width Last 7 Days chart */}
              <div style={cardStyle}>
                <div style={sectionLabel}><BarChart3 size={13} />Last 7 Days</div>
                <div style={{ width: '100%', height: 240 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={activityByDay}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
                      <XAxis dataKey="label" stroke="transparent" tick={{ fill: '#6b7280', fontSize: 10 }} />
                      <Tooltip
                        contentStyle={{ background: '#0c0e12', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8 }}
                        formatter={(v) => [`${Math.round(Number(v) / 60)} min`, 'Playtime']}
                      />
                      <Bar dataKey="seconds" radius={[5, 5, 0, 0]}>
                        {activityByDay.map((_, i) => <Cell key={i} fill={theme.accent.primary} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Two-column: TrackingInfoCard + Recent Sessions */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                <div style={cardStyle}>
                  <TrackingInfoCard
                    game={{
                      id: gameData.id, title: gameData.title, cover_url: gameData.cover_url,
                      rating: gameData.rating, total_playtime_seconds: gameData.total_time,
                      process_name: gameData.process_name, process_name_aliases: gameData.process_name_aliases ?? null,
                      hltb_main_story: gameData.hltb_main_story, hltb_main_extras: gameData.hltb_main_extras,
                      hltb_completionist: gameData.hltb_completionist, target_hours: gameData.target_hours,
                      completion_status: gameData.completion_status,
                    }}
                    exe_path={gameData.exe_path}
                    onUpdate={() => void loadData()}
                  />
                </div>

                <div style={cardStyle}>
                  <div style={sectionLabel}><History size={13} />Recent Sessions</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {recentSessions.length > 0 ? recentSessions.slice(0, 8).map((session, idx) => (
                      <div key={idx} style={{ display: 'flex', gap: '14px', alignItems: 'center', padding: '10px 14px', background: 'rgba(255,255,255,0.03)', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.05)' }}>
                        <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(var(--accent-rgb),0.08)', display: 'grid', placeItems: 'center', border: '1px solid rgba(var(--accent-rgb),0.14)', color: 'var(--accent)', flexShrink: 0 }}>
                          <History size={13} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.35)', fontWeight: 700 }}>
                            {new Date(session[0]).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          </div>
                        </div>
                        <div style={{ fontSize: '13px', color: '#fff', fontWeight: 800, flexShrink: 0 }}>
                          {Math.floor(session[1] / 3600)}h {Math.floor((session[1] % 3600) / 60)}m
                        </div>
                      </div>
                    )) : (
                      <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.25)', textAlign: 'center', padding: '30px 0', border: '1px dashed rgba(255,255,255,0.06)', borderRadius: '10px' }}>No sessions yet</div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* SIMILAR TAB */}
          {activeTab === 'similar' && (
            similarGames.length > 0 ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '20px' }}>
                {similarGames.map((sg: any, idx: number) => {
                  const primary = sg.cover?.url || sg.cover_url;
                  const fb = [sg.cover?.thumb_url].map((u: string | undefined) => getFileUrl(u)).filter((u): u is string => u !== null);
                  const isHovered = hoveredSimilar === idx;
                  return (
                    <div
                      key={`similar-tab-${sg.id}-${idx}`}
                      style={{
                        cursor: 'pointer',
                        transform: isHovered ? 'scale(1.05)' : 'scale(1)',
                        transition: 'transform 0.18s ease',
                      }}
                      onClick={() => void openSimilarGameModal(sg)}
                      onMouseEnter={() => setHoveredSimilar(idx)}
                      onMouseLeave={() => setHoveredSimilar(null)}
                    >
                      <GamePoster src={getFileUrl(primary)} fallbackSrcs={fb} title={sg.name} variant="portrait"
                        style={{ borderRadius: '12px', boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }} />
                      <div style={{ marginTop: '10px', fontSize: '12px', fontWeight: 700, color: '#fff', lineHeight: 1.4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sg.name}</div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '80px 0', color: 'rgba(255,255,255,0.25)' }}>
                <Gamepad2 size={40} style={{ opacity: 0.2, marginBottom: 16 }} />
                <div style={{ fontSize: '16px', fontWeight: 700, marginBottom: 8 }}>No similar games found</div>
                <div style={{ fontSize: '13px' }}>Similar games data is not available for this title.</div>
              </div>
            )
          )}

        </div>
      </div>

      {/* Modals */}
      {imagePicker && (
        <ImagePickerModal title={imagePicker.title} images={imagePicker.images} onSelect={handleImageSelect} onClose={() => setImagePicker(null)} />
      )}
      {showAddToPlaylist && (
        <AddToPlaylistModal gameId={gameId} gameTitle={gameData.title} onClose={() => setShowAddToPlaylist(false)} />
      )}

      {/* Compatibility modal (similar games + performance advisor) */}
      {compatModal && (
        <GameCompatibilityModal
          hit={compatModal}
          hasProfile={hasProfile}
          onClose={() => setCompatModal(null)}
          onGoSettings={onGoSettings ?? (() => {})}
        />
      )}

      {/* All Similar Games */}
      {showAllSimilar && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(12px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={() => setShowAllSimilar(false)}>
          <div style={{ width: '900px', maxHeight: '80vh', background: 'linear-gradient(145deg, #12151a 0%, #0c0e12 100%)', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.08)', padding: '32px', overflow: 'auto' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px' }}>
              <div>
                <h2 style={{ fontSize: '22px', fontWeight: 800, margin: 0 }}>Games Like {gameData.title}</h2>
                <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.4)', margin: '6px 0 0' }}>{similarGames.length} similar games · click to check compatibility</p>
              </div>
              <button onClick={() => setShowAllSimilar(false)} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', padding: '8px', cursor: 'pointer', color: 'rgba(255,255,255,0.6)' }}>
                <ChevronLeft size={18} style={{ transform: 'rotate(-90deg)' }} />
              </button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '20px' }}>
              {similarGames.map((sg: any, idx: number) => {
                const primary = sg.cover?.url || sg.cover_url;
                const fb = [sg.cover?.thumb_url].map((u: string | undefined) => getFileUrl(u)).filter((u): u is string => u !== null);
                return (
                  <div key={`all-similar-${sg.id}-${idx}`} style={{ cursor: 'pointer' }} onClick={() => { setShowAllSimilar(false); void openSimilarGameModal(sg); }}>
                    <GamePoster src={getFileUrl(primary)} fallbackSrcs={fb} title={sg.name} variant="portrait" style={{ borderRadius: '12px', boxShadow: '0 8px 24px rgba(0,0,0,0.4)', maxWidth: 130 }} />
                    <div style={{ marginTop: '10px', fontSize: '12px', fontWeight: 700, color: '#fff', lineHeight: 1.4 }}>{sg.name}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Fullscreen image preview */}
      {previewImage && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.92)', backdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, padding: '40px' }} onClick={() => setPreviewImage(null)}>
          <button onClick={() => setPreviewImage(null)} style={{ position: 'absolute', top: '24px', right: '24px', background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', width: '44px', height: '44px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>✕</button>
          <SafeImage src={getFileUrl(previewImage) || undefined} alt="Preview" fallbackText=" " style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: '8px' }} onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </div>
  );
};

export default GameDetails;
