import React, { useCallback, useState } from 'react';
import Cropper, { Area } from 'react-easy-crop';
import ActionButton from './ActionButton';

async function getCroppedPngBlob(imageSrc: string, pixelCrop: Area): Promise<Blob | null> {
  let bitmap: ImageBitmap;
  try {
    const res = await fetch(imageSrc);
    if (!res.ok) return null;
    bitmap = await createImageBitmap(await res.blob());
  } catch {
    return null;
  }

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    bitmap.close();
    return null;
  }

  canvas.width = pixelCrop.width;
  canvas.height = pixelCrop.height;
  try {
    ctx.drawImage(
      bitmap,
      pixelCrop.x,
      pixelCrop.y,
      pixelCrop.width,
      pixelCrop.height,
      0,
      0,
      pixelCrop.width,
      pixelCrop.height
    );
  } finally {
    bitmap.close();
  }

  return new Promise((resolve) => {
    canvas.toBlob((b) => resolve(b), 'image/png', 0.92);
  });
}

interface AvatarCropModalProps {
  imageSrc: string;
  onCancel: () => void;
  onCropped: (blob: Blob) => Promise<void>;
}

const AvatarCropModal: React.FC<AvatarCropModalProps> = ({ imageSrc, onCancel, onCropped }) => {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [busy, setBusy] = useState(false);

  const onCropComplete = useCallback((_area: Area, areaPixels: Area) => {
    setCroppedAreaPixels(areaPixels);
  }, []);

  const handleSave = async () => {
    if (!croppedAreaPixels) return;
    setBusy(true);
    try {
      const blob = await getCroppedPngBlob(imageSrc, croppedAreaPixels);
      if (blob) await onCropped(blob);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 5000,
        background: 'rgba(0,0,0,0.82)',
        display: 'grid',
        placeItems: 'center',
        padding: 24,
      }}
    >
      <div
        style={{
          width: 'min(440px, 100%)',
          background: '#0c0e12',
          borderRadius: 16,
          border: '1px solid rgba(255,255,255,0.08)',
          padding: 20,
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}
      >
        <div style={{ fontSize: 18, fontWeight: 800, color: '#fff' }}>Crop photo</div>
        <p style={{ margin: 0, fontSize: 13, color: 'rgba(255,255,255,0.55)', lineHeight: 1.5 }}>
          Drag to reposition, use the slider to zoom, then save. The result is a square avatar.
        </p>
        <div style={{ position: 'relative', width: '100%', height: 280, borderRadius: 12, overflow: 'hidden', background: '#111' }}>
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={1}
            cropShape="rect"
            showGrid={false}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropComplete}
          />
        </div>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6, color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase' }}>
          Zoom
          <input type="range" min={1} max={3} step={0.01} value={zoom} onChange={(e) => setZoom(Number(e.target.value))} style={{ width: '100%' }} />
        </label>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
          <ActionButton variant="secondary" onClick={onCancel} disabled={busy}>
            Cancel
          </ActionButton>
          <ActionButton variant="primary" onClick={handleSave} disabled={busy || !croppedAreaPixels}>
            {busy ? 'Saving…' : 'Use photo'}
          </ActionButton>
        </div>
      </div>
    </div>
  );
};

export default AvatarCropModal;
