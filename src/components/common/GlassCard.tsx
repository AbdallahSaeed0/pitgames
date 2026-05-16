import React from 'react';

interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  noPadding?: boolean;
}

const GlassCard: React.FC<GlassCardProps> = ({ children, className, style, noPadding }) => {
  return (
    <div 
      className={`glass-panel ${className || ''}`}
      style={{ 
        padding: noPadding ? 0 : '24px',
        ...style 
      }}
    >
      {children}
    </div>
  );
};

export default GlassCard;
