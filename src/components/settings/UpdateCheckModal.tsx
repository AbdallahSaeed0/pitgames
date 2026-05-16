import React from 'react';
import ActionButton from '../common/ActionButton';
import GlassCard from '../common/GlassCard';
import { ExternalLink, X } from 'lucide-react';

export interface GitHubReleaseCheck {
  current_version: string;
  latest_version: string;
  release_notes: string;
  html_url: string;
  download_url: string | null;
  update_available: boolean;
}

interface UpdateCheckModalProps {
  data: GitHubReleaseCheck;
  onClose: () => void;
}

const UpdateCheckModal: React.FC<UpdateCheckModalProps> = ({ data, onClose }) => {
  const primaryHref = data.download_url || data.html_url;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.88)',
        backdropFilter: 'blur(10px)',
        zIndex: 13000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
      role="dialog"
      aria-modal
    >
      <GlassCard style={{ maxWidth: 520, width: '100%', padding: 0, overflow: 'hidden' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            padding: '22px 24px',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          <div>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 900 }}>Update available</h2>
            <p style={{ margin: '8px 0 0', fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>
              You are on <strong style={{ color: '#fff' }}>{data.current_version}</strong> — latest is{' '}
              <strong style={{ color: 'var(--accent)' }}>{data.latest_version}</strong>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              border: 'none',
              background: 'rgba(255,255,255,0.06)',
              color: '#fff',
              borderRadius: 10,
              width: 38,
              height: 38,
              cursor: 'pointer',
              display: 'grid',
              placeItems: 'center',
            }}
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>
        <div style={{ padding: '16px 24px', maxHeight: 220, overflowY: 'auto', fontSize: 13, lineHeight: 1.55, color: 'rgba(255,255,255,0.75)' }}>
          <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', margin: 0 }}>
            {data.release_notes?.trim() || 'No release notes provided for this version.'}
          </pre>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'flex-end', padding: '16px 24px' }}>
          <ActionButton variant="secondary" onClick={onClose}>
            Later
          </ActionButton>
          <ActionButton
            variant="primary"
            icon={<ExternalLink size={16} />}
            onClick={() => {
              window.open(primaryHref, '_blank');
            }}
          >
            {data.download_url ? 'Download' : 'Open release page'}
          </ActionButton>
        </div>
      </GlassCard>
    </div>
  );
};

export default UpdateCheckModal;
