import React, { ReactNode } from 'react';
import theme from '../../theme';

interface EmptyStateProps {
  icon: string | ReactNode;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}

const EmptyState: React.FC<EmptyStateProps> = ({ 
  icon, 
  title, 
  description, 
  actionLabel, 
  onAction 
}) => {
  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      alignItems: 'center', 
      justifyContent: 'center', 
      padding: '60px 20px',
      textAlign: 'center',
      maxWidth: '400px',
      margin: '0 auto'
    }}>
      <div style={{ fontSize: '64px', marginBottom: theme.spacing.md, opacity: 0.6 }}>
        {icon}
      </div>
      <h2 style={{ ...theme.typography.h2, color: theme.text.secondary, marginBottom: theme.spacing.sm }}>
        {title}
      </h2>
      <p style={{ ...theme.typography.body, color: theme.text.muted, marginBottom: theme.spacing.lg }}>
        {description}
      </p>
      {actionLabel && onAction && (
        <button 
          onClick={onAction}
          style={{ 
            backgroundColor: theme.accent.primary,
            color: theme.accent.onFill,
            border: 'none',
            borderRadius: theme.borderRadius.md,
            padding: '12px 24px',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.2s ease'
          }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = theme.accent.hover}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = theme.accent.primary}
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
};

export default EmptyState;
