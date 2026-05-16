import React, { useCallback, useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { enable, disable, isEnabled } from '@tauri-apps/plugin-autostart';
import { useToast } from '../hooks/useToast';
import { getFileUrl } from '../utils/fileUtils';
import {
  readStoredHeroGameId,
  writeStoredHeroGameId,
  notifyHomeHeroBgChanged,
  resetHomeHeroToAuto,
  readHomeHeroCustomImageUrl,
} from '../utils/homeHeroBackground';
import HomeHeroBackgroundModal from '../components/home/HomeHeroBackgroundModal';
import UpdateCheckModal, { GitHubReleaseCheck } from '../components/settings/UpdateCheckModal';
import { APP_VERSION, GITHUB_OWNER, GITHUB_REPO } from '../constants/appRelease';
import {
  ExternalLink, Save, Pizza, Image as ImageIcon, Download,
  Wifi, Key, Settings as SettingsIcon,
  Database, CheckCircle2, XCircle,
  Eye, EyeOff, RefreshCw,
} from 'lucide-react';

interface SettingsProps {
  onRefreshLibrary: () => void;
}

type LibraryGameRow = [number, string, string | null, number | null];

interface ApiKeysSettings {
  igdbClientId: string;
  igdbClientSecretSaved: boolean;
  rawgApiKeySaved: boolean;
  steamgriddbApiKeySaved: boolean;
  igdbReady: boolean;
  rawgReady: boolean;
  steamgriddbReady: boolean;
  igdbClientIdFromEnvironment: boolean;
  igdbClientSecretFromEnvironment: boolean;
  rawgApiKeyFromEnvironment: boolean;
  steamgriddbApiKeyFromEnvironment: boolean;
}

// ── reusable primitives ─────────────────────────────────────────────────────

const SectionHeader = ({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle?: string }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
    <div style={{
      width: 34, height: 34, borderRadius: 9, flexShrink: 0,
      background: 'rgba(var(--accent-rgb),0.12)',
      border: '1px solid rgba(var(--accent-rgb),0.2)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: 'var(--accent)',
    }}>{icon}</div>
    <div>
      <div style={{ fontWeight: 800, fontSize: 15 }}>{title}</div>
      {subtitle && <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 1 }}>{subtitle}</div>}
    </div>
  </div>
);

const Row = ({ label, children, sub }: { label: string; children: React.ReactNode; sub?: string }) => (
  <div style={{
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    gap: 16, padding: '13px 0', borderBottom: '1px solid rgba(255,255,255,0.05)',
  }}>
    <div>
      <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.85)' }}>{label}</div>
      {sub && <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.38)', marginTop: 3 }}>{sub}</div>}
    </div>
    {children}
  </div>
);

const Toggle = ({ checked, onChange, disabled }: { checked: boolean; onChange: () => void; disabled?: boolean }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    disabled={disabled}
    onClick={onChange}
    style={{
      flexShrink: 0,
      width: 42, height: 24, borderRadius: 999,
      border: 'none',
      background: checked ? 'var(--accent)' : 'rgba(255,255,255,0.12)',
      cursor: disabled ? 'wait' : 'pointer',
      position: 'relative',
      transition: 'background 0.2s',
      padding: 0,
    }}
  >
    <div style={{
      position: 'absolute', top: 3,
      left: checked ? 21 : 3,
      width: 18, height: 18, borderRadius: '50%',
      background: '#fff',
      transition: 'left 0.2s',
      boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
    }} />
  </button>
);

const FieldLabel = ({ children }: { children: React.ReactNode }) => (
  <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.06em', color: 'rgba(255,255,255,0.4)', marginBottom: 6 }}>
    {children}
  </div>
);

const Input = (props: React.InputHTMLAttributes<HTMLInputElement>) => (
  <input
    {...props}
    style={{
      width: '100%', boxSizing: 'border-box',
      background: 'rgba(255,255,255,0.05)',
      border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: 9, padding: '10px 14px',
      color: '#fff', fontSize: 14,
      ...(props.style ?? {}),
    }}
  />
);

const StatusBadge = ({ ready }: { ready: boolean }) => (
  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
    {ready
      ? <CheckCircle2 size={14} style={{ color: '#4ade80' }} />
      : <XCircle size={14} style={{ color: 'rgba(255,255,255,0.25)' }} />}
    <span style={{ fontSize: 12, fontWeight: 700, color: ready ? '#4ade80' : 'rgba(255,255,255,0.35)' }}>
      {ready ? 'Ready' : 'Not set'}
    </span>
  </div>
);

const Card = ({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) => (
  <div style={{
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: 16, padding: '22px 24px',
    ...(style ?? {}),
  }}>
    {children}
  </div>
);

// ── main component ──────────────────────────────────────────────────────────

const Settings: React.FC<SettingsProps> = ({ onRefreshLibrary }) => {
  const { showSuccess, showError } = useToast();
  const [loadingKeys, setLoadingKeys] = useState(true);
  const [savingKeys, setSavingKeys] = useState(false);
  const [keysMeta, setKeysMeta] = useState<ApiKeysSettings | null>(null);

  const [igdbClientId, setIgdbClientId] = useState('');
  const [igdbClientSecret, setIgdbClientSecret] = useState('');
  const [clearIgdbClientSecret, setClearIgdbClientSecret] = useState(false);
  const [rawgApiKey, setRawgApiKey] = useState('');
  const [steamgriddbApiKey, setSteamgriddbApiKey] = useState('');
  const [removeRawgApiKey, setRemoveRawgApiKey] = useState(false);
  const [removeSteamgriddbApiKey, setRemoveSteamgriddbApiKey] = useState(false);

  // ── show/hide password state ──
  const [showIgdbSecret, setShowIgdbSecret] = useState(false);
  const [showRawgKey, setShowRawgKey] = useState(false);
  const [showSteamgridKey, setShowSteamgridKey] = useState(false);

  // ── test connection loading state ──
  const [testingIgdb, setTestingIgdb] = useState(false);
  const [testingRawg, setTestingRawg] = useState(false);
  const [testingSteamgrid, setTestingSteamgrid] = useState(false);

  const [launchOnStartup, setLaunchOnStartup] = useState(false);
  const [launchOnStartupLoading, setLaunchOnStartupLoading] = useState(true);
  const [startMinimizedTray, setStartMinimizedTray] = useState(false);
  const [startMinTrayLoading, setStartMinTrayLoading] = useState(true);

  const [libraryGames, setLibraryGames] = useState<LibraryGameRow[]>([]);
  const [heroGameId, setHeroGameId] = useState<number | null>(() => readStoredHeroGameId());
  const [heroCustomUrl, setHeroCustomUrl] = useState<string | null>(() => readHomeHeroCustomImageUrl());
  const [homeHeroModalOpen, setHomeHeroModalOpen] = useState(false);
  const [updateCheckLoading, setUpdateCheckLoading] = useState(false);
  const [updateModal, setUpdateModal] = useState<GitHubReleaseCheck | null>(null);

  // ── data loading ──

  const loadApiKeys = useCallback(async () => {
    setLoadingKeys(true);
    try {
      const data = await invoke<ApiKeysSettings>('get_api_keys_settings');
      setKeysMeta(data);
      setIgdbClientId(data.igdbClientId);
      setIgdbClientSecret('');
      setClearIgdbClientSecret(false);
      setRawgApiKey('');
      setSteamgriddbApiKey('');
      setRemoveRawgApiKey(false);
      setRemoveSteamgriddbApiKey(false);
    } catch { showError('Could not load API key settings'); }
    finally { setLoadingKeys(false); }
  }, [showError]);

  useEffect(() => { void loadApiKeys(); }, [loadApiKeys]);

  useEffect(() => {
    (async () => {
      try { setLibraryGames(await invoke<LibraryGameRow[]>('list_games')); } catch { /* ignore */ }
    })();
  }, []);

  useEffect(() => {
    let c = false;
    (async () => {
      try { if (!c) setLaunchOnStartup(await isEnabled()); } catch { if (!c) setLaunchOnStartup(false); }
      finally { if (!c) setLaunchOnStartupLoading(false); }
    })();
    return () => { c = true; };
  }, []);

  useEffect(() => {
    let c = false;
    (async () => {
      try { if (!c) setStartMinimizedTray(await invoke<boolean>('get_start_minimized_to_tray')); }
      catch { if (!c) setStartMinimizedTray(false); }
      finally { if (!c) setStartMinTrayLoading(false); }
    })();
    return () => { c = true; };
  }, []);

  // ── actions ──

  const toggleStartMinTray = async () => {
    try {
      const next = !startMinimizedTray;
      await invoke('set_start_minimized_to_tray', { enabled: next });
      setStartMinimizedTray(next);
      showSuccess(next ? 'Window close will minimize to tray' : 'Window close will exit the app');
    } catch (e) { showError(String(e)); }
  };

  const toggleLaunchOnStartup = async () => {
    try {
      if (launchOnStartup) { await disable(); setLaunchOnStartup(false); showSuccess('Launch on startup disabled'); }
      else { await enable(); setLaunchOnStartup(true); showSuccess('Launch on startup enabled'); }
    } catch (e) { showError(`Autostart error: ${e}`); }
  };

  const handleSaveApiKeys = async () => {
    setSavingKeys(true);
    try {
      await invoke('save_api_keys_settings', {
        payload: {
          igdbClientId: igdbClientId.trim(),
          igdbClientSecret,
          clearIgdbClientSecret,
          rawgApiKey,
          steamgriddbApiKey,
          removeRawgApiKey,
          removeSteamgriddbApiKey,
        },
      });
      showSuccess('API keys saved');
      await loadApiKeys();
    } catch (e) {
      showError(typeof e === 'string' ? e : e instanceof Error ? e.message : String(e));
    } finally { setSavingKeys(false); }
  };

  const handleTestIgdb = async () => {
    setTestingIgdb(true);
    try {
      const ok = await invoke<boolean>('test_igdb_connection');
      if (ok) showSuccess('IGDB connection OK');
      else showError('IGDB: Connection failed — check your keys');
    } catch {
      showError('IGDB: Connection failed — check your keys');
    } finally { setTestingIgdb(false); }
  };

  const handleTestRawg = async () => {
    setTestingRawg(true);
    try {
      const ok = await invoke<boolean>('test_rawg_connection');
      if (ok) showSuccess('RAWG connection OK');
      else showError('RAWG: Connection failed — check your key');
    } catch {
      showError('RAWG: Connection failed — check your key');
    } finally { setTestingRawg(false); }
  };

  const handleTestSteamgrid = async () => {
    setTestingSteamgrid(true);
    try {
      const ok = await invoke<boolean>('test_steamgriddb_connection');
      if (ok) showSuccess('SteamGridDB connection OK');
      else showError('SteamGridDB: Connection failed — check your key');
    } catch {
      showError('SteamGridDB: Connection failed — check your key');
    } finally { setTestingSteamgrid(false); }
  };

  const handleCheckUpdates = async () => {
    if (!GITHUB_OWNER || !GITHUB_REPO) { showError('Set VITE_GITHUB_OWNER and VITE_GITHUB_REPO to check updates.'); return; }
    setUpdateCheckLoading(true);
    try {
      const res = await invoke<GitHubReleaseCheck>('check_github_app_release', { owner: GITHUB_OWNER, repo: GITHUB_REPO, currentVersion: APP_VERSION });
      if (res.update_available) setUpdateModal(res);
      else showSuccess('You are on the latest version.');
    } catch (e) { showError(typeof e === 'string' ? e : String(e)); }
    finally { setUpdateCheckLoading(false); }
  };

  const selectHomeHeroGame = (gameId: number | null) => {
    writeStoredHeroGameId(gameId);
    setHeroGameId(gameId);
    notifyHomeHeroBgChanged();
    showSuccess(gameId != null ? "Home hero will use that game's cover art" : 'Home hero reset to automatic');
  };

  const syncHeroState = () => {
    setHeroGameId(readStoredHeroGameId());
    setHeroCustomUrl(readHomeHeroCustomImageUrl());
  };

  // ── render ──

  return (
    <div className="premium-page" style={{ maxWidth: 860, margin: '0 auto' }}>

      {/* Page title */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
        <div style={{
          width: 38, height: 38, borderRadius: 11,
          background: 'rgba(var(--accent-rgb),0.12)',
          border: '1px solid rgba(var(--accent-rgb),0.22)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'var(--accent)',
        }}>
          <SettingsIcon size={20} />
        </div>
        <div>
          <h1 style={{ margin: 0, fontSize: 22 }}>Settings</h1>
          <p style={{ margin: 0, fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>Configure PitGames to your liking</p>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* ── General ── */}
        <Card>
          <SectionHeader icon={<SettingsIcon size={16} />} title="General" />

          <Row label="App version" sub={APP_VERSION}>
            <button type="button" className="btn btn-secondary" disabled={updateCheckLoading}
              onClick={() => void handleCheckUpdates()}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 13 }}>
              <Download size={14} />
              {updateCheckLoading ? 'Checking…' : 'Check for updates'}
            </button>
          </Row>

          <Row label="Launch on startup" sub="Starts PitGames in the background so playtime tracking runs without opening the window first.">
            <Toggle checked={launchOnStartup} onChange={() => void toggleLaunchOnStartup()} disabled={launchOnStartupLoading} />
          </Row>

          <Row label="Minimize to tray on close" sub="Closing the window sends the app to the system tray instead of quitting.">
            <Toggle checked={startMinimizedTray} onChange={() => void toggleStartMinTray()} disabled={startMinTrayLoading} />
          </Row>
        </Card>

        {/* ── API Keys ── */}
        <Card>
          <SectionHeader
            icon={<Key size={16} />}
            title="API Keys"
            subtitle="Stored locally. Environment variables override anything saved here."
          />

          {/* New-user onboarding: no keys configured */}
          {keysMeta && !keysMeta.igdbReady && !keysMeta.rawgReady && !keysMeta.steamgriddbReady && (
            <div style={{
              marginBottom: 20,
              padding: '18px 20px',
              background: 'rgba(251,191,36,0.06)',
              border: '1px solid rgba(251,191,36,0.2)',
              borderRadius: 14,
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <div style={{ fontSize: 22, flexShrink: 0, lineHeight: 1 }}>🔑</div>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 14, color: '#fbbf24', marginBottom: 6 }}>
                    Set up API keys to unlock the full experience
                  </div>
                  <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)', margin: '0 0 12px', lineHeight: 1.6 }}>
                    Without API keys, game search and artwork won't work. It only takes a minute — all keys are free.
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {[
                      { name: 'IGDB (Twitch)', desc: 'Game search & metadata — the backbone of adding games', required: true },
                      { name: 'RAWG', desc: 'Extra game data and descriptions', required: false },
                      { name: 'SteamGridDB', desc: 'High-quality artwork and banners', required: false },
                    ].map(({ name, desc, required }) => (
                      <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>
                        <span style={{
                          fontSize: 9, fontWeight: 800, padding: '1px 6px', borderRadius: 999, textTransform: 'uppercase',
                          background: required ? 'rgba(251,191,36,0.18)' : 'rgba(255,255,255,0.08)',
                          color: required ? '#fbbf24' : 'rgba(255,255,255,0.35)',
                        }}>{required ? 'Required' : 'Optional'}</span>
                        <strong style={{ color: 'rgba(255,255,255,0.75)' }}>{name}</strong> — {desc}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Status row */}
          {keysMeta && (
            <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', padding: '12px 16px', borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', marginBottom: 20, alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)' }}>IGDB</span>
                <StatusBadge ready={keysMeta.igdbReady} />
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={!keysMeta.igdbReady || testingIgdb}
                  title={!keysMeta.igdbReady ? 'Save keys first' : 'Test IGDB connection'}
                  onClick={() => void handleTestIgdb()}
                  style={{ fontSize: 12, padding: '5px 10px', opacity: !keysMeta.igdbReady ? 0.4 : 1, display: 'inline-flex', alignItems: 'center', gap: 5 }}
                >
                  <RefreshCw size={11} style={testingIgdb ? { animation: 'spin 1s linear infinite' } : undefined} />
                  {testingIgdb ? 'Testing…' : 'Test'}
                </button>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)' }}>RAWG</span>
                <StatusBadge ready={keysMeta.rawgReady} />
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={!keysMeta.rawgReady || testingRawg}
                  title={!keysMeta.rawgReady ? 'Save keys first' : 'Test RAWG connection'}
                  onClick={() => void handleTestRawg()}
                  style={{ fontSize: 12, padding: '5px 10px', opacity: !keysMeta.rawgReady ? 0.4 : 1, display: 'inline-flex', alignItems: 'center', gap: 5 }}
                >
                  <RefreshCw size={11} style={testingRawg ? { animation: 'spin 1s linear infinite' } : undefined} />
                  {testingRawg ? 'Testing…' : 'Test'}
                </button>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)' }}>SteamGridDB</span>
                <StatusBadge ready={keysMeta.steamgriddbReady} />
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={!keysMeta.steamgriddbReady || testingSteamgrid}
                  title={!keysMeta.steamgriddbReady ? 'Save keys first' : 'Test SteamGridDB connection'}
                  onClick={() => void handleTestSteamgrid()}
                  style={{ fontSize: 12, padding: '5px 10px', opacity: !keysMeta.steamgriddbReady ? 0.4 : 1, display: 'inline-flex', alignItems: 'center', gap: 5 }}
                >
                  <RefreshCw size={11} style={testingSteamgrid ? { animation: 'spin 1s linear infinite' } : undefined} />
                  {testingSteamgrid ? 'Testing…' : 'Test'}
                </button>
              </div>
            </div>
          )}

          {keysMeta && (keysMeta.igdbClientIdFromEnvironment || keysMeta.igdbClientSecretFromEnvironment || keysMeta.rawgApiKeyFromEnvironment || keysMeta.steamgriddbApiKeyFromEnvironment) && (
            <div style={{ padding: '10px 14px', borderRadius: 8, background: 'rgba(var(--accent-rgb),0.08)', border: '1px solid rgba(var(--accent-rgb),0.18)', fontSize: 13, marginBottom: 20 }}>
              <strong>Environment keys active.</strong> Some keys are coming from your system environment — inputs may look blank while the API still works.
            </div>
          )}

          {loadingKeys ? (
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>Loading…</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 22, maxWidth: 560 }}>

              {/* IGDB */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <FieldLabel>IGDB — Twitch Developer Portal</FieldLabel>
                  <a href="https://dev.twitch.tv/console/apps" target="_blank" rel="noopener noreferrer"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--accent)' }}>
                    Open console <ExternalLink size={11} />
                  </a>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <Input type="text" autoComplete="off" value={igdbClientId}
                    onChange={(e) => setIgdbClientId(e.target.value)} placeholder="Client ID" />
                  <div style={{ position: 'relative' }}>
                    <Input
                      type={showIgdbSecret ? 'text' : 'password'}
                      autoComplete="new-password"
                      value={igdbClientSecret}
                      onChange={(e) => setIgdbClientSecret(e.target.value)}
                      placeholder={keysMeta?.igdbClientSecretSaved ? 'Leave blank to keep current secret' : 'Client Secret'}
                      style={{ paddingRight: 44 }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowIgdbSecret((v) => !v)}
                      style={{
                        position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                        background: 'none', border: 'none', cursor: 'pointer',
                        color: 'rgba(255,255,255,0.4)', padding: 0, display: 'flex', alignItems: 'center',
                      }}
                      aria-label={showIgdbSecret ? 'Hide secret' : 'Show secret'}
                    >
                      {showIgdbSecret ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, cursor: 'pointer', fontSize: 13, color: 'rgba(255,255,255,0.6)' }}>
                  <input type="checkbox" checked={clearIgdbClientSecret} onChange={(e) => setClearIgdbClientSecret(e.target.checked)}
                    style={{ accentColor: 'var(--accent)' }} />
                  Remove saved Client Secret
                </label>
              </div>

              {/* RAWG */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <FieldLabel>RAWG</FieldLabel>
                  <a href="https://rawg.io/apidocs" target="_blank" rel="noopener noreferrer"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--accent)' }}>
                    API docs <ExternalLink size={11} />
                  </a>
                </div>
                <div style={{ position: 'relative' }}>
                  <Input
                    type={showRawgKey ? 'text' : 'password'}
                    autoComplete="off"
                    value={rawgApiKey}
                    onChange={(e) => setRawgApiKey(e.target.value)}
                    placeholder={keysMeta?.rawgApiKeySaved ? 'Enter new key to replace' : 'RAWG API key'}
                    style={{ paddingRight: 44 }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowRawgKey((v) => !v)}
                    style={{
                      position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                      background: 'none', border: 'none', cursor: 'pointer',
                      color: 'rgba(255,255,255,0.4)', padding: 0, display: 'flex', alignItems: 'center',
                    }}
                    aria-label={showRawgKey ? 'Hide key' : 'Show key'}
                  >
                    {showRawgKey ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, cursor: 'pointer', fontSize: 13, color: 'rgba(255,255,255,0.6)' }}>
                  <input type="checkbox" checked={removeRawgApiKey} onChange={(e) => setRemoveRawgApiKey(e.target.checked)}
                    style={{ accentColor: 'var(--accent)' }} />
                  Remove saved RAWG key
                </label>
              </div>

              {/* SteamGridDB */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <FieldLabel>SteamGridDB</FieldLabel>
                  <a href="https://www.steamgriddb.com/profile/preferences/api" target="_blank" rel="noopener noreferrer"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--accent)' }}>
                    Get API key <ExternalLink size={11} />
                  </a>
                </div>
                <div style={{ position: 'relative' }}>
                  <Input
                    type={showSteamgridKey ? 'text' : 'password'}
                    autoComplete="off"
                    value={steamgriddbApiKey}
                    onChange={(e) => setSteamgriddbApiKey(e.target.value)}
                    placeholder={keysMeta?.steamgriddbApiKeySaved ? 'Enter new key to replace' : 'Bearer token'}
                    style={{ paddingRight: 44 }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowSteamgridKey((v) => !v)}
                    style={{
                      position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                      background: 'none', border: 'none', cursor: 'pointer',
                      color: 'rgba(255,255,255,0.4)', padding: 0, display: 'flex', alignItems: 'center',
                    }}
                    aria-label={showSteamgridKey ? 'Hide key' : 'Show key'}
                  >
                    {showSteamgridKey ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, cursor: 'pointer', fontSize: 13, color: 'rgba(255,255,255,0.6)' }}>
                  <input type="checkbox" checked={removeSteamgriddbApiKey} onChange={(e) => setRemoveSteamgriddbApiKey(e.target.checked)}
                    style={{ accentColor: 'var(--accent)' }} />
                  Remove saved SteamGridDB key
                </label>
              </div>

              <button type="button" className="btn btn-primary" disabled={savingKeys}
                onClick={() => void handleSaveApiKeys()}
                style={{ alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                <Save size={15} />
                {savingKeys ? 'Saving…' : 'Save API keys'}
              </button>
            </div>
          )}
        </Card>

        {/* ── Data ── */}
        <Card>
          <SectionHeader icon={<Database size={16} />} title="Data" />
          <Row label="Database location"><strong style={{ fontSize: 13 }}>Local app data</strong></Row>
          <Row label="Watcher status"><strong style={{ fontSize: 13 }}>Running</strong></Row>
          <Row label="Polling interval"><strong style={{ fontSize: 13 }}>5 seconds</strong></Row>
          <div style={{ display: 'flex', gap: 10, marginTop: 16, flexWrap: 'wrap' }}>
            <button className="btn btn-secondary" disabled style={{ fontSize: 13 }}>Open data folder</button>
            <button className="btn btn-primary" onClick={onRefreshLibrary} style={{ fontSize: 13 }}>Refresh library data</button>
          </div>
        </Card>

        {/* ── Home Hero Background ── */}
        <Card>
          <SectionHeader icon={<ImageIcon size={16} />} title="Home Hero Background"
            subtitle="Choose a wide art image for the Home page. Custom image → pinned cover → last played art → gradient." />

          {(heroCustomUrl || heroGameId != null) && (
            <div style={{ padding: '10px 14px', borderRadius: 8, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', fontSize: 13, marginBottom: 16 }}>
              {heroCustomUrl && <div><strong>Custom image:</strong> {heroCustomUrl.slice(0, 60)}{heroCustomUrl.length > 60 ? '…' : ''}</div>}
              {heroGameId != null && (
                <div style={{ marginTop: heroCustomUrl ? 4 : 0 }}>
                  <strong>Pinned:</strong> {libraryGames.find((g) => g[0] === heroGameId)?.[1] ?? `#${heroGameId}`}
                </div>
              )}
            </div>
          )}

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 20 }}>
            <button type="button" className="btn btn-primary" onClick={() => setHomeHeroModalOpen(true)}>
              Choose hero image…
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => { resetHomeHeroToAuto(); syncHeroState(); notifyHomeHeroBgChanged(); showSuccess('Home hero reset to automatic.'); }}>
              Reset to auto
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => selectHomeHeroGame(null)}>
              Clear pinned game
            </button>
          </div>

          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.38)', marginBottom: 12 }}>Quick-pin a game cover as fallback:</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(90px,1fr))', gap: 10 }}>
            {libraryGames.filter((g) => g[2]).map((g) => {
              const url = getFileUrl(g[2]);
              const sel = heroGameId === g[0];
              return (
                <button key={g[0]} type="button" title={g[1]} onClick={() => selectHomeHeroGame(g[0])}
                  style={{
                    padding: 0, border: sel ? '2px solid var(--accent)' : '1px solid rgba(255,255,255,0.09)',
                    borderRadius: 10, overflow: 'hidden', cursor: 'pointer',
                    background: '#111', display: 'flex', flexDirection: 'column',
                  }}>
                  <div style={{ aspectRatio: '2/3', width: '100%', position: 'relative' }}>
                    {url && <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />}
                  </div>
                  <span style={{
                    fontSize: 9, fontWeight: 700, color: 'rgba(255,255,255,0.6)',
                    padding: '5px 6px', lineHeight: 1.3,
                    display: '-webkit-box', WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical', overflow: 'hidden',
                  }}>{g[1]}</span>
                </button>
              );
            })}
            {libraryGames.filter((g) => g[2]).length === 0 && (
              <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.38)', gridColumn: '1 / -1' }}>
                No covers in your library yet.
              </p>
            )}
          </div>
        </Card>

        {/* ── About ── */}
        <Card>
          <SectionHeader icon={<Wifi size={16} />} title="About" />
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)', margin: '0 0 14px' }}>
            PitGames is a local-first game library and playtime tracker.
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'rgba(255,255,255,0.35)' }}>
            <span>Made by Abdalla Saeed</span>
            <Pizza size={16} strokeWidth={2} color="var(--accent)" />
          </div>
        </Card>

      </div>

      {/* Footer */}
      <div style={{ marginTop: 32, paddingTop: 20, borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, color: 'rgba(255,255,255,0.35)', fontSize: 13 }}>
        <span>Made by Abdalla Saeed</span>
        <Pizza size={18} strokeWidth={2} color="var(--accent)" />
      </div>

      {homeHeroModalOpen && (
        <HomeHeroBackgroundModal libraryGames={libraryGames}
          onClose={() => setHomeHeroModalOpen(false)}
          onApplied={() => { syncHeroState(); showSuccess('Home hero background updated'); }} />
      )}
      {updateModal && <UpdateCheckModal data={updateModal} onClose={() => setUpdateModal(null)} />}
    </div>
  );
};

export default Settings;
