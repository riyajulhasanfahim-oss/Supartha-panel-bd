import React, { useCallback, useEffect, useState } from 'react';
import {
  Landmark,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  X,
} from 'lucide-react';
import { APP_CONFIG } from '../../config/app.config';
import { useApp } from '../../context/AppContext';
import {
  adminPanelService,
  type AdminPaymentMethodItem,
} from '../../services/adminPanel.service';
import { normalizeCurrencySymbol } from '../../utils/pricing';

export function AdminPaymentMethodsView() {
  const { showToast, refreshWalletLedger, systemSettings } = useApp();
  const currencySymbol = normalizeCurrencySymbol(
    systemSettings?.currencySymbol,
    systemSettings?.currency
  );
  const [methods, setMethods] = useState<AdminPaymentMethodItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [editingId, setEditingId] = useState<string | undefined>(undefined);
  const [name, setName] = useState('');
  const [type, setType] = useState('Mobile Banking');
  const [accountNumber, setAccountNumber] = useState('');
  const [note, setNote] = useState('');
  const [instructions, setInstructions] = useState('');
  const [minAmount, setMinAmount] = useState('50');
  const [maxAmount, setMaxAmount] = useState('50000');
  const [displayOrder, setDisplayOrder] = useState('1');
  const [status, setStatus] = useState<'active' | 'inactive'>('active');

  const loadMethods = useCallback(async () => {
    setLoading(true);
    try {
      const list = await adminPanelService.listPaymentMethodsAdmin();
      setMethods(list);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMethods();
  }, [loadMethods]);

  const openNewModal = () => {
    setEditingId(undefined);
    setName('');
    setType('Mobile Banking');
    setAccountNumber('');
    setNote('');
    setInstructions(
      '1. Send money to the account number shown above.\n2. Copy the Transaction ID (TrxID).\n3. Submit the amount and TrxID in the form.'
    );
    setMinAmount('50');
    setMaxAmount('50000');
    setDisplayOrder(String(methods.length + 1));
    setStatus('active');
    setModalOpen(true);
  };

  const openEditModal = (item: AdminPaymentMethodItem) => {
    setEditingId(item.id);
    setName(item.name);
    setType(item.type);
    setAccountNumber(item.accountNumber);
    setNote(item.note);
    setInstructions(item.instructions);
    setMinAmount(String(item.minAmount));
    setMaxAmount(String(item.maxAmount));
    setDisplayOrder(String(item.displayOrder));
    setStatus(item.status);
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await adminPanelService.savePaymentMethod({
        id: editingId,
        name,
        type,
        accountNumber,
        note,
        instructions,
        minAmount: Number(minAmount) || 50,
        maxAmount: Number(maxAmount) || 50000,
        displayOrder: Number(displayOrder) || 1,
        status,
      });
      showToast({
        title: editingId ? 'Payment Method Updated' : 'Payment Method Added',
        description: `${name} is now ${status}.`,
        tone: 'success',
      });
      setModalOpen(false);
      await loadMethods();
      await refreshWalletLedger();
    } catch (err) {
      showToast({
        title: 'Save Failed',
        description: err instanceof Error ? err.message : 'Unable to save payment method.',
        tone: 'error',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleQuickToggle = async (item: AdminPaymentMethodItem) => {
    const nextStatus = item.status === 'active' ? 'inactive' : 'active';
    try {
      await adminPanelService.savePaymentMethod({
        ...item,
        status: nextStatus,
      });
      showToast({
        title: 'Status Updated',
        description: `${item.name} is now ${nextStatus}.`,
        tone: 'success',
      });
      await loadMethods();
      await refreshWalletLedger();
    } catch (err) {
      showToast({
        title: 'Toggle Failed',
        description: err instanceof Error ? err.message : 'Unable to update status.',
        tone: 'error',
      });
    }
  };

  const handleDelete = async (item: AdminPaymentMethodItem) => {
    try {
      await adminPanelService.deletePaymentMethod(item.id);
      showToast({
        title: 'Payment Method Deleted',
        description: `${item.name} removed.`,
        tone: 'info',
      });
      await loadMethods();
      await refreshWalletLedger();
    } catch (err) {
      showToast({
        title: 'Delete Failed',
        description: err instanceof Error ? err.message : 'Unable to delete method.',
        tone: 'error',
      });
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-xl sm:text-2xl font-extrabold text-slate-950">
            Payment Methods Management
          </h1>
          <p className="text-xs sm:text-sm text-slate-500">
            Configure bKash, Nagad, Rocket, Bank, or custom deposit channels shown on the customer Add Funds page.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={loadMethods}
            className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-violet-200 bg-white px-4 text-xs font-bold text-violet-800 hover:bg-violet-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
          <button
            type="button"
            onClick={openNewModal}
            className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-violet-700 px-4 text-xs font-bold text-white shadow-sm hover:bg-violet-800"
          >
            <Plus className="h-4 w-4" />
            <span>Add Method</span>
          </button>
        </div>
      </div>

      {/* Methods Grid */}
      {loading && methods.length === 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="h-44 rounded-3xl bg-white border border-slate-200 animate-pulse" />
          <div className="h-44 rounded-3xl bg-white border border-slate-200 animate-pulse" />
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {methods.map((item) => (
            <div
              key={item.id}
              className="flex flex-col justify-between rounded-3xl border border-slate-200/80 bg-white p-5 shadow-xs space-y-4"
            >
              <div className="space-y-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-violet-700">
                      <Landmark className="h-5 w-5" />
                    </span>
                    <div className="min-w-0">
                      <h2 className="font-display text-base font-bold text-slate-900 truncate">
                        {item.name}
                      </h2>
                      <p className="text-[11px] font-medium text-slate-500">
                        {item.type} · Order #{item.displayOrder}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleQuickToggle(item)}
                    className={`rounded-lg px-2.5 py-1 text-[11px] font-bold uppercase ${
                      item.status === 'active'
                        ? 'bg-emerald-50 text-emerald-700'
                        : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {item.status}
                  </button>
                </div>

                <div className="rounded-xl bg-slate-50 p-3 border border-slate-100">
                  <span className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    Account / Wallet Number
                  </span>
                  <span className="font-mono text-sm font-bold text-violet-800 break-all">
                    {item.accountNumber}
                  </span>
                  {item.note && (
                    <span className="mt-0.5 block text-[11px] text-slate-500">{item.note}</span>
                  )}
                </div>

                <p className="text-xs text-slate-600 line-clamp-3 whitespace-pre-line">
                  {item.instructions}
                </p>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-slate-600 tabular-nums">
                  {currencySymbol}
                  {item.minAmount.toLocaleString()} – {currencySymbol}
                  {item.maxAmount.toLocaleString()}
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => openEditModal(item)}
                    className="inline-flex h-8 items-center gap-1 rounded-lg border border-violet-200 bg-violet-50 px-2.5 text-xs font-bold text-violet-700 hover:bg-violet-100"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    <span>Edit</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(item)}
                    aria-label={`Delete ${item.name}`}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl bg-white p-5 sm:p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="font-display text-lg font-bold text-slate-900">
                {editingId ? 'Edit Payment Method' : 'Add Payment Method'}
              </h2>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSave} className="mt-4 space-y-3.5">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Method Name
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. bKash Personal"
                    className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Type</label>
                  <input
                    type="text"
                    required
                    value={type}
                    onChange={(e) => setType(e.target.value)}
                    placeholder="Mobile Banking / Bank / Crypto"
                    className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm"
                  />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Account / Number
                  </label>
                  <input
                    type="text"
                    required
                    value={accountNumber}
                    onChange={(e) => setAccountNumber(e.target.value)}
                    placeholder="e.g. 01XXXXXXXXX"
                    className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 font-mono text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Short Tagline Note
                  </label>
                  <input
                    type="text"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Send Money / Zero Fee"
                    className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Min ({currencySymbol})
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={minAmount}
                    onChange={(e) => setMinAmount(e.target.value)}
                    className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Max ({currencySymbol})
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={maxAmount}
                    onChange={(e) => setMaxAmount(e.target.value)}
                    className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Order</label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={displayOrder}
                    onChange={(e) => setDisplayOrder(e.target.value)}
                    className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Deposit Instructions
                </label>
                <textarea
                  rows={4}
                  required
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs leading-relaxed"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Status</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as 'active' | 'inactive')}
                  className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold"
                >
                  <option value="active">Active (Visible to customers)</option>
                  <option value="inactive">Inactive (Hidden from customers)</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="h-10 rounded-xl border border-slate-200 px-4 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="h-10 rounded-xl bg-violet-700 px-5 text-xs font-bold text-white hover:bg-violet-800 disabled:opacity-60"
                >
                  {saving ? 'Saving...' : 'Save Payment Method'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
