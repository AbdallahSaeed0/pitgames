import React from 'react';
import theme from '../../theme';

interface SkeletonProps {
  width?: string | number;
  height?: string | number;
  variant?: 'text' | 'rect' | 'circle';
  style?: React.CSSProperties;
}

const Skeleton: React.FC<SkeletonProps> = ({ 
  width = '100%', 
  height = '20px', 
  variant = 'rect',
  style 
}) => {
  const borderRadius = variant === 'circle' ? '50%' : variant === 'text' ? '4px' : theme.borderRadius.md;

  return (
    <div 
      className="skeleton-pulse"
      style={{ 
        width, 
        height, 
        backgroundColor: theme.surface.border, 
        borderRadius,
        ...style 
      }} 
    >
      <style>{`
        .skeleton-pulse {
          animation: pulse 1.5s ease-in-out infinite;
        }
        @keyframes pulse {
          0% { opacity: 0.5; }
          50% { opacity: 1; }
          100% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
};

export default Skeleton;
