import React, { useCallback, useEffect, useState } from 'react';
import { Edit3, Plus, RefreshCw, Trash2, X } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { adminPanelService, type AdminCategoryItem } from '../../services/adminPanel.service';

export function AdminCategoriesView() {
  const { showToast, refreshCustomerData } = useApp();
  const [categories, setCategories] = useState<AdminCategoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<AdminCategoryItem | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const [name, setName] = useState('');
  const [icon, setIcon] = useState('instagram');
  const [description, setDescription] = useState('');
  const [sortOrder, setSortOrder] = useState('1');
  const [status, setStatus] = useState<'active' | 'inactive'>('active');
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<AdminCategoryItem | null>(null);

  const loadCategories = useCallback(async () => {
    setLoading(true);
    try {
      const list = await adminPanelService.listCategories();
      setCategories(list);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  const openCreate = () => {
    setEditing(null);
    setName('');
    setIcon('instagram');
    setDescription('');
    setSortOrder(String(categories.length + 1));
    setStatus('active');
    setModalOpen(true);
  };

  const openEdit = (cat: AdminCategoryItem) => {
    setEditing(cat);
    setName(cat.name);
    setIcon(cat.icon);
    setDescription(cat.description);
    setSortOrder(String(cat.sortOrder));
    setStatus(cat.status);
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await adminPanelService.saveCategory({
        id: editing?.id,
        name,
        icon,
        description,
        sortOrder: Number(sortOrder) || 0,
        status,
      });
      showToast({
        title: editing ? 'Category Updated' : 'Category Created',
        description: `${name} saved to Firestore.`,
        tone: 'success',
      });
      setModalOpen(false);
      await Promise.all([loadCategories(), refreshCustomerData().catch(() => undefined)]);
    } catch (err) {
      showToast({
        title: 'Save Failed',
        description: err instanceof Error ? err.message : 'Unable to save category.',
        tone: 'error',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async (cat: AdminCategoryItem) => {
    const nextStatus = cat.status === 'active' ? 'inactive' : 'active';
    try {
      await adminPanelService.saveCategory({
        id: cat.id,
        name: cat.name,
        icon: cat.icon,
        description: cat.description,
        sortOrder: cat.sortOrder,
        status: nextStatus,
      });
      setCategories((prev) =>
        prev.map((c) => (c.id === cat.id ? { ...c, status: nextStatus } : c))
      );
      showToast({
        title: 'Category Status Updated',
        description: `${cat.name} is now ${nextStatus}.`,
        tone: 'success',
      });
      refreshCustomerData().catch(() => undefined);
    } catch (err) {
      showToast({
        title: 'Update Failed',
        description: err instanceof Error ? err.message : 'Unable to toggle status.',
        tone: 'error',
      });
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    try {
      await adminPanelService.deleteCategory(confirmDelete.id);
      setCategories((prev) => prev.filter((c) => c.id !== confirmDelete.id));
      showToast({
        title: 'Category Deleted',
        description: `${confirmDelete.name} removed.`,
        tone: 'info',
      });
      setConfirmDelete(null);
      refreshCustomerData().catch(() => undefined);
    } catch (err) {
      showToast({
        title: 'Delete Failed',
        description: err instanceof Error ? err.message : 'Unable to delete category.',
        tone: 'error',
      });
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-xl sm:text-2xl font-extrabold text-slate-950">
            Categories Management
          </h1>
          <p className="text-xs sm:text-sm text-slate-500">
            Create, reorder, enable/disable, or remove service platform categories.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={loadCategories}
            className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-violet-700 px-4 text-xs font-bold text-white hover:bg-violet-800"
          >
            <Plus className="h-4 w-4" />
            <span>Add Category</span>
          </button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {categories.map((cat) => (
          <div
            key={cat.id}
            className="flex flex-col justify-between rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs"
          >
            <div>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="font-mono text-[10px] text-slate-400">
                    #{cat.sortOrder} · {cat.id}
                  </span>
                  <h2 className="font-display text-base font-bold text-slate-900">{cat.name}</h2>
                </div>
                <button
                  type="button"
                  onClick={() => handleToggleStatus(cat)}
                  className={`rounded-lg px-2.5 py-1 text-[11px] font-bold ${
                    cat.status === 'active'
                      ? 'bg-emerald-50 text-emerald-700'
                      : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {cat.status}
                </button>
              </div>
              <p className="mt-1.5 text-xs text-slate-500">Icon key: {cat.icon}</p>
              {cat.description && (
                <p className="mt-1 text-xs text-slate-600 line-clamp-2">{cat.description}</p>
              )}
            </div>

            <div className="mt-4 flex items-center justify-end gap-2 border-t border-slate-100 pt-3">
              <button
                type="button"
                onClick={() => openEdit(cat)}
                className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                <Edit3 className="h-3.5 w-3.5" />
                <span>Edit</span>
              </button>
              <button
                type="button"
                onClick={() => setConfirmDelete(cat)}
                className="inline-flex h-8 items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-3 text-xs font-semibold text-rose-700 hover:bg-rose-100"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>Delete</span>
              </button>
            </div>
          </div>
        ))}
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-3xl bg-white p-5 sm:p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="font-display text-lg font-bold text-slate-900">
                {editing ? 'Edit Category' : 'Create Category'}
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
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Name</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Instagram"
                  className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm focus:border-violet-500 focus:bg-white focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Icon</label>
                  <input
                    type="text"
                    required
                    value={icon}
                    onChange={(e) => setIcon(e.target.value)}
                    placeholder="instagram"
                    className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm focus:border-violet-500 focus:bg-white focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Sort Order</label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={sortOrder}
                    onChange={(e) => setSortOrder(e.target.value)}
                    className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm focus:border-violet-500 focus:bg-white focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Status</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as 'active' | 'inactive')}
                  className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Description</label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm"
                />
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
                  {saving ? 'Saving...' : 'Save Category'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-3xl bg-white p-5 shadow-2xl">
            <h3 className="font-display text-base font-bold text-slate-900">Delete Category?</h3>
            <p className="mt-1.5 text-xs text-slate-600">
              Remove <span className="font-semibold">{confirmDelete.name}</span> from Firestore?
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmDelete(null)}
                className="h-9 rounded-xl border border-slate-200 px-3 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                className="h-9 rounded-xl bg-rose-600 px-4 text-xs font-bold text-white hover:bg-rose-700"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
