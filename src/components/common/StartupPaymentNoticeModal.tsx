import React, { useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';

export function StartupPaymentNoticeModal() {
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="startup-payment-notice-title"
      className="fixed inset-0 z-[100] flex min-h-dvh w-full items-center justify-center bg-slate-950/90 p-4 backdrop-blur-md sm:p-6"
    >
      <div className="w-full max-w-lg max-h-[90dvh] overflow-y-auto rounded-3xl border border-rose-200 bg-white p-6 shadow-2xl shadow-slate-950/40 sm:p-8">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-50 text-rose-600 ring-1 ring-rose-100 sm:h-20 sm:w-20">
          <AlertTriangle className="h-9 w-9 sm:h-10 sm:w-10" aria-hidden="true" />
        </div>

        <div className="mt-5 text-center sm:mt-6">
          <h1
            id="startup-payment-notice-title"
            className="text-xl font-extrabold tracking-tight text-slate-950 leading-snug sm:text-2xl"
          >
            ওয়েবসাইট সাময়িকভাবে বন্ধ করা হয়েছে
          </h1>

          <div className="mt-4 rounded-2xl border border-rose-100 bg-rose-50/70 p-4 sm:p-5">
            <p className="text-base font-semibold text-slate-800 leading-relaxed sm:text-lg">
              আপনি ওয়েবসাইটের পেমেন্ট করেননি, তাই আপনার ওয়েবসাইট সাময়িকভাবে বন্ধ করা হলো।
            </p>
            <p className="mt-3 text-base font-bold text-rose-700 leading-relaxed sm:text-lg">
              পরবর্তীতে পেমেন্ট করার সাথে সাথে আপনার ওয়েবসাইট আবার চালু হবে।
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
