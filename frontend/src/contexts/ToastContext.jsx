import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { Check, X, AlertCircle, Info } from 'lucide-react';

const ToastContext = createContext(null);

let toastId = 0;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timersRef = useRef({});

  const removeToast = useCallback((id) => {
    clearTimeout(timersRef.current[id]);
    delete timersRef.current[id];
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback((message, type = 'info', duration = 4000) => {
    const id = ++toastId;
    setToasts((prev) => [...prev.slice(-4), { id, message, type }]);
    if (duration > 0) {
      timersRef.current[id] = setTimeout(() => removeToast(id), duration);
    }
    return id;
  }, [removeToast]);

  const toast = useCallback({
    success: (msg, dur) => addToast(msg, 'success', dur),
    error: (msg, dur) => addToast(msg, 'error', dur ?? 6000),
    warning: (msg, dur) => addToast(msg, 'warning', dur),
    info: (msg, dur) => addToast(msg, 'info', dur),
  }, [addToast]);

  // Fix: useCallback can't return an object, use useMemo-like pattern
  const toastMethods = {
    success: (msg, dur) => addToast(msg, 'success', dur),
    error: (msg, dur) => addToast(msg, 'error', dur ?? 6000),
    warning: (msg, dur) => addToast(msg, 'warning', dur),
    info: (msg, dur) => addToast(msg, 'info', dur),
  };

  const icons = {
    success: <Check size={20} className="shrink-0" />,
    error: <X size={20} className="shrink-0" />,
    warning: <AlertCircle size={20} className="shrink-0" />,
    info: <Info size={20} className="shrink-0" />,
  };

  const toastClass = {
    success: 'toast-success',
    error: 'toast-error',
    warning: 'toast-warning',
    info: 'toast-info',
  };

  return (
    <ToastContext.Provider value={toastMethods}>
      {children}
      <div className="toast-container">
        {toasts.map((t) => (
          <div key={t.id} className={toastClass[t.type] || 'toast-info'}>
            {icons[t.type]}
            <span className="text-sm font-medium flex-1">{t.message}</span>
            <button
              onClick={() => removeToast(t.id)}
              className="text-current opacity-50 hover:opacity-100 transition-opacity shrink-0"
            >
              <X size={16} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
