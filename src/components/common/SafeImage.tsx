import React, { useState } from 'react';
import theme from '../../theme';

interface SafeImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  fallbackSrcs?: string[];
  fallbackText?: string;
  containerStyle?: React.CSSProperties;
  fallbackStyle?: React.CSSProperties;
}

const SafeImage: React.FC<SafeImageProps> = ({ 
  src, 
  fallbackSrcs = [], 
  fallbackText = 'PG', 
  containerStyle,
  fallbackStyle,
  alt, 
  style, 
  ...props 
}) => {
  const [currentSrcIndex, setCurrentSrcIndex] = useState(-1); // -1 means initial src, 0+ means fallbackSrcs index
  const [hasError, setHasError] = useState(!src && fallbackSrcs.length === 0);

  const srcs = [src, ...fallbackSrcs].filter(Boolean) as string[];
  const currentSrc = currentSrcIndex === -1 ? src : srcs[currentSrcIndex + 1];

  const handleError = () => {
    const nextIndex = currentSrcIndex + 1;
    if (nextIndex < fallbackSrcs.length) {
      setCurrentSrcIndex(nextIndex);
    } else {
      setHasError(true);
    }
  };

  if (hasError || !currentSrc) {
    const defaultFallbackStyle: React.CSSProperties = {
      width: '100%',
      height: '100%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: `linear-gradient(135deg, ${theme.background.secondary || '#12141b'} 0%, ${theme.background.elevated || '#1a1c23'} 100%)`,
      color: theme.text?.muted || 'rgba(255, 255, 255, 0.4)',
      fontWeight: 700,
      fontSize: '24px',
      textAlign: 'center',
      padding: '10px',
      ...fallbackStyle
    };

    return (
      <div style={{ ...containerStyle, ...style, overflow: 'hidden' }}>
        <div style={defaultFallbackStyle}>
          {fallbackText}
        </div>
      </div>
    );
  }

  return (
    <img
      src={currentSrc}
      alt={alt || fallbackText}
      style={{ ...style, objectFit: style?.objectFit || 'cover' }}
      onError={handleError}
      {...props}
    />
  );
};

export default SafeImage;
