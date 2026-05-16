import React from 'react';
import theme from '../../theme';
import SafeImage from './SafeImage';

type PosterVariant = 'portrait' | 'banner' | 'thumbnail';

interface GamePosterProps {
  src?: string | null;
  fallbackSrcs?: string[];
  title: string;
  variant?: PosterVariant;
  className?: string;
  style?: React.CSSProperties;
}

const GamePoster: React.FC<GamePosterProps> = ({ src, fallbackSrcs = [], title, variant = 'portrait', className, style }) => {
  const getInitials = (t: string) =>
    t
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((chunk) => chunk[0]?.toUpperCase() ?? '')
      .join('');

  const baseStyle: React.CSSProperties = {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.background.secondary,
    border: `1px solid ${theme.surface.border}`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    ...style,
  };

  const variantStyles: Record<PosterVariant, React.CSSProperties> = {
    portrait: {
      aspectRatio: '3/4',
      width: '100%',
    },
    banner: {
      aspectRatio: '16/9',
      width: '100%',
    },
    thumbnail: {
      width: '60px',
      height: '60px',
    },
  };

  const imageStyle: React.CSSProperties = {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    objectPosition: 'center',
    display: 'block',
  };

  return (
    <div style={{ ...baseStyle, ...variantStyles[variant] }} className={className}>
      <SafeImage
        src={src || undefined}
        fallbackSrcs={fallbackSrcs}
        fallbackText={getInitials(title) || 'PG'}
        alt={title}
        style={imageStyle}
        fallbackStyle={{ fontSize: variant === 'thumbnail' ? '14px' : '24px' }}
        loading="lazy"
      />
    </div>
  );
};

export default GamePoster;
