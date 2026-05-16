import React, { useState, useEffect, useMemo } from 'react';
import { invoke } from '@tauri-apps/api/core';
import theme from '../theme';
import GlassCard from '../components/common/GlassCard';
import ActionButton from '../components/common/ActionButton';
import { useToast } from '../hooks/useToast';
import { getFileUrl } from '../utils/fileUtils';
import { ChevronLeft, Folder, Pin } from 'lucide-react';

type PlaylistRow = { id: number; name: string; icon?: string | null; is_pinned: boolean; game_count: number };
type PlaylistGameRow = [number, string, string | null];

interface PlaylistsProps {
  onBack: () => void;
  selectedPlaylistId?: number | null;
  onClearPlaylistSelection?: () => void;
  onOpenPlaylist: (id: number) => void;
  onSelectGame: (id: number) => void;
}

const Playlists: React.FC<PlaylistsProps> = ({
  onBack,
  selectedPlaylistId,
  onClearPlaylistSelection,
  onOpenPlaylist,
  onSelectGame,
}) => {
  const [playlists, setPlaylists] = useState<PlaylistRow[]>([]);
  const [newListName, setNewListName] = useState('');
  const [loading, setLoading] = useState(true);
  const [games, setGames] = useState<PlaylistGameRow[]>([]);
  const [loadingGames, setLoadingGames] = useState(false);
  const { showSuccess, showError } = useToast();

  const fetchPlaylists = async () => {
    try {
      const data = await invoke<PlaylistRow[]>('list_playlists');
      setPlaylists(data);
    } catch (e) {
      console.error(e);
      showError('Could not load playlists');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPlaylists();
  }, []);

  useEffect(() => {
    if (selectedPlaylistId == null) {
      setGames([]);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoadingGames(true);
      try {
        const rows = await invoke<PlaylistGameRow[]>('list_playlist_games', { playlistId: selectedPlaylistId });
        if (!cancelled) setGames(rows);
      } catch (e) {
        console.error(e);
        if (!cancelled) {
          setGames([]);
          showError('Could not load games for this playlist');
        }
      } finally {
        if (!cancelled) setLoadingGames(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedPlaylistId]);

  const activePlaylist = useMemo(
    () => playlists.find((p) => p.id === selectedPlaylistId),
    [playlists, selectedPlaylistId]
  );

  const handleCreateList = async () => {
    if (!newListName.trim()) return;
    try {
      await invoke('create_playlist', { name: newListName.trim(), icon: '📁' });
      setNewListName('');
      fetchPlaylists();
      showSuccess('Playlist created');
    } catch {
      showError('Failed to create playlist');
    }
  };

  const handleTogglePin = async (id: number) => {
    try {
      await invoke('toggle_playlist_pin', { id });
      fetchPlaylists();
    } catch {
      showError('Failed to toggle pin');
    }
  };

  const handleTopBack = () => {
    if (selectedPlaylistId != null) {
      onClearPlaylistSelection?.();
      return;
    }
    onBack();
  };

  if (loading) return <div style={{ padding: '40px', color: '#fff' }}>Loading...</div>;

  return (
    <div className="premium-page">
      <div className="top-nav">
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', paddingLeft: '32px' }}>
          <button
            type="button"
            onClick={handleTopBack}
            style={{
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)',
              color: '#fff',
              padding: '8px 16px',
              borderRadius: '8px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '13px',
              fontWeight: 700,
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
            }}
          >
            <ChevronLeft size={16} /> {selectedPlaylistId != null ? 'All playlists' : 'Back'}
          </button>
        </div>
        <div className="nav-actions" />
      </div>

      <div style={{ padding: '48px 64px', color: '#fff' }}>
        {selectedPlaylistId != null ? (
          <>
            <div style={{ marginBottom: '32px' }}>
              <h1 style={theme.typography.h1}>{activePlaylist?.name || 'Playlist'}</h1>
              <p style={{ margin: '8px 0 0', fontSize: '14px', color: 'rgba(255,255,255,0.45)' }}>
                {loadingGames ? 'Loading games…' : `${games.length} game${games.length === 1 ? '' : 's'}`}
              </p>
            </div>
            {games.length === 0 && !loadingGames ? (
              <GlassCard style={{ padding: '48px', textAlign: 'center' }}>
                <p style={{ margin: 0, color: 'rgba(255,255,255,0.5)' }}>No games in this playlist yet.</p>
              </GlassCard>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '20px' }}>
                {games.map(([id, title, cover]) => (
                  <button
                    type="button"
                    key={id}
                    onClick={() => onSelectGame(id)}
                    style={{
                      textAlign: 'left',
                      padding: 0,
                      border: '1px solid rgba(255,255,255,0.08)',
                      borderRadius: 14,
                      overflow: 'hidden',
                      background: 'rgba(255,255,255,0.03)',
                      cursor: 'pointer',
                      color: '#fff',
                    }}
                  >
                    <div
                      style={{
                        aspectRatio: '2/3',
                        background: 'rgba(0,0,0,0.35)',
                        backgroundImage: getFileUrl(cover) ? `url(${getFileUrl(cover)})` : undefined,
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                      }}
                    />
                    <div style={{ padding: '12px 14px', fontWeight: 800, fontSize: 14 }}>{title}</div>
                  </button>
                ))}
              </div>
            )}
          </>
        ) : (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px', flexWrap: 'wrap', gap: 16 }}>
              <h1 style={theme.typography.h1}>My Playlists</h1>
              <div style={{ display: 'flex', gap: '12px' }}>
                <input
                  type="text"
                  placeholder="New List Name..."
                  value={newListName}
                  onChange={(e) => setNewListName(e.target.value)}
                  style={{
                    backgroundColor: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '8px',
                    padding: '10px 16px',
                    color: '#fff',
                    width: '240px',
                  }}
                />
                <ActionButton onClick={handleCreateList} variant="primary">
                  Create List
                </ActionButton>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '24px' }}>
              {playlists.map((pl) => (
                <GlassCard key={pl.id} style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div
                        style={{
                          width: '40px',
                          height: '40px',
                          borderRadius: '10px',
                          background: 'rgba(255,255,255,0.05)',
                          display: 'grid',
                          placeItems: 'center',
                          color: 'var(--accent)',
                        }}
                      >
                        <Folder size={20} />
                      </div>
                      <div>
                        <div style={{ fontSize: '18px', fontWeight: 700 }}>{pl.name}</div>
                        <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)' }}>{pl.game_count} games</div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleTogglePin(pl.id)}
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        opacity: pl.is_pinned ? 1 : 0.2,
                        color: pl.is_pinned ? 'var(--accent)' : '#fff',
                        transition: 'all 0.2s ease',
                      }}
                    >
                      <Pin size={20} fill={pl.is_pinned ? 'currentColor' : 'none'} />
                    </button>
                  </div>
                  <div style={{ marginTop: 'auto', display: 'flex', gap: '8px' }}>
                    <ActionButton
                      onClick={() => onOpenPlaylist(pl.id)}
                      variant="secondary"
                      style={{ flex: 1, fontSize: '12px', padding: '8px' }}
                    >
                      View games
                    </ActionButton>
                    {pl.id > 2 && (
                      <ActionButton
                        onClick={async () => {
                          if (confirm('Delete this playlist?')) {
                            await invoke('delete_playlist', { id: pl.id });
                            fetchPlaylists();
                          }
                        }}
                        variant="secondary"
                        style={{ color: '#ff4444', fontSize: '12px', padding: '8px' }}
                      >
                        Delete
                      </ActionButton>
                    )}
                  </div>
                </GlassCard>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default Playlists;
