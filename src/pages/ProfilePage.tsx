import React, { useEffect, useState } from 'react';
import {
  User,
  Mail,
  Phone,
  Globe,
  ShieldCheck,
  Save,
  Camera,
  CheckCircle2,
  AlertTriangle,
  Ban,
  LogOut,
} from 'lucide-react';
import { APP_CONFIG } from '../config/app.config';
import { useApp } from '../context/AppContext';

export function ProfilePage() {
  const { profile, accountStatus, orderStats, wallet, goToHome, updateUserProfile, logoutUser } =
    useApp();

  const [name, setName] = useState(profile?.fullName ?? '');
  const [phone, setPhone] = useState(profile?.phone ?? '');
  const [photoUrl, setPhotoUrl] = useState(profile?.photoUrl ?? '');
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (profile) {
      setName(profile.fullName);
      setPhone(profile.phone);
      setPhotoUrl(profile.photoUrl ?? '');
    }
  }, [profile]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    if (name.trim().length < 2) {
      setFeedback({ tone: 'error', text: 'Name must be at least 2 characters.' });
      return;
    }

    setSaving(true);
    try {
      const res = await updateUserProfile({ name, phone, photoUrl });
      if (res.success) {
        setFeedback({ tone: 'success', text: 'Profile updated successfully.' });
      } else {
        setFeedback({ tone: 'error', text: res.error ?? 'Could not update profile.' });
      }
    } finally {
      setSaving(false);
    }
  };

  const statusDisplay = () => {
    switch (accountStatus) {
      case 'suspended':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
            Suspended
          </span>
        );
      case 'blocked':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-800">
            <Ban className="h-3.5 w-3.5 text-rose-600" />
            Blocked
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
            Active
          </span>
        );
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-xl sm:text-2xl font-extrabold text-slate-950">
            Customer Profile
          </h1>
          <p className="mt-0.5 text-xs sm:text-sm text-slate-500">
            Manage your personal contact information and inspect your account summary.
          </p>
        </div>

        <button
          type="button"
          onClick={logoutUser}
          className="inline-flex h-10 items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 text-xs font-bold text-rose-700 hover:bg-rose-100 whitespace-nowrap"
        >
          <LogOut className="h-4 w-4" aria-hidden="true" />
          <span>Sign Out</span>
        </button>
      </div>

      {/* Identity Overview Card */}
      <div className="rounded-3xl border border-violet-100 bg-white p-5 sm:p-6 shadow-xs">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            {profile?.photoUrl ? (
              <img
                src={profile.photoUrl}
                alt={profile.fullName}
                referrerPolicy="no-referrer"
                className="h-16 w-16 shrink-0 rounded-2xl object-cover border border-violet-100 shadow-sm"
              />
            ) : (
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-700 to-indigo-600 font-display text-xl font-extrabold text-white shadow-md shadow-violet-700/20">
                {profile?.avatarInitials ?? 'US'}
              </div>
            )}
            <div>
              <div className="flex flex-wrap items-center gap-2.5">
                <h2 className="font-display text-lg sm:text-xl font-bold text-slate-900">
                  {profile?.fullName ?? 'Member'}
                </h2>
                {statusDisplay()}
              </div>
              <p className="mt-0.5 text-xs sm:text-sm text-slate-500">
                @{profile?.username ?? 'member'} · {profile?.tierLabel ?? 'Customer'} · Member since{' '}
                {profile?.joinedDate ?? 'Recent'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={goToHome}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-violet-200 bg-violet-50 px-4 text-xs font-bold text-violet-800 hover:bg-violet-100 whitespace-nowrap"
          >
            <Globe className="h-4 w-4" aria-hidden="true" />
            <span>Home Page</span>
          </button>
        </div>

        <div className="mt-6 grid gap-4 border-t border-slate-100 pt-5 sm:grid-cols-3">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
              <Mail className="h-4 w-4" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="text-[11px] font-medium text-slate-500">Email</p>
              <p className="text-sm font-semibold text-slate-900 truncate">{profile?.email}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
              <Phone className="h-4 w-4" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="text-[11px] font-medium text-slate-500">Phone</p>
              <p className="text-sm font-semibold text-slate-900 truncate">
                {profile?.phone || 'Not provided'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-700">
              <User className="h-4 w-4" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="text-[11px] font-medium text-slate-500">Account Balance</p>
              <p className="text-sm font-bold text-slate-900 tabular-nums">
                {APP_CONFIG.currencySymbol}
                {wallet.balance.toLocaleString()} ({orderStats.totalOrders} orders)
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Editable Profile Form (Strictly Name, Phone, Photo URL) */}
      <form
        onSubmit={handleSaveProfile}
        className="rounded-3xl border border-violet-100 bg-white p-5 sm:p-6 shadow-xs space-y-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3.5">
          <div>
            <h3 className="font-display text-base sm:text-lg font-bold text-slate-900">
              Update Personal Details
            </h3>
            <p className="text-xs text-slate-500">
              Only name, phone number, and profile photo can be edited here. Role, status, and balance are server-protected.
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
            <ShieldCheck className="h-4 w-4 text-emerald-600" aria-hidden="true" />
            Security Enforced
          </span>
        </div>

        {feedback && (
          <div
            role="status"
            className={`rounded-xl border px-3.5 py-2.5 text-xs font-semibold ${
              feedback.tone === 'success'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                : 'border-rose-200 bg-rose-50 text-rose-800'
            }`}
          >
            {feedback.text}
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="prof-name" className="block text-xs font-semibold text-slate-700 mb-1.5">
              Full Name
            </label>
            <input
              id="prof-name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-sm text-slate-900 focus:border-violet-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-violet-500/20"
            />
          </div>

          <div>
            <label htmlFor="prof-phone" className="block text-xs font-semibold text-slate-700 mb-1.5">
              Phone Number
            </label>
            <input
              id="prof-phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+880 1712-000000"
              className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-sm text-slate-900 focus:border-violet-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-violet-500/20"
            />
          </div>

          <div className="sm:col-span-2">
            <label htmlFor="prof-photo" className="block text-xs font-semibold text-slate-700 mb-1.5">
              Profile Photo URL (Optional)
            </label>
            <div className="relative">
              <Camera className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                id="prof-photo"
                type="url"
                value={photoUrl}
                onChange={(e) => setPhotoUrl(e.target.value)}
                placeholder="https://example.com/avatar.jpg"
                className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-4 text-sm text-slate-900 placeholder:text-slate-400 focus:border-violet-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-violet-500/20"
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-1">
          <button
            type="submit"
            disabled={saving || accountStatus !== 'active'}
            className="inline-flex h-11 items-center gap-2 rounded-xl bg-violet-700 px-5 text-sm font-bold text-white shadow-sm hover:bg-violet-800 disabled:opacity-60"
          >
            <Save className="h-4 w-4" aria-hidden="true" />
            <span>{saving ? 'Saving Changes...' : 'Save Profile'}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
