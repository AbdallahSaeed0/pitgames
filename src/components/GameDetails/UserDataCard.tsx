import React from 'react';
import theme from '../../theme';

import GlassCard from '../common/GlassCard';

const UserDataCard: React.FC = () => {
  return (
    <GlassCard style={{ display: 'flex', flexDirection: 'column', gap: theme.spacing.md }}>
      <h3 style={{ ...theme.typography.h3, margin: 0 }}>User Data</h3>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <label style={{ fontSize: '12px', color: theme.text.secondary }}>Status</label>
        <select style={{ 
          backgroundColor: 'rgba(255,255,255,0.05)', 
          border: `1px solid ${theme.surface.border}`, 
          borderRadius: theme.borderRadius.md, 
          padding: '10px', 
          color: theme.text.primary, 
          outline: 'none' 
        }}>
          <option>Playing</option>
          <option>Backlog</option>
          <option>Completed</option>
          <option>Dropped</option>
        </select>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <label style={{ fontSize: '12px', color: theme.text.secondary }}>Notes</label>
        <textarea 
          placeholder="Add your notes here..."
          style={{ 
            backgroundColor: 'rgba(255,255,255,0.05)', 
            border: `1px solid ${theme.surface.border}`, 
            borderRadius: theme.borderRadius.md, 
            padding: '12px', 
            color: theme.text.primary, 
            outline: 'none', 
            minHeight: '100px', 
            resize: 'vertical', 
            fontSize: '14px' 
          }}
        />
      </div>

      <p style={{ fontSize: '12px', color: theme.text.muted, fontStyle: 'italic' }}>
        Notes and status are saved locally to your PitGames library.
      </p>
    </GlassCard>
  );
};

export default UserDataCard;
