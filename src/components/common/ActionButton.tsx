import React from 'react';
import theme from '../../theme';

interface ActionButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'danger';
  icon?: React.ReactNode;
  style?: React.CSSProperties;
  className?: string;
  disabled?: boolean;
}

const ActionButton: React.FC<ActionButtonProps> = ({ 
  children, 
  onClick, 
  variant = 'primary', 
  icon, 
  style,
  className,
  disabled
}) => {
  const getVariantStyles = (): React.CSSProperties => {
    switch (variant) {
      case 'primary':
        return {
          background: theme.accent.gradient,
          color: theme.accent.onFill,
          border: 'none',
          boxShadow: '0 4px 22px rgba(var(--accent-rgb), 0.3)',
        };
      case 'secondary':
        return {
          backgroundColor: 'rgba(255, 255, 255, 0.08)',
          color: '#fff',
          border: '1px solid rgba(255, 255, 255, 0.1)',
        };
      case 'outline':
        return {
          backgroundColor: 'transparent',
          color: '#fff',
          border: `1px solid ${theme.surface.border}`,
        };
      case 'danger':
        return {
          backgroundColor: 'rgba(239, 68, 68, 0.15)',
          color: '#ff8a86',
          border: '1px solid rgba(239, 68, 68, 0.3)',
        };
      default:
        return {};
    }
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`btn-hover ${className || ''}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '10px',
        padding: '12px 24px',
        borderRadius: theme.borderRadius.md,
        fontSize: '15px',
        fontWeight: 700,
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
        opacity: disabled ? 0.6 : 1,
        ...getVariantStyles(),
        ...style
      }}
    >
      {icon && <span style={{ display: 'flex' }}>{icon}</span>}
      {children}
    </button>
  );
};

export default ActionButton;
