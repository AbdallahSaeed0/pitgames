import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useToast } from '../../hooks/useToast';
import { X, Plus, Folder, Check } from 'lucide-react';

interface Playlist {
  id: number;
  name: string;
  game_count: number;
}

interface PlaylistRow {
  id: number;
  name: string;
  icon: string | null;
  is_pinned: boolean;
  game_count: number;
}

interface AddToPlaylistModalProps {
  gameId: number;
  gameTitle: string;
  onClose: () => void;
}

const AddToPlaylistModal: React.FC<AddToPlaylistModalProps> = ({ gameId, gameTitle, onClose }) => {
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [gamePlaylists, setGamePlaylists] = useState<number[]>([]);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [showCreateInput, setShowCreateInput] = useState(false);
  const [loading, setLoading] = useState(true);
  const { showSuccess, showError } = useToast();

  useEffect(() => {
    loadPlaylists();
  }, [gameId]);

  const loadPlaylists = async () => {
    try {
      const [plData, gamePlData] = await Promise.all([
        invoke<PlaylistRow[]>('list_playlists'),
        invoke<number[]>('get_game_playlists', { gameId }),
      ]);
      setPlaylists(
        plData.map((p) => ({ id: p.id, name: p.name, game_count: Number(p.game_count) ?? 0 })),
      );
      setGamePlaylists(gamePlData);
    } catch (e) {
      showError('Failed to load playlists');
    } finally {
      setLoading(false);
    }
  };

  const handleTogglePlaylist = async (playlistId: number) => {
    const isInPlaylist = gamePlaylists.includes(playlistId);
    try {
      if (isInPlaylist) {
        await invoke('remove_game_from_playlist', { playlistId, gameId });
        setGamePlaylists(prev => prev.filter(id => id !== playlistId));
        showSuccess(`Removed from playlist`);
      } else {
        await invoke('add_game_to_playlist', { playlistId, gameId });
        setGamePlaylists(prev => [...prev, playlistId]);
        showSuccess(`Added to playlist`);
      }
    } catch (e) {
      showError('Failed to update playlist');
    }
  };

  const handleCreatePlaylist = async () => {
    if (!newPlaylistName.trim()) return;
    try {
      await invoke('create_playlist', { name: newPlaylistName.trim(), icon: null });
      setNewPlaylistName('');
      setShowCreateInput(false);
      await loadPlaylists();
      showSuccess('Playlist created');
    } catch (e) {
      showError('Failed to create playlist');
    }
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0, 0, 0, 0.8)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
    }} onClick={onClose}>
      <div 
        style={{
          width: '400px',
          background: 'linear-gradient(145deg, #12151a 0%, #0c0e12 100%)',
          borderRadius: '20px',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          padding: '28px',
          boxShadow: '0 25px 50px rgba(0, 0, 0, 0.5)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <div>
            <h3 style={{ fontSize: '20px', fontWeight: 800, margin: 0, color: '#fff' }}>Add to Playlist</h3>
            <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.4)', margin: '4px 0 0' }}>{gameTitle}</p>
          </div>
          <button 
            onClick={onClose}
            style={{ 
              background: 'rgba(255,255,255,0.05)', 
              border: 'none', 
              borderRadius: '10px', 
              padding: '8px',
              cursor: 'pointer',
              color: 'rgba(255,255,255,0.6)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <X size={20} />
          </button>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'rgba(255,255,255,0.4)' }}>Loading...</div>
        ) : (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' }}>
              {playlists.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '32px', color: 'rgba(255,255,255,0.4)', fontSize: '14px' }}>
                  No playlists yet. Create your first one!
                </div>
              ) : (
                playlists.map((playlist, index) => {
                  const isSelected = gamePlaylists.includes(playlist.id);
                  return (
                    <button
                      key={`playlist-${playlist.id}-${index}`}
                      onClick={() => handleTogglePlaylist(playlist.id)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        padding: '14px 16px',
                        borderRadius: '12px',
                        border: '1px solid',
                        borderColor: isSelected ? 'rgba(var(--accent-rgb), 0.4)' : 'rgba(255,255,255,0.05)',
                        background: isSelected ? 'rgba(var(--accent-rgb), 0.15)' : 'rgba(255,255,255,0.02)',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        width: '100%',
                        textAlign: 'left',
                      }}
                    >
                      <div style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '8px',
                        background: isSelected ? 'var(--accent-grad)' : 'rgba(255,255,255,0.05)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}>
                        {isSelected ? <Check size={16} color="var(--accent-on-fill)" /> : <Folder size={16} color="rgba(255,255,255,0.5)" />}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '14px', fontWeight: 700, color: '#fff' }}>{playlist.name}</div>
                        <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)' }}>{playlist.game_count} games</div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            {showCreateInput ? (
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  value={newPlaylistName}
                  onChange={(e) => setNewPlaylistName(e.target.value)}
                  placeholder="Playlist name..."
                  autoFocus
                  style={{
                    flex: 1,
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '10px',
                    padding: '12px 16px',
                    color: '#fff',
                    fontSize: '14px',
                    outline: 'none',
                  }}
                  onKeyDown={(e) => e.key === 'Enter' && handleCreatePlaylist()}
                />
                <button
                  onClick={handleCreatePlaylist}
                  disabled={!newPlaylistName.trim()}
                  style={{
                    background: 'var(--accent-grad)',
                    border: 'none',
                    borderRadius: '10px',
                    padding: '12px 20px',
                    color: 'var(--accent-on-fill)',
                    fontWeight: 700,
                    cursor: newPlaylistName.trim() ? 'pointer' : 'not-allowed',
                    opacity: newPlaylistName.trim() ? 1 : 0.5,
                  }}
                >
                  Create
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowCreateInput(true)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  width: '100%',
                  padding: '14px',
                  borderRadius: '12px',
                  border: '1px dashed rgba(255,255,255,0.2)',
                  background: 'transparent',
                  color: 'rgba(255,255,255,0.6)',
                  fontSize: '14px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
              >
                <Plus size={18} />
                Create New Playlist
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default AddToPlaylistModal;
