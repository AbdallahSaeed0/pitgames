import React from 'react';
import theme from '../../theme';

interface StatsCardProps {
  playtime: number;
  processName: string;
  isRunning: boolean;
  currentSessionSec?: number;
}

const StatsCard: React.FC<StatsCardProps> = ({ playtime, processName, isRunning, currentSessionSec }) => {
  const formatTime = (sec: number) => {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    return `${h}h ${m}m`;
  };

  const cardStyle: React.CSSProperties = {
    backgroundColor: theme.surface.card,
    borderRadius: theme.borderRadius.lg,
    padding: theme.spacing.lg,
    border: `1px solid ${theme.surface.border}`,
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing.lg,
  };

  const statItemStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  };

  return (
    <div style={cardStyle}>
      <h3 style={{ ...theme.typography.h3, margin: 0 }}>Playtime Stats</h3>
      
      <div style={statItemStyle}>
        <div style={{ color: theme.text.secondary, fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total Played</div>
        <div style={{ ...theme.typography.h1, color: theme.text.primary }}>{formatTime(playtime)}</div>
      </div>

      {isRunning && currentSessionSec !== undefined && (
        <div style={{ ...statItemStyle, padding: theme.spacing.md, backgroundColor: 'rgba(76, 175, 80, 0.1)', borderRadius: theme.borderRadius.md, border: `1px solid ${theme.status.success}` }}>
          <div style={{ color: theme.status.success, fontSize: '12px', fontWeight: 600 }}>Current Session</div>
          <div style={{ ...theme.typography.h2, color: theme.status.success }}>{formatTime(currentSessionSec)}</div>
        </div>
      )}

      <div style={{ borderTop: `1px solid ${theme.surface.border}`, paddingTop: theme.spacing.md }}>
        <div style={{ color: theme.text.muted, fontSize: '12px', marginBottom: '8px' }}>Tracking Details</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
          <span style={{ color: theme.text.secondary }}>Process Name</span>
          <code style={{ color: theme.accent.primary }}>{processName}</code>
        </div>
      </div>
    </div>
  );
};

export default StatsCard;
