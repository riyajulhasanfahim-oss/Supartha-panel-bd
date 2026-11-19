import React, { useState } from 'react';
import { ArrowLeft, ArrowRight, Eye, EyeOff, Lock, Mail, AlertCircle } from 'lucide-react';
import {
  resolveBrandLogoUrl,
  resolveBrandName,
} from '../config/app.config';
import { useApp } from '../context/AppContext';
import { BrandLogo } from '../components/common/BrandLogo';

export function LoginPage() {
  const { setViewMode, goToHome, loginWithEmail, loginWithGoogle, systemSettings } = useApp();
  const brandName = resolveBrandName(systemSettings?.websiteName);
  const logoUrl = resolveBrandLogoUrl(systemSettings?.logo);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [googleSubmitting, setGoogleSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!email.trim() || !password) {
      setErrorMessage('Please enter both your email address and password.');
      return;
    }

    setSubmitting(true);
    try {
      const result = await loginWithEmail({ email, password, rememberMe });
      if (!result.success) {
        setErrorMessage(result.error ?? 'Unable to sign in. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleLogin = async () => {
    setErrorMessage(null);
    setGoogleSubmitting(true);
    try {
      const result = await loginWithGoogle();
      if (!result.success) {
        setErrorMessage(result.error ?? 'Google sign-in could not be completed.');
      }
    } finally {
      setGoogleSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#F6F5FB] text-slate-900">
      <header className="border-b border-violet-100/80 bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4 sm:px-6">
          <BrandLogo showTagline size="sm" onClick={goToHome} />
          <button
            type="button"
            onClick={goToHome}
            className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            <span>Back to Home</span>
          </button>
        </div>
      </header>

      <main className="flex flex-1 items-center justify-center px-4 py-8 sm:py-12">
        <div className="w-full max-w-md rounded-3xl border border-violet-100 bg-white p-6 sm:p-8 shadow-xl shadow-violet-950/5">
          <div className="flex items-center gap-3.5">
            <img
              src={logoUrl}
              alt={brandName}
              className="h-12 w-12 shrink-0 rounded-full object-cover bg-slate-950 ring-1 ring-sky-400/50 shadow-sm shadow-sky-500/20"
            />
            <div>
              <h1 className="font-display text-2xl font-extrabold tracking-tight text-slate-950">
                Sign In to {brandName}
              </h1>
              <p className="mt-1 text-sm text-slate-600">
                Access your orders, balance, and customer growth workspace.
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
              <label htmlFor="login-email" className="block text-xs font-semibold text-slate-700 mb-1.5">
                Email Address
              </label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  id="login-email"
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

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="login-password" className="block text-xs font-semibold text-slate-700">
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => setViewMode('forgot-password')}
                  className="text-xs font-semibold text-violet-700 hover:underline"
                >
                  Forgot Password?
                </button>
              </div>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-11 text-sm text-slate-900 placeholder:text-slate-400 focus:border-violet-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-violet-500/20"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-2 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between pt-0.5">
              <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-violet-700 focus:ring-violet-600"
                />
                <span>Stay signed in</span>
              </label>
            </div>

            <button
              type="submit"
              disabled={submitting || googleSubmitting}
              className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-700 to-purple-600 px-5 text-sm font-bold text-white shadow-md shadow-violet-700/25 transition-colors hover:from-violet-800 hover:to-purple-700 disabled:opacity-60"
            >
              <span>{submitting ? 'Signing In...' : 'Sign In'}</span>
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </form>

          <div className="my-5 flex items-center gap-3">
            <span className="h-px flex-1 bg-slate-200" />
            <span className="text-[11px] font-medium text-slate-400">or continue with</span>
            <span className="h-px flex-1 bg-slate-200" />
          </div>

          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={submitting || googleSubmitting}
            className="inline-flex h-11 w-full items-center justify-center gap-2.5 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-800 transition-colors hover:bg-slate-50 disabled:opacity-60"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
              <path
                fill="#EA4335"
                d="M12 10.2v3.9h5.4c-.2 1.3-1.5 3.8-5.4 3.8-3.3 0-6-2.7-6-6s2.7-6 6-6c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.8 3.4 14.6 2.5 12 2.5 6.8 2.5 2.5 6.8 2.5 12s4.3 9.5 9.5 9.5c5.5 0 9.1-3.9 9.1-9.3 0-.6-.1-1.1-.2-1.6H12Z"
              />
            </svg>
            <span>{googleSubmitting ? 'Connecting...' : 'Continue with Google'}</span>
          </button>

          <p className="mt-6 text-center text-xs text-slate-600">
            Don&apos;t have an account yet?{' '}
            <button
              type="button"
              onClick={() => setViewMode('register')}
              className="font-bold text-violet-700 hover:underline"
            >
              Create Account
            </button>
          </p>
        </div>
      </main>
    </div>
  );
}
