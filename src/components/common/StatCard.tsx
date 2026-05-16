import React from 'react';
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  label: string;
  value: string | number;
  icon?: LucideIcon;
  trend?: string;
  trendPositive?: boolean;
  /** Optional hex/CSS color to tint the icon bubble and hover border */
  accentColor?: string;
  /** Optional sub-label shown below value */
  sub?: string;
}

const StatCard: React.FC<StatCardProps> = ({
  label, value, icon: Icon, trend, trendPositive, accentColor, sub,
}) => {
  const color = accentColor ?? 'var(--accent)';

  return (
    <div
      className="stat-card"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        padding: 22,
        background: 'rgba(255,255,255,0.03)',
        borderRadius: 20,
        border: '1px solid rgba(255,255,255,0.055)',
        transition: 'all 0.25s cubic-bezier(0.4,0,0.2,1)',
        position: 'relative',
        overflow: 'hidden',
        // subtle tinted top line
      }}
    >
      {/* Tinted top accent strip */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 2,
        background: color, opacity: 0.55, borderRadius: '20px 20px 0 0',
      }} />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <span style={{
          fontSize: 10, fontWeight: 800, textTransform: 'uppercase',
          letterSpacing: '1.2px', color: 'rgba(255,255,255,0.38)',
        }}>
          {label}
        </span>
        {Icon && (
          <div style={{
            width: 34, height: 34, borderRadius: 10,
            background: `color-mix(in srgb, ${color} 14%, transparent)`,
            border: `1px solid color-mix(in srgb, ${color} 30%, transparent)`,
            display: 'grid', placeItems: 'center',
            color,
            flexShrink: 0,
          }}>
            <Icon size={16} />
          </div>
        )}
      </div>

      <div>
        <div style={{
          fontSize: 32, fontWeight: 900, color: '#fff',
          letterSpacing: '-1px', lineHeight: 1,
        }}>
          {value}
        </div>
        {sub && (
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 4, fontWeight: 600 }}>
            {sub}
          </div>
        )}
      </div>

      {trend && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 5,
          fontSize: 12, fontWeight: 800,
          color: trendPositive ? '#4ade80' : '#f87171',
        }}>
          <span style={{ fontSize: 14 }}>{trendPositive ? '↑' : '↓'}</span>
          {trend}
          <span style={{ color: 'rgba(255,255,255,0.2)', fontWeight: 600, marginLeft: 2 }}>
            vs last week
          </span>
        </div>
      )}

      <style>{`
        .stat-card:hover {
          background: rgba(255,255,255,0.055) !important;
          transform: translateY(-3px);
          box-shadow: 0 14px 32px rgba(0,0,0,0.45);
        }
      `}</style>
    </div>
  );
};

export default StatCard;
