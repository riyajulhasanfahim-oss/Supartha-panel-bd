import React from 'react';
import { ArrowRight, HeadphonesIcon, MessageCircle, ShieldCheck } from 'lucide-react';
import { APP_CONFIG } from '../../config/app.config';
import { useApp } from '../../context/AppContext';

export function SupportBanner() {
  const { navigateProtected, systemSettings } = useApp();
  const supportEmail = systemSettings?.supportEmail?.trim() || APP_CONFIG.supportEmail;
  const whatsappRaw = systemSettings?.supportWhatsapp?.trim() || '';
  const whatsappHref = whatsappRaw
    ? whatsappRaw.startsWith('http')
      ? whatsappRaw
      : `https://wa.me/${whatsappRaw.replace(/[^0-9]/g, '')}`
    : '';

  return (
    <section aria-label="Customer support and security" className="grid grid-cols-1 gap-3 sm:grid-cols-12">
      <div className="sm:col-span-8 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-violet-100 bg-violet-50/75 p-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white text-violet-700 shadow-xs">
            <HeadphonesIcon className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h3 className="font-display text-sm sm:text-base font-bold text-slate-900">Need Help?</h3>
            <p className="text-xs text-slate-600 truncate">
              Our Support Team is always here · {supportEmail}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {whatsappHref && (
            <a
              href={whatsappHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-10 items-center gap-1.5 rounded-full border border-emerald-200 bg-white px-3.5 text-xs font-bold text-emerald-700 hover:bg-emerald-50 whitespace-nowrap"
            >
              <MessageCircle className="h-3.5 w-3.5" aria-hidden="true" />
              <span>WhatsApp</span>
            </a>
          )}
          <button
            type="button"
            onClick={() => navigateProtected('support')}
            className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full bg-violet-700 px-4 text-xs font-bold text-white shadow-xs transition-colors hover:bg-violet-800 whitespace-nowrap"
          >
            <span>Open Ticket</span>
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="sm:col-span-4 flex items-center gap-3 rounded-2xl border border-emerald-200/80 bg-emerald-50/80 p-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500 text-white shadow-xs">
          <ShieldCheck className="h-5 w-5" aria-hidden="true" />
        </div>
        <div>
          <p className="text-xs sm:text-sm font-bold text-emerald-950 leading-tight">
            100% Secure &amp; Trusted
          </p>
          <p className="mt-0.5 text-[11px] text-emerald-800">Encrypted account safety</p>
        </div>
      </div>
    </section>
  );
}
