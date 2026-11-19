import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, RefreshCw, Search, ShieldCheck, X } from 'lucide-react';
import { APP_CONFIG } from '../../config/app.config';
import { useApp } from '../../context/AppContext';
import {
  adminPanelService,
  isPaymentApprovedStatus,
  isPaymentCancelledStatus,
  isPaymentPendingStatus,
  isPaymentRejectedStatus,
  type AdminPaymentItem,
} from '../../services/adminPanel.service';
import { StatusText } from '../common/StatusText';
import { normalizeCurrencySymbol } from '../../utils/pricing';

type PaymentFilterTab = 'All' | 'Pending' | 'Approved' | 'Rejected' | 'Cancelled';

export function AdminPaymentsView() {
  const { firebaseUser, showToast, systemSettings } = useApp();
  const currencySymbol = normalizeCurrencySymbol(
    systemSettings?.currencySymbol,
    systemSettings?.currency
  );
  const [payments, setPayments] = useState<AdminPaymentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<PaymentFilterTab>('All');
  const [search, setSearch] = useState('');
  const [confirmAction, setConfirmAction] = useState<{
    payment: AdminPaymentItem;
    action: 'approved' | 'rejected';
  } | null>(null);
  const [adminNote, setAdminNote] = useState('');
  const [processing, setProcessing] = useState(false);

  const loadPayments = useCallback(async () => {
    setLoading(true);
    try {
      const list = await adminPanelService.listPaymentsAdmin();
      setPayments(list);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPayments();
  }, [loadPayments]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return payments.filter((p) => {
      if (statusFilter === 'Pending' && !isPaymentPendingStatus(p.status)) return false;
      if (statusFilter === 'Approved' && !isPaymentApprovedStatus(p.status)) return false;
      if (statusFilter === 'Rejected' && !isPaymentRejectedStatus(p.status)) return false;
      if (statusFilter === 'Cancelled' && !isPaymentCancelledStatus(p.status)) return false;

      if (!q) return true;
      return (
        p.id.toLowerCase().includes(q) ||
        p.paymentId.toLowerCase().includes(q) ||
        p.userId.toLowerCase().includes(q) ||
        p.userName.toLowerCase().includes(q) ||
        p.transactionId.toLowerCase().includes(q) ||
        p.method.toLowerCase().includes(q)
      );
    });
  }, [payments, statusFilter, search]);

  const executeDecision = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!confirmAction || !firebaseUser) return;
    setProcessing(true);
    try {
      await adminPanelService.reviewPaymentAdmin(
        confirmAction.payment.id,
        confirmAction.action,
        firebaseUser.uid,
        adminNote
      );
      showToast({
        title: confirmAction.action === 'approved' ? 'Payment Approved' : 'Payment Rejected',
        description:
          confirmAction.action === 'approved'
            ? `Credited ${currencySymbol}${confirmAction.payment.amount.toFixed(
                2
              )} to ${confirmAction.payment.userName} & sent notification.`
            : 'Payment request rejected & user notified.',
        tone: confirmAction.action === 'approved' ? 'success' : 'info',
      });
      setConfirmAction(null);
      setAdminNote('');
      await loadPayments();
    } catch (err) {
      showToast({
        title: 'Review Failed',
        description: err instanceof Error ? err.message : 'Unable to update payment.',
        tone: 'error',
      });
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-xl sm:text-2xl font-extrabold text-slate-950">
            Payments Management
          </h1>
          <p className="text-xs sm:text-sm text-slate-500">
            Verify deposit TrxIDs, approve atomically with duplicate-credit protection, or reject invalid requests.
          </p>
        </div>
        <button
          type="button"
          onClick={loadPayments}
          className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-violet-200 bg-white px-4 text-xs font-bold text-violet-800 hover:bg-violet-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 rounded-2xl border border-slate-200/80 bg-white p-4">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search Payment ID, User Name, UID, Method, or Transaction ID..."
            className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-xs sm:text-sm focus:border-violet-500 focus:bg-white focus:outline-none"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {(['All', 'Pending', 'Approved', 'Rejected', 'Cancelled'] as const).map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setStatusFilter(st)}
              className={`h-10 rounded-xl px-3.5 text-xs font-bold transition-colors ${
                statusFilter === st
                  ? 'bg-violet-700 text-white'
                  : 'border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      <div className="hidden lg:block overflow-x-auto rounded-3xl border border-slate-200/80 bg-white shadow-xs">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-slate-100 bg-slate-50/80 text-slate-500 font-semibold">
            <tr>
              <th className="px-4 py-3.5">Payment ID</th>
              <th className="px-4 py-3.5">Customer</th>
              <th className="px-4 py-3.5">Method</th>
              <th className="px-4 py-3.5">Transaction ID</th>
              <th className="px-4 py-3.5">Amount</th>
              <th className="px-4 py-3.5">Status</th>
              <th className="px-4 py-3.5">Submitted / Reviewed</th>
              <th className="px-4 py-3.5 text-right">Review</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.map((pay) => {
              const isPending = isPaymentPendingStatus(pay.status);
              return (
                <tr key={pay.id} className="hover:bg-violet-50/30">
                  <td className="px-4 py-3.5 font-mono font-bold text-violet-700">
                    {pay.paymentId}
                  </td>
                  <td className="px-4 py-3.5">
                    <p className="font-semibold text-slate-900">{pay.userName}</p>
                    <p className="font-mono text-[10px] text-slate-400">{pay.userId}</p>
                  </td>
                  <td className="px-4 py-3.5 font-semibold text-slate-800">{pay.method}</td>
                  <td className="px-4 py-3.5 font-mono text-slate-700">{pay.transactionId}</td>
                  <td className="px-4 py-3.5 font-bold tabular-nums text-slate-900">
                    {currencySymbol}
                    {pay.amount.toFixed(2)}
                  </td>
                  <td className="px-4 py-3.5">
                    <StatusText
                      status={
                        pay.status === 'Completed'
                          ? 'Approved'
                          : pay.status === 'Failed'
                          ? 'Rejected'
                          : pay.status
                      }
                    />
                  </td>
                  <td className="px-4 py-3.5 text-slate-500">
                    <p>{pay.createdAtLabel}</p>
                    {pay.adminNote && (
                      <p className="text-[10px] text-slate-400 truncate max-w-[160px]">
                        Note: {pay.adminNote}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3.5 text-right whitespace-nowrap space-x-1.5">
                    {isPending ? (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            setAdminNote('');
                            setConfirmAction({ payment: pay, action: 'approved' });
                          }}
                          className="inline-flex h-8 items-center gap-1 rounded-lg bg-emerald-600 px-2.5 text-xs font-bold text-white hover:bg-emerald-700"
                        >
                          <Check className="h-3.5 w-3.5" />
                          <span>Approve</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setAdminNote('');
                            setConfirmAction({ payment: pay, action: 'rejected' });
                          }}
                          className="inline-flex h-8 items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2.5 text-xs font-bold text-rose-700 hover:bg-rose-100"
                        >
                          <X className="h-3.5 w-3.5" />
                          <span>Reject</span>
                        </button>
                      </>
                    ) : (
                      <span className="text-[11px] text-slate-400">
                        {pay.reviewedAtLabel !== '—' ? `Reviewed ${pay.reviewedAtLabel}` : 'Locked'}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
            {!loading && filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-slate-400">
                  No payment records found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile Cards */}
      <div className="space-y-3 lg:hidden">
        {filtered.map((pay) => {
          const isPending = isPaymentPendingStatus(pay.status);
          return (
            <div
              key={pay.id}
              className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs space-y-2.5"
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-bold text-violet-700">{pay.paymentId}</span>
                <StatusText
                  status={
                    pay.status === 'Completed'
                      ? 'Approved'
                      : pay.status === 'Failed'
                      ? 'Rejected'
                      : pay.status
                  }
                />
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-800">
                  {pay.method} · <code className="font-mono">{pay.transactionId}</code>
                </span>
                <span className="font-bold text-slate-900">
                  {currencySymbol}
                  {pay.amount.toFixed(2)}
                </span>
              </div>
              <p className="text-[11px] text-slate-600">
                Customer: <span className="font-semibold">{pay.userName}</span> ({pay.userId})
              </p>
              {pay.adminNote && (
                <p className="text-[11px] text-rose-600">Admin Note: {pay.adminNote}</p>
              )}
              {isPending && (
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setAdminNote('');
                      setConfirmAction({ payment: pay, action: 'approved' });
                    }}
                    className="h-9 rounded-xl bg-emerald-600 text-xs font-bold text-white"
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAdminNote('');
                      setConfirmAction({ payment: pay, action: 'rejected' });
                    }}
                    className="h-9 rounded-xl border border-rose-200 bg-rose-50 text-xs font-bold text-rose-700"
                  >
                    Reject
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {confirmAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
          <form
            onSubmit={executeDecision}
            className="w-full max-w-md rounded-3xl bg-white p-5 sm:p-6 shadow-2xl space-y-4"
          >
            <div>
              <h3 className="font-display text-base font-bold text-slate-900">
                {confirmAction.action === 'approved'
                  ? 'Approve Payment Request'
                  : 'Reject Payment Request'}
              </h3>
              <p className="mt-1 text-xs text-slate-600">
                {confirmAction.action === 'approved'
                  ? `Confirming will atomically credit ${currencySymbol}${confirmAction.payment.amount.toFixed(
                      2
                    )} to ${confirmAction.payment.userName} (${confirmAction.payment.method} · TrxID: ${confirmAction.payment.transactionId}).`
                  : `Reject ${confirmAction.payment.paymentId} (${currencySymbol}${confirmAction.payment.amount.toFixed(
                      2
                    )}) with zero balance change.`}
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Admin Note {confirmAction.action === 'rejected' ? '(Reason sent to customer)' : '(Optional)'}
              </label>
              <input
                type="text"
                value={adminNote}
                onChange={(e) => setAdminNote(e.target.value)}
                placeholder={
                  confirmAction.action === 'rejected'
                    ? 'e.g. Transaction ID not matched or invalid amount'
                    : 'Optional verification remark'
                }
                className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs sm:text-sm focus:border-violet-500 focus:bg-white focus:outline-none"
              />
            </div>

            {confirmAction.action === 'approved' && (
              <div className="flex items-start gap-2 rounded-xl bg-emerald-50 p-3 text-[11px] text-emerald-900">
                <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>
                  Idempotent lock enabled: duplicate approvals or double-credits on the same payment ID are blocked automatically.
                </span>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmAction(null)}
                className="h-9 rounded-xl border border-slate-200 px-3 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={processing}
                className={`h-9 rounded-xl px-4 text-xs font-bold text-white disabled:opacity-60 ${
                  confirmAction.action === 'approved'
                    ? 'bg-emerald-600 hover:bg-emerald-700'
                    : 'bg-rose-600 hover:bg-rose-700'
                }`}
              >
                {processing
                  ? 'Processing...'
                  : confirmAction.action === 'approved'
                  ? 'Confirm Approve'
                  : 'Confirm Reject'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
