import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CheckSquare,
  ChevronLeft,
  ChevronRight,
  Edit3,
  Plus,
  RefreshCw,
  Search,
  Square,
  Trash2,
  X,
} from 'lucide-react';
import { APP_CONFIG } from '../../config/app.config';
import { useApp } from '../../context/AppContext';
import {
  adminPanelService,
  type AdminApiProviderItem,
  type AdminCategoryItem,
  type AdminServiceItem,
} from '../../services/adminPanel.service';
import { SERVICE_TYPE_OPTIONS, type ServiceType } from '../../types/service.types';
import { isPackageService, normalizeCurrencySymbol } from '../../utils/pricing';

export function AdminServicesView() {
  const { showToast, refreshCustomerData, systemSettings } = useApp();
  const currencyCode = systemSettings?.currency?.trim() || APP_CONFIG.currencyCode;
  const currencySymbol = normalizeCurrencySymbol(systemSettings?.currencySymbol, currencyCode);
  const [services, setServices] = useState<AdminServiceItem[]>([]);
  const [categories, setCategories] = useState<AdminCategoryItem[]>([]);
  const [providers, setProviders] = useState<AdminApiProviderItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters & pagination
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [providerFilter, setProviderFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | ServiceType>('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);

  // Selection & bulk actions
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkBusy, setBulkBusy] = useState(false);

  // Modals
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<AdminServiceItem | null>(null);
  const [deleteTargets, setDeleteTargets] = useState<AdminServiceItem[] | null>(null);
  const [saving, setSaving] = useState(false);

  // Form fields
  const [categoryId, setCategoryId] = useState('');
  const [serviceType, setServiceType] = useState<ServiceType>('Followers');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [providerId, setProviderId] = useState('');
  const [providerServiceId, setProviderServiceId] = useState('');
  const [costPrice, setCostPrice] = useState('25');
  const [sellingPrice, setSellingPrice] = useState('35');
  const [minQuantity, setMinQuantity] = useState('100');
  const [maxQuantity, setMaxQuantity] = useState('50000');
  const [averageTime, setAverageTime] = useState('15 minutes');
  const [deliverySpeed, setDeliverySpeed] = useState('Instant Delivery');
  const [refillGuaranteed, setRefillGuaranteed] = useState(true);
  const [status, setStatus] = useState<'active' | 'inactive'>('active');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [srvList, catList, provList] = await Promise.all([
        adminPanelService.listServicesAdmin(),
        adminPanelService.listCategories(),
        adminPanelService.listApiProviders(),
      ]);
      setServices(srvList);
      setCategories(catList);
      setProviders(provList);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const categoryNameMap = useMemo(
    () => new Map(categories.map((c) => [c.id, c.name])),
    [categories]
  );

  const providerNameMap = useMemo(
    () => new Map(providers.map((p) => [p.id, p.name])),
    [providers]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return services.filter((s) => {
      if (categoryFilter !== 'all' && s.categoryId !== categoryFilter) return false;
      if (statusFilter !== 'all' && s.status !== statusFilter) return false;
      if (typeFilter !== 'all' && s.serviceType !== typeFilter) return false;
      if (providerFilter === 'local' && s.providerId) return false;
      if (providerFilter !== 'all' && providerFilter !== 'local' && s.providerId !== providerFilter)
        return false;

      if (!q) return true;
      return (
        s.id.toLowerCase().includes(q) ||
        s.name.toLowerCase().includes(q) ||
        s.providerServiceId.toLowerCase().includes(q)
      );
    });
  }, [services, search, categoryFilter, providerFilter, statusFilter, typeFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);

  const paginated = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, safePage, pageSize]);

  useEffect(() => {
    setPage(1);
  }, [search, categoryFilter, providerFilter, statusFilter, typeFilter, pageSize]);

  const activeFilterCount =
    (categoryFilter !== 'all' ? 1 : 0) +
    (providerFilter !== 'all' ? 1 : 0) +
    (statusFilter !== 'all' ? 1 : 0) +
    (typeFilter !== 'all' ? 1 : 0) +
    (search.trim() ? 1 : 0);

  const clearFilters = () => {
    setSearch('');
    setCategoryFilter('all');
    setProviderFilter('all');
    setStatusFilter('all');
    setTypeFilter('all');
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const pageAllSelected =
    paginated.length > 0 && paginated.every((srv) => selectedIds.includes(srv.id));

  const toggleSelectPage = () => {
    const pageIds = paginated.map((s) => s.id);
    if (pageAllSelected) {
      setSelectedIds((prev) => prev.filter((id) => !pageIds.includes(id)));
    } else {
      setSelectedIds((prev) => Array.from(new Set([...prev, ...pageIds])));
    }
  };

  const openCreate = () => {
    setEditing(null);
    setCategoryId(categoryFilter !== 'all' ? categoryFilter : (categories[0]?.id ?? 'instagram'));
    setServiceType('Followers');
    setName('');
    setDescription('');
    setProviderId('');
    setProviderServiceId('');
    setCostPrice('25');
    setSellingPrice('35');
    setMinQuantity('100');
    setMaxQuantity('50000');
    setAverageTime('15 minutes');
    setDeliverySpeed('Instant Delivery');
    setRefillGuaranteed(true);
    setStatus('active');
    setModalOpen(true);
  };

  const openEdit = (srv: AdminServiceItem) => {
    setEditing(srv);
    setCategoryId(srv.categoryId);
    setServiceType(srv.serviceType ?? 'Other');
    setName(srv.name);
    setDescription(srv.description);
    setProviderId(srv.providerId);
    setProviderServiceId(srv.providerServiceId);
    setCostPrice(String(srv.costPrice));
    setSellingPrice(String(srv.sellingPrice));
    setMinQuantity(String(srv.minQuantity));
    setMaxQuantity(String(srv.maxQuantity));
    setAverageTime(srv.averageTime || '15 minutes');
    setDeliverySpeed(srv.deliverySpeed || 'Instant Delivery');
    setRefillGuaranteed(srv.refillGuaranteed);
    setStatus(srv.status);
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!categoryId) {
      showToast({
        title: 'Category Required',
        description: 'Create or select a category first.',
        tone: 'warning',
      });
      return;
    }
    setSaving(true);
    try {
      await adminPanelService.saveService({
        id: editing?.id,
        categoryId,
        serviceType,
        name,
        description,
        providerId,
        providerServiceId,
        costPrice: Number(costPrice),
        sellingPrice: Number(sellingPrice),
        minQuantity: Number(minQuantity),
        maxQuantity: Number(maxQuantity),
        averageTime,
        deliverySpeed,
        refillGuaranteed,
        status,
      });
      showToast({
        title: editing ? 'Service Updated' : 'Service Added',
        description: `${name} saved with selling price ${currencySymbol}${Number(
          sellingPrice
        ).toFixed(2)}/${isPackageService({ serviceType, deliverySpeed, description, minQuantity: Number(minQuantity), maxQuantity: Number(maxQuantity) }) ? 'Pkg' : '1K'}.`,
        tone: 'success',
      });
      setModalOpen(false);
      await Promise.all([loadData(), refreshCustomerData().catch(() => undefined)]);
    } catch (err) {
      showToast({
        title: 'Save Failed',
        description: err instanceof Error ? err.message : 'Unable to save service.',
        tone: 'error',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async (srv: AdminServiceItem) => {
    const nextStatus = srv.status === 'active' ? 'inactive' : 'active';
    try {
      await adminPanelService.bulkUpdateServiceStatus([srv.id], nextStatus);
      setServices((prev) =>
        prev.map((item) => (item.id === srv.id ? { ...item, status: nextStatus } : item))
      );
      showToast({
        title: 'Service Status Updated',
        description: `${srv.name} is now ${nextStatus}.`,
        tone: 'success',
      });
      refreshCustomerData().catch(() => undefined);
    } catch (err) {
      showToast({
        title: 'Update Failed',
        description: err instanceof Error ? err.message : 'Could not update status.',
        tone: 'error',
      });
    }
  };

  const handleBulkStatus = async (nextStatus: 'active' | 'inactive') => {
    if (selectedIds.length === 0) return;
    setBulkBusy(true);
    try {
      await adminPanelService.bulkUpdateServiceStatus(selectedIds, nextStatus);
      setServices((prev) =>
        prev.map((s) => (selectedIds.includes(s.id) ? { ...s, status: nextStatus } : s))
      );
      showToast({
        title: 'Bulk Status Updated',
        description: `${selectedIds.length} service(s) marked ${nextStatus}.`,
        tone: 'success',
      });
      setSelectedIds([]);
      refreshCustomerData().catch(() => undefined);
    } catch (err) {
      showToast({
        title: 'Bulk Update Failed',
        description: err instanceof Error ? err.message : 'Unable to update selected services.',
        tone: 'error',
      });
    } finally {
      setBulkBusy(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTargets || deleteTargets.length === 0) return;
    setBulkBusy(true);
    try {
      const targetIds = deleteTargets.map((s) => s.id);
      const { deletedIds, archivedIds } = await adminPanelService.safeDeleteServices(targetIds);

      setServices((prev) =>
        prev
          .filter((s) => !deletedIds.includes(s.id))
          .map((s) => (archivedIds.includes(s.id) ? { ...s, status: 'inactive' } : s))
      );
      setSelectedIds((prev) => prev.filter((id) => !targetIds.includes(id)));

      if (archivedIds.length > 0 && deletedIds.length > 0) {
        showToast({
          title: 'Delete & Historical Archive Complete',
          description: `${deletedIds.length} removed, ${archivedIds.length} set to Inactive to protect historical orders.`,
          tone: 'info',
        });
      } else if (archivedIds.length > 0) {
        showToast({
          title: 'Archived to Protect Order History',
          description: `${archivedIds.length} service(s) had existing orders, so they were set to Inactive instead of deleting.`,
          tone: 'warning',
        });
      } else {
        showToast({
          title: 'Service Deleted',
          description: `${deletedIds.length} service(s) removed.`,
          tone: 'info',
        });
      }

      setDeleteTargets(null);
      refreshCustomerData().catch(() => undefined);
    } catch (err) {
      showToast({
        title: 'Delete Failed',
        description: err instanceof Error ? err.message : 'Could not delete selected services.',
        tone: 'error',
      });
    } finally {
      setBulkBusy(false);
    }
  };

  const margin = Number(sellingPrice || 0) - Number(costPrice || 0);
  const activeCount = useMemo(
    () => services.filter((s) => s.status === 'active').length,
    [services]
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-xl sm:text-2xl font-extrabold text-slate-950">
            Services &amp; Price Management
          </h1>
          <p className="text-xs sm:text-sm text-slate-500">
            Configure service types, cost/selling pricing, provider mappings, and bulk availability.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={loadData}
            className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700"
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
            <span>Add Service</span>
          </button>
        </div>
      </div>

      {/* Compact Stats Strip */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-2xl border border-slate-200/80 bg-white px-4 py-3">
          <p className="text-[11px] text-slate-500">Total Services</p>
          <p className="mt-0.5 font-display text-lg font-extrabold text-slate-900">
            {services.length}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200/80 bg-white px-4 py-3">
          <p className="text-[11px] text-slate-500">Active (Live)</p>
          <p className="mt-0.5 font-display text-lg font-extrabold text-emerald-700">
            {activeCount}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200/80 bg-white px-4 py-3">
          <p className="text-[11px] text-slate-500">Provider-Linked</p>
          <p className="mt-0.5 font-display text-lg font-extrabold text-violet-700">
            {services.filter((s) => Boolean(s.providerId)).length}
          </p>
        </div>
      </div>

      {/* Search & Multi-Filters */}
      <div className="space-y-3 rounded-2xl border border-slate-200/80 bg-white p-4">
        <div className="grid gap-2.5 sm:grid-cols-12">
          <div className="relative sm:col-span-4">
            <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search Service ID, Name, or Provider Service ID..."
              className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-xs sm:text-sm focus:border-violet-500 focus:bg-white focus:outline-none"
            />
          </div>

          <div className="sm:col-span-2">
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-2.5 text-xs font-medium"
            >
              <option value="all">All Categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-2">
            <select
              value={providerFilter}
              onChange={(e) => setProviderFilter(e.target.value)}
              className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-2.5 text-xs font-medium"
            >
              <option value="all">All Providers</option>
              <option value="local">Manual / Local</option>
              {providers.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-2">
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as 'all' | ServiceType)}
              className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-2.5 text-xs font-medium"
            >
              <option value="all">All Types</option>
              {SERVICE_TYPE_OPTIONS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as 'all' | 'active' | 'inactive')}
              className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-2.5 text-xs font-medium"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        </div>

        {activeFilterCount > 0 && (
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>
              Showing {filtered.length} matching service(s) across {activeFilterCount} filter(s)
            </span>
            <button
              type="button"
              onClick={clearFilters}
              className="font-semibold text-violet-700 hover:text-violet-900"
            >
              Clear filters
            </button>
          </div>
        )}
      </div>

      {/* Bulk Management Bar */}
      {selectedIds.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-violet-200 bg-violet-50 px-4 py-3 text-xs">
          <div className="flex items-center gap-2 font-bold text-violet-950">
            <span>{selectedIds.length} service(s) selected</span>
            <button
              type="button"
              onClick={() => setSelectedIds([])}
              className="font-semibold text-violet-700 underline underline-offset-2"
            >
              Clear
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={bulkBusy}
              onClick={() => handleBulkStatus('active')}
              className="h-8 rounded-xl bg-emerald-600 px-3 font-bold text-white hover:bg-emerald-700 disabled:opacity-60"
            >
              Activate Selected
            </button>
            <button
              type="button"
              disabled={bulkBusy}
              onClick={() => handleBulkStatus('inactive')}
              className="h-8 rounded-xl bg-slate-700 px-3 font-bold text-white hover:bg-slate-800 disabled:opacity-60"
            >
              Deactivate Selected
            </button>
            <button
              type="button"
              disabled={bulkBusy}
              onClick={() =>
                setDeleteTargets(services.filter((s) => selectedIds.includes(s.id)))
              }
              className="h-8 rounded-xl bg-rose-600 px-3 font-bold text-white hover:bg-rose-700 disabled:opacity-60"
            >
              Delete Selected
            </button>
          </div>
        </div>
      )}

      {/* Desktop Table */}
      <div className="hidden lg:block overflow-x-auto rounded-3xl border border-slate-200/80 bg-white shadow-xs">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-slate-100 bg-slate-50/80 text-slate-500 font-semibold">
            <tr>
              <th className="pl-4 pr-2 py-3.5 w-8">
                <button
                  type="button"
                  onClick={toggleSelectPage}
                  className="text-slate-500 hover:text-violet-700"
                  aria-label="Select all on page"
                >
                  {pageAllSelected ? (
                    <CheckSquare className="h-4 w-4 text-violet-700" />
                  ) : (
                    <Square className="h-4 w-4" />
                  )}
                </button>
              </th>
              <th className="px-3 py-3.5">Service &amp; Type</th>
              <th className="px-3 py-3.5">Category</th>
              <th className="px-3 py-3.5">Provider Mapping</th>
              <th className="px-3 py-3.5">Cost / 1K</th>
              <th className="px-3 py-3.5">Selling / 1K</th>
              <th className="px-3 py-3.5">Gross Margin</th>
              <th className="px-3 py-3.5">Limits &amp; Avg</th>
              <th className="px-3 py-3.5">Status</th>
              <th className="px-4 py-3.5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {paginated.map((srv) => {
              const rowMargin = srv.sellingPrice - srv.costPrice;
              const isSelected = selectedIds.includes(srv.id);
              return (
                <tr
                  key={srv.id}
                  className={`hover:bg-violet-50/30 ${isSelected ? 'bg-violet-50/40' : ''}`}
                >
                  <td className="pl-4 pr-2 py-3.5">
                    <button
                      type="button"
                      onClick={() => toggleSelect(srv.id)}
                      className="text-slate-400 hover:text-violet-700"
                      aria-label={`Select ${srv.name}`}
                    >
                      {isSelected ? (
                        <CheckSquare className="h-4 w-4 text-violet-700" />
                      ) : (
                        <Square className="h-4 w-4" />
                      )}
                    </button>
                  </td>
                  <td className="px-3 py-3.5 max-w-xs">
                    <div className="flex items-center gap-1.5">
                      <p className="font-bold text-slate-900 truncate">{srv.name}</p>
                    </div>
                    <p className="font-mono text-[10px] text-slate-400 mt-0.5">
                      {srv.id} ·{' '}
                      <span className="font-sans font-semibold text-violet-700">
                        {srv.serviceType}
                      </span>
                    </p>
                  </td>
                  <td className="px-3 py-3.5 font-medium text-slate-700">
                    {categoryNameMap.get(srv.categoryId) ?? srv.categoryId}
                  </td>
                  <td className="px-3 py-3.5 text-slate-600">
                    {srv.providerId ? (
                      <span>
                        {providerNameMap.get(srv.providerId) ?? srv.providerId}
                        {srv.providerServiceId ? ` (#${srv.providerServiceId})` : ''}
                      </span>
                    ) : (
                      <span className="text-slate-400">Manual / Local</span>
                    )}
                  </td>
                  <td className="px-3 py-3.5 font-mono text-slate-600 tabular-nums">
                    {currencySymbol}
                    {srv.costPrice.toFixed(2)}
                    {isPackageService(srv) ? ' /Pkg' : ''}
                  </td>
                  <td className="px-3 py-3.5 font-bold text-violet-700 tabular-nums">
                    {currencySymbol}
                    {srv.sellingPrice.toFixed(2)}
                    {isPackageService(srv) ? ' /Pkg' : ''}
                  </td>
                  <td
                    className={`px-3 py-3.5 font-mono font-bold tabular-nums ${
                      rowMargin >= 0 ? 'text-emerald-700' : 'text-rose-700'
                    }`}
                  >
                    {rowMargin >= 0 ? '+' : ''}
                    {currencySymbol}
                    {rowMargin.toFixed(2)}
                  </td>
                  <td className="px-3 py-3.5 text-slate-500 tabular-nums">
                    <p>
                      {srv.minQuantity.toLocaleString()} – {srv.maxQuantity.toLocaleString()}
                    </p>
                    <p className="text-[10px] text-slate-400">{srv.averageTime}</p>
                  </td>
                  <td className="px-3 py-3.5">
                    <button
                      type="button"
                      onClick={() => handleToggleStatus(srv)}
                      className={`rounded-lg px-2.5 py-1 text-[11px] font-bold ${
                        srv.status === 'active'
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {srv.status}
                    </button>
                  </td>
                  <td className="px-4 py-3.5 text-right space-x-1.5 whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => openEdit(srv)}
                      className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-200 px-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      <Edit3 className="h-3.5 w-3.5" />
                      <span>Edit</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteTargets([srv])}
                      className="inline-flex h-8 items-center rounded-lg border border-rose-200 bg-rose-50 px-2.5 text-rose-700 hover:bg-rose-100"
                      aria-label={`Delete ${srv.name}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              );
            })}
            {!loading && paginated.length === 0 && (
              <tr>
                <td colSpan={10} className="px-4 py-10 text-center text-xs text-slate-400">
                  No services match your current filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile Cards */}
      <div className="space-y-3 lg:hidden">
        {paginated.map((srv) => {
          const isSelected = selectedIds.includes(srv.id);
          const rowMargin = srv.sellingPrice - srv.costPrice;
          return (
            <div
              key={srv.id}
              className={`rounded-2xl border bg-white p-4 shadow-xs space-y-2.5 ${
                isSelected ? 'border-violet-400 bg-violet-50/20' : 'border-slate-200/80'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2.5 min-w-0">
                  <button
                    type="button"
                    onClick={() => toggleSelect(srv.id)}
                    className="mt-0.5 text-slate-400 hover:text-violet-700 shrink-0"
                  >
                    {isSelected ? (
                      <CheckSquare className="h-4 w-4 text-violet-700" />
                    ) : (
                      <Square className="h-4 w-4" />
                    )}
                  </button>
                  <div className="min-w-0">
                    <p className="font-mono text-[10px] text-slate-400">
                      {categoryNameMap.get(srv.categoryId) ?? srv.categoryId} · {srv.serviceType} ·{' '}
                      {srv.id}
                    </p>
                    <p className="font-bold text-sm text-slate-900">{srv.name}</p>
                    {srv.providerId && (
                      <p className="text-[11px] text-slate-500">
                        Provider: {providerNameMap.get(srv.providerId) ?? srv.providerId}
                        {srv.providerServiceId ? ` (#${srv.providerServiceId})` : ''}
                      </p>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleToggleStatus(srv)}
                  className={`rounded-lg px-2.5 py-1 text-[11px] font-bold shrink-0 ${
                    srv.status === 'active'
                      ? 'bg-emerald-50 text-emerald-700'
                      : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {srv.status}
                </button>
              </div>
              <div className="grid grid-cols-4 gap-2 rounded-xl bg-slate-50 p-2.5 text-xs">
                <div>
                  <p className="text-[10px] text-slate-400">
                    {isPackageService(srv) ? 'Cost/Pkg' : 'Cost/1K'}
                  </p>
                  <p className="font-bold text-slate-700">
                    {currencySymbol}
                    {srv.costPrice.toFixed(2)}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-400">
                    {isPackageService(srv) ? 'Sell/Pkg' : 'Sell/1K'}
                  </p>
                  <p className="font-bold text-violet-700">
                    {currencySymbol}
                    {srv.sellingPrice.toFixed(2)}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-400">Margin</p>
                  <p
                    className={`font-bold ${
                      rowMargin >= 0 ? 'text-emerald-700' : 'text-rose-700'
                    }`}
                  >
                    {currencySymbol}
                    {rowMargin.toFixed(2)}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-400">Avg</p>
                  <p className="font-semibold text-slate-700 truncate">{srv.averageTime}</p>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => openEdit(srv)}
                  className="h-9 rounded-xl border border-slate-200 px-3 text-xs font-semibold text-slate-700"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => setDeleteTargets([srv])}
                  className="h-9 rounded-xl border border-rose-200 bg-rose-50 px-3 text-xs font-semibold text-rose-700"
                >
                  Delete
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Pagination Bar */}
      {filtered.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200/80 bg-white px-4 py-3 text-xs text-slate-600">
          <div className="flex items-center gap-2">
            <span>
              Showing {(safePage - 1) * pageSize + 1}–
              {Math.min(safePage * pageSize, filtered.length)} of {filtered.length}
            </span>
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              className="h-8 rounded-lg border border-slate-200 bg-slate-50 px-2 text-xs font-semibold"
              aria-label="Rows per page"
            >
              <option value={10}>10 / page</option>
              <option value={15}>15 / page</option>
              <option value={25}>25 / page</option>
              <option value={50}>50 / page</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={safePage <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-200 px-2.5 font-semibold disabled:opacity-40"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              <span>Prev</span>
            </button>
            <span className="px-2 font-bold text-slate-800">
              Page {safePage} / {totalPages}
            </span>
            <button
              type="button"
              disabled={safePage >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-200 px-2.5 font-semibold disabled:opacity-40"
            >
              <span>Next</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Add/Edit Service Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
          <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-3xl bg-white p-5 sm:p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="font-display text-lg font-bold text-slate-900">
                {editing ? 'Edit Service & Pricing' : 'Create New Service'}
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
              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Category
                  </label>
                  <select
                    required
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                    className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Service Type
                  </label>
                  <select
                    value={serviceType}
                    onChange={(e) => setServiceType(e.target.value as ServiceType)}
                    className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm"
                  >
                    {SERVICE_TYPE_OPTIONS.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
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
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Service Name
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Instagram Followers – High Quality"
                  className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Description
                </label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm"
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Provider (Admin Only)
                  </label>
                  <select
                    value={providerId}
                    onChange={(e) => setProviderId(e.target.value)}
                    className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm"
                  >
                    <option value="">Manual / No API Provider</option>
                    {providers.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.status})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Provider Service ID
                  </label>
                  <input
                    type="text"
                    value={providerServiceId}
                    onChange={(e) => setProviderServiceId(e.target.value)}
                    placeholder="e.g. 1420"
                    className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 font-mono text-sm"
                  />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Cost Price ({currencyCode})
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={costPrice}
                    onChange={(e) => setCostPrice(e.target.value)}
                    className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Customer Selling Price ({currencyCode})
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={sellingPrice}
                    onChange={(e) => setSellingPrice(e.target.value)}
                    className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm"
                  />
                </div>
              </div>

              <div className="rounded-xl bg-violet-50 px-3.5 py-2 text-xs font-semibold text-violet-900">
                Gross Margin Preview:{' '}
                <span className={margin >= 0 ? 'text-emerald-700' : 'text-rose-700'}>
                  {currencySymbol}
                  {margin.toFixed(2)}
                </span>{' '}
                <span className="font-normal text-slate-500">
                  (Gross difference before gateway fees or refunds)
                </span>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Min Quantity
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={minQuantity}
                    onChange={(e) => setMinQuantity(e.target.value)}
                    className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Max Quantity
                  </label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={maxQuantity}
                    onChange={(e) => setMaxQuantity(e.target.value)}
                    className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm"
                  />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Average Delivery Time
                  </label>
                  <input
                    type="text"
                    value={averageTime}
                    onChange={(e) => setAverageTime(e.target.value)}
                    placeholder="15 minutes"
                    className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Delivery Speed Label
                  </label>
                  <input
                    type="text"
                    value={deliverySpeed}
                    onChange={(e) => setDeliverySpeed(e.target.value)}
                    placeholder="Instant Delivery"
                    className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm"
                  />
                </div>
              </div>

              <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700">
                <input
                  type="checkbox"
                  checked={refillGuaranteed}
                  onChange={(e) => setRefillGuaranteed(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-violet-700"
                />
                <span>Refill Guarantee Included</span>
              </label>

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
                  {saving ? 'Saving...' : 'Save Service'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Single / Bulk Delete Confirmation with Historical Order Protection */}
      {deleteTargets && deleteTargets.length > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-3xl bg-white p-5 shadow-2xl">
            <h3 className="font-display text-base font-bold text-slate-900">
              {deleteTargets.length === 1
                ? 'Delete or Archive Service?'
                : `Process ${deleteTargets.length} Selected Services?`}
            </h3>
            <p className="mt-1.5 text-xs text-slate-600 leading-relaxed">
              {deleteTargets.length === 1 ? (
                <>
                  Target: <span className="font-semibold">{deleteTargets[0].name}</span>.
                </>
              ) : (
                <>
                  You selected <span className="font-semibold">{deleteTargets.length} services</span>.
                </>
              )}{' '}
              If any service is referenced by historical orders, it will automatically be set to{' '}
              <span className="font-semibold text-slate-800">Inactive</span> instead of hard-deleting
              so past order reports stay intact.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteTargets(null)}
                className="h-9 rounded-xl border border-slate-200 px-3 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={bulkBusy}
                onClick={handleConfirmDelete}
                className="h-9 rounded-xl bg-rose-600 px-4 text-xs font-bold text-white disabled:opacity-60"
              >
                {bulkBusy ? 'Processing...' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
