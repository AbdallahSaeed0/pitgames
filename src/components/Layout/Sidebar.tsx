import React from 'react';
import { invoke } from '@tauri-apps/api/core';
import { getFileUrl, getBackgroundImageUrl } from '../../utils/fileUtils';
import { Home, Library, BarChart3, Gamepad2, Settings, ShieldCheck, Folder, ChevronDown, User, Star } from 'lucide-react';

interface SidebarProps {
  currentPage: string;
  selectedPlaylistId?: number | null;
  setPage: (page: any, id?: number) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ currentPage, selectedPlaylistId, setPage }) => {
  const [brandLogoSrc, setBrandLogoSrc] = React.useState('/Firefly%20(1).png');
  const [profile, setProfile] = React.useState<any>(null);
  const [playlists, setPlaylists] = React.useState<any[]>([]);
  const [pinnedGames, setPinnedGames] = React.useState<any[]>([]);
  const [runningGames, setRunningGames] = React.useState<any[]>([]);
  const [allGamesCount, setAllGamesCount] = React.useState(0);
  const [playlistsExpanded, setPlaylistsExpanded] = React.useState(true);

  React.useEffect(() => {
    const fetchData = async () => {
        try {
            const [_, p, pl, pg, runningNames, games] = await Promise.all([
                invoke<any>('get_dashboard_stats'),
                invoke<any>('get_user_profile'),
                invoke<any[]>('list_playlists'),
                invoke<any[]>('list_pinned_games'),
                invoke<string[]>('detect_running_games'),
                invoke<any[]>('list_games_with_time'),
            ]);
            setProfile(p);
            setPlaylists(pl);
            setPinnedGames(pg);
            const running = games.filter(g => runningNames.includes(g[5].toLowerCase()));
            setRunningGames(running);
            setAllGamesCount(games.length);
        } catch (e) {
            console.error(e);
        }
    };
    fetchData();
    const interval = setInterval(fetchData, 10000);
    window.addEventListener('profile-updated', fetchData);
    return () => {
      clearInterval(interval);
      window.removeEventListener('profile-updated', fetchData);
    };
  }, []);

  const navItems = [
    { id: 'home',          label: 'Home',          icon: Home },
    { id: 'library',       label: 'Library',       icon: Library },
    { id: 'analytics',     label: 'Analytics',     icon: BarChart3 },
    { id: 'compatibility', label: 'Can I Run It?', icon: ShieldCheck },
    { id: 'settings',      label: 'Settings',      icon: Settings },
  ];

  const xpPercent = Math.min(100, ((profile?.xp || 0) % 1000) / 10);

  return (
    <aside
      style={{
        width: '260px',
        minWidth: '260px',
        background: '#050608',
        borderRight: '1px solid rgba(255,255,255,0.05)',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflow: 'hidden',
      }}
    >
      {/* Logo */}
      <div style={{ padding: '28px 24px 20px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: 40, height: 40, flexShrink: 0, display: 'grid', placeItems: 'center' }}>
            {brandLogoSrc ? (
              <img
                src={brandLogoSrc}
                alt=""
                width={40}
                height={40}
                style={{ objectFit: 'contain', display: 'block', backgroundColor: 'transparent', mixBlendMode: 'screen' }}
                onError={() => setBrandLogoSrc((s) => (s.includes('Firefly') ? '/logo.png' : ''))}
              />
            ) : (
              <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--accent-grad)', display: 'grid', placeItems: 'center' }}>
                <Gamepad2 size={20} color="#fff" />
              </div>
            )}
          </div>
          <span style={{ fontSize: '20px', fontWeight: 900, letterSpacing: '-1px', color: '#fff', lineHeight: 1 }}>
            PitGames
          </span>
        </div>
      </div>

      {/* Scrollable body */}
      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', display: 'flex', flexDirection: 'column' }} className="sidebar-scroll">

        {/* Nav */}
        <nav style={{ padding: '4px 14px 0' }}>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '2px' }}>
            {navItems.map((item) => {
              const isActive = currentPage === item.id;
              const Icon = item.icon;
              return (
                <li
                  key={item.id}
                  onClick={() => setPage(item.id)}
                  className="sidebar-nav-item"
                  style={{
                    position: 'relative',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '9px 14px 9px 17px',
                    borderRadius: '10px',
                    cursor: 'pointer',
                    background: isActive ? 'rgba(var(--accent-rgb), 0.12)' : 'transparent',
                    color: isActive ? '#fff' : 'rgba(255,255,255,0.45)',
                    fontSize: '14px',
                    fontWeight: isActive ? 700 : 500,
                    letterSpacing: '0.1px',
                    transition: 'background 0.18s ease, color 0.18s ease',
                    overflow: 'hidden',
                  }}
                >
                  {/* Left accent bar */}
                  <div style={{
                    position: 'absolute',
                    left: 0,
                    top: '20%',
                    bottom: '20%',
                    width: '3px',
                    borderRadius: '0 3px 3px 0',
                    background: 'var(--accent)',
                    opacity: isActive ? 1 : 0,
                    transition: 'opacity 0.18s ease',
                  }} />
                  <Icon size={17} style={{ opacity: isActive ? 1 : 0.4, flexShrink: 0, transition: 'opacity 0.18s ease' }} />
                  <span style={{ flex: 1 }}>{item.label}</span>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Divider */}
        <div style={{ margin: '20px 24px 0', height: '1px', background: 'rgba(255,255,255,0.05)', flexShrink: 0 }} />

        {/* Library section */}
        <div style={{ padding: '16px 14px 0', flexShrink: 0 }}>
          {/* All Games — always visible */}
          <div
            onClick={() => setPage('library')}
            className="sidebar-sub-item"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '8px 14px',
              borderRadius: '9px',
              cursor: 'pointer',
              color: 'rgba(255,255,255,0.55)',
              fontSize: '14px',
              fontWeight: 500,
              transition: 'background 0.15s ease, color 0.15s ease',
            }}
          >
            <Gamepad2 size={15} style={{ opacity: 0.5, flexShrink: 0 }} />
            <span style={{ flex: 1 }}>All Games</span>
            <span style={{
              fontSize: '11px',
              fontWeight: 600,
              color: 'rgba(255,255,255,0.25)',
              background: 'rgba(255,255,255,0.06)',
              padding: '2px 8px',
              borderRadius: '20px',
              lineHeight: 1.5,
            }}>{allGamesCount}</span>
          </div>

          {/* Playlists header with toggle */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '12px 14px 4px', cursor: 'pointer' }}
            onClick={() => setPlaylistsExpanded(v => !v)}
          >
            <span style={{
              fontSize: '10.5px',
              fontWeight: 700,
              color: 'rgba(255,255,255,0.28)',
              textTransform: 'uppercase',
              letterSpacing: '1.8px',
              flex: 1,
            }}>Playlists</span>
            <ChevronDown
              size={13}
              style={{
                color: 'rgba(255,255,255,0.3)',
                transition: 'transform 0.2s ease',
                transform: playlistsExpanded ? 'rotate(0deg)' : 'rotate(-90deg)',
                flexShrink: 0,
              }}
            />
          </div>

          {/* Playlist items — collapsible */}
          <div style={{
            overflow: 'hidden',
            maxHeight: playlistsExpanded ? '400px' : '0px',
            transition: 'max-height 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
          }}>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '1px' }}>
              {playlists.map((pl) => {
                const isActive = currentPage === 'playlists' && selectedPlaylistId === pl.id;
                return (
                  <li
                    key={pl.id}
                    onClick={() => setPage('playlists', pl.id)}
                    className="sidebar-sub-item"
                    style={{
                      position: 'relative',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      padding: '8px 14px 8px 17px',
                      borderRadius: '9px',
                      cursor: 'pointer',
                      fontSize: '14px',
                      fontWeight: isActive ? 600 : 400,
                      color: isActive ? '#fff' : 'rgba(255,255,255,0.45)',
                      background: isActive ? 'rgba(var(--accent-rgb), 0.12)' : 'transparent',
                      transition: 'background 0.15s ease, color 0.15s ease',
                      overflow: 'hidden',
                    }}
                  >
                    {isActive && (
                      <div style={{
                        position: 'absolute',
                        left: 0,
                        top: '20%',
                        bottom: '20%',
                        width: '3px',
                        borderRadius: '0 3px 3px 0',
                        background: 'var(--accent)',
                      }} />
                    )}
                    <Folder size={14} style={{ opacity: isActive ? 0.8 : 0.35, flexShrink: 0 }} />
                    <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{pl.name}</span>
                    <span style={{
                      fontSize: '11px',
                      fontWeight: 600,
                      color: 'rgba(255,255,255,0.22)',
                      background: 'rgba(255,255,255,0.05)',
                      padding: '2px 7px',
                      borderRadius: '20px',
                      lineHeight: 1.5,
                      flexShrink: 0,
                    }}>{pl.game_count}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>

        {/* Pinned games */}
        {pinnedGames.length > 0 && (
          <div style={{ padding: '20px 14px 0', flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '0 14px 8px' }}>
              <Star size={11} style={{ color: 'rgba(255,255,255,0.28)', flexShrink: 0 }} />
              <span style={{
                fontSize: '10.5px',
                fontWeight: 700,
                color: 'rgba(255,255,255,0.28)',
                textTransform: 'uppercase',
                letterSpacing: '1.8px',
              }}>Pinned</span>
            </div>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '1px' }}>
              {pinnedGames.map((game) => (
                <li
                  key={game[0]}
                  onClick={() => setPage('details', game[0])}
                  className="sidebar-sub-item"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '6px 14px',
                    borderRadius: '9px',
                    cursor: 'pointer',
                    transition: 'background 0.15s ease',
                  }}
                >
                  <div style={{
                    width: 28,
                    height: 28,
                    borderRadius: '6px',
                    overflow: 'hidden',
                    flexShrink: 0,
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.08)',
                  }}>
                    <img
                      src={getFileUrl(game[2]) || ''}
                      alt=""
                      style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                    />
                  </div>
                  <span style={{
                    fontSize: '13px',
                    fontWeight: 500,
                    color: 'rgba(255,255,255,0.7)',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    flex: 1,
                  }}>{game[1]}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Spacer */}
        <div style={{ flex: 1, minHeight: '16px' }} />
      </div>

      {/* Bottom: Now Playing + Profile */}
      <div style={{ flexShrink: 0, padding: '12px 14px 18px' }}>

        {/* Now Playing — subtle banner */}
        {runningGames.length > 0 && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '8px 14px',
            marginBottom: '10px',
            borderRadius: '10px',
            background: 'rgba(16,185,129,0.07)',
            border: '1px solid rgba(16,185,129,0.15)',
          }}>
            {/* Pulsing dot */}
            <span className="now-playing-dot" style={{
              display: 'inline-block',
              width: 7,
              height: 7,
              borderRadius: '50%',
              background: '#10b981',
              flexShrink: 0,
            }} />
            <span style={{
              fontSize: '13px',
              fontWeight: 600,
              color: 'rgba(255,255,255,0.75)',
              flex: 1,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}>{runningGames[0][1]}</span>
          </div>
        )}

        {/* Divider */}
        <div style={{ height: '1px', background: 'rgba(255,255,255,0.05)', marginBottom: '10px' }} />

        {/* Profile card */}
        <div
          onClick={() => setPage('profile')}
          className="profile-card-btn"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '10px 12px',
            borderRadius: '12px',
            cursor: 'pointer',
            border: '1px solid rgba(255,255,255,0.06)',
            background: 'rgba(255,255,255,0.02)',
            transition: 'background 0.18s ease, border-color 0.18s ease',
          }}
        >
          {/* Avatar */}
          <div style={{
            width: 38,
            height: 38,
            borderRadius: '10px',
            flexShrink: 0,
            backgroundImage: getBackgroundImageUrl(profile?.avatar_url) || 'var(--accent-grad)',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            display: 'grid',
            placeItems: 'center',
            fontWeight: 900,
            fontSize: '15px',
            color: '#fff',
            overflow: 'hidden',
            boxShadow: '0 3px 12px rgba(0,0,0,0.4)',
          }}>
            {!profile?.avatar_url && (profile?.name?.charAt(0).toUpperCase() || <User size={18} />)}
          </div>

          {/* Name + XP */}
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <div style={{ fontSize: '14px', fontWeight: 700, color: '#fff', lineHeight: 1.3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {profile?.name || 'User'}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
              <span style={{ fontSize: '10.5px', fontWeight: 600, color: 'rgba(255,255,255,0.35)', whiteSpace: 'nowrap' }}>
                Lv {profile?.level || 1}
              </span>
              {/* XP bar */}
              <div style={{ flex: 1, height: '3px', borderRadius: '2px', background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
                <div style={{
                  height: '100%',
                  width: `${xpPercent}%`,
                  borderRadius: '2px',
                  background: 'var(--accent)',
                  transition: 'width 0.6s ease',
                }} />
              </div>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .sidebar-scroll::-webkit-scrollbar {
          width: 3px;
        }
        .sidebar-scroll::-webkit-scrollbar-track {
          background: transparent;
        }
        .sidebar-scroll::-webkit-scrollbar-thumb {
          background: rgba(255,255,255,0.08);
          border-radius: 3px;
        }
        .sidebar-nav-item:hover {
          background: rgba(255,255,255,0.05) !important;
          color: rgba(255,255,255,0.85) !important;
        }
        .sidebar-sub-item:hover {
          background: rgba(255,255,255,0.05) !important;
          color: rgba(255,255,255,0.85) !important;
        }
        .profile-card-btn:hover {
          background: rgba(255,255,255,0.05) !important;
          border-color: rgba(255,255,255,0.1) !important;
        }
        @keyframes nowPlayingPulse {
          0%, 100% { opacity: 1; box-shadow: 0 0 0 0 rgba(16,185,129,0.5); }
          50% { opacity: 0.7; box-shadow: 0 0 0 4px rgba(16,185,129,0); }
        }
        .now-playing-dot {
          animation: nowPlayingPulse 2s ease-in-out infinite;
        }
      `}</style>
    </aside>
  );
};

export default Sidebar;
