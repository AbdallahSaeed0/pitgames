import React, { useState, useEffect, useMemo } from 'react';
import { invoke } from '@tauri-apps/api/core';
import theme from '../../theme';
import { Game } from '../../types';
import { useToast } from '../../hooks/useToast';

interface TrackingInfoCardProps {
  game: Game;
  exe_path: string;
  onUpdate: () => void;
}

type DebugProcess = {
  pid: number;
  name: string;
  exe_path: string | null;
  exe_filename: string | null;
};

function aliasesToLines(raw: string | null | undefined): string {
  if (!raw?.trim()) return '';
  try {
    const arr = JSON.parse(raw) as string[];
    if (Array.isArray(arr)) return arr.filter(Boolean).join('\n');
  } catch {
    /* ignore */
  }
  return '';
}

function linesToAliasesJson(text: string): string | null {
  const lines = text
    .split(/[\n,]+/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  if (lines.length === 0) return null;
  return JSON.stringify(lines);
}

const NOISE = new Set([
  'pitgames.exe',
  'node.exe',
  'cargo.exe',
  'rustc.exe',
  'code.exe',
  'devenv.exe',
  'explorer.exe',
  'dwm.exe',
  'svchost.exe',
]);

const TrackingInfoCard: React.FC<TrackingInfoCardProps> = ({ game, exe_path, onUpdate }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isValidPath, setIsValidPath] = useState<boolean | null>(null);
  const [formData, setFormData] = useState({
    exe_path: exe_path,
    process_name: game.process_name,
    aliases_text: aliasesToLines(game.process_name_aliases),
  });
  const [showProcessPicker, setShowProcessPicker] = useState(false);
  const [processList, setProcessList] = useState<DebugProcess[]>([]);
  const [processFilter, setProcessFilter] = useState('');
  const { showSuccess, showError } = useToast();

  useEffect(() => {
    setFormData({
      exe_path,
      process_name: game.process_name,
      aliases_text: aliasesToLines(game.process_name_aliases),
    });
  }, [exe_path, game.process_name, game.process_name_aliases]);

  const checkPath = async (path: string) => {
    try {
      const exists = await invoke<boolean>('verify_exe_path', { path });
      setIsValidPath(exists);
    } catch {
      setIsValidPath(false);
    }
  };

  useEffect(() => {
    checkPath(exe_path);
  }, [exe_path]);

  const filteredProcesses = useMemo(() => {
    const q = processFilter.trim().toLowerCase();
    return processList.filter((p) => {
      const fn = (p.exe_filename || '').toLowerCase();
      const n = (p.name || '').toLowerCase();
      const path = (p.exe_path || '').toLowerCase();
      if (NOISE.has(fn) || NOISE.has(n)) return false;
      if (!q) return Boolean(fn || n);
      return fn.includes(q) || n.includes(q) || path.includes(q);
    });
  }, [processList, processFilter]);

  const openProcessPicker = async () => {
    setProcessFilter('');
    try {
      const list = await invoke<DebugProcess[]>('debug_processes');
      const withExe = list.filter((p) => p.exe_filename || p.name);
      setProcessList(withExe);
      setShowProcessPicker(true);
    } catch (e) {
      showError(`Could not list processes: ${e}`);
    }
  };

  const handlePickExe = async () => {
    try {
      const path = await invoke<string>('pick_exe');
      if (path) {
        const processName = path.split(/[\\/]/).pop()?.toLowerCase() || '';
        setFormData((prev) => ({ ...prev, exe_path: path, process_name: processName }));
        checkPath(path);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleSave = async () => {
    if (!formData.exe_path.toLowerCase().endsWith('.exe')) {
      showError('Path must point to an .exe file');
      return;
    }
    if (!formData.process_name.trim()) {
      showError('Process name is required');
      return;
    }

    setLoading(true);
    try {
      const aliasesJson = linesToAliasesJson(formData.aliases_text);
      await invoke('update_game_tracking', {
        gameId: game.id,
        exePath: formData.exe_path,
        processName: formData.process_name.trim().toLowerCase(),
        processNameAliases: aliasesJson,
      });
      showSuccess('Tracking information updated');
      setIsEditing(false);
      onUpdate();
    } catch (e) {
      showError(`Update failed: ${e}`);
    } finally {
      setLoading(false);
    }
  };

  const cardStyle: React.CSSProperties = {
    backgroundColor: theme.surface.card,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    border: `1px solid ${theme.surface.border}`,
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing.md,
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    showSuccess('Copied to clipboard');
  };

  const getStatusBadge = () => {
    if (isValidPath === false) return { label: 'Exe not found', color: theme.status.error, bg: 'rgba(244, 67, 54, 0.1)' };
    if (game.total_playtime_seconds > 0)
      return { label: 'Tracking active', color: theme.status.success, bg: 'rgba(76, 175, 80, 0.1)' };
    return { label: 'Never played', color: theme.status.warning, bg: 'rgba(255, 152, 0, 0.1)' };
  };

  const status = getStatusBadge();

  if (isEditing) {
    return (
      <div style={cardStyle}>
        <h3 style={{ ...theme.typography.h3, margin: 0 }}>Edit tracking</h3>
        <p
          style={{
            fontSize: 12,
            color: theme.text.muted,
            lineHeight: 1.55,
            margin: 0,
            padding: '10px 12px',
            background: 'rgba(var(--accent-rgb), 0.08)',
            border: '1px solid rgba(var(--accent-rgb), 0.2)',
            borderRadius: 10,
          }}
        >
          <strong>Launcher games (e.g. Marvel Rivals):</strong> keep <em>Executable path</em> pointing at your launcher if
          that is what you launch from PitGames, but set <em>Process name</em> to the <strong>running game client</strong>{' '}
          .exe (Task Manager → Details). For Marvel Rivals the client is often{' '}
          <code style={{ color: theme.accent.primary }}>Marvel-Win64-Shipping.exe</code>. PitGames matches this name
          for playtime; sessions use the same key as your library entry.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '12px', color: theme.text.secondary }}>Executable path (what “Play” starts)</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="text"
                value={formData.exe_path}
                onChange={(e) => setFormData({ ...formData, exe_path: e.target.value })}
                style={{
                  flex: 1,
                  backgroundColor: theme.background.secondary,
                  border: `1px solid ${theme.surface.border}`,
                  borderRadius: theme.borderRadius.sm,
                  padding: '8px',
                  color: 'white',
                  fontSize: '13px',
                }}
              />
              <button
                type="button"
                onClick={handlePickExe}
                style={{
                  backgroundColor: theme.background.elevated,
                  color: 'white',
                  border: `1px solid ${theme.surface.border}`,
                  padding: '0 12px',
                  borderRadius: theme.borderRadius.sm,
                  cursor: 'pointer',
                }}
              >
                Browse
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
              <label style={{ fontSize: '12px', color: theme.text.secondary }}>
                Process name (must match the running game .exe)
              </label>
              <button
                type="button"
                onClick={() => void openProcessPicker()}
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  padding: '6px 10px',
                  borderRadius: 8,
                  border: '1px solid rgba(255,255,255,0.12)',
                  background: 'rgba(255,255,255,0.06)',
                  color: '#fff',
                  cursor: 'pointer',
                }}
              >
                Pick from running…
              </button>
            </div>
            <input
              type="text"
              value={formData.process_name}
              onChange={(e) => setFormData({ ...formData, process_name: e.target.value })}
              style={{
                backgroundColor: theme.background.secondary,
                border: `1px solid ${theme.surface.border}`,
                borderRadius: theme.borderRadius.sm,
                padding: '8px',
                color: 'white',
                fontSize: '13px',
              }}
              placeholder="e.g. Marvel-Win64-Shipping.exe"
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '12px', color: theme.text.secondary }}>
              Extra process names (optional, one per line — same game, other .exe builds)
            </label>
            <textarea
              value={formData.aliases_text}
              onChange={(e) => setFormData({ ...formData, aliases_text: e.target.value })}
              rows={3}
              placeholder="Rarely needed. Do not add the launcher here if you do not want launcher time counted."
              style={{
                backgroundColor: theme.background.secondary,
                border: `1px solid ${theme.surface.border}`,
                borderRadius: theme.borderRadius.sm,
                padding: '8px',
                color: 'white',
                fontSize: '13px',
                resize: 'vertical',
              }}
            />
          </div>
        </div>

        <div style={{ display: 'flex', gap: theme.spacing.sm, marginTop: theme.spacing.sm }}>
          <button
            type="button"
            onClick={handleSave}
            disabled={loading}
            style={{
              flex: 1,
              backgroundColor: theme.accent.primary,
              color: theme.accent.onFill,
              border: 'none',
              padding: '10px',
              borderRadius: theme.borderRadius.md,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {loading ? 'Saving…' : 'Save changes'}
          </button>
          <button
            type="button"
            onClick={() => setIsEditing(false)}
            style={{
              flex: 1,
              backgroundColor: 'transparent',
              color: 'white',
              border: `1px solid ${theme.surface.border}`,
              padding: '10px',
              borderRadius: theme.borderRadius.md,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
        </div>

        {showProcessPicker && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,0.82)',
              zIndex: 15000,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 20,
            }}
            onClick={() => setShowProcessPicker(false)}
          >
            <div
              style={{
                width: '100%',
                maxWidth: 560,
                maxHeight: '80vh',
                background: theme.surface.card,
                borderRadius: 16,
                border: `1px solid ${theme.surface.border}`,
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ padding: '14px 16px', borderBottom: `1px solid ${theme.surface.border}` }}>
                <div style={{ fontWeight: 800, marginBottom: 8 }}>Running processes</div>
                <input
                  type="search"
                  placeholder="Filter by name or path…"
                  value={processFilter}
                  onChange={(e) => setProcessFilter(e.target.value)}
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    padding: '8px 10px',
                    borderRadius: 8,
                    border: `1px solid ${theme.surface.border}`,
                    background: theme.background.secondary,
                    color: '#fff',
                  }}
                />
                <p style={{ fontSize: 11, color: theme.text.muted, margin: '8px 0 0' }}>
                  Start the game, then click a row to copy its .exe name into “Process name”.
                </p>
              </div>
              <div style={{ overflowY: 'auto', flex: 1, minHeight: 0 }}>
                {filteredProcesses.slice(0, 400).map((p) => {
                  const label = p.exe_filename || p.name;
                  return (
                    <button
                      type="button"
                      key={`${p.pid}-${label}`}
                      onClick={() => {
                        setFormData((prev) => ({
                          ...prev,
                          process_name: (p.exe_filename || p.name).toLowerCase(),
                        }));
                        setShowProcessPicker(false);
                      }}
                      style={{
                        display: 'block',
                        width: '100%',
                        textAlign: 'left',
                        padding: '10px 14px',
                        border: 'none',
                        borderBottom: `1px solid ${theme.surface.border}`,
                        background: 'transparent',
                        color: '#fff',
                        cursor: 'pointer',
                        fontSize: 12,
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'rgba(255,255,255,0.06)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'transparent';
                      }}
                    >
                      <div style={{ fontWeight: 700 }}>{label}</div>
                      {p.exe_path ? (
                        <div style={{ fontSize: 10, color: theme.text.muted, marginTop: 4, wordBreak: 'break-all' }}>
                          {p.exe_path}
                        </div>
                      ) : null}
                    </button>
                  );
                })}
              </div>
              <div style={{ padding: 12, borderTop: `1px solid ${theme.surface.border}` }}>
                <button
                  type="button"
                  onClick={() => setShowProcessPicker(false)}
                  style={{
                    width: '100%',
                    padding: 10,
                    borderRadius: 8,
                    border: `1px solid ${theme.surface.border}`,
                    background: 'transparent',
                    color: '#fff',
                    cursor: 'pointer',
                    fontWeight: 600,
                  }}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={cardStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <h3 style={{ ...theme.typography.h3, margin: 0 }}>Tracking</h3>
        </div>
        <button
          type="button"
          onClick={() => setIsEditing(true)}
          style={{ background: 'none', border: 'none', color: theme.text.secondary, cursor: 'pointer', fontSize: '18px' }}
          title="Edit"
        >
          ✏️
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div>
          <div style={{ fontSize: '11px', color: theme.text.muted, textTransform: 'uppercase', marginBottom: '4px' }}>
            Status
          </div>
          <span
            style={{
              padding: '4px 10px',
              borderRadius: theme.borderRadius.sm,
              fontSize: '11px',
              fontWeight: 700,
              backgroundColor: status.bg,
              color: status.color,
              border: `1px solid ${status.color}`,
            }}
          >
            {status.label}
          </span>
        </div>

        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: '11px', color: theme.text.muted, textTransform: 'uppercase' }}>Executable path</div>
            <button
              type="button"
              onClick={() => copyToClipboard(exe_path)}
              style={{ background: 'none', border: 'none', color: theme.text.muted, cursor: 'pointer', fontSize: '12px' }}
            >
              📋
            </button>
          </div>
          <div style={{ fontSize: '12px', color: theme.text.secondary, wordBreak: 'break-all', marginTop: '4px' }}>
            {exe_path}
          </div>
        </div>

        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: '11px', color: theme.text.muted, textTransform: 'uppercase' }}>Process name</div>
            <button
              type="button"
              onClick={() => copyToClipboard(game.process_name)}
              style={{ background: 'none', border: 'none', color: theme.text.muted, cursor: 'pointer', fontSize: '12px' }}
            >
              📋
            </button>
          </div>
          <code style={{ fontSize: '13px', color: theme.accent.primary, marginTop: '4px', display: 'block' }}>
            {game.process_name}
          </code>
        </div>
      </div>
    </div>
  );
};

export default TrackingInfoCard;
