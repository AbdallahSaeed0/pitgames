import React from 'react';
import theme from '../../theme';

interface ProgressBarProps {
  progress: number;
  height?: number;
  showLabel?: boolean;
  color?: string;
}

const ProgressBar: React.FC<ProgressBarProps> = ({ 
  progress, 
  height = 8, 
  showLabel = false,
  color
}) => {
  const clampedProgress = Math.min(100, Math.max(0, progress));
  
  return (
    <div style={{ width: '100%' }}>
      {showLabel && (
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px', fontSize: '12px', fontWeight: 600 }}>
          <span style={{ color: theme.text.muted }}>Progress</span>
          <span style={{ color: theme.text.primary }}>{Math.round(clampedProgress)}%</span>
        </div>
      )}
      <div style={{ 
        width: '100%', 
        height: `${height}px`, 
        backgroundColor: 'rgba(255, 255, 255, 0.05)', 
        borderRadius: '100px',
        overflow: 'hidden'
      }}>
        <div style={{ 
          width: `${clampedProgress}%`, 
          height: '100%', 
          background: color || theme.accent.gradient,
          borderRadius: '100px',
          transition: 'width 0.6s cubic-bezier(0.4, 0, 0.2, 1)'
        }} />
      </div>
    </div>
  );
};

export default ProgressBar;
