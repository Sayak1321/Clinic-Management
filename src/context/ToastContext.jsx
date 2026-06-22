import { createContext, useContext, useState, useCallback } from 'react';

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((message, type = 'success') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts(prev => [...prev, { id, message, type }]);

    if (type !== 'error') {
      setTimeout(() => {
        removeToast(id);
      }, 3500);
    }
  }, []);

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ addToast, removeToast }}>
      {children}
      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside ToastProvider');
  return ctx;
}

function ToastContainer({ toasts, removeToast }) {
  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      {toasts.map(t => (
        <div
          key={t.id}
          className={[
            'p-3 rounded-lg shadow-lg border text-sm pointer-events-auto flex justify-between items-start transition-all duration-300 transform translate-y-0 opacity-100',
            t.type === 'error'
              ? 'bg-red-50 border-red-200 text-red-800'
              : t.type === 'info'
              ? 'bg-blue-50 border-blue-200 text-blue-800'
              : 'bg-green-50 border-green-200 text-green-800',
          ].join(' ')}
          style={{ animation: 'slideIn 0.2s ease-out' }}
        >
          <div className="flex-1 font-medium">{t.message}</div>
          <button
            onClick={() => removeToast(t.id)}
            className="ml-3 text-slate-400 hover:text-slate-600 focus:outline-none font-bold text-lg leading-none"
          >
            &times;
          </button>
        </div>
      ))}
    </div>
  );
}
