import React from 'react';
import theme from '../../theme';

interface StatPillProps {
  label: string;
  value: string | number;
  icon?: React.ReactNode;
  color?: string;
}

const StatPill: React.FC<StatPillProps> = ({ label, value, icon, color }) => {
  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      gap: '4px',
      padding: '12px 16px',
      backgroundColor: 'rgba(255, 255, 255, 0.03)',
      borderRadius: theme.borderRadius.md,
      border: '1px solid rgba(255, 255, 255, 0.05)',
      minWidth: '120px'
    }}>
      <span style={{ fontSize: '11px', color: theme.text.muted, textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.5px' }}>
        {label}
      </span>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        {icon && <span style={{ color: color || theme.accent.primary }}>{icon}</span>}
        <span style={{ fontSize: '18px', fontWeight: 700, color: theme.text.primary }}>
          {value}
        </span>
      </div>
    </div>
  );
};

export default StatPill;
