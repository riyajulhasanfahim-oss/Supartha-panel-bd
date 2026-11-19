import React, { useEffect, useState } from 'react';
import {
  Wallet,
  ArrowUpRight,
  ArrowDownLeft,
  CreditCard,
  Smartphone,
  ShieldCheck,
  Info,
  Copy,
  Check,
  RefreshCw,
  Clock,
  Send,
  XCircle,
} from 'lucide-react';
import { APP_CONFIG } from '../config/app.config';
import { useApp } from '../context/AppContext';
import { normalizeCurrencySymbol } from '../utils/pricing';
import { StatusText } from '../components/common/StatusText';

const QUICK_AMOUNTS = [250, 500, 1000, 2500];

export function FundsPage() {
  const {
    wallet,
    paymentMethods,
    paymentRequests,
    transactions,
    submitPaymentRequest,
    cancelPaymentRequest,
    refreshWalletLedger,
    showToast,
    isLoading,
    systemSettings,
  } = useApp();

  const currencyCode = systemSettings?.currency?.trim() || APP_CONFIG.currencyCode;
  const currencySymbol = normalizeCurrencySymbol(systemSettings?.currencySymbol, currencyCode);

  const [selectedMethodId, setSelectedMethodId] = useState<string>('');
  const [amountInput, setAmountInput] = useState('500');
  const [transactionId, setTransactionId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [copiedAccount, setCopiedAccount] = useState(false);

  useEffect(() => {
    if (paymentMethods.length > 0 && !paymentMethods.some((m) => m.id === selectedMethodId)) {
      const first = paymentMethods[0];
      setSelectedMethodId(first.id);
      if (Number(amountInput) < first.minAmount) {
        setAmountInput(String(first.minAmount));
      }
    }
  }, [amountInput, paymentMethods, selectedMethodId]);

  const activeMethod =
    paymentMethods.find((m) => m.id === selectedMethodId) ?? paymentMethods[0] ?? null;

  const handleCopyAccount = async () => {
    if (!activeMethod?.accountNumber) return;
    try {
      await navigator.clipboard.writeText(activeMethod.accountNumber);
      setCopiedAccount(true);
      showToast({
        title: 'Copied',
        description: `${activeMethod.name} number copied to clipboard.`,
        tone: 'info',
      });
      window.setTimeout(() => setCopiedAccount(false), 1800);
    } catch {
      showToast({
        title: 'Copy Failed',
        description: 'Please copy the account number manually.',
        tone: 'warning',
      });
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refreshWalletLedger();
    } finally {
      setRefreshing(false);
    }
  };

  const handleDepositSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeMethod) return;

    const numericAmount = Number(amountInput);
    if (!Number.isFinite(numericAmount) || numericAmount < activeMethod.minAmount) {
      showToast({
        title: 'Minimum Deposit Required',
        description: `Minimum deposit for ${activeMethod.name} is ${currencySymbol}${activeMethod.minAmount}.`,
        tone: 'warning',
      });
      return;
    }

    if (numericAmount > activeMethod.maxAmount) {
      showToast({
        title: 'Maximum Limit Exceeded',
        description: `Maximum deposit for ${activeMethod.name} is ${currencySymbol}${activeMethod.maxAmount}.`,
        tone: 'warning',
      });
      return;
    }

    if (!transactionId.trim()) {
      showToast({
        title: 'Transaction ID Required',
        description: 'Please enter your payment Transaction ID (TrxID).',
        tone: 'warning',
      });
      return;
    }

    setSubmitting(true);
    try {
      const ok = await submitPaymentRequest({
        paymentMethodId: activeMethod.id,
        amount: numericAmount,
        transactionId: transactionId.trim(),
      });
      if (ok) {
        setTransactionId('');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Compact Header Row */}
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-display text-lg sm:text-2xl font-extrabold text-slate-950 truncate">
            Add Funds &amp; Wallet
          </h1>
          <p className="mt-0.5 text-xs text-slate-500 line-clamp-1 sm:line-clamp-none">
            Deposit funds, track approval status, and view your balance ledger.
          </p>
        </div>
        <button
          type="button"
          onClick={handleRefresh}
          disabled={refreshing}
          className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-xl border border-violet-200 bg-white px-3 text-xs font-bold text-violet-800 shadow-2xs hover:bg-violet-50 disabled:opacity-60 transition-colors"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          <span>Sync Wallet</span>
        </button>
      </div>

      {/* Compact Wallet Summary Strip */}
      <div className="grid gap-2.5 sm:grid-cols-12">
        <div className="sm:col-span-5 flex items-center justify-between gap-3 rounded-2xl bg-gradient-to-br from-[#6D28D9] to-[#4F46E5] px-4 py-3.5 text-white shadow-md shadow-violet-700/15">
          <div className="min-w-0">
            <span className="block text-[11px] font-medium uppercase tracking-wide text-violet-100/90">
              Current Balance
            </span>
            <p className="mt-0.5 font-display text-2xl sm:text-[1.75rem] font-extrabold leading-tight tabular-nums truncate">
              {currencySymbol} {wallet.balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/15">
            <Wallet className="h-5 w-5 text-amber-300" aria-hidden="true" />
          </span>
        </div>

        <div className="sm:col-span-7 grid grid-cols-2 gap-2.5">
          <div className="flex flex-col justify-center rounded-2xl border border-slate-200/80 bg-white px-3.5 py-3 shadow-xs">
            <div className="flex items-center gap-1.5">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-emerald-50 text-emerald-600">
                <ArrowDownLeft className="h-3.5 w-3.5" aria-hidden="true" />
              </span>
              <span className="text-[11px] font-semibold text-slate-500 truncate">
                Total Deposited
              </span>
            </div>
            <p className="mt-1 font-display text-base sm:text-xl font-bold text-slate-900 tabular-nums truncate">
              {currencySymbol} {wallet.totalDeposited.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>

          <div className="flex flex-col justify-center rounded-2xl border border-slate-200/80 bg-white px-3.5 py-3 shadow-xs">
            <div className="flex items-center gap-1.5">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-600">
                <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
              </span>
              <span className="text-[11px] font-semibold text-slate-500 truncate">
                Total Spent
              </span>
            </div>
            <p className="mt-1 font-display text-base sm:text-xl font-bold text-slate-900 tabular-nums truncate">
              {currencySymbol} {wallet.totalSpent.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
        </div>
      </div>

      {/* Add Funds Form + Dynamic Payment Methods */}
      <form
        onSubmit={handleDepositSubmit}
        className="rounded-2xl sm:rounded-3xl border border-violet-100 bg-white p-4 sm:p-5 shadow-xs space-y-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <h2 className="font-display text-base sm:text-lg font-bold text-slate-900">
            Add Funds
          </h2>
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />
            Admin-Verified Credit
          </span>
        </div>

        {paymentMethods.length === 0 ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4 text-xs text-amber-900">
            <p className="font-bold">No active payment methods configured right now.</p>
            <p className="mt-1 text-amber-800">
              Please contact support or check back shortly once the administrator activates deposit channels.
            </p>
          </div>
        ) : (
          <>
            <div>
              <p className="text-xs font-semibold text-slate-700 mb-2">
                Select Payment Method
              </p>
              <div
                className={`grid gap-2 ${
                  paymentMethods.length === 1
                    ? 'grid-cols-1'
                    : 'grid-cols-2 sm:grid-cols-3'
                }`}
              >
                {paymentMethods.map((method) => {
                  const active = activeMethod?.id === method.id;
                  const isCard =
                    method.type.toLowerCase().includes('card') ||
                    method.type.toLowerCase().includes('bank');
                  return (
                    <button
                      key={method.id}
                      type="button"
                      onClick={() => setSelectedMethodId(method.id)}
                      className={`relative flex items-center gap-2.5 rounded-xl border p-2.5 sm:p-3 text-left transition-all ${
                        active
                          ? 'border-violet-600 bg-violet-50/80 ring-1 ring-violet-500/25 shadow-2xs'
                          : 'border-slate-200 bg-white hover:border-violet-200 hover:bg-slate-50/60'
                      }`}
                    >
                      <span
                        className={`flex h-8 w-8 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-lg ${
                          active
                            ? 'bg-violet-600 text-white'
                            : 'bg-violet-100 text-violet-700'
                        }`}
                      >
                        {isCard ? (
                          <CreditCard className="h-4 w-4 sm:h-4.5 sm:w-4.5" />
                        ) : (
                          <Smartphone className="h-4 w-4 sm:h-4.5 sm:w-4.5" />
                        )}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs sm:text-sm font-bold text-slate-900 truncate">
                          {method.name}
                        </p>
                        <p className="text-[11px] text-slate-500 truncate">
                          {method.note || method.type} · Min {currencySymbol}
                          {method.minAmount}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {activeMethod && (
              <div className="rounded-xl border border-violet-100 bg-violet-50/45 p-3 sm:p-3.5 space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-violet-950">
                    <Info className="h-3.5 w-3.5 text-violet-700 shrink-0" aria-hidden="true" />
                    <span>{activeMethod.name} Instructions</span>
                  </div>
                  <span className="text-[11px] font-semibold text-violet-700 tabular-nums">
                    Min {currencySymbol}
                    {activeMethod.minAmount.toLocaleString()} · Max {currencySymbol}
                    {activeMethod.maxAmount.toLocaleString()}
                  </span>
                </div>

                {/* Copyable Account Number Box */}
                <div className="flex items-center justify-between gap-2 rounded-xl border border-violet-200/80 bg-white px-3 py-2">
                  <div className="min-w-0">
                    <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Account / Number ({activeMethod.type})
                    </span>
                    <span className="block font-mono text-sm sm:text-base font-extrabold text-violet-800 break-all select-all">
                      {activeMethod.accountNumber}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleCopyAccount}
                    className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg bg-violet-100 px-2.5 text-xs font-bold text-violet-800 hover:bg-violet-200 transition-colors"
                  >
                    {copiedAccount ? (
                      <>
                        <Check className="h-3.5 w-3.5 text-emerald-600" />
                        <span>Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                </div>

                {activeMethod.instructions && (
                  <div className="whitespace-pre-line text-xs leading-relaxed text-slate-700">
                    {activeMethod.instructions}
                  </div>
                )}
              </div>
            )}

            <div className="grid gap-3.5 sm:grid-cols-12">
              <div className="sm:col-span-6 space-y-2">
                <div className="flex items-center justify-between">
                  <label htmlFor="fund-amount" className="block text-xs font-semibold text-slate-700">
                    Deposit Amount ({currencyCode})
                  </label>
                  {activeMethod && (
                    <span className="text-[11px] font-medium text-slate-500">
                      Min {currencySymbol}
                      {activeMethod.minAmount}
                    </span>
                  )}
                </div>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-500">
                    {currencySymbol}
                  </span>
                  <input
                    id="fund-amount"
                    type="number"
                    step="0.01"
                    required
                    min={activeMethod?.minAmount ?? 1}
                    max={activeMethod?.maxAmount ?? 100000}
                    value={amountInput}
                    onChange={(e) => setAmountInput(e.target.value)}
                    className="h-10.5 w-full rounded-xl border border-slate-200 bg-slate-50 pl-8 pr-3.5 text-sm font-bold text-slate-900 tabular-nums focus:border-violet-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-violet-500/20"
                  />
                </div>
                <div className="grid grid-cols-4 gap-1.5">
                  {QUICK_AMOUNTS.map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setAmountInput(String(amt))}
                      className={`h-8 rounded-lg text-xs font-bold tabular-nums transition-colors ${
                        Number(amountInput) === amt
                          ? 'bg-violet-700 text-white shadow-2xs'
                          : 'bg-violet-50 text-violet-800 hover:bg-violet-100'
                      }`}
                    >
                      {currencySymbol}
                      {amt}
                    </button>
                  ))}
                </div>
              </div>

              <div className="sm:col-span-6 flex flex-col justify-between gap-3">
                <div>
                  <label htmlFor="fund-trx" className="block text-xs font-semibold text-slate-700 mb-2">
                    Transaction ID (TrxID / Reference)
                  </label>
                  <input
                    id="fund-trx"
                    type="text"
                    required
                    minLength={3}
                    maxLength={128}
                    value={transactionId}
                    onChange={(e) => setTransactionId(e.target.value)}
                    placeholder="e.g. BKH8X92K4P"
                    className="h-10.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 font-mono text-sm font-semibold text-slate-900 placeholder:font-sans placeholder:font-normal placeholder:text-slate-400 focus:border-violet-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-violet-500/20"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitting || !activeMethod}
                  className="inline-flex h-10.5 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-700 to-purple-600 px-5 text-sm font-bold text-white shadow-sm hover:from-violet-800 hover:to-purple-700 disabled:opacity-60 transition-all"
                >
                  <Send className="h-4 w-4" aria-hidden="true" />
                  <span>{submitting ? 'Submitting Request...' : 'Submit Payment Request'}</span>
                </button>
              </div>
            </div>
          </>
        )}
      </form>

      {/* Customer Payment Requests Status List */}
      <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-xs">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 sm:px-5">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-violet-700" aria-hidden="true" />
            <h2 className="font-display text-sm sm:text-base font-bold text-slate-900">
              Payment Requests
            </h2>
          </div>
          <span className="text-xs font-medium text-slate-500 tabular-nums">
            {paymentRequests.length} requests
          </span>
        </div>

        {isLoading ? (
          <div className="space-y-2 p-4">
            <div className="h-14 rounded-xl bg-slate-100 animate-pulse" />
          </div>
        ) : paymentRequests.length === 0 ? (
          <div className="p-6 text-center">
            <p className="text-sm font-semibold text-slate-800">No payment requests yet</p>
            <p className="mt-1 text-xs text-slate-500">
              Submitted deposit requests appear here with real-time review status.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {paymentRequests.map((req) => {
              const isPending = req.status === 'pending' || req.status === 'Pending';
              return (
                <div
                  key={req.id}
                  className="flex flex-wrap items-center justify-between gap-2.5 px-4 py-3 sm:px-5"
                >
                  <div className="min-w-0 space-y-0.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs font-bold text-violet-700">
                        {req.paymentId}
                      </span>
                      <span className="text-xs font-semibold text-slate-900">{req.method}</span>
                    </div>
                    <p className="font-mono text-xs text-slate-500 truncate">
                      TrxID: {req.transactionId} · {req.createdAtLabel}
                    </p>
                    {req.adminNote && (
                      <p className="text-[11px] font-medium text-rose-600">
                        Note: {req.adminNote}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2.5 shrink-0">
                    <span className="font-mono text-sm font-bold text-slate-900 tabular-nums">
                      {currencySymbol}
                      {req.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                    <StatusText status={req.status} />
                    {isPending && (
                      <button
                        type="button"
                        onClick={() => cancelPaymentRequest(req.id)}
                        title="Cancel pending request"
                        className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-200 px-2.5 text-[11px] font-semibold text-slate-600 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200 transition-colors"
                      >
                        <XCircle className="h-3.5 w-3.5" />
                        <span>Cancel</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Transaction History */}
      <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-xs">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 sm:px-5">
          <h2 className="font-display text-sm sm:text-base font-bold text-slate-900">
            Transaction History
          </h2>
          <span className="text-xs font-medium text-slate-500 tabular-nums">
            {transactions.length} records
          </span>
        </div>

        {isLoading ? (
          <div className="space-y-2 p-4">
            <div className="h-14 rounded-xl bg-slate-100 animate-pulse" />
            <div className="h-14 rounded-xl bg-slate-100 animate-pulse" />
          </div>
        ) : transactions.length === 0 ? (
          <div className="p-7 text-center">
            <p className="text-sm font-semibold text-slate-800">No transactions yet</p>
            <p className="mt-1 text-xs text-slate-500">
              Deposits, refunds, admin credits, and order payments appear in your ledger automatically.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {transactions.map((txn) => {
              const isCredit =
                txn.type === 'deposit' ||
                txn.type === 'refund' ||
                txn.type === 'admin_credit' ||
                (txn.type === 'adjustment' && txn.amount >= 0);
              return (
                <div
                  key={txn.id}
                  className="flex flex-wrap items-center justify-between gap-2.5 px-4 py-3 sm:px-5"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                        isCredit ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
                      }`}
                    >
                      {isCredit ? (
                        <ArrowDownLeft className="h-4 w-4" />
                      ) : (
                        <ArrowUpRight className="h-4 w-4" />
                      )}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900 truncate">{txn.method}</p>
                      <p className="text-xs text-slate-500 truncate">
                        <span className="font-mono">{txn.reference}</span> · {txn.timestampLabel}
                        {txn.description || txn.reason ? ` · ${txn.description || txn.reason}` : ''}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5 shrink-0">
                    <div className="text-right">
                      <span
                        className={`block font-mono text-sm font-bold tabular-nums ${
                          isCredit ? 'text-emerald-700' : 'text-rose-700'
                        }`}
                      >
                        {isCredit ? '+' : '-'}
                        {currencySymbol}
                        {Math.abs(txn.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </span>
                      {typeof txn.balanceAfter === 'number' && (
                        <span className="block text-[10px] text-slate-400 tabular-nums">
                          Bal: {currencySymbol}
                          {txn.balanceAfter.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </span>
                      )}
                    </div>
                    <StatusText status={txn.status === 'Failed' ? 'Canceled' : txn.status} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
