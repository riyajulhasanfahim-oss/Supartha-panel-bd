import React, { useEffect } from 'react';
import { Lock } from 'lucide-react';

export function StartupPaymentNoticeModal() {
  useEffect(() => {
    const previousHtmlOverflow = document.documentElement.style.overflow;
    const previousBodyOverflow = document.body.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';

    return () => {
      document.documentElement.style.overflow = previousHtmlOverflow;
      document.body.style.overflow = previousBodyOverflow;
    };
  }, []);

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="startup-payment-notice-title"
      className="fixed inset-0 z-[9999] flex min-h-dvh w-full select-none items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm sm:p-6"
    >
      <div className="w-full max-w-xl max-h-[90dvh] overflow-y-auto rounded-3xl border-2 border-rose-200 bg-white p-7 shadow-2xl shadow-slate-950/50 sm:p-10">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-100 text-rose-600 ring-4 ring-rose-50 sm:h-20 sm:w-20">
          <Lock className="h-8 w-8 sm:h-10 sm:w-10" aria-hidden="true" />
        </div>

        <div className="mt-6 text-center">
          <h1
            id="startup-payment-notice-title"
            className="text-2xl font-extrabold tracking-tight text-slate-950 leading-snug sm:text-3xl"
          >
            ওয়েবসাইট সাময়িকভাবে বন্ধ করা হলো
          </h1>

          <div className="mt-5 rounded-2xl border border-rose-200/80 bg-rose-50/80 p-5 sm:p-6">
            <p className="text-base font-bold text-slate-900 leading-relaxed sm:text-xl">
              আপনি ওয়েবসাইটের পেমেন্ট করেননি, তাই আপনার ওয়েবসাইট সাময়িকভাবে বন্ধ করা হলো।
            </p>
            <p className="mt-3 text-base font-extrabold text-rose-700 leading-relaxed sm:text-xl">
              পেমেন্ট করলে আবার ওয়েবসাইট চালু হবে।
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
