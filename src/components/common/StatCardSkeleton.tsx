import React from 'react';
import theme from '../../theme';
import Skeleton from './Skeleton';

const StatCardSkeleton: React.FC = () => {
  return (
    <div style={{ 
      backgroundColor: theme.surface.card, 
      border: `1px solid ${theme.surface.border}`, 
      padding: theme.spacing.lg, 
      borderRadius: theme.borderRadius.md,
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing.sm
    }}>
      <Skeleton width="30px" height="30px" variant="circle" />
      <Skeleton width="60%" height="32px" variant="text" />
      <Skeleton width="40%" height="14px" variant="text" />
    </div>
  );
};

export default StatCardSkeleton;
