import React, { useEffect, useState } from 'react';
import { LogOut, Save, ShieldCheck, UserCog } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { getAdminRoleLabel } from '../../lib/permissions';

export function AdminProfileView() {
  const { profile, firebaseUser, staffRole, updateUserProfile, setViewMode, signOutAdmin } = useApp();
  const [name, setName] = useState(profile?.fullName ?? firebaseUser?.displayName ?? 'Administrator');
  const [phone, setPhone] = useState(profile?.phone ?? '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (profile) {
      setName(profile.fullName);
      setPhone(profile.phone);
    }
  }, [profile]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await updateUserProfile({ name, phone, photoUrl: profile?.photoUrl ?? '' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-xl sm:text-2xl font-extrabold text-slate-950">
          Admin Profile
        </h1>
        <p className="text-xs sm:text-sm text-slate-500">
          Manage your verified administrator profile and session shortcuts.
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-12">
        <div className="lg:col-span-5 rounded-3xl border border-violet-100 bg-white p-5 sm:p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-700 to-purple-600 text-lg font-extrabold text-white">
              {profile?.avatarInitials ?? 'AD'}
            </div>
            <div className="min-w-0">
              <h2 className="font-display text-lg font-bold text-slate-900 truncate">
                {profile?.fullName ?? firebaseUser?.displayName ?? 'Panel Admin'}
              </h2>
              <p className="truncate text-xs text-slate-500">{firebaseUser?.email}</p>
            </div>
          </div>

          <div className="rounded-2xl bg-emerald-50/80 border border-emerald-200 p-3.5 text-xs text-emerald-900 flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-700" />
            <span>
              Role: <strong className="uppercase">{getAdminRoleLabel(staffRole)}</strong> · Email Verified:{' '}
              <strong>{firebaseUser?.emailVerified ? 'Yes' : 'No'}</strong>
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-2">
            <button
              type="button"
              onClick={() => setViewMode('dashboard')}
              className="h-10 rounded-xl border border-violet-200 bg-violet-50 text-xs font-bold text-violet-800 hover:bg-violet-100"
            >
              Customer Panel
            </button>
            <button
              type="button"
              onClick={signOutAdmin}
              className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 text-xs font-bold text-rose-700 hover:bg-rose-100"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>

        <form
          onSubmit={handleSave}
          className="lg:col-span-7 rounded-3xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-xs space-y-4"
        >
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <UserCog className="h-5 w-5 text-violet-700" />
            <h2 className="font-display text-base font-bold text-slate-900">Edit Admin Details</h2>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Email Address</label>
            <input
              type="email"
              disabled
              value={firebaseUser?.email ?? ''}
              className="h-10 w-full rounded-xl border border-slate-200 bg-slate-100 px-3 text-sm text-slate-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Phone Number</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+880 1XXX-XXXXXX"
              className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm"
            />
          </div>

          <button
            type="submit"
            disabled={saving}
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-violet-700 px-5 text-xs font-bold text-white hover:bg-violet-800 disabled:opacity-60"
          >
            <Save className="h-4 w-4" />
            <span>{saving ? 'Saving...' : 'Update Admin Profile'}</span>
          </button>
        </form>
      </div>
    </div>
  );
}
