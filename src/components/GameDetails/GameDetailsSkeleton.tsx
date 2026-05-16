import React from 'react';
import theme from '../../theme';
import Skeleton from '../common/Skeleton';

const GameDetailsSkeleton: React.FC = () => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', backgroundColor: theme.background.primary }}>
      {/* Hero Skeleton */}
      <div style={{ height: '500px', position: 'relative', backgroundColor: theme.surface.border }}>
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '48px', display: 'flex', alignItems: 'flex-end', gap: '32px' }}>
          <Skeleton width="200px" height="280px" variant="rect" style={{ borderRadius: theme.borderRadius.lg }} />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <Skeleton width="150px" height="20px" variant="text" />
            <Skeleton width="300px" height="48px" variant="text" />
            <div style={{ display: 'flex', gap: '16px' }}>
              <Skeleton width="120px" height="40px" variant="rect" />
              <Skeleton width="120px" height="40px" variant="rect" />
            </div>
          </div>
        </div>
      </div>

      {/* Content Skeleton */}
      <div style={{ display: 'grid', gridTemplateColumns: '7fr 3fr', gap: '32px', padding: '48px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
          <section>
            <Skeleton width="100px" height="24px" variant="text" style={{ marginBottom: '16px' }} />
            <Skeleton width="100%" height="100px" variant="rect" />
          </section>
          <section>
            <Skeleton width="150px" height="24px" variant="text" style={{ marginBottom: '16px' }} />
            <Skeleton width="100%" height="200px" variant="rect" />
          </section>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
          <Skeleton width="100%" height="150px" variant="rect" />
          <Skeleton width="100%" height="200px" variant="rect" />
        </div>
      </div>
    </div>
  );
};

export default GameDetailsSkeleton;
