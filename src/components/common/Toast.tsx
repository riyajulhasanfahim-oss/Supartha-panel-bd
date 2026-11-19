import React from 'react';
import { CheckCircle2, AlertTriangle, XCircle, Info, X } from 'lucide-react';
import { useApp } from '../../context/AppContext';

export function Toast() {
  const { toast, dismissToast } = useApp();
  if (!toast) return null;

  const toneMap = {
    success: {
      wrap: 'border-emerald-200 bg-white text-slate-900',
      icon: <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />,
    },
    warning: {
      wrap: 'border-amber-200 bg-white text-slate-900',
      icon: <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />,
    },
    error: {
      wrap: 'border-rose-200 bg-white text-slate-900',
      icon: <XCircle className="h-5 w-5 text-rose-600 shrink-0" />,
    },
    info: {
      wrap: 'border-violet-200 bg-white text-slate-900',
      icon: <Info className="h-5 w-5 text-violet-600 shrink-0" />,
    },
  };

  const current = toneMap[toast.tone];

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed top-4 right-4 left-4 sm:left-auto sm:w-96 z-50 pointer-events-none flex justify-end"
    >
      <div
        className={`${current.wrap} pointer-events-auto flex w-full items-start gap-3 rounded-2xl border p-4 shadow-xl shadow-slate-900/10`}
      >
        {current.icon}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-900">{toast.title}</p>
          {toast.description && <p className="mt-0.5 text-xs text-slate-600">{toast.description}</p>}
        </div>
        <button
          type="button"
          onClick={dismissToast}
          aria-label="Dismiss notification"
          className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
