import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, ClipboardList, RefreshCw, Search } from 'lucide-react';
import {
  adminPanelService,
  type AdminAuditLogItem,
} from '../../services/adminPanel.service';

const PAGE_SIZE = 20;

export function AdminAuditLogsView() {
  const [logs, setLogs] = useState<AdminAuditLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const loadLogs = useCallback(async () => {
    setLoading(true);
    try {
      const list = await adminPanelService.listAuditLogsAdmin(150);
      setLogs(list);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  useEffect(() => {
    setPage(1);
  }, [actionFilter, search]);

  const distinctActions = useMemo(() => {
    const set = new Set<string>();
    logs.forEach((l) => set.add(l.action));
    return Array.from(set);
  }, [logs]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return logs.filter((l) => {
      if (actionFilter !== 'all' && l.action !== actionFilter) return false;
      if (!q) return true;
      return (
        l.action.toLowerCase().includes(q) ||
        l.adminId.toLowerCase().includes(q) ||
        l.targetId.toLowerCase().includes(q) ||
        l.targetType.toLowerCase().includes(q) ||
        l.previousValue.toLowerCase().includes(q) ||
        l.newValue.toLowerCase().includes(q) ||
        (l.note ?? '').toLowerCase().includes(q)
      );
    });
  }, [actionFilter, logs, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginated = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, safePage]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-xl sm:text-2xl font-extrabold text-slate-950">
            Admin Audit Logs
          </h1>
          <p className="text-xs sm:text-sm text-slate-500">
            Immutable record of payment reviews, balance adjustments, refunds, ticket replies, and manual status changes.
          </p>
        </div>
        <button
          type="button"
          onClick={loadLogs}
          className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-violet-200 bg-white px-4 text-xs font-bold text-violet-800 hover:bg-violet-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Filters */}
      <div className="grid gap-3 rounded-2xl border border-slate-200/80 bg-white p-4 sm:grid-cols-12">
        <div className="relative sm:col-span-8">
          <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search Target ID, Admin UID, action, value, or note..."
            className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-xs sm:text-sm"
          />
        </div>
        <div className="sm:col-span-4">
          <select
            aria-label="Filter audit action"
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs sm:text-sm font-semibold text-slate-800"
          >
            <option value="all">All Actions</option>
            {distinctActions.map((act) => (
              <option key={act} value={act}>
                {act}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Desktop Table */}
      <div className="hidden lg:block overflow-x-auto rounded-3xl border border-slate-200/80 bg-white shadow-xs">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-slate-100 bg-slate-50/80 text-slate-500 font-semibold">
            <tr>
              <th className="px-4 py-3.5">Timestamp</th>
              <th className="px-4 py-3.5">Action</th>
              <th className="px-4 py-3.5">Target</th>
              <th className="px-4 py-3.5">Change (Prev → New)</th>
              <th className="px-4 py-3.5">Admin UID</th>
              <th className="px-4 py-3.5">Note</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {paginated.map((log) => (
              <tr key={log.id} className="hover:bg-violet-50/20">
                <td className="px-4 py-3.5 whitespace-nowrap text-slate-500">
                  {log.timestampLabel}
                </td>
                <td className="px-4 py-3.5">
                  <span className="rounded-md bg-violet-50 px-2 py-0.5 font-mono text-[11px] font-bold text-violet-700">
                    {log.action}
                  </span>
                </td>
                <td className="px-4 py-3.5">
                  <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-slate-600 mr-1.5">
                    {log.targetType}
                  </span>
                  <span className="font-mono text-[11px] font-semibold text-slate-900">
                    {log.targetId}
                  </span>
                </td>
                <td className="px-4 py-3.5">
                  <span className="text-slate-500">{log.previousValue || '—'}</span>
                  <span className="mx-1.5 text-slate-400">→</span>
                  <span className="font-semibold text-slate-900">{log.newValue || '—'}</span>
                </td>
                <td className="px-4 py-3.5 font-mono text-[11px] text-slate-600">{log.adminId}</td>
                <td className="px-4 py-3.5 text-slate-600 max-w-xs truncate">
                  {log.note || '—'}
                </td>
              </tr>
            ))}
            {!loading && paginated.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-slate-400">
                  No audit log entries recorded yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile Cards */}
      <div className="space-y-3 lg:hidden">
        {paginated.map((log) => (
          <div
            key={log.id}
            className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs space-y-2"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="rounded-md bg-violet-50 px-2 py-0.5 font-mono text-[11px] font-bold text-violet-700">
                {log.action}
              </span>
              <span className="text-[11px] text-slate-400">{log.timestampLabel}</span>
            </div>
            <p className="text-xs font-semibold text-slate-900">
              <span className="uppercase text-[10px] text-slate-500 mr-1.5">
                {log.targetType}:
              </span>
              <span className="font-mono">{log.targetId}</span>
            </p>
            <p className="text-xs text-slate-700">
              <span className="text-slate-500">{log.previousValue || '—'}</span> →{' '}
              <span className="font-semibold text-slate-950">{log.newValue || '—'}</span>
            </p>
            {log.note && (
              <p className="rounded-lg bg-slate-50 px-2.5 py-1.5 text-[11px] text-slate-600">
                {log.note}
              </p>
            )}
            <p className="font-mono text-[10px] text-slate-400">Admin: {log.adminId}</p>
          </div>
        ))}

        {!loading && paginated.length === 0 && (
          <div className="rounded-3xl border border-dashed border-slate-200 bg-white p-10 text-center text-xs text-slate-400">
            <ClipboardList className="mx-auto h-7 w-7 text-slate-300 mb-2" />
            No audit log entries recorded yet.
          </div>
        )}
      </div>

      {/* Pagination */}
      {!loading && filtered.length > PAGE_SIZE && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200/80 bg-white px-4 py-3 text-xs">
          <span className="text-slate-500 tabular-nums">
            Showing {(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, filtered.length)}{' '}
            of {filtered.length}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={safePage <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="inline-flex h-9 items-center gap-1 rounded-xl border border-slate-200 px-3 font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              <span>Prev</span>
            </button>
            <span className="font-mono font-bold text-slate-700 tabular-nums">
              {safePage}/{totalPages}
            </span>
            <button
              type="button"
              disabled={safePage >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="inline-flex h-9 items-center gap-1 rounded-xl border border-slate-200 px-3 font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
            >
              <span>Next</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
