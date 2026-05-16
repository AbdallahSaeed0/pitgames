import React, { useState, useMemo } from 'react';
import ActionButton from '../common/ActionButton';
import GlassCard from '../common/GlassCard';
import SafeImage from '../common/SafeImage';
import { getFileUrl } from '../../utils/fileUtils';
import { MediaImage } from '../../types';
import { CheckCircle2 } from 'lucide-react';

interface ImagePickerModalProps {
  title: string;
  images: MediaImage[];
  onSelect: (image: MediaImage) => void;
  onClose: () => void;
  type?: 'cover' | 'artwork' | 'screenshot';
}

const ImagePickerModal: React.FC<ImagePickerModalProps> = ({ title, images, onSelect, onClose }) => {
  const [selectedImage, setSelectedImage] = useState<MediaImage | null>(null);

  const isBackground = title.toLowerCase().includes('background');

  // Deduplicate and group images
  const groupedImages = useMemo(() => {
    const dedupedMap = new Map<string, MediaImage>();
    images.forEach(img => {
      const url = getFileUrl(img.url);
      if (url && !dedupedMap.has(url)) {
        dedupedMap.set(url, img);
      }
    });

    const groups: Record<string, MediaImage[]> = {
      'Current': [],
      'IGDB Covers': [],
      'SteamGridDB Posters': [],
      'SteamGridDB Heroes': [],
      'IGDB Artworks': [],
      'Screenshots': [],
      'Other Sources': []
    };

    dedupedMap.forEach(img => {
      const source = img.source?.toLowerCase() || '';
      
      if (source === 'current') {
        groups['Current'].push(img);
      } else if (source === 'steamgriddb') {
        if (isBackground) groups['SteamGridDB Heroes'].push(img);
        else groups['SteamGridDB Posters'].push(img);
      } else if (source === 'igdb') {
        if (img.id?.includes('cover')) groups['IGDB Covers'].push(img);
        else groups['IGDB Artworks'].push(img);
      } else if (img.id?.includes('screenshot') || source === 'screenshots') {
        groups['Screenshots'].push(img);
      } else {
        groups['Other Sources'].push(img);
      }
    });

    return groups;
  }, [images, isBackground]);

  const handleSave = () => {
    if (selectedImage) {
      onSelect(selectedImage);
    }
  };

  const getSourceBadgeColor = (source: string) => {
    if (source.includes('IGDB')) return '#6d28d9';
    if (source.includes('SteamGridDB')) return '#0ea5e9';
    if (source.includes('Current')) return '#f59e0b';
    return 'rgba(255, 255, 255, 0.2)';
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.85)',
      backdropFilter: 'blur(10px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '40px'
    }}>
      <GlassCard style={{ width: '100%', maxWidth: '1100px', height: '80vh', display: 'flex', flexDirection: 'column', padding: '0', overflow: 'hidden' }}>
        
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '32px 40px', borderBottom: '1px solid rgba(255,255,255,0.05)', backgroundColor: 'rgba(0,0,0,0.2)' }}>
          <div>
            <h2 style={{ fontSize: '32px', fontWeight: 900, margin: 0, letterSpacing: '-1px' }}>{title}</h2>
            <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)', marginTop: '6px', fontWeight: 600 }}>
              {images.length} available images from multiple sources
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#fff', fontSize: '24px', cursor: 'pointer', opacity: 0.5, transition: 'opacity 0.2s' }} onMouseEnter={(e) => e.currentTarget.style.opacity = '1'} onMouseLeave={(e) => e.currentTarget.style.opacity = '0.5'}>✕</button>
        </div>
        
        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '32px 40px', display: 'flex', flexDirection: 'column', gap: '40px' }}>
          {Object.entries(groupedImages).map(([groupName, imgs]) => {
            if (imgs.length === 0) return null;
            return (
              <div key={groupName}>
                <h3 className="muted-label" style={{ marginBottom: '16px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {groupName}
                  <div style={{ height: '1px', flex: 1, backgroundColor: 'rgba(255,255,255,0.05)' }} />
                </h3>
                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: isBackground ? 'repeat(auto-fill, minmax(320px, 1fr))' : 'repeat(auto-fill, minmax(180px, 1fr))', 
                  gap: '24px', 
                }}>
                  {imgs.map((image, i) => {
                    const isSelected = selectedImage?.url === image.url;
                    return (
                      <div 
                        key={`${image.id}-${i}`} 
                        onClick={() => setSelectedImage(image)}
                        style={{ 
                          aspectRatio: isBackground ? '16/9' : '2/3',
                          borderRadius: '14px',
                          overflow: 'hidden',
                          cursor: 'pointer',
                          border: `2px solid ${isSelected ? 'var(--accent)' : 'transparent'}`,
                          boxShadow: isSelected ? '0 0 20px rgba(var(--accent-rgb), 0.42)' : '0 10px 30px rgba(0,0,0,0.3)',
                          transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                          backgroundColor: 'rgba(255,255,255,0.05)',
                          position: 'relative'
                        }}
                        onMouseEnter={(e) => {
                          if (!isSelected) {
                            e.currentTarget.style.transform = 'scale(1.02)';
                            e.currentTarget.style.filter = 'brightness(1.1)';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (!isSelected) {
                            e.currentTarget.style.transform = 'scale(1)';
                            e.currentTarget.style.filter = 'brightness(1)';
                          }
                        }}
                      >
                        <SafeImage
                          src={getFileUrl(image.thumb_url) || getFileUrl(image.url) || undefined}
                          alt={`${groupName} option ${i}`}
                          fallbackText=" "
                          style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: isSelected ? 0.9 : 1 }}
                        />
                        {/* Source Badge */}
                        <div style={{ 
                          position: 'absolute', 
                          bottom: '8px', 
                          right: '8px', 
                          backgroundColor: getSourceBadgeColor(groupName), 
                          padding: '4px 8px', 
                          borderRadius: '6px', 
                          fontSize: '10px', 
                          fontWeight: 800,
                          boxShadow: '0 2px 10px rgba(0,0,0,0.5)',
                          border: '1px solid rgba(255,255,255,0.2)'
                        }}>
                          {image.source?.toUpperCase() || 'UNKNOWN'}
                        </div>
                        {/* Selected Checkmark */}
                        {isSelected && (
                          <div style={{ position: 'absolute', top: '12px', right: '12px', backgroundColor: 'var(--accent)', borderRadius: '50%', padding: '2px', boxShadow: '0 4px 10px rgba(0,0,0,0.5)' }}>
                            <CheckCircle2 size={24} fill="white" color="var(--accent)" />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {images.length === 0 && (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.3 }}>
              No images available.
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '24px 40px', borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '20px', backgroundColor: 'rgba(0,0,0,0.2)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20, flex: 1, minWidth: 280 }}>
            {selectedImage && (
              <>
                <div style={{ width: 120, height: isBackground ? 68 : 160, borderRadius: 12, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.12)', flexShrink: 0 }}>
                  <SafeImage
                    src={getFileUrl(selectedImage.url) || undefined}
                    alt="Preview"
                    fallbackText=" "
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                </div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', maxWidth: 360 }}>
                  Preview uses full image. Save applies this asset to your library entry.
                </div>
              </>
            )}
          </div>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {selectedImage && (
              <ActionButton
                variant="outline"
                onClick={async () => {
                  const url = getFileUrl(selectedImage.url);
                  if (!url) return;
                  try {
                    const res = await fetch(url);
                    const blob = await res.blob();
                    const a = document.createElement('a');
                    a.href = URL.createObjectURL(blob);
                    a.download = `pitgames-image-${selectedImage.id}.png`;
                    a.click();
                    URL.revokeObjectURL(a.href);
                  } catch {
                    window.open(url, '_blank');
                  }
                }}
              >
                Download
              </ActionButton>
            )}
            <ActionButton variant="secondary" onClick={onClose}>Cancel</ActionButton>
            <ActionButton variant="primary" onClick={handleSave} disabled={!selectedImage}>Save Selection</ActionButton>
          </div>
        </div>
      </GlassCard>
    </div>
  );
};

export default ImagePickerModal;
