import React from 'react';

interface StatCardProps {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  tone: 'indigo' | 'emerald' | 'amber' | 'violet';
  onClick?: () => void;
}

const TONE_CLASSES: Record<StatCardProps['tone'], { card: string; iconBg: string; value: string }> = {
  indigo: {
    card: 'bg-[#EEF2FF] border-indigo-100/90',
    iconBg: 'bg-indigo-600 text-white',
    value: 'text-slate-900',
  },
  emerald: {
    card: 'bg-[#ECFDF5] border-emerald-100/90',
    iconBg: 'bg-emerald-500 text-white',
    value: 'text-slate-900',
  },
  amber: {
    card: 'bg-[#FFF7ED] border-amber-100/90',
    iconBg: 'bg-amber-500 text-white',
    value: 'text-amber-900',
  },
  violet: {
    card: 'bg-[#F5F3FF] border-violet-100/90',
    iconBg: 'bg-violet-600 text-white',
    value: 'text-violet-950',
  },
};

export function StatCard({ label, value, icon, tone, onClick }: StatCardProps) {
  const styles = TONE_CLASSES[tone];
  const baseClass = `${styles.card} flex flex-col items-center justify-center rounded-xl border px-2 py-2 sm:px-3 sm:py-2.5 text-center shadow-2xs transition-all duration-200`;

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`${baseClass} hover:-translate-y-0.5 hover:shadow-sm active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-600`}
      >
        <div className={`${styles.iconBg} mb-1 flex h-7 w-7 items-center justify-center rounded-full shadow-xs`}>
          {icon}
        </div>
        <span className="max-w-full truncate text-[10.5px] sm:text-[11px] font-medium text-slate-600 leading-tight">{label}</span>
        <span className={`${styles.value} mt-0.5 font-display text-base sm:text-lg font-bold tabular-nums leading-tight`}>
          {value}
        </span>
      </button>
    );
  }

  return (
    <div className={baseClass}>
      <div className={`${styles.iconBg} mb-1 flex h-7 w-7 items-center justify-center rounded-full shadow-xs`}>
        {icon}
      </div>
      <span className="max-w-full truncate text-[10.5px] sm:text-[11px] font-medium text-slate-600 leading-tight">{label}</span>
      <span className={`${styles.value} mt-0.5 font-display text-base sm:text-lg font-bold tabular-nums leading-tight`}>
        {value}
      </span>
    </div>
  );
}
