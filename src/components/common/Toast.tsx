import React, { useEffect } from 'react';
import { CheckCircle, XCircle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info';

interface ToastProps {
  id: string;
  message: string;
  type: ToastType;
  onClose: (id: string) => void;
}

const Toast: React.FC<ToastProps> = ({ id, message, type, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose(id);
    }, 4000);
    return () => clearTimeout(timer);
  }, [id, onClose]);

  const getIcon = () => {
    switch (type) {
      case 'success': return <CheckCircle size={20} color="#10b981" />;
      case 'error': return <XCircle size={20} color="#ef4444" />;
      case 'info': return <Info size={20} color="#7cb842" />;
    }
  };

  const getStyles = () => {
    switch (type) {
      case 'success':
        return {
          background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.15) 0%, rgba(16, 185, 129, 0.05) 100%)',
          borderColor: 'rgba(16, 185, 129, 0.3)',
          progressColor: '#10b981',
        };
      case 'error':
        return {
          background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.15) 0%, rgba(239, 68, 68, 0.05) 100%)',
          borderColor: 'rgba(239, 68, 68, 0.3)',
          progressColor: '#ef4444',
        };
      case 'info':
        return {
          background: 'linear-gradient(135deg, rgba(var(--accent-rgb), 0.16) 0%, rgba(var(--accent-rgb), 0.05) 100%)',
          borderColor: 'rgba(var(--accent-rgb), 0.35)',
          progressColor: '#7cb842',
        };
    }
  };

  const styles = getStyles();

  return (
    <div className="toast-item" style={{
      width: '360px',
      padding: '16px 20px',
      borderRadius: '16px',
      background: styles.background,
      border: `1px solid ${styles.borderColor}`,
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
      color: '#fff',
      boxShadow: '0 20px 40px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.05)',
      display: 'flex',
      alignItems: 'center',
      gap: '14px',
      position: 'relative',
      overflow: 'hidden',
    }}>
      <div style={{
        width: '36px',
        height: '36px',
        borderRadius: '10px',
        background: 'rgba(255,255,255,0.05)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}>
        {getIcon()}
      </div>
      <div style={{ flex: 1, fontSize: '14px', fontWeight: 600, lineHeight: 1.4 }}>{message}</div>
      <button 
        onClick={() => onClose(id)}
        style={{ 
          background: 'none', 
          border: 'none', 
          color: 'rgba(255,255,255,0.5)', 
          cursor: 'pointer', 
          fontSize: '18px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '4px',
          borderRadius: '6px',
          transition: 'all 0.2s ease',
        }}
        onMouseEnter={(e) => e.currentTarget.style.color = 'rgba(255,255,255,0.8)'}
        onMouseLeave={(e) => e.currentTarget.style.color = 'rgba(255,255,255,0.5)'}
      >
        <X size={18} />
      </button>
      <div 
        className="toast-progress" 
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          height: '3px',
          backgroundColor: styles.progressColor,
          boxShadow: `0 0 10px ${styles.progressColor}`,
        }}
      />
      
      <style>{`
        .toast-item {
          animation: toast-slide-in 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        @keyframes toast-slide-in {
          from { 
            transform: translateX(120%) scale(0.9); 
            opacity: 0; 
          }
          to { 
            transform: translateX(0) scale(1); 
            opacity: 1; 
          }
        }
        .toast-progress {
          animation: toast-progress 4s linear forwards;
        }
        @keyframes toast-progress {
          from { width: 100%; }
          to { width: 0%; }
        }
      `}</style>
    </div>
  );
};

export default Toast;
