import React, { useState } from 'react';
import './AddGameWizard.css';
import Step1SelectExe from './Step1SelectExe';
import Step2SearchMetadata from './Step2SearchMetadata';
import Step3ReviewSave from './Step3ReviewSave';
import { Check, X, Gamepad2 } from 'lucide-react';

interface AddGameWizardProps {
  onClose: () => void;
  onSuccess: (id?: number) => void;
}

const STEPS = [
  { label: 'Executable', sub: 'Pick your .exe file' },
  { label: 'Metadata',   sub: 'Find game info on IGDB' },
  { label: 'Review',     sub: 'Confirm and add' },
];

const PARTICLE_COLORS = [
  'var(--accent)', '#4ade80', '#f59e0b', '#60a5fa',
  '#f472b6', '#a78bfa', '#34d399', 'var(--accent)',
];

// ── Main wizard ──────────────────────────────────────────────────────────────

const AddGameWizard: React.FC<AddGameWizardProps> = ({ onClose, onSuccess }) => {
  const [step, setStep]         = useState(1);
  const [dir, setDir]           = useState<'fwd' | 'bwd'>('fwd');
  const [exePath, setExePath]   = useState<string | null>(null);
  const [metadata, setMetadata] = useState<any | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isSaving, setIsSaving]   = useState(false);
  const [addedId, setAddedId]     = useState<number | undefined>(undefined);
  const [addedMeta, setAddedMeta] = useState<any | null>(null);

  const goTo = (next: number) => {
    setDir(next > step ? 'fwd' : 'bwd');
    setStep(next);
  };

  const handleStep1Next = (path: string, title: string) => {
    setExePath(path);
    setMetadata({ name: title });
    setDir('fwd');
    setStep(2);
  };

  const handleStep2Next = (data: any) => {
    setMetadata(data);
    setDir('fwd');
    setStep(3);
  };

  const handleSaveStart = () => setIsSaving(true);

  const handleSaveSuccess = (id?: number) => {
    setIsSaving(false);
    setAddedId(id);
    setAddedMeta(metadata);
    setIsSuccess(true);
  };

  const handleAddAnother = () => {
    setStep(1); setDir('fwd');
    setExePath(null); setMetadata(null);
    setIsSuccess(false); setIsSaving(false);
    setAddedId(undefined); setAddedMeta(null);
  };

  const stepClass = dir === 'fwd' ? 'wz-step-fwd' : 'wz-step-bwd';

  return (
    <div
      style={{
        position: 'fixed', inset: 0,
        backgroundColor: 'rgba(0,0,0,0.82)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1000, backdropFilter: 'blur(10px)',
      }}
      onClick={(e) => e.target === e.currentTarget && !isSaving && onClose()}
    >
      <div style={{
        width: 780, maxHeight: '93vh',
        borderRadius: 24,
        backgroundColor: 'rgba(11,11,15,0.99)',
        border: '1px solid rgba(255,255,255,0.09)',
        boxShadow: '0 40px 100px rgba(0,0,0,0.75), 0 0 0 1px rgba(255,255,255,0.03)',
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden', position: 'relative',
      }}>

        {/* Accent top line */}
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: 2,
          background: 'var(--accent-grad, var(--accent))',
        }} />

        {/* ── Header ── */}
        <div style={{ padding: '26px 30px 0', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10, flexShrink: 0,
            background: 'rgba(var(--accent-rgb),0.13)',
            border: '1px solid rgba(var(--accent-rgb),0.24)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--accent)',
          }}>
            <Gamepad2 size={18} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 800, fontSize: 16, color: '#fff' }}>Add Game to Library</div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', marginTop: 1 }}>
              {isSuccess ? 'All done!' : isSaving ? 'Saving…' : STEPS[step - 1].sub}
            </div>
          </div>
          {!isSaving && !isSuccess && (
            <button
              onClick={onClose}
              style={{
                width: 30, height: 30, borderRadius: 8, border: 'none',
                background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.45)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', flexShrink: 0, transition: 'background 0.15s',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.12)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* ── Step indicator ── */}
        {!isSuccess && !isSaving && (
          <div style={{ padding: '22px 30px 0', display: 'flex', alignItems: 'flex-start', gap: 0 }}>
            {STEPS.map((s, i) => {
              const n = i + 1;
              const done   = step > n;
              const active = step === n;
              return (
                <React.Fragment key={n}>
                  {/* Circle + label */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7, minWidth: 64 }}>
                    <div style={{
                      width: 34, height: 34, borderRadius: '50%',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontWeight: 800, fontSize: 13,
                      background: done   ? 'var(--accent)' :
                                  active ? 'rgba(var(--accent-rgb),0.16)' :
                                           'rgba(255,255,255,0.05)',
                      border: done   ? '2px solid var(--accent)' :
                              active ? '2px solid var(--accent)' :
                                       '2px solid rgba(255,255,255,0.1)',
                      color: done   ? 'var(--accent-on-fill, #000)' :
                             active ? 'var(--accent)' :
                                      'rgba(255,255,255,0.3)',
                      transition: 'all 0.3s ease',
                      boxShadow: active ? '0 0 0 5px rgba(var(--accent-rgb),0.1)' : 'none',
                      flexShrink: 0,
                    }}>
                      {done ? <Check size={14} strokeWidth={3} /> : n}
                    </div>
                    <div style={{
                      fontSize: 11, fontWeight: 700, textAlign: 'center', whiteSpace: 'nowrap',
                      color: active ? 'rgba(255,255,255,0.9)' : done ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.28)',
                      transition: 'color 0.3s ease',
                    }}>
                      {s.label}
                    </div>
                  </div>
                  {/* Connector line */}
                  {i < STEPS.length - 1 && (
                    <div style={{
                      flex: 1, height: 2, margin: '16px 6px 0',
                      background: step > n ? 'var(--accent)' : 'rgba(255,255,255,0.08)',
                      transition: 'background 0.4s ease 0.1s',
                      borderRadius: 2,
                    }} />
                  )}
                </React.Fragment>
              );
            })}
          </div>
        )}

        {/* Divider */}
        {!isSuccess && !isSaving && (
          <div style={{ margin: '20px 30px 0', height: 1, background: 'rgba(255,255,255,0.055)' }} />
        )}

        {/* ── Content area ── */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '26px 30px 30px' }}>
          {isSuccess ? (
            <SuccessScreen
              meta={addedMeta}
              onViewGame={() => onSuccess(addedId)}
              onAddAnother={handleAddAnother}
            />
          ) : isSaving ? (
            <SavingScreen />
          ) : (
            <div key={step} className={stepClass}>
              {step === 1 && (
                <Step1SelectExe onNext={handleStep1Next} />
              )}
              {step === 2 && (
                <Step2SearchMetadata
                  guessedTitle={metadata?.name || ''}
                  onBack={() => goTo(1)}
                  onNext={handleStep2Next}
                />
              )}
              {step === 3 && exePath && metadata && (
                <Step3ReviewSave
                  exePath={exePath}
                  metadata={metadata}
                  onBack={() => goTo(2)}
                  onSuccess={handleSaveSuccess}
                  onSaveStart={handleSaveStart}
                />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ── Saving screen ─────────────────────────────────────────────────────────────

const SavingScreen: React.FC = () => (
  <div className="wz-fade-up" style={{
    textAlign: 'center', padding: '52px 0 44px',
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 22,
  }}>
    {/* Spinning ring */}
    <div style={{ position: 'relative', width: 68, height: 68 }}>
      <svg viewBox="0 0 68 68" width={68} height={68}>
        <circle cx="34" cy="34" r="29"
          fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="5" />
      </svg>
      <svg viewBox="0 0 68 68" width={68} height={68}
        className="wz-spin"
        style={{ position: 'absolute', inset: 0 }}>
        <circle cx="34" cy="34" r="29"
          fill="none" stroke="var(--accent)" strokeWidth="5"
          strokeDasharray="182" strokeDashoffset="140"
          strokeLinecap="round" />
      </svg>
    </div>
    <div>
      <div style={{ fontWeight: 800, fontSize: 19, color: '#fff', marginBottom: 6 }}>
        Adding to Library…
      </div>
      <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.38)' }}>
        Downloading artwork and saving metadata
      </div>
    </div>
  </div>
);

// ── Success screen ────────────────────────────────────────────────────────────

const SuccessScreen: React.FC<{
  meta: any;
  onViewGame: () => void;
  onAddAnother: () => void;
}> = ({ meta, onViewGame, onAddAnother }) => {
  const coverUrl = meta?.cover?.url || meta?.artworks?.[0]?.url || null;
  const title    = meta?.title || meta?.name || 'Game';
  const devs     = meta?.developers?.length ? meta.developers.join(', ') : null;
  const year     = meta?.release_date
    ? new Date(meta.release_date * 1000).getFullYear()
    : null;

  return (
    <div className="wz-fade-up" style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      padding: '28px 0 8px', gap: 28,
    }}>

      {/* Animated checkmark + particles */}
      <div style={{ position: 'relative', width: 108, height: 108 }}>
        {PARTICLE_COLORS.map((color, i) => (
          <div key={i} className={`wz-p wz-p-${i}`} style={{ background: color }} />
        ))}
        <div className="wz-icon" style={{ position: 'absolute', inset: 0 }}>
          <svg viewBox="0 0 108 108" width={108} height={108}>
            {/* Filled circle bg */}
            <circle cx="54" cy="54" r="46"
              fill="rgba(var(--accent-rgb),0.1)" />
            {/* Animated ring */}
            <circle
              className="wz-ring"
              cx="54" cy="54" r="46"
              fill="none"
              stroke="var(--accent)" strokeWidth="3"
              strokeLinecap="round"
            />
            {/* Animated tick */}
            <polyline
              className="wz-tick"
              points="30,56 46,72 78,38"
              fill="none"
              stroke="var(--accent)" strokeWidth="5.5"
              strokeLinecap="round" strokeLinejoin="round"
            />
          </svg>
        </div>
      </div>

      {/* Headline */}
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontWeight: 800, fontSize: 24, color: '#fff', marginBottom: 6 }}>
          Game Added! 🎮
        </div>
        <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.42)' }}>
          Ready to track your playtime
        </div>
      </div>

      {/* Added game card */}
      <div style={{
        display: 'flex', gap: 18, alignItems: 'center',
        padding: '16px 20px',
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.09)',
        borderRadius: 16, width: '100%', maxWidth: 460,
      }}>
        {/* Cover */}
        {coverUrl ? (
          <img src={coverUrl} alt=""
            style={{ width: 50, height: 70, objectFit: 'cover', borderRadius: 8, flexShrink: 0, boxShadow: '0 4px 14px rgba(0,0,0,0.5)' }}
            onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
          />
        ) : (
          <div style={{
            width: 50, height: 70, borderRadius: 8, flexShrink: 0,
            background: 'rgba(var(--accent-rgb),0.15)',
            display: 'grid', placeItems: 'center',
          }}>
            <Gamepad2 size={22} color="var(--accent)" />
          </div>
        )}

        {/* Info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontWeight: 800, fontSize: 16, marginBottom: 4,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#fff',
          }}>
            {title}
          </div>
          {(devs || year) && (
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.42)', marginBottom: 8 }}>
              {devs || year}
            </div>
          )}
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            fontSize: 11, fontWeight: 700, color: '#4ade80',
            background: 'rgba(74,222,128,0.1)', borderRadius: 20,
            padding: '3px 10px', border: '1px solid rgba(74,222,128,0.2)',
          }}>
            <Check size={10} strokeWidth={3} /> Added to library
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: 12 }}>
        <button
          onClick={onViewGame}
          className="wz-nav-btn wz-nav-btn--primary"
          style={{ paddingLeft: 32, paddingRight: 32 }}
        >
          View Game →
        </button>
        <button
          onClick={onAddAnother}
          className="wz-nav-btn wz-nav-btn--secondary"
        >
          Add Another
        </button>
      </div>
    </div>
  );
};

export default AddGameWizard;
