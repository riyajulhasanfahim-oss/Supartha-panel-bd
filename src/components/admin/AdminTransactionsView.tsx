import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshCw, Search } from 'lucide-react';
import { APP_CONFIG } from '../../config/app.config';
import { useApp } from '../../context/AppContext';
import type { TransactionTypeFirestore } from '../../lib/firestore/collections';
import {
  adminPanelService,
  type AdminTransactionItem,
} from '../../services/adminPanel.service';
import { normalizeCurrencySymbol } from '../../utils/pricing';

export function AdminTransactionsView() {
  const { systemSettings } = useApp();
  const currencySymbol = normalizeCurrencySymbol(
    systemSettings?.currencySymbol,
    systemSettings?.currency
  );
  const [transactions, setTransactions] = useState<AdminTransactionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | TransactionTypeFirestore>('all');

  const loadTransactions = useCallback(async () => {
    setLoading(true);
    try {
      const list = await adminPanelService.listTransactionsAdmin();
      setTransactions(list);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTransactions();
  }, [loadTransactions]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return transactions.filter((t) => {
      if (typeFilter !== 'all') {
        if (typeFilter === 'order_payment') {
          if (t.type !== 'order_payment' && t.type !== 'order') return false;
        } else if (t.type !== typeFilter) {
          return false;
        }
      }
      if (!q) return true;
      return (
        t.id.toLowerCase().includes(q) ||
        t.transactionId.toLowerCase().includes(q) ||
        t.userId.toLowerCase().includes(q) ||
        t.reference.toLowerCase().includes(q) ||
        t.referenceId.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        t.reason.toLowerCase().includes(q)
      );
    });
  }, [transactions, search, typeFilter]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-xl sm:text-2xl font-extrabold text-slate-950">
            Transactions Ledger
          </h1>
          <p className="text-xs sm:text-sm text-slate-500">
            Immutable audit trail of deposits, order payments, refunds, and admin balance credits/debits.
          </p>
        </div>
        <button
          type="button"
          onClick={loadTransactions}
          className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-violet-200 bg-white px-4 text-xs font-bold text-violet-800 hover:bg-violet-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      <div className="grid gap-3 rounded-2xl border border-slate-200/80 bg-white p-4 sm:grid-cols-12">
        <div className="relative sm:col-span-8">
          <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search Transaction ID, User ID, Reference, or Description..."
            className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-xs sm:text-sm"
          />
        </div>
        <div className="sm:col-span-4">
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as 'all' | TransactionTypeFirestore)}
            className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs sm:text-sm font-medium"
          >
            <option value="all">All Types</option>
            <option value="deposit">Deposit</option>
            <option value="order_payment">Order Payment</option>
            <option value="refund">Refund</option>
            <option value="admin_credit">Admin Credit</option>
            <option value="admin_debit">Admin Debit</option>
            <option value="adjustment">Legacy Adjustment</option>
          </select>
        </div>
      </div>

      <div className="hidden lg:block overflow-x-auto rounded-3xl border border-slate-200/80 bg-white shadow-xs">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-slate-100 bg-slate-50/80 text-slate-500 font-semibold">
            <tr>
              <th className="px-4 py-3.5">Transaction ID</th>
              <th className="px-4 py-3.5">User ID</th>
              <th className="px-4 py-3.5">Type</th>
              <th className="px-4 py-3.5">Amount</th>
              <th className="px-4 py-3.5">Before</th>
              <th className="px-4 py-3.5">After</th>
              <th className="px-4 py-3.5">Reference &amp; Description</th>
              <th className="px-4 py-3.5">Created By</th>
              <th className="px-4 py-3.5">Created</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.map((txn) => (
              <tr key={txn.id} className="hover:bg-violet-50/30">
                <td className="px-4 py-3.5 font-mono font-bold text-violet-700">
                  {txn.transactionId}
                </td>
                <td className="px-4 py-3.5 font-mono text-[11px] text-slate-600">{txn.userId}</td>
                <td className="px-4 py-3.5">
                  <span className="rounded-lg bg-slate-100 px-2 py-0.5 text-[11px] font-bold uppercase text-slate-700">
                    {txn.type}
                  </span>
                </td>
                <td
                  className={`px-4 py-3.5 font-bold tabular-nums ${
                    txn.amount >= 0 ? 'text-emerald-600' : 'text-rose-600'
                  }`}
                >
                  {txn.amount >= 0 ? '+' : ''}
                  {currencySymbol}
                  {txn.amount.toFixed(2)}
                </td>
                <td className="px-4 py-3.5 tabular-nums text-slate-500">
                  {currencySymbol}
                  {txn.balanceBefore.toFixed(2)}
                </td>
                <td className="px-4 py-3.5 font-bold tabular-nums text-slate-900">
                  {currencySymbol}
                  {txn.balanceAfter.toFixed(2)}
                </td>
                <td className="px-4 py-3.5 max-w-xs">
                  <p className="font-mono text-[11px] text-slate-800">{txn.referenceId}</p>
                  <p className="text-[11px] text-slate-500 truncate">{txn.description}</p>
                </td>
                <td className="px-4 py-3.5 font-mono text-[11px] text-slate-500">
                  {txn.createdBy}
                </td>
                <td className="px-4 py-3.5 text-slate-500">{txn.createdAtLabel}</td>
              </tr>
            ))}
            {!loading && filtered.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-10 text-center text-slate-400">
                  No ledger transactions found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile Cards */}
      <div className="space-y-3 lg:hidden">
        {filtered.map((txn) => (
          <div key={txn.id} className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-xs font-bold text-violet-700">{txn.transactionId}</span>
              <span
                className={`text-sm font-extrabold tabular-nums ${
                  txn.amount >= 0 ? 'text-emerald-600' : 'text-rose-600'
                }`}
              >
                {txn.amount >= 0 ? '+' : ''}
                {currencySymbol}
                {txn.amount.toFixed(2)}
              </span>
            </div>
            <p className="text-xs font-semibold text-slate-800">
              {txn.type.toUpperCase()} · {txn.referenceId}
            </p>
            <p className="text-xs text-slate-600">{txn.description}</p>
            <div className="flex justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-100">
              <span>
                {currencySymbol}
                {txn.balanceBefore.toFixed(2)} → {currencySymbol}
                {txn.balanceAfter.toFixed(2)}
              </span>
              <span>{txn.createdAtLabel}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
