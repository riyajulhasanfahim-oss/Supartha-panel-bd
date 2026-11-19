import React, { useCallback, useEffect, useState } from 'react';
import {
  Plus,
  RefreshCw,
  Shield,
  ShieldCheck,
  UserCheck,
  UserX,
  X,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import type { AdminStaffRole } from '../../lib/firestore/collections';
import { getAdminRoleLabel } from '../../lib/permissions';
import { adminPanelService, type AdminStaffMember } from '../../services/adminPanel.service';

const STAFF_ROLE_OPTIONS: Array<{ value: AdminStaffRole; label: string; summary: string }> = [
  {
    value: 'super_admin',
    label: 'Super Admin',
    summary: 'Full access · Staff RBAC, Firebase, Setup Wizard, Financials & Catalog',
  },
  {
    value: 'admin',
    label: 'Admin',
    summary: 'Panel Operations · Users, Orders, Payments, Services, Settings & Firebase',
  },
  {
    value: 'manager',
    label: 'Manager',
    summary: 'Fulfillment & Catalog · Orders, Services, Categories, Providers & User View',
  },
  {
    value: 'support_staff',
    label: 'Support Staff',
    summary: 'Customer Desk · Support Tickets, Order Status Lookup & Notifications',
  },
];

export function AdminStaffView() {
  const { adminPermissions, firebaseUser, showToast } = useApp();
  const [staff, setStaff] = useState<AdminStaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [updatingUid, setUpdatingUid] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<AdminStaffRole>('manager');

  const loadStaff = useCallback(async () => {
    setLoading(true);
    try {
      const list = await adminPanelService.listAdminStaff();
      setStaff(list);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStaff();
  }, [loadStaff]);

  const handleCreateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await adminPanelService.createAdminStaffAccount({
        name,
        email,
        password,
        role,
      });
      setModalOpen(false);
      setName('');
      setEmail('');
      setPassword('');
      setRole('manager');
      await loadStaff();
      showToast({
        title: 'Staff Account Created',
        description: `${email.trim().toLowerCase()} assigned role ${getAdminRoleLabel(role)}.`,
        tone: 'success',
      });
    } catch (err) {
      showToast({
        title: 'Creation Failed',
        description: err instanceof Error ? err.message : 'Unable to create staff user.',
        tone: 'error',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateRole = async (
    member: AdminStaffMember,
    nextRole: AdminStaffRole,
    nextStatus: 'active' | 'revoked'
  ) => {
    if (member.uid === firebaseUser?.uid && nextStatus === 'revoked') {
      showToast({
        title: 'Action Blocked',
        description: 'You cannot revoke your own currently active Super Admin session.',
        tone: 'warning',
      });
      return;
    }
    setUpdatingUid(member.uid);
    try {
      await adminPanelService.updateAdminStaffRole(member.uid, nextRole, nextStatus);
      await loadStaff();
      showToast({
        title: 'Staff Updated',
        description: `${member.email} is now ${getAdminRoleLabel(nextRole)} (${nextStatus}).`,
        tone: 'success',
      });
    } catch (err) {
      showToast({
        title: 'Update Failed',
        description: err instanceof Error ? err.message : 'Requires Super Admin permissions.',
        tone: 'error',
      });
    } finally {
      setUpdatingUid(null);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-xl sm:text-2xl font-extrabold text-slate-950">
            Admin Staff &amp; Role Access (RBAC)
          </h1>
          <p className="text-xs sm:text-sm text-slate-500">
            Assign granular panel permissions via <code className="font-mono">adminUsers</code> enforced at Firestore rule level.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={loadStaff}
            disabled={loading}
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-violet-200 bg-white px-3.5 text-xs font-bold text-violet-800 hover:bg-violet-50 disabled:opacity-60 whitespace-nowrap"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>

          {adminPermissions.canManageStaff && (
            <button
              type="button"
              onClick={() => setModalOpen(true)}
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-violet-700 px-4 text-xs font-bold text-white hover:bg-violet-800 whitespace-nowrap"
            >
              <Plus className="h-4 w-4" />
              <span>Add Staff Member</span>
            </button>
          )}
        </div>
      </div>

      {/* Role Permissions Matrix */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {STAFF_ROLE_OPTIONS.map((opt) => (
          <div
            key={opt.value}
            className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs"
          >
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-violet-700 shrink-0" />
              <p className="font-display text-sm font-bold text-slate-900">{opt.label}</p>
            </div>
            <p className="mt-1.5 text-xs leading-relaxed text-slate-500">{opt.summary}</p>
          </div>
        ))}
      </div>

      {!adminPermissions.canManageStaff && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-medium text-amber-900">
          Read-only view: Only a verified <strong>Super Admin</strong> can create new staff accounts or change staff RBAC roles.
        </div>
      )}

      {/* Staff List */}
      <div className="rounded-3xl border border-violet-100 bg-white shadow-xs overflow-hidden">
        <div className="border-b border-slate-100 px-5 py-4 flex items-center justify-between">
          <h2 className="font-display text-base font-bold text-slate-900">
            Authorized Staff Accounts ({staff.length})
          </h2>
        </div>

        {loading ? (
          <div className="p-8 text-center text-xs text-slate-500">Loading staff registry...</div>
        ) : staff.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500">
            No additional staff accounts recorded in <code className="font-mono">adminUsers</code> yet.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {staff.map((member) => {
              const isSelf = member.uid === firebaseUser?.uid;
              const isBusy = updatingUid === member.uid;
              return (
                <div
                  key={member.uid}
                  className="flex flex-wrap items-center justify-between gap-4 px-5 py-4"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <ShieldCheck
                        className={`h-4 w-4 shrink-0 ${
                          member.status === 'active' ? 'text-emerald-600' : 'text-slate-400'
                        }`}
                      />
                      <p className="font-display text-sm font-bold text-slate-900 truncate">
                        {member.name}
                        {isSelf && (
                          <span className="ml-1.5 font-sans text-[11px] font-semibold text-violet-700">
                            (You)
                          </span>
                        )}
                      </p>
                    </div>
                    <p className="mt-0.5 text-xs text-slate-500 truncate">
                      {member.email} · UID: <span className="font-mono">{member.uid.slice(0, 10)}…</span>
                    </p>
                    <p className="mt-0.5 text-[11px] text-slate-400">
                      Updated {member.updatedAtLabel} · Status:{' '}
                      <span
                        className={
                          member.status === 'active'
                            ? 'font-semibold text-emerald-700'
                            : 'font-semibold text-rose-600'
                        }
                      >
                        {member.status === 'active' ? 'Active' : 'Revoked'}
                      </span>
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      aria-label={`Role for ${member.email}`}
                      disabled={!adminPermissions.canManageStaff || isBusy}
                      value={member.role}
                      onChange={(e) =>
                        handleUpdateRole(
                          member,
                          e.target.value as AdminStaffRole,
                          member.status
                        )
                      }
                      className="h-9 rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-semibold text-slate-800 disabled:opacity-60"
                    >
                      {STAFF_ROLE_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>

                    {adminPermissions.canManageStaff && !isSelf && (
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() =>
                          handleUpdateRole(
                            member,
                            member.role,
                            member.status === 'active' ? 'revoked' : 'active'
                          )
                        }
                        className={`inline-flex h-9 items-center gap-1.5 rounded-xl border px-3 text-xs font-bold whitespace-nowrap ${
                          member.status === 'active'
                            ? 'border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100'
                            : 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                        }`}
                      >
                        {member.status === 'active' ? (
                          <>
                            <UserX className="h-3.5 w-3.5" />
                            <span>Revoke</span>
                          </>
                        ) : (
                          <>
                            <UserCheck className="h-3.5 w-3.5" />
                            <span>Activate</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Create Staff Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-display text-lg font-bold text-slate-950">
                Create Admin / Staff Account
              </h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateStaff} className="mt-4 space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Operations Manager"
                  className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Staff Email *
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="staff@yourdomain.com"
                  className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Initial Password (min 6 chars) *
                </label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Strong password"
                  className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Assigned RBAC Role *
                </label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as AdminStaffRole)}
                  className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold"
                >
                  {STAFF_ROLE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-[11px] text-slate-500">
                  {STAFF_ROLE_OPTIONS.find((r) => r.value === role)?.summary}
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="h-10 rounded-xl border border-slate-200 px-4 text-xs font-semibold text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="h-10 rounded-xl bg-violet-700 px-5 text-xs font-bold text-white hover:bg-violet-800 disabled:opacity-60 whitespace-nowrap"
                >
                  {submitting ? 'Creating Account...' : 'Create Staff Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
