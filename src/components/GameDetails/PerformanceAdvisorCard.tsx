import React from 'react';
import GlassCard from '../common/GlassCard';
import ActionButton from '../common/ActionButton';
import { Cpu, Gauge } from 'lucide-react';

export interface PerfSummary {
  presetLabel: string;
  overall: string;
  confidence: string;
  bottlenecks: string[];
  storageRequiredGb: number | null;
  explanation: string;
}

interface PerformanceAdvisorCardProps {
  loading: boolean;
  summary: PerfSummary | null;
  noHardware: boolean;
  noRequirements: boolean;
  onFetchRequirements?: () => void;
  fetchingRequirements?: boolean;
  onFullReport?: () => void;
}

const presetTone = (label: string) => {
  const l = label.toLowerCase();
  if (l.includes('not supported') || l.includes('unknown')) return 'rgba(255,255,255,0.45)';
  if (l.includes('low')) return '#fbbf24';
  if (l.includes('medium')) return '#60a5fa';
  if (l.includes('high') || l.includes('ultra')) return '#4ade80';
  return 'rgba(255,255,255,0.85)';
};

const PerformanceAdvisorCard: React.FC<PerformanceAdvisorCardProps> = ({
  loading,
  summary,
  noHardware,
  noRequirements,
  onFetchRequirements,
  fetchingRequirements,
  onFullReport,
}) => {
  return (
    <GlassCard style={{ padding: '28px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Gauge size={20} style={{ color: 'var(--accent)', opacity: 0.9 }} />
          <h3 className="muted-label" style={{ margin: 0, color: '#fff' }}>
            Performance Advisor
          </h3>
        </div>
        {onFullReport ? (
          <ActionButton variant="secondary" onClick={onFullReport} style={{ padding: '8px 14px', fontSize: 12 }}>
            View full report
          </ActionButton>
        ) : null}
      </div>

      {loading ? (
        <p className="muted-label" style={{ margin: 0 }}>Loading compatibility…</p>
      ) : noHardware ? (
        <div>
          <p style={{ color: 'rgba(255,255,255,0.65)', margin: '0 0 12px', fontSize: 14, lineHeight: 1.5 }}>
            Scan your PC once in Settings → Hardware Profile so PitGames can estimate settings against store requirements.
          </p>
          {onFullReport ? (
            <ActionButton variant="primary" onClick={onFullReport}>
              Open Performance Advisor
            </ActionButton>
          ) : null}
        </div>
      ) : noRequirements ? (
        <div>
          <p style={{ color: 'rgba(255,255,255,0.65)', margin: '0 0 12px', fontSize: 14 }}>
            Requirements not loaded yet. Fetch from Steam (by title match) for an estimate — IGDB does not ship reliable PC specs.
          </p>
          {onFetchRequirements ? (
            <ActionButton variant="primary" onClick={onFetchRequirements} disabled={fetchingRequirements}>
              {fetchingRequirements ? 'Fetching…' : 'Fetch requirements'}
            </ActionButton>
          ) : null}
        </div>
      ) : summary ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div>
              <div className="muted-label" style={{ fontSize: 10, marginBottom: 4 }}>Estimated preset</div>
              <div style={{ fontWeight: 900, fontSize: 18, color: presetTone(summary.presetLabel) }}>{summary.presetLabel}</div>
            </div>
            <div>
              <div className="muted-label" style={{ fontSize: 10, marginBottom: 4 }}>Compatibility</div>
              <div style={{ fontWeight: 700, fontSize: 14, color: 'rgba(255,255,255,0.9)', textTransform: 'capitalize' }}>
                {summary.overall.replace(/_/g, ' ')}
              </div>
            </div>
          </div>
          {summary.storageRequiredGb != null ? (
            <div>
              <div className="muted-label" style={{ fontSize: 10, marginBottom: 4 }}>Storage (from requirements)</div>
              <div style={{ fontWeight: 700 }}>{summary.storageRequiredGb.toFixed(1)} GB</div>
            </div>
          ) : null}
          <div>
            <div className="muted-label" style={{ fontSize: 10, marginBottom: 6 }}>Bottlenecks</div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)', lineHeight: 1.45 }}>
              {summary.bottlenecks.length ? summary.bottlenecks.slice(0, 3).join(' · ') : 'None flagged — see full report for detail.'}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'rgba(255,255,255,0.45)' }}>
            <Cpu size={14} />
            <span>Confidence: {summary.confidence} — {summary.explanation.slice(0, 140)}{summary.explanation.length > 140 ? '…' : ''}</span>
          </div>
        </div>
      ) : null}
    </GlassCard>
  );
};

export default PerformanceAdvisorCard;
