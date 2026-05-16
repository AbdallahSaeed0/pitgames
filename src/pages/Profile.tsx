import React, { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import theme from '../theme';
import GlassCard from '../components/common/GlassCard';
import ActionButton from '../components/common/ActionButton';
import { useToast } from '../hooks/useToast';
import { getBackgroundImageUrl } from '../utils/fileUtils';
import AvatarCropModal from '../components/common/AvatarCropModal';
import {
  User, Camera, Save, ChevronLeft,
  Cpu, Scan, RefreshCw, Trash2,
} from 'lucide-react';

interface ProfileProps {
  onBack: () => void;
}

const specRows = (p: Record<string, unknown>) => [
  { label: 'CPU', value: String(p.cpuName ?? '—') },
  { label: 'GPU', value: String(p.gpuName ?? '—') },
  { label: 'RAM', value: p.ramGb != null ? `${Number(p.ramGb).toFixed(1)} GB` : '—' },
  { label: 'VRAM', value: p.gpuVramGb != null ? `${Number(p.gpuVramGb).toFixed(1)} GB` : '—' },
  { label: 'Free storage', value: p.storageFreeGb != null ? `${Number(p.storageFreeGb).toFixed(0)} GB` : '—' },
  { label: 'Display', value: String(p.screenResolution ?? '—') },
  { label: 'DirectX', value: String(p.directxVersion ?? '—') },
];

const Profile: React.FC<ProfileProps> = ({ onBack }) => {
  const [profile, setProfile] = useState<any>(null);
  const [name, setName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [cropImageSrc, setCropImageSrc] = useState<string | null>(null);
  const { showSuccess, showError } = useToast();

  const [hardwareProfiles, setHardwareProfiles] = useState<Array<Record<string, unknown>>>([]);
  const [hardwareLoading, setHardwareLoading] = useState(true);
  const [scanningHw, setScanningHw] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const data = await invoke<any>('get_user_profile');
        setProfile(data);
        setName(data.name);
        setAvatarUrl(data.avatar_url || '');
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchProfile();
  }, []);

  const loadHardwareProfiles = useCallback(async () => {
    setHardwareLoading(true);
    try {
      const rows = await invoke<Array<Record<string, unknown>>>('list_hardware_profiles');
      setHardwareProfiles(rows);
    } catch { showError('Could not load hardware profiles'); }
    finally { setHardwareLoading(false); }
  }, [showError]);

  useEffect(() => { void loadHardwareProfiles(); }, [loadHardwareProfiles]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await invoke('update_user_profile', { name, avatarUrl: avatarUrl || null });
      showSuccess('Profile updated');
      // Tell the sidebar to re-fetch immediately
      window.dispatchEvent(new Event('profile-updated'));
    } catch (e) {
      showError('Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handlePickAvatar = async () => {
    try {
      const path = await invoke<string>('pick_image');
      const dataUrl = await invoke<string>('read_local_image_as_data_url', { path });
      setCropImageSrc(dataUrl);
    } catch {
      /* cancelled or read failed */
    }
  };

  const handleScanHardware = async () => {
    setScanningHw(true);
    try {
      await invoke('scan_hardware_profile', { profile_name: null });
      showSuccess('Hardware profile saved');
      await loadHardwareProfiles();
    } catch (e) { showError(String(e)); }
    finally { setScanningHw(false); }
  };

  const handleSetActiveProfile = async (id: number) => {
    try {
      await invoke('set_active_hardware_profile', { profileId: id });
      showSuccess('Active profile updated');
      await loadHardwareProfiles();
    } catch (e) { showError(String(e)); }
  };

  const handleDeleteProfile = async (id: number) => {
    setDeletingId(id);
    try {
      await invoke('delete_hardware_profile', { profileId: id });
      showSuccess('Profile deleted');
      await loadHardwareProfiles();
    } catch (e) { showError(String(e)); }
    finally { setDeletingId(null); }
  };

  if (loading) return <div style={{ padding: '40px', color: '#fff' }}>Loading...</div>;

  return (
    <div className="premium-page">
      {cropImageSrc && (
        <AvatarCropModal
          imageSrc={cropImageSrc}
          onCancel={() => setCropImageSrc(null)}
          onCropped={async (blob) => {
            try {
              const bytes = Array.from(new Uint8Array(await blob.arrayBuffer()));
              const stored = await invoke<string>('save_profile_avatar_png', { bytes });
              setAvatarUrl(stored);
              setCropImageSrc(null);
              showSuccess('Cropped photo ready — tap Save Changes to store it on your profile');
            } catch {
              showError('Could not save cropped image');
            }
          }}
        />
      )}
      <div className="top-nav">
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', paddingLeft: '32px' }}>
          <button
            onClick={onBack}
            style={{
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)',
              color: '#fff',
              padding: '8px 16px',
              borderRadius: '8px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '13px',
              fontWeight: 700,
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.1)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
          >
            <ChevronLeft size={16} /> Back
          </button>
        </div>
        <div className="nav-actions" />
      </div>

      <div style={{ padding: '48px 64px', color: '#fff' }}>
        <h1 style={{ ...theme.typography.h1, marginBottom: '32px' }}>User Profile</h1>

        <div style={{ maxWidth: '860px', display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* ── Identity card ── */}
          <GlassCard style={{ padding: '40px', display: 'flex', gap: '40px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px' }}>
              <div style={{
                width: '160px',
                height: '160px',
                borderRadius: '50%',
                backgroundImage: getBackgroundImageUrl(avatarUrl) || 'var(--accent-grad)',
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                display: 'grid',
                placeItems: 'center',
                fontSize: '48px',
                fontWeight: 800,
                boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
                border: '4px solid rgba(255,255,255,0.1)',
                overflow: 'hidden',
                color: '#fff',
              }}>
                {!avatarUrl && (name?.charAt(0).toUpperCase() || <User size={64} />)}
              </div>
              <ActionButton onClick={handlePickAvatar} variant="secondary" icon={<Camera size={14} />} style={{ fontSize: '12px', padding: '8px 16px' }}>
                Change Photo
              </ActionButton>
            </div>

            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', fontWeight: 800, marginBottom: '8px' }}>Display Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  style={{
                    width: '100%',
                    backgroundColor: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '8px',
                    padding: '12px 16px',
                    color: '#fff',
                    fontSize: '16px',
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: '24px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '12px', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', fontWeight: 800, marginBottom: '8px' }}>Level</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                    <div style={{ fontSize: '28px', fontWeight: 900, color: 'var(--accent)', lineHeight: 1 }}>{profile?.level || 1}</div>
                    <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', fontWeight: 600 }}>
                      {profile?.xp ?? 0} XP
                    </div>
                  </div>
                  {/* XP progress bar toward next level */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5, fontSize: 11, color: 'rgba(255,255,255,0.3)', fontWeight: 700 }}>
                      <span>Progress to Level {(profile?.level || 1) + 1}</span>
                      <span>{Math.round(((profile?.xp ?? 0) % 1000) / 10)}%</span>
                    </div>
                    <div style={{ height: 5, background: 'rgba(255,255,255,0.08)', borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{
                        height: '100%',
                        width: `${Math.min(100, ((profile?.xp ?? 0) % 1000) / 10)}%`,
                        background: 'var(--accent)',
                        borderRadius: 4,
                        transition: 'width 0.5s ease',
                        boxShadow: '0 0 8px var(--accent)',
                      }} />
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ marginTop: '16px' }}>
                <ActionButton onClick={handleSave} variant="primary" icon={<Save size={18} />} disabled={saving} style={{ padding: '12px 32px' }}>
                  {saving ? 'Saving...' : 'Save Changes'}
                </ActionButton>
              </div>
            </div>
          </GlassCard>

          {/* ── Hardware Profile ── */}
          <div style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: 16, padding: '22px 24px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
              <div style={{
                width: 34, height: 34, borderRadius: 9, flexShrink: 0,
                background: 'rgba(var(--accent-rgb),0.12)',
                border: '1px solid rgba(var(--accent-rgb),0.2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'var(--accent)',
              }}><Cpu size={16} /></div>
              <div>
                <div style={{ fontWeight: 800, fontSize: 15 }}>Hardware Profile</div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 1 }}>
                  Scanned specs are used by "Can I Run It?" to compare your PC against game requirements.
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
              <button type="button" className="btn btn-primary" disabled={scanningHw}
                onClick={() => void handleScanHardware()}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
                <Scan size={15} />
                {scanningHw ? 'Scanning…' : 'Scan My PC'}
              </button>
              <button type="button" className="btn btn-secondary" disabled={hardwareLoading}
                onClick={() => void loadHardwareProfiles()}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
                <RefreshCw size={14} />
                Refresh
              </button>
            </div>

            {hardwareLoading && <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>Loading profiles…</p>}
            {!hardwareLoading && hardwareProfiles.length === 0 && (
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>
                No scans yet — click <strong>Scan My PC</strong> to create your first profile.
              </p>
            )}
            {!hardwareLoading && hardwareProfiles.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {hardwareProfiles.map((p) => {
                  const id = Number(p.id);
                  const active = Boolean(p.isActive);
                  const isDeleting = deletingId === id;
                  return (
                    <div key={id} style={{
                      borderRadius: 12, overflow: 'hidden',
                      border: active ? '1px solid rgba(var(--accent-rgb),0.35)' : '1px solid rgba(255,255,255,0.07)',
                    }}>
                      <div style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
                        padding: '12px 16px',
                        background: active ? 'rgba(var(--accent-rgb),0.07)' : 'rgba(255,255,255,0.02)',
                        borderBottom: '1px solid rgba(255,255,255,0.05)',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ fontWeight: 700, fontSize: 14 }}>{String(p.profileName ?? 'Profile')}</div>
                          {active && (
                            <span style={{
                              fontSize: 10, fontWeight: 800, textTransform: 'uppercase',
                              letterSpacing: '0.06em', color: 'var(--accent)',
                              padding: '2px 8px', borderRadius: 999,
                              background: 'rgba(var(--accent-rgb),0.15)',
                            }}>Active</span>
                          )}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>
                            {new Date(String(p.scannedAt ?? '')).toLocaleDateString()}
                          </span>
                          {!active && (
                            <button type="button" className="btn btn-secondary"
                              style={{ padding: '6px 12px', fontSize: 12 }}
                              onClick={() => void handleSetActiveProfile(id)}>
                              Set active
                            </button>
                          )}
                          <button type="button"
                            disabled={isDeleting}
                            onClick={() => void handleDeleteProfile(id)}
                            style={{
                              display: 'inline-flex', alignItems: 'center', gap: 5,
                              padding: '6px 10px', fontSize: 12, borderRadius: 8,
                              border: '1px solid rgba(239,68,68,0.35)',
                              background: 'rgba(239,68,68,0.08)',
                              color: '#ef4444', cursor: isDeleting ? 'wait' : 'pointer',
                              opacity: isDeleting ? 0.6 : 1,
                            }}>
                            <Trash2 size={12} />
                            {isDeleting ? 'Deleting…' : 'Delete'}
                          </button>
                        </div>
                      </div>

                      <div style={{
                        display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px,1fr))',
                        gap: 0, padding: '4px 0',
                      }}>
                        {specRows(p).map(({ label, value }) => (
                          <div key={label} style={{ padding: '10px 16px', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'rgba(255,255,255,0.3)', marginBottom: 3 }}>{label}</div>
                            <div style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.85)', wordBreak: 'break-word' }}>{value}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
};

export default Profile;
