import React, { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import SafeImage from './SafeImage';
import { useToast } from '../../hooks/useToast';
import { isValidSteamAppId } from '../../utils/steamAdvisorSearch';
import {
  Cpu, HardDrive, Monitor, Zap, CheckCircle2, XCircle,
  AlertCircle, HelpCircle, SlidersHorizontal, X, RefreshCw,
  ShieldCheck,
} from 'lucide-react';

export interface AdvisorHit {
  title: string;
  steamAppId: number | null;
  coverUrl: string | null;
}

interface CompatibilityReport {
  overall: string;
  presetLabel: string;
  confidence: string;
  bottlenecks: string[];
  explanation: string;
  components: { component: string; status: string; detail: string }[];
  suggestedSettings: {
    resolution: string;
    textureQuality: string;
    shadows: string;
    rayTracing: string;
    upscaling: string;
  };
  storageRequiredGb: number | null;
}

function mapAdvisorError(e: unknown): string {
  const msg = String(e);
  if (/invalid args.*steamAppId|missing required key.*steamAppId/i.test(msg)) return 'Please select a game first.';
  if (msg.includes('No active hardware') || msg.includes('active hardware profile')) return 'Scan your PC first in Settings → Hardware Profile.';
  if (msg.includes('Requirements not loaded')) return 'Fetch requirements first, then compare.';
  return msg;
}

function StatusIcon({ status }: { status: string }) {
  const s = { flexShrink: 0 as const };
  if (status === 'pass') return <CheckCircle2 size={16} style={{ ...s, color: '#4ade80' }} />;
  if (status === 'borderline') return <AlertCircle size={16} style={{ ...s, color: '#fbbf24' }} />;
  if (status === 'fail') return <XCircle size={16} style={{ ...s, color: '#f87171' }} />;
  return <HelpCircle size={16} style={{ ...s, color: 'rgba(255,255,255,0.25)' }} />;
}

function statusColor(s: string) {
  if (s === 'pass') return '#4ade80';
  if (s === 'borderline') return '#fbbf24';
  if (s === 'fail') return '#f87171';
  return 'rgba(255,255,255,0.28)';
}

function statusBg(s: string) {
  if (s === 'pass') return 'rgba(74,222,128,0.08)';
  if (s === 'borderline') return 'rgba(251,191,36,0.08)';
  if (s === 'fail') return 'rgba(248,113,113,0.08)';
  return 'rgba(255,255,255,0.04)';
}

function overallAccent(overall: string) {
  if (overall === 'ultra_candidate') return '#a78bfa';
  if (overall === 'recommended') return '#4ade80';
  if (overall === 'minimum_only') return '#fbbf24';
  if (overall === 'cannot_run') return '#f87171';
  return 'rgba(255,255,255,0.45)';
}

function confidenceColor(c: string) {
  if (c === 'high') return '#4ade80';
  if (c === 'medium') return '#fbbf24';
  return '#f87171';
}

interface GameCompatibilityModalProps {
  hit: AdvisorHit;
  hasProfile: boolean | null;
  onClose: () => void;
  onGoSettings: () => void;
}

const GameCompatibilityModal: React.FC<GameCompatibilityModalProps> = ({
  hit, hasProfile, onClose, onGoSettings,
}) => {
  const { showError, showSuccess } = useToast();
  const [fetchingReq, setFetchingReq] = useState(false);
  const [report, setReport] = useState<CompatibilityReport | null>(null);
  const [noPcReq, setNoPcReq] = useState(false);
  const [headerImage, setHeaderImage] = useState<string | null>(hit.coverUrl);

  const canFetch = isValidSteamAppId(hit.steamAppId) && hasProfile !== false;
  const accent = report ? overallAccent(report.overall) : 'var(--accent)';

  const fetchReqAndReport = async () => {
    if (!isValidSteamAppId(hit.steamAppId)) { showError('No Steam app ID for this game.'); return; }
    setFetchingReq(true);
    try {
      const fr = await invoke<Record<string, unknown>>('fetch_requirements_for_steam_app', {
        steamAppId: hit.steamAppId,
        titleHint: hit.title || null,
      });
      setHeaderImage((fr.headerImage as string) ?? headerImage);
      const minRaw = (fr.minimumRaw as string) ?? '';
      const recRaw = (fr.recommendedRaw as string) ?? '';
      if (!minRaw.trim() && !recRaw.trim()) { setNoPcReq(true); return; }
      const rep = await invoke<CompatibilityReport>('get_compatibility_report_for_steam_app', {
        steamAppId: hit.steamAppId,
      });
      setReport(rep);
      showSuccess('Requirements fetched and compared against your hardware.');
    } catch (e) {
      showError(mapAdvisorError(e));
    } finally { setFetchingReq(false); }
  };

  const passCount = report?.components.filter((c) => c.status === 'pass').length ?? 0;
  const failCount = report?.components.filter((c) => c.status === 'fail').length ?? 0;
  const borderCount = report?.components.filter((c) => c.status === 'borderline').length ?? 0;

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 2000,
        background: 'rgba(0,0,0,0.78)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 24,
        backdropFilter: 'blur(8px)',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 700,
          maxHeight: '92vh', overflowY: 'auto',
          background: 'rgba(13,13,18,0.99)',
          border: '1px solid rgba(255,255,255,0.09)',
          borderRadius: 22,
          display: 'flex', flexDirection: 'column',
          position: 'relative',
          boxShadow: '0 32px 80px rgba(0,0,0,0.8)',
        }}
      >
        {/* ── Header image ─────────────────────────────────────────────── */}
        <div style={{
          position: 'relative', height: 200, flexShrink: 0,
          background: '#08080d', borderRadius: '22px 22px 0 0', overflow: 'hidden',
        }}>
          {headerImage && (
            <SafeImage
              src={headerImage} alt=""
              style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.75 }}
            />
          )}
          {/* Bottom-to-top gradient fade */}
          <div style={{
            position: 'absolute', inset: 0,
            background: 'linear-gradient(to top, rgba(13,13,18,1) 0%, rgba(13,13,18,0.2) 55%, transparent 100%)',
          }} />
          {/* Subtle top vignette */}
          <div style={{
            position: 'absolute', inset: 0,
            background: 'linear-gradient(to bottom, rgba(0,0,0,0.35) 0%, transparent 40%)',
          }} />

          {/* Close button */}
          <button
            type="button" onClick={onClose}
            style={{
              position: 'absolute', top: 14, right: 14,
              width: 36, height: 36, borderRadius: '50%',
              background: 'rgba(0,0,0,0.6)', border: '1px solid rgba(255,255,255,0.14)',
              color: '#fff', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'background 0.15s',
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(0,0,0,0.85)'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(0,0,0,0.6)'; }}
          >
            <X size={15} />
          </button>

          {/* Title block */}
          <div style={{ position: 'absolute', bottom: 18, left: 22, right: 68 }}>
            <div style={{
              fontWeight: 900, fontSize: 21,
              textShadow: '0 2px 10px rgba(0,0,0,0.95)',
              lineHeight: 1.2, letterSpacing: '-0.3px',
            }}>
              {hit.title}
            </div>
            {hit.steamAppId && (
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.38)', marginTop: 5 }}>
                Steam app {hit.steamAppId}
              </div>
            )}
          </div>
        </div>

        {/* ── Body ─────────────────────────────────────────────────────── */}
        <div style={{ padding: '24px 26px 28px', display: 'flex', flexDirection: 'column', gap: 22 }}>

          {/* No hardware profile — prominent card */}
          {hasProfile === false && (
            <div style={{
              borderRadius: 14,
              background: 'rgba(251,191,36,0.06)',
              border: '1px solid rgba(251,191,36,0.25)',
              overflow: 'hidden',
            }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '12px 16px',
                background: 'rgba(251,191,36,0.09)',
                borderBottom: '1px solid rgba(251,191,36,0.15)',
              }}>
                <Cpu size={17} style={{ color: '#fbbf24', flexShrink: 0 }} />
                <span style={{ fontWeight: 800, fontSize: 14, color: '#fbbf24' }}>
                  Hardware scan required
                </span>
              </div>
              <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
                <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', lineHeight: 1.5 }}>
                  Scan your PC first to compare your specs against this game's requirements.
                </div>
                <button
                  type="button" className="btn btn-secondary"
                  style={{ fontSize: 12, padding: '7px 14px', flexShrink: 0 }}
                  onClick={onGoSettings}
                >
                  Settings
                </button>
              </div>
            </div>
          )}

          {/* No Steam ID warning */}
          {!isValidSteamAppId(hit.steamAppId) && (
            <div style={{
              padding: '14px 16px', borderRadius: 12,
              background: 'rgba(255,255,255,0.03)',
              border: '1px dashed rgba(255,255,255,0.13)',
              display: 'flex', alignItems: 'flex-start', gap: 11,
            }}>
              <SlidersHorizontal size={15} style={{ color: 'rgba(255,255,255,0.35)', flexShrink: 0, marginTop: 1 }} />
              <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', lineHeight: 1.55 }}>
                No Steam ID found — search for this game on the{' '}
                <strong style={{ color: 'rgba(255,255,255,0.7)', fontWeight: 700 }}>Can I Run It?</strong>{' '}
                page for a full hardware comparison.
              </span>
            </div>
          )}

          {/* ── Fetch button ──────────────────────────────────────────── */}
          {!report && !noPcReq && isValidSteamAppId(hit.steamAppId) && (
            <button
              type="button"
              onClick={() => void fetchReqAndReport()}
              disabled={!canFetch || fetchingReq}
              style={{
                width: '100%', padding: '16px 24px',
                borderRadius: 14,
                background: canFetch && !fetchingReq
                  ? 'linear-gradient(135deg, rgba(var(--accent-rgb),0.85) 0%, rgba(var(--accent-rgb),0.65) 100%)'
                  : 'rgba(255,255,255,0.05)',
                border: canFetch && !fetchingReq
                  ? '1px solid rgba(var(--accent-rgb),0.5)'
                  : '1px solid rgba(255,255,255,0.08)',
                color: canFetch && !fetchingReq ? '#fff' : 'rgba(255,255,255,0.3)',
                cursor: canFetch && !fetchingReq ? 'pointer' : 'not-allowed',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                fontWeight: 800, fontSize: 15, letterSpacing: '-0.2px',
                boxShadow: canFetch && !fetchingReq ? '0 4px 24px rgba(var(--accent-rgb),0.25)' : 'none',
                transition: 'box-shadow 0.2s, opacity 0.2s',
              }}
              onMouseEnter={(e) => {
                if (canFetch && !fetchingReq) (e.currentTarget as HTMLElement).style.opacity = '0.88';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.opacity = '1';
              }}
            >
              {fetchingReq ? (
                <>
                  <RefreshCw size={18} style={{ animation: 'spin 0.8s linear infinite', flexShrink: 0 }} />
                  Fetching requirements…
                  <span style={{ fontSize: 12, fontWeight: 500, color: 'rgba(255,255,255,0.55)', marginLeft: 4 }}>
                    Contacting Steam
                  </span>
                </>
              ) : (
                <>
                  <ShieldCheck size={20} style={{ flexShrink: 0 }} />
                  Check Compatibility
                </>
              )}
            </button>
          )}

          {/* No PC requirements available */}
          {noPcReq && (
            <div style={{
              padding: '14px 16px', borderRadius: 12,
              background: 'rgba(255,255,255,0.03)',
              border: '1px dashed rgba(255,255,255,0.1)',
              fontSize: 13, color: 'rgba(255,255,255,0.5)', lineHeight: 1.55,
            }}>
              Steam doesn't publish PC requirements for this title.
            </div>
          )}

          {/* ── Report ───────────────────────────────────────────────── */}
          {report && (
            <>
              {/* Verdict card */}
              <div style={{
                borderRadius: 16,
                background: `${accent}0d`,
                border: `1px solid ${accent}28`,
                overflow: 'hidden',
              }}>
                {/* Preset banner */}
                <div style={{
                  padding: '20px 24px 18px',
                  display: 'flex', flexDirection: 'column', alignItems: 'center',
                  borderBottom: `1px solid ${accent}18`,
                  background: `${accent}08`,
                }}>
                  <div style={{
                    fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
                    letterSpacing: '0.12em', color: 'rgba(255,255,255,0.3)', marginBottom: 10,
                  }}>
                    Estimated Preset
                  </div>
                  <div style={{
                    display: 'inline-flex', alignItems: 'center', gap: 10,
                    padding: '10px 28px', borderRadius: 999,
                    background: `${accent}1a`, border: `1.5px solid ${accent}50`,
                    color: accent, fontWeight: 900, fontSize: 28,
                    letterSpacing: '-0.5px',
                    boxShadow: `0 0 32px ${accent}22`,
                  }}>
                    <Zap size={22} fill={accent} stroke="none" />
                    {report.presetLabel}
                  </div>
                </div>

                {/* Counts + confidence row */}
                <div style={{
                  display: 'flex', alignItems: 'stretch',
                  borderBottom: `1px solid ${accent}10`,
                }}>
                  {/* Pass tile */}
                  <div style={{
                    flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
                    justifyContent: 'center', padding: '16px 8px',
                    borderRight: '1px solid rgba(255,255,255,0.06)',
                  }}>
                    <div style={{ fontSize: 32, fontWeight: 900, color: '#4ade80', lineHeight: 1 }}>
                      {passCount}
                    </div>
                    <div style={{
                      fontSize: 9, fontWeight: 700, textTransform: 'uppercase',
                      letterSpacing: '0.1em', color: 'rgba(255,255,255,0.32)', marginTop: 5,
                      display: 'flex', alignItems: 'center', gap: 4,
                    }}>
                      <CheckCircle2 size={9} style={{ color: '#4ade80' }} /> Pass
                    </div>
                  </div>
                  {/* Borderline tile */}
                  <div style={{
                    flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
                    justifyContent: 'center', padding: '16px 8px',
                    borderRight: '1px solid rgba(255,255,255,0.06)',
                  }}>
                    <div style={{ fontSize: 32, fontWeight: 900, color: '#fbbf24', lineHeight: 1 }}>
                      {borderCount}
                    </div>
                    <div style={{
                      fontSize: 9, fontWeight: 700, textTransform: 'uppercase',
                      letterSpacing: '0.1em', color: 'rgba(255,255,255,0.32)', marginTop: 5,
                      display: 'flex', alignItems: 'center', gap: 4,
                    }}>
                      <AlertCircle size={9} style={{ color: '#fbbf24' }} /> Tight
                    </div>
                  </div>
                  {/* Fail tile */}
                  <div style={{
                    flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
                    justifyContent: 'center', padding: '16px 8px',
                  }}>
                    <div style={{ fontSize: 32, fontWeight: 900, color: '#f87171', lineHeight: 1 }}>
                      {failCount}
                    </div>
                    <div style={{
                      fontSize: 9, fontWeight: 700, textTransform: 'uppercase',
                      letterSpacing: '0.1em', color: 'rgba(255,255,255,0.32)', marginTop: 5,
                      display: 'flex', alignItems: 'center', gap: 4,
                    }}>
                      <XCircle size={9} style={{ color: '#f87171' }} /> Below
                    </div>
                  </div>
                </div>

                {/* Confidence + storage row */}
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '12px 20px',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>Confidence</span>
                    <span style={{
                      fontSize: 10, fontWeight: 800, textTransform: 'uppercase',
                      letterSpacing: '0.07em', padding: '2px 10px', borderRadius: 999,
                      background: `${confidenceColor(report.confidence)}18`,
                      border: `1px solid ${confidenceColor(report.confidence)}40`,
                      color: confidenceColor(report.confidence),
                    }}>
                      {report.confidence}
                    </span>
                  </div>
                  {report.storageRequiredGb != null && (
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 5,
                      fontSize: 11, color: 'rgba(255,255,255,0.4)',
                    }}>
                      <HardDrive size={11} style={{ opacity: 0.5 }} />
                      {report.storageRequiredGb.toFixed(1)} GB required
                    </div>
                  )}
                </div>

                {/* Explanation */}
                <div style={{ padding: '0 20px 18px' }}>
                  <p style={{
                    margin: 0, fontSize: 13, color: 'rgba(255,255,255,0.55)',
                    lineHeight: 1.65,
                  }}>
                    {report.explanation}
                  </p>
                </div>
              </div>

              {/* ── Component cards ───────────────────────────────────── */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 12 }}>
                  <Monitor size={13} style={{ opacity: 0.35 }} />
                  <span style={{
                    fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
                    letterSpacing: '0.1em', color: 'rgba(255,255,255,0.35)',
                  }}>
                    Your PC vs Requirements
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {report.components.map((c) => (
                    <div
                      key={c.component}
                      style={{
                        display: 'flex', alignItems: 'flex-start', gap: 0,
                        borderRadius: 12,
                        background: statusBg(c.status),
                        border: `1px solid ${statusColor(c.status)}22`,
                        overflow: 'hidden',
                      }}
                    >
                      {/* Colored left accent bar */}
                      <div style={{
                        width: 4, flexShrink: 0, alignSelf: 'stretch',
                        background: statusColor(c.status),
                        opacity: 0.7,
                      }} />
                      {/* Content */}
                      <div style={{
                        flex: 1, display: 'flex', alignItems: 'center',
                        gap: 12, padding: '11px 14px',
                        flexWrap: 'wrap',
                      }}>
                        {/* Component name */}
                        <div style={{
                          fontWeight: 800, fontSize: 12,
                          color: '#fff', minWidth: 80, flexShrink: 0,
                        }}>
                          {c.component}
                        </div>
                        {/* Status chip */}
                        <div style={{
                          display: 'inline-flex', alignItems: 'center', gap: 5,
                          padding: '3px 10px', borderRadius: 999, flexShrink: 0,
                          background: `${statusColor(c.status)}15`,
                          border: `1px solid ${statusColor(c.status)}35`,
                        }}>
                          <StatusIcon status={c.status} />
                          <span style={{
                            fontSize: 10, fontWeight: 800, textTransform: 'capitalize',
                            color: statusColor(c.status), letterSpacing: '0.04em',
                          }}>
                            {c.status === 'borderline' ? 'Tight' : c.status.charAt(0).toUpperCase() + c.status.slice(1)}
                          </span>
                        </div>
                        {/* Detail text */}
                        <div style={{
                          fontSize: 11, color: 'rgba(255,255,255,0.48)',
                          lineHeight: 1.55, flex: 1, minWidth: 120,
                        }}>
                          {c.detail}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* ── Suggested settings chips ──────────────────────────── */}
              <div>
                <div style={{
                  fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
                  letterSpacing: '0.1em', color: 'rgba(255,255,255,0.32)', marginBottom: 12,
                  display: 'flex', alignItems: 'center', gap: 6,
                }}>
                  <SlidersHorizontal size={11} style={{ opacity: 0.5 }} />
                  Suggested Settings
                  <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0, opacity: 0.6, fontSize: 9 }}>
                    (estimate)
                  </span>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {[
                    { label: 'Resolution', value: report.suggestedSettings.resolution },
                    { label: 'Textures', value: report.suggestedSettings.textureQuality },
                    { label: 'Shadows', value: report.suggestedSettings.shadows },
                    { label: 'Ray Tracing', value: report.suggestedSettings.rayTracing },
                    { label: 'Upscaling', value: report.suggestedSettings.upscaling },
                  ].map(({ label, value }) => (
                    <div
                      key={label}
                      style={{
                        display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
                        padding: '8px 14px', borderRadius: 10,
                        background: 'rgba(255,255,255,0.05)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        minWidth: 90,
                      }}
                    >
                      <div style={{
                        fontSize: 8, fontWeight: 800, textTransform: 'uppercase',
                        letterSpacing: '0.09em', color: 'rgba(255,255,255,0.3)',
                        marginBottom: 5,
                      }}>
                        {label}
                      </div>
                      <div style={{
                        fontSize: 13, fontWeight: 800, color: '#fff',
                        letterSpacing: '-0.2px',
                      }}>
                        {value}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Refresh link */}
              <div>
                <button
                  type="button" className="btn btn-secondary"
                  onClick={() => void fetchReqAndReport()} disabled={fetchingReq}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 12 }}
                >
                  <RefreshCw size={13} /> Refresh requirements
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default GameCompatibilityModal;
