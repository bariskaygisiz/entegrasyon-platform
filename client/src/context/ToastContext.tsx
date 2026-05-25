import React, { createContext, useCallback, useContext, useState } from 'react';
import type { Toast, ToastType } from '../types';

interface ToastContextValue {
  showToast: (title: string, msg?: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue>({ showToast: () => {} });

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((title: string, msg?: string, type: ToastType = 'info') => {
    const id = 'toast-' + Date.now() + Math.random();
    setToasts(prev => [...prev, { id, title, msg, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  }, []);

  const icons: Record<ToastType, string> = { success: '✓', warning: '⚠', error: '✕', info: 'ℹ' };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="toast-container">
        {toasts.map(t => (
          <div key={t.id} className={`toast ${t.type}`}>
            <div className="toast-icon">{icons[t.type]}</div>
            <div className="toast-content">
              <div className="toast-title">{t.title}</div>
              {t.msg && <div className="toast-msg">{t.msg}</div>}
            </div>
            <button
              onClick={() => setToasts(prev => prev.filter(x => x.id !== t.id))}
              style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 16, cursor: 'pointer', marginLeft: 8, lineHeight: 1, padding: '2px' }}
            >×</button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
