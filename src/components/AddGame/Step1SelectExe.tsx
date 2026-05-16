import React, { useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { FolderOpen, CheckCircle2, Pencil, ChevronRight } from 'lucide-react';

interface Step1Props {
  onNext: (exePath: string, guessedTitle: string) => void;
}

function extractTitle(path: string): string {
  let filename = path.split(/[\\/]/).pop() || '';
  filename = filename.replace(/\.exe$/i, '');
  filename = filename
    .replace(/(_x64|_x86|_win64|_win32|launcher|game|v?\d+(\.\d+)*)/gi, '')
    .replace(/[_-]+/g, ' ')
    .trim();
  return filename
    .split(' ')
    .filter(Boolean)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

const Step1SelectExe: React.FC<Step1Props> = ({ onNext }) => {
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [guessedTitle, setGuessedTitle] = useState('');
  const [isEditing, setIsEditing]       = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handlePickExe = async () => {
    try {
      const path = await invoke<string>('pick_exe');
      if (path) {
        setSelectedPath(path);
        setGuessedTitle(extractTitle(path));
        setIsEditing(false);
      }
    } catch { /* user cancelled */ }
  };

  const startEdit = () => {
    setIsEditing(true);
    // Focus after state update
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const filename = selectedPath?.split(/[\\/]/).pop() ?? '';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* ── Drop zone ── */}
      <div
        className="wz-dropzone"
        onClick={handlePickExe}
        style={{
          padding: selectedPath ? '28px 24px' : '52px 24px',
          border: `2px dashed ${selectedPath ? 'rgba(74,222,128,0.45)' : 'rgba(255,255,255,0.1)'}`,
          borderRadius: 18,
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16,
          background: selectedPath ? 'rgba(74,222,128,0.04)' : 'rgba(255,255,255,0.02)',
          textAlign: 'center',
          transition: 'border-color 0.25s ease, background 0.25s ease, padding 0.25s ease',
        }}
      >
        {/* Icon */}
        <div style={{
          width: 60, height: 60, borderRadius: 16, flexShrink: 0,
          background: selectedPath ? 'rgba(74,222,128,0.12)' : 'rgba(var(--accent-rgb),0.1)',
          border: `1.5px solid ${selectedPath ? 'rgba(74,222,128,0.3)' : 'rgba(var(--accent-rgb),0.22)'}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: selectedPath ? '#4ade80' : 'var(--accent)',
          transition: 'all 0.25s ease',
        }}>
          {selectedPath
            ? <CheckCircle2 size={28} strokeWidth={1.8} />
            : <FolderOpen   size={28} strokeWidth={1.8} />}
        </div>

        {/* Text */}
        {selectedPath ? (
          <div style={{ maxWidth: 500 }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: '#4ade80', marginBottom: 6 }}>
              {filename}
            </div>
            <div style={{
              fontSize: 11, color: 'rgba(255,255,255,0.3)',
              wordBreak: 'break-all', fontFamily: 'monospace', lineHeight: 1.5,
            }}>
              {selectedPath}
            </div>
          </div>
        ) : (
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, color: 'rgba(255,255,255,0.85)', marginBottom: 5 }}>
              Click to browse for .exe file
            </div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.3)' }}>
              Select the game's executable to start tracking playtime
            </div>
          </div>
        )}

        {/* Change button */}
        {selectedPath && (
          <button
            type="button"
            onClick={e => { e.stopPropagation(); void handlePickExe(); }}
            style={{
              fontSize: 12, color: 'var(--accent)',
              background: 'none', border: 'none',
              cursor: 'pointer', textDecoration: 'underline', padding: 0,
            }}
          >
            Change file
          </button>
        )}
      </div>

      {/* ── Detected title ── */}
      {selectedPath && (
        <div style={{
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.07)',
          borderRadius: 14, padding: '16px 18px',
        }}>
          <div style={{
            fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
            letterSpacing: '0.07em', color: 'rgba(255,255,255,0.28)', marginBottom: 10,
          }}>
            Detected Game Title
          </div>

          {isEditing ? (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                ref={inputRef}
                type="text"
                value={guessedTitle}
                onChange={e => setGuessedTitle(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && setIsEditing(false)}
                style={{
                  flex: 1, padding: '10px 14px',
                  background: 'rgba(255,255,255,0.05)',
                  border: '1.5px solid rgba(var(--accent-rgb),0.45)',
                  borderRadius: 10, color: '#fff', fontSize: 15, fontWeight: 600,
                  outline: 'none',
                }}
                autoFocus
              />
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="wz-nav-btn wz-nav-btn--primary"
                style={{ padding: '9px 18px', fontSize: 13 }}
              >
                Done
              </button>
            </div>
          ) : (
            <div
              className="wz-title-click"
              onClick={startEdit}
              style={{ display: 'flex', alignItems: 'center', gap: 10 }}
            >
              <span style={{ fontSize: 19, fontWeight: 800, flex: 1, color: '#fff' }}>
                {guessedTitle || '—'}
              </span>
              <Pencil size={14} style={{ color: 'rgba(255,255,255,0.3)', flexShrink: 0 }} />
            </div>
          )}

          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.28)', marginTop: 10 }}>
            This title will be used to search IGDB in the next step. Click to edit if it looks wrong.
          </div>
        </div>
      )}

      {/* ── Navigation ── */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 4 }}>
        <button
          type="button"
          disabled={!selectedPath}
          onClick={() => selectedPath && onNext(selectedPath, guessedTitle)}
          className="wz-nav-btn wz-nav-btn--primary"
        >
          Next <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
};

export default Step1SelectExe;
