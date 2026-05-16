import React, { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import theme from '../../theme';
import { Game, GameProgressPayload } from '../../types';

interface ProgressCardProps {
  game: Game;
  onUpdate: () => void;
}

import GlassCard from '../common/GlassCard';

const ProgressCard: React.FC<ProgressCardProps> = ({ game, onUpdate }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    hltb_main_story: game.hltb_main_story || 0,
    hltb_main_extras: game.hltb_main_extras || 0,
    hltb_completionist: game.hltb_completionist || 0,
    target_hours: game.target_hours || 0,
    completion_status: game.completion_status,
  });

  const playtimeHours = game.total_playtime_seconds / 3600;
  const progressPercentage = game.target_hours 
    ? Math.min(100, Math.round((playtimeHours / game.target_hours) * 100)) 
    : 0;

  const handleSave = async () => {
    setLoading(true);
    try {
      const payload: GameProgressPayload = {
        game_id: game.id,
        hltb_main_story: formData.hltb_main_story || null,
        hltb_main_extras: formData.hltb_main_extras || null,
        hltb_completionist: formData.hltb_completionist || null,
        target_hours: formData.target_hours || null,
        completion_status: formData.completion_status,
      };
      await invoke('update_game_progress', { payload });
      setIsEditing(false);
      onUpdate();
    } catch (e) {
      console.error("Failed to update progress", e);
      alert("Failed to update progress");
    } finally {
      setLoading(false);
    }
  };

  if (isEditing) {
    return (
      <GlassCard style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.md }}>
        <h3 style={{ ...theme.typography.h3, margin: 0 }}>Edit Progress Goals</h3>
        
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: theme.spacing.md }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '12px', color: theme.text.secondary }}>Main Story (h)</label>
            <input 
              type="number" 
              value={formData.hltb_main_story} 
              onChange={e => setFormData({...formData, hltb_main_story: parseInt(e.target.value) || 0})}
              style={{ backgroundColor: 'rgba(255,255,255,0.05)', border: `1px solid ${theme.surface.border}`, borderRadius: theme.borderRadius.sm, padding: '8px', color: 'white' }}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '12px', color: theme.text.secondary }}>Main + Extras (h)</label>
            <input 
              type="number" 
              value={formData.hltb_main_extras} 
              onChange={e => setFormData({...formData, hltb_main_extras: parseInt(e.target.value) || 0})}
              style={{ backgroundColor: 'rgba(255,255,255,0.05)', border: `1px solid ${theme.surface.border}`, borderRadius: theme.borderRadius.sm, padding: '8px', color: 'white' }}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '12px', color: theme.text.secondary }}>Completionist (h)</label>
            <input 
              type="number" 
              value={formData.hltb_completionist} 
              onChange={e => setFormData({...formData, hltb_completionist: parseInt(e.target.value) || 0})}
              style={{ backgroundColor: 'rgba(255,255,255,0.05)', border: `1px solid ${theme.surface.border}`, borderRadius: theme.borderRadius.sm, padding: '8px', color: 'white' }}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '12px', color: theme.text.secondary }}>Personal Target (h)</label>
            <input 
              type="number" 
              value={formData.target_hours} 
              onChange={e => setFormData({...formData, target_hours: parseInt(e.target.value) || 0})}
              style={{ backgroundColor: 'rgba(255,255,255,0.05)', border: `1px solid ${theme.surface.border}`, borderRadius: theme.borderRadius.sm, padding: '8px', color: 'white' }}
            />
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <label style={{ fontSize: '12px', color: theme.text.secondary }}>Status</label>
          <select 
            value={formData.completion_status} 
            onChange={e => setFormData({...formData, completion_status: e.target.value as any})}
            style={{ backgroundColor: 'rgba(255,255,255,0.05)', border: `1px solid ${theme.surface.border}`, borderRadius: theme.borderRadius.sm, padding: '8px', color: 'white' }}
          >
            <option value="not_started">Not Started</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
          </select>
        </div>

        <div style={{ display: 'flex', gap: theme.spacing.sm, marginTop: theme.spacing.sm }}>
          <button 
            onClick={handleSave} 
            disabled={loading}
            style={{ flex: 1, backgroundColor: theme.accent.primary, color: theme.accent.onFill, border: 'none', padding: '10px', borderRadius: theme.borderRadius.md, fontWeight: 600, cursor: 'pointer' }}
          >
            {loading ? 'Saving...' : 'Save Progress'}
          </button>
          <button 
            onClick={() => setIsEditing(false)}
            style={{ flex: 1, backgroundColor: 'transparent', color: 'white', border: `1px solid ${theme.surface.border}`, padding: '10px', borderRadius: theme.borderRadius.md, fontWeight: 600, cursor: 'pointer' }}
          >
            Cancel
          </button>
        </div>
      </GlassCard>
    );
  }

  const hasAnyData = game.hltb_main_story || game.hltb_main_extras || game.hltb_completionist || game.target_hours;

  return (
    <GlassCard style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.md }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ ...theme.typography.h3, margin: 0 }}>Progress Tracking</h3>
        <button 
          onClick={() => setIsEditing(true)}
          style={{ background: 'none', border: 'none', color: theme.text.secondary, cursor: 'pointer', fontSize: '18px' }}
        >
          ✏️
        </button>
      </div>

      {!hasAnyData ? (
        <div style={{ textAlign: 'center', padding: '20px 0' }}>
          <p style={{ color: theme.text.muted, fontSize: '14px', marginBottom: theme.spacing.md }}>No progress tracking set</p>
          <button 
            onClick={() => setIsEditing(true)}
            style={{ backgroundColor: theme.accent.primary, color: theme.accent.onFill, border: 'none', padding: '8px 16px', borderRadius: theme.borderRadius.md, fontWeight: 600, cursor: 'pointer' }}
          >
            Set Progress Goals
          </button>
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {game.hltb_main_story && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: theme.text.secondary }}>
                <span>Main Story</span>
                <span>{game.hltb_main_story}h</span>
              </div>
            )}
            {game.hltb_main_extras && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: theme.text.secondary }}>
                <span>Main + Extras</span>
                <span>{game.hltb_main_extras}h</span>
              </div>
            )}
            {game.hltb_completionist && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: theme.text.secondary }}>
                <span>Completionist</span>
                <span>{game.hltb_completionist}h</span>
              </div>
            )}
          </div>

          {game.target_hours && (
            <div style={{ marginTop: theme.spacing.sm }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ fontWeight: 600, fontSize: '14px' }}>Target: {game.target_hours}h</span>
                <span style={{ color: theme.accent.primary, fontWeight: 700, fontSize: '14px' }}>{progressPercentage}%</span>
              </div>
              <div style={{ width: '100%', height: '8px', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '3px', overflow: 'hidden' }}>
                <div style={{ width: `${progressPercentage}%`, height: '100%', background: 'var(--accent-grad)', transition: 'width 0.3s ease' }} />
              </div>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: theme.spacing.sm }}>
            <div style={{ fontSize: '13px' }}>
              <div style={{ color: theme.text.muted }}>Played: {Math.floor(playtimeHours)}h</div>
              {game.target_hours && (
                <div style={{ color: theme.text.secondary }}>Remaining: {Math.max(0, game.target_hours - Math.floor(playtimeHours))}h</div>
              )}
            </div>
            <span style={{ 
              padding: '4px 10px', 
              borderRadius: theme.borderRadius.sm, 
              fontSize: '11px', 
              fontWeight: 700, 
              textTransform: 'uppercase',
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
              color: 
                game.completion_status === 'completed' ? theme.status.success : 
                game.completion_status === 'in_progress' ? theme.accent.primary : 
                theme.text.muted,
              border: `1px solid ${
                game.completion_status === 'completed' ? theme.status.success : 
                game.completion_status === 'in_progress' ? theme.accent.primary : 
                theme.surface.border
              }`
            }}>
              {game.completion_status.replace('_', ' ')}
            </span>
          </div>
        </>
      )}
    </GlassCard>
  );
};

export default ProgressCard;
