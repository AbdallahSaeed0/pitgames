import React from 'react';
import theme from '../../theme';
import Skeleton from '../common/Skeleton';

const GameCardSkeleton: React.FC = () => {
  return (
    <div style={{ 
      aspectRatio: '3/4', 
      backgroundColor: theme.surface.card, 
      borderRadius: theme.borderRadius.lg,
      border: `1px solid ${theme.surface.border}`,
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column'
    }}>
      <Skeleton height="100%" width="100%" variant="rect" />
      <div style={{ padding: theme.spacing.md, position: 'absolute', bottom: 0, left: 0, right: 0, background: 'rgba(15, 20, 25, 0.8)' }}>
        <Skeleton width="80%" height="16px" variant="text" style={{ marginBottom: '8px' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <Skeleton width="40%" height="12px" variant="text" />
          <Skeleton width="20%" height="12px" variant="text" />
        </div>
      </div>
    </div>
  );
};

export default GameCardSkeleton;
