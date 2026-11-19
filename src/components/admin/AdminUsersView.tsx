import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshCw, Search, Shield, Wallet, X } from 'lucide-react';
import { APP_CONFIG } from '../../config/app.config';
import { useApp } from '../../context/AppContext';
import type { UserAccountRole, UserAccountStatus } from '../../lib/firestore/collections';
import {
  userManagementService,
  type ManagedUserRecord,
} from '../../services/userManagement.service';

export function AdminUsersView() {
  const { firebaseUser, showToast } = useApp();
  const [users, setUsers] = useState<ManagedUserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | UserAccountStatus>('all');
  const [roleFilter, setRoleFilter] = useState<'all' | UserAccountRole>('all');
  const [busyUid, setBusyUid] = useState<string | null>(null);

  // Balance adjustment modal state
  const [adjustTarget, setAdjustTarget] = useState<ManagedUserRecord | null>(null);
  const [adjustMode, setAdjustMode] = useState<'add' | 'deduct'>('add');
  const [adjustAmount, setAdjustAmount] = useState('');
  const [adjustReason, setAdjustReason] = useState('');
  const [submittingBalance, setSubmittingBalance] = useState(false);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const list = await userManagementService.listAllUsers();
      setUsers(list);
    } catch (err) {
      showToast({
        title: 'Failed to Load Users',
        description: err instanceof Error ? err.message : 'Check admin permissions.',
        tone: 'error',
      });
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users.filter((u) => {
      if (statusFilter !== 'all' && u.status !== statusFilter) return false;
      if (roleFilter !== 'all' && u.role !== roleFilter) return false;
      if (!q) return true;
      return (
        u.uid.toLowerCase().includes(q) ||
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.phone.toLowerCase().includes(q)
      );
    });
  }, [users, search, statusFilter, roleFilter]);

  const handleStatusChange = async (user: ManagedUserRecord, nextStatus: UserAccountStatus) => {
    setBusyUid(user.uid);
    try {
      await userManagementService.updateUserStatus(user.uid, nextStatus);
      setUsers((prev) =>
        prev.map((u) => (u.uid === user.uid ? { ...u, status: nextStatus } : u))
      );
      showToast({
        title: 'Status Updated',
        description: `${user.name} is now ${nextStatus}.`,
        tone: 'success',
      });
    } catch (err) {
      showToast({
        title: 'Status Update Failed',
        description: err instanceof Error ? err.message : 'Unable to update status.',
        tone: 'error',
      });
    } finally {
      setBusyUid(null);
    }
  };

  const handleRoleChange = async (user: ManagedUserRecord, nextRole: UserAccountRole) => {
    if (user.uid === firebaseUser?.uid && nextRole !== 'admin') {
      showToast({
        title: 'Protected Action',
        description: 'You cannot demote your own currently active admin session.',
        tone: 'warning',
      });
      return;
    }

    setBusyUid(user.uid);
    try {
      await userManagementService.updateUserRole(user.uid, nextRole, user.email);
      setUsers((prev) =>
        prev.map((u) => (u.uid === user.uid ? { ...u, role: nextRole } : u))
      );
      showToast({
        title: 'Role Updated',
        description: `${user.name} role changed to ${nextRole}.`,
        tone: 'success',
      });
    } catch (err) {
      showToast({
        title: 'Role Update Failed',
        description: err instanceof Error ? err.message : 'Only verified admins can change roles.',
        tone: 'error',
      });
    } finally {
      setBusyUid(null);
    }
  };

  const handleBalanceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustTarget || !firebaseUser) return;

    const parsedAmount = Number(adjustAmount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      showToast({
        title: 'Invalid Amount',
        description: 'Enter a valid amount greater than 0.',
        tone: 'warning',
      });
      return;
    }

    setSubmittingBalance(true);
    try {
      const res = await userManagementService.adjustUserBalance({
        uid: adjustTarget.uid,
        amount: parsedAmount,
        mode: adjustMode,
        reason: adjustReason,
        adminId: firebaseUser.uid,
      });

      setUsers((prev) =>
        prev.map((u) =>
          u.uid === adjustTarget.uid ? { ...u, balance: res.balanceAfter } : u
        )
      );
      showToast({
        title: 'Balance Adjusted',
        description: `${adjustTarget.name}: ${APP_CONFIG.currencySymbol}${res.balanceBefore.toFixed(
          2
        )} -> ${APP_CONFIG.currencySymbol}${res.balanceAfter.toFixed(2)}`,
        tone: 'success',
      });
      setAdjustTarget(null);
      setAdjustAmount('');
      setAdjustReason('');
    } catch (err) {
      showToast({
        title: 'Adjustment Failed',
        description: err instanceof Error ? err.message : 'Could not update balance.',
        tone: 'error',
      });
    } finally {
      setSubmittingBalance(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-xl sm:text-2xl font-extrabold text-slate-950">
            User Management
          </h1>
          <p className="text-xs sm:text-sm text-slate-500">
            Manage customer accounts, roles, account status, and audited wallet balance adjustments.
          </p>
        </div>
        <button
          type="button"
          onClick={loadUsers}
          disabled={loading}
          className="inline-flex h-10 items-center gap-2 rounded-xl border border-violet-200 bg-white px-4 text-xs font-bold text-violet-800 hover:bg-violet-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Filters */}
      <div className="grid gap-3 rounded-2xl border border-slate-200/80 bg-white p-4 sm:grid-cols-12">
        <div className="relative sm:col-span-6">
          <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by User ID, Name, Email, or Phone..."
            className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-xs sm:text-sm focus:border-violet-500 focus:bg-white focus:outline-none"
          />
        </div>
        <div className="sm:col-span-3">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as 'all' | UserAccountStatus)}
            className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs sm:text-sm font-medium focus:border-violet-500 focus:bg-white focus:outline-none"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
            <option value="blocked">Blocked</option>
          </select>
        </div>
        <div className="sm:col-span-3">
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value as 'all' | UserAccountRole)}
            className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs sm:text-sm font-medium focus:border-violet-500 focus:bg-white focus:outline-none"
          >
            <option value="all">All Roles</option>
            <option value="user">User</option>
            <option value="admin">Admin</option>
          </select>
        </div>
      </div>

      {/* Desktop Table */}
      <div className="hidden lg:block overflow-x-auto rounded-3xl border border-slate-200/80 bg-white shadow-xs">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-slate-100 bg-slate-50/80 text-slate-500 font-semibold">
            <tr>
              <th className="px-4 py-3.5">User</th>
              <th className="px-4 py-3.5">Phone</th>
              <th className="px-4 py-3.5">Balance</th>
              <th className="px-4 py-3.5">Role</th>
              <th className="px-4 py-3.5">Status</th>
              <th className="px-4 py-3.5">Created</th>
              <th className="px-4 py-3.5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.map((user) => (
              <tr key={user.uid} className="hover:bg-violet-50/30">
                <td className="px-4 py-3.5">
                  <p className="font-bold text-slate-900">{user.name}</p>
                  <p className="text-[11px] text-slate-500">{user.email}</p>
                  <p className="font-mono text-[10px] text-slate-400">ID: {user.uid}</p>
                </td>
                <td className="px-4 py-3.5 text-slate-600">{user.phone}</td>
                <td className="px-4 py-3.5 font-bold text-slate-900 tabular-nums">
                  {APP_CONFIG.currencySymbol}
                  {user.balance.toFixed(2)}
                </td>
                <td className="px-4 py-3.5">
                  <select
                    aria-label={`Role for ${user.name}`}
                    value={user.role}
                    disabled={busyUid === user.uid}
                    onChange={(e) => handleRoleChange(user, e.target.value as UserAccountRole)}
                    className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-700"
                  >
                    <option value="user">user</option>
                    <option value="admin">admin</option>
                  </select>
                </td>
                <td className="px-4 py-3.5">
                  <select
                    aria-label={`Status for ${user.name}`}
                    value={user.status}
                    disabled={busyUid === user.uid}
                    onChange={(e) => handleStatusChange(user, e.target.value as UserAccountStatus)}
                    className={`h-8 rounded-lg border px-2 text-xs font-semibold ${
                      user.status === 'active'
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                        : user.status === 'suspended'
                        ? 'border-amber-200 bg-amber-50 text-amber-700'
                        : 'border-rose-200 bg-rose-50 text-rose-700'
                    }`}
                  >
                    <option value="active">active</option>
                    <option value="suspended">suspended</option>
                    <option value="blocked">blocked</option>
                  </select>
                </td>
                <td className="px-4 py-3.5 text-slate-500">{user.createdAtLabel}</td>
                <td className="px-4 py-3.5 text-right whitespace-nowrap space-x-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setAdjustTarget(user);
                      setAdjustMode('add');
                      setAdjustAmount('');
                      setAdjustReason('');
                    }}
                    className="inline-flex h-8 items-center gap-1 rounded-lg bg-emerald-600 px-2.5 text-xs font-bold text-white hover:bg-emerald-700"
                  >
                    <Wallet className="h-3.5 w-3.5" />
                    <span>+ Add</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAdjustTarget(user);
                      setAdjustMode('deduct');
                      setAdjustAmount('');
                      setAdjustReason('');
                    }}
                    className="inline-flex h-8 items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2.5 text-xs font-bold text-rose-700 hover:bg-rose-100"
                  >
                    <span>- Deduct</span>
                  </button>
                </td>
              </tr>
            ))}
            {!loading && filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-slate-400">
                  No users matched your search filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile Cards */}
      <div className="space-y-3 lg:hidden">
        {filtered.map((user) => (
          <div key={user.uid} className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-bold text-sm text-slate-900 truncate">{user.name}</p>
                <p className="text-xs text-slate-500 truncate">{user.email}</p>
                <p className="font-mono text-[10px] text-slate-400 truncate">ID: {user.uid}</p>
              </div>
              <span className="font-display text-sm font-extrabold text-violet-700 tabular-nums shrink-0">
                {APP_CONFIG.currencySymbol}
                {user.balance.toFixed(2)}
              </span>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
              <span>Phone: {user.phone}</span>
              <span>Joined: {user.createdAtLabel}</span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <select
                value={user.role}
                disabled={busyUid === user.uid}
                onChange={(e) => handleRoleChange(user, e.target.value as UserAccountRole)}
                className="h-9 rounded-xl border border-slate-200 bg-slate-50 px-2.5 text-xs font-semibold"
              >
                <option value="user">Role: User</option>
                <option value="admin">Role: Admin</option>
              </select>
              <select
                value={user.status}
                disabled={busyUid === user.uid}
                onChange={(e) => handleStatusChange(user, e.target.value as UserAccountStatus)}
                className="h-9 rounded-xl border border-slate-200 bg-slate-50 px-2.5 text-xs font-semibold"
              >
                <option value="active">Status: Active</option>
                <option value="suspended">Status: Suspended</option>
                <option value="blocked">Status: Blocked</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setAdjustTarget(user);
                  setAdjustMode('add');
                  setAdjustAmount('');
                  setAdjustReason('');
                }}
                className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl bg-emerald-600 text-xs font-bold text-white hover:bg-emerald-700"
              >
                <Wallet className="h-3.5 w-3.5" />
                <span>Add Balance</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setAdjustTarget(user);
                  setAdjustMode('deduct');
                  setAdjustAmount('');
                  setAdjustReason('');
                }}
                className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 text-xs font-bold text-rose-700 hover:bg-rose-100"
              >
                <span>Deduct Balance</span>
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Balance Adjustment Modal */}
      {adjustTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-3xl bg-white p-5 sm:p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h2 className="font-display text-lg font-bold text-slate-900">
                  Manual Balance Adjustment
                </h2>
                <p className="text-xs text-slate-500">
                  {adjustTarget.name} · Current: {APP_CONFIG.currencySymbol}
                  {adjustTarget.balance.toFixed(2)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAdjustTarget(null)}
                className="flex h-8 w-8 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleBalanceSubmit} className="mt-4 space-y-4">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setAdjustMode('add')}
                  className={`h-10 rounded-xl text-xs font-bold border ${
                    adjustMode === 'add'
                      ? 'border-emerald-600 bg-emerald-50 text-emerald-700'
                      : 'border-slate-200 text-slate-600'
                  }`}
                >
                  + Add Credit
                </button>
                <button
                  type="button"
                  onClick={() => setAdjustMode('deduct')}
                  className={`h-10 rounded-xl text-xs font-bold border ${
                    adjustMode === 'deduct'
                      ? 'border-rose-600 bg-rose-50 text-rose-700'
                      : 'border-slate-200 text-slate-600'
                  }`}
                >
                  - Deduct Funds
                </button>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Amount ({APP_CONFIG.currencyCode})
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  value={adjustAmount}
                  onChange={(e) => setAdjustAmount(e.target.value)}
                  placeholder="100.00"
                  className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-sm focus:border-violet-500 focus:bg-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Audit Reason
                </label>
                <input
                  type="text"
                  required
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  placeholder="e.g., Manual deposit confirmation / Bonus / Order correction"
                  className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-sm focus:border-violet-500 focus:bg-white focus:outline-none"
                />
              </div>

              <div className="rounded-xl bg-violet-50/70 p-3 text-[11px] text-violet-900 flex items-start gap-2">
                <Shield className="h-4 w-4 shrink-0 text-violet-700 mt-0.5" />
                <span>
                  Writes an immutable audit entry in Firestore <code className="font-mono">transactions</code> with
                  Balance Before, Balance After, Reason, and Admin ID.
                </span>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setAdjustTarget(null)}
                  className="h-10 rounded-xl border border-slate-200 px-4 text-xs font-semibold text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingBalance}
                  className="h-10 rounded-xl bg-violet-700 px-5 text-xs font-bold text-white hover:bg-violet-800 disabled:opacity-60"
                >
                  {submittingBalance ? 'Applying...' : 'Confirm Adjustment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
