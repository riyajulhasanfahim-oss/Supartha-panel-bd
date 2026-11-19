import React, { useState } from 'react';
import { ArrowLeft, ArrowRight, CheckCircle2, Mail, AlertCircle } from 'lucide-react';
import {
  resolveBrandLogoUrl,
  resolveBrandName,
} from '../config/app.config';
import { useApp } from '../context/AppContext';
import { BrandLogo } from '../components/common/BrandLogo';

export function ForgotPasswordPage() {
  const { setViewMode, goToHome, sendPasswordReset, systemSettings } = useApp();
  const brandName = resolveBrandName(systemSettings?.websiteName);
  const logoUrl = resolveBrandLogoUrl(systemSettings?.logo);
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!email.trim().includes('@')) {
      setErrorMessage('Please enter a valid email address.');
      return;
    }

    setSubmitting(true);
    try {
      const result = await sendPasswordReset(email);
      if (result.success) {
        setSentTo(email.trim());
      } else {
        setErrorMessage(result.error ?? 'Could not send reset email.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#F6F5FB] text-slate-900">
      <header className="border-b border-violet-100/80 bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4 sm:px-6">
          <BrandLogo showTagline size="sm" onClick={goToHome} />
          <button
            type="button"
            onClick={() => setViewMode('login')}
            className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            <span>Back to Login</span>
          </button>
        </div>
      </header>

      <main className="flex flex-1 items-center justify-center px-4 py-8 sm:py-12">
        <div className="w-full max-w-md rounded-3xl border border-violet-100 bg-white p-6 sm:p-8 shadow-xl shadow-violet-950/5">
          {sentTo ? (
            <div className="text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
                <CheckCircle2 className="h-6 w-6" aria-hidden="true" />
              </div>
              <h1 className="mt-4 font-display text-2xl font-extrabold text-slate-950">
                Reset Link Sent
              </h1>
              <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                If an account exists for <span className="font-semibold text-slate-900">{sentTo}</span>, a
                password reset email is on its way. Check your inbox and spam folder.
              </p>
              <button
                type="button"
                onClick={() => setViewMode('login')}
                className="mt-6 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-violet-700 px-5 text-sm font-bold text-white hover:bg-violet-800"
              >
                <span>Return to Sign In</span>
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3.5">
                <img
                  src={logoUrl}
                  alt={brandName}
                  className="h-12 w-12 shrink-0 rounded-full object-cover bg-slate-950 ring-1 ring-sky-400/50 shadow-sm shadow-sky-500/20"
                />
                <div>
                  <h1 className="font-display text-2xl font-extrabold tracking-tight text-slate-950">
                    Reset Password
                  </h1>
                  <p className="mt-1 text-sm text-slate-600">
                    Enter your account email and we will send a password reset link.
                  </p>
                </div>
              </div>

              {errorMessage && (
                <div
                  role="alert"
                  className="mt-5 flex items-start gap-2.5 rounded-2xl border border-rose-200 bg-rose-50 p-3.5 text-xs font-medium text-rose-800"
                >
                  <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" aria-hidden="true" />
                  <span>{errorMessage}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="mt-5 space-y-4">
                <div>
                  <label htmlFor="reset-email" className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input
                      id="reset-email"
                      type="email"
                      autoComplete="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-4 text-sm text-slate-900 placeholder:text-slate-400 focus:border-violet-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-violet-500/20"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-700 to-purple-600 px-5 text-sm font-bold text-white shadow-md shadow-violet-700/25 transition-colors hover:from-violet-800 hover:to-purple-700 disabled:opacity-60"
                >
                  <span>{submitting ? 'Sending Reset Link...' : 'Send Reset Link'}</span>
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </button>
              </form>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
