import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CheckCheck,
  ExternalLink,
  MessageSquareReply,
  Paperclip,
  RefreshCw,
  Search,
  X,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import type { SupportTicketStatusFirestore } from '../../lib/firestore/collections';
import { adminPanelService, type AdminTicketItem } from '../../services/adminPanel.service';
import { supportService } from '../../services/support.service';
import type { TicketReply } from '../../types';
import { StatusText } from '../common/StatusText';

type TicketFilter =
  | 'All'
  | 'Open'
  | 'In Progress'
  | 'Waiting for Customer'
  | 'Resolved'
  | 'Closed';

function isSafeAttachmentUrl(url?: string): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

export function AdminSupportView() {
  const { firebaseUser, showToast } = useApp();
  const [tickets, setTickets] = useState<AdminTicketItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<TicketFilter>('All');
  const [search, setSearch] = useState('');

  const [selected, setSelected] = useState<AdminTicketItem | null>(null);
  const [threadReplies, setThreadReplies] = useState<TicketReply[]>([]);
  const [replyText, setReplyText] = useState('');
  const [editStatus, setEditStatus] =
    useState<SupportTicketStatusFirestore>('Waiting for Customer');
  const [editPriority, setEditPriority] = useState<AdminTicketItem['priority']>('Medium');
  const [saving, setSaving] = useState(false);

  const loadTickets = useCallback(async () => {
    setLoading(true);
    try {
      const list = await adminPanelService.listTicketsAdmin();
      setTickets(list);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTickets();
  }, [loadTickets]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tickets.filter((t) => {
      if (filter !== 'All') {
        if (filter === 'Open') {
          if (t.status !== 'Open' && t.status !== 'Pending') return false;
        } else if (filter === 'Waiting for Customer') {
          if (t.status !== 'Waiting for Customer' && t.status !== 'Answered') return false;
        } else if (t.status !== filter) {
          return false;
        }
      }
      if (!q) return true;
      return (
        t.id.toLowerCase().includes(q) ||
        t.userId.toLowerCase().includes(q) ||
        t.subject.toLowerCase().includes(q) ||
        t.category.toLowerCase().includes(q) ||
        t.orderReference.toLowerCase().includes(q) ||
        t.message.toLowerCase().includes(q)
      );
    });
  }, [tickets, filter, search]);

  useEffect(() => {
    if (!selected) {
      setThreadReplies([]);
      return;
    }

    const unsub = supportService.subscribeMessages(
      selected.id,
      (list) => {
        setThreadReplies(list);
        supportService.markMessagesRead(selected.id, 'admin').catch(() => undefined);
      },
      () => undefined
    );

    return () => {
      unsub();
    };
  }, [selected?.id]);

  const openTicket = (tkt: AdminTicketItem) => {
    setSelected(tkt);
    setReplyText('');
    setEditStatus(
      tkt.status === 'Open' || tkt.status === 'Pending' || tkt.status === 'In Progress'
        ? 'Waiting for Customer'
        : tkt.status
    );
    setEditPriority(tkt.priority);
  };

  const handleSaveReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected || !firebaseUser) return;
    setSaving(true);
    try {
      await adminPanelService.updateTicketAdmin(selected.id, {
        adminReply: replyText.trim() || undefined,
        repliedBy: firebaseUser.uid,
        status: editStatus,
        priority: editPriority,
      });
      showToast({
        title: 'Ticket Updated',
        description: `Ticket #${selected.id} updated (${editStatus}).`,
        tone: 'success',
      });
      setSelected(null);
      await loadTickets();
    } catch (err) {
      showToast({
        title: 'Update Failed',
        description: err instanceof Error ? err.message : 'Unable to save reply.',
        tone: 'error',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-xl sm:text-2xl font-extrabold text-slate-950">
            Support Tickets
          </h1>
          <p className="text-xs sm:text-sm text-slate-500">
            Respond to customer tickets in real time, attach resolutions, and track message read receipts.
          </p>
        </div>
        <button
          type="button"
          onClick={loadTickets}
          className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-violet-200 bg-white px-4 text-xs font-bold text-violet-800"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      <div className="space-y-3 rounded-2xl border border-slate-200/80 bg-white p-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search Ticket ID, User ID, Order ID, Category, or Subject..."
            className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-xs sm:text-sm"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {(
            ['All', 'Open', 'In Progress', 'Waiting for Customer', 'Resolved', 'Closed'] as const
          ).map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setFilter(st)}
              className={`h-8 rounded-xl px-3 text-xs font-bold ${
                filter === st
                  ? 'bg-violet-700 text-white'
                  : 'border border-slate-200 bg-slate-50 text-slate-600'
              }`}
            >
              {st}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        {filtered.map((tkt) => (
          <div
            key={tkt.id}
            className="rounded-3xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-xs space-y-2.5"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-xs font-bold text-violet-700">{tkt.id}</span>
                <span className="rounded-md bg-violet-50 px-2 py-0.5 text-[10px] font-bold text-violet-700">
                  {tkt.category}
                </span>
                <span className="text-xs font-bold text-slate-900">{tkt.subject}</span>
                {tkt.orderReference && (
                  <span className="rounded-md bg-emerald-50 px-2 py-0.5 font-mono text-[10px] font-bold text-emerald-700">
                    {tkt.orderReference}
                  </span>
                )}
                <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase text-slate-600">
                  {tkt.priority}
                </span>
              </div>
              <StatusText status={tkt.status} />
            </div>

            <p className="text-xs sm:text-sm text-slate-700 leading-relaxed">{tkt.message}</p>

            {tkt.adminReply && (
              <div className="rounded-xl border border-violet-100 bg-violet-50/70 p-3 text-xs text-slate-700">
                <span className="font-bold text-violet-800">Latest Admin Reply: </span>
                {tkt.adminReply}
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[11px] text-slate-400">
              <span>
                User: <code className="font-mono">{tkt.userId}</code> · Created {tkt.createdAtLabel} ·
                Updated {tkt.updatedAtLabel}
              </span>
              <button
                type="button"
                onClick={() => openTicket(tkt)}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-violet-700 px-3 text-xs font-bold text-white hover:bg-violet-800"
              >
                <MessageSquareReply className="h-3.5 w-3.5" />
                <span>Open Thread &amp; Reply</span>
              </button>
            </div>
          </div>
        ))}

        {!loading && filtered.length === 0 && (
          <div className="rounded-3xl border border-dashed border-slate-200 bg-white p-10 text-center text-xs text-slate-400">
            No support tickets matched your filters.
          </div>
        )}
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl bg-white p-5 sm:p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h2 className="font-display text-lg font-bold text-slate-900">
                  Ticket #{selected.id}
                </h2>
                <p className="text-xs text-slate-500">
                  {selected.category} · {selected.subject} · User: {selected.userId}
                </p>
                {selected.orderReference && (
                  <p className="text-[11px] font-mono text-emerald-700 mt-0.5">
                    Order Ref: {selected.orderReference}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="flex h-8 w-8 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {isSafeAttachmentUrl(selected.attachmentUrl) && (
              <a
                href={selected.attachmentUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-violet-700 hover:bg-violet-50"
              >
                <Paperclip className="h-3.5 w-3.5" />
                <span>Open Customer Attachment</span>
                <ExternalLink className="h-3 w-3" />
              </a>
            )}

            <div className="mt-4 space-y-2.5">
              <div className="rounded-2xl bg-slate-50 p-3.5 text-xs text-slate-700">
                <p className="font-semibold text-slate-900 mb-1">Initial Customer Message:</p>
                <p className="leading-relaxed whitespace-pre-wrap">{selected.message}</p>
              </div>
              {threadReplies.map((rep) => (
                <div
                  key={rep.id}
                  className={`rounded-2xl p-3 text-xs ${
                    rep.senderRole === 'admin'
                      ? 'bg-violet-50/80 text-violet-950'
                      : 'bg-slate-50 text-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 mb-0.5">
                    <span className="font-semibold">
                      {rep.senderRole === 'admin' ? 'Support Team' : rep.senderName}
                    </span>
                    <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                      {rep.senderRole === 'admin' && rep.readAtLabel && (
                        <span className="inline-flex items-center gap-0.5 font-semibold text-emerald-600">
                          <CheckCheck className="h-3 w-3" />
                          <span>Seen</span>
                        </span>
                      )}
                      <span>{rep.createdAtLabel}</span>
                    </div>
                  </div>
                  <p className="leading-relaxed whitespace-pre-wrap">{rep.message}</p>
                </div>
              ))}
            </div>

            <form onSubmit={handleSaveReply} className="mt-4 space-y-3.5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Status</label>
                  <select
                    value={editStatus}
                    onChange={(e) =>
                      setEditStatus(e.target.value as SupportTicketStatusFirestore)
                    }
                    className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold"
                  >
                    <option value="Open">Open</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Waiting for Customer">Waiting for Customer</option>
                    <option value="Resolved">Resolved</option>
                    <option value="Closed">Closed</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Priority
                  </label>
                  <select
                    value={editPriority}
                    onChange={(e) =>
                      setEditPriority(e.target.value as AdminTicketItem['priority'])
                    }
                    className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm"
                  >
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Send Official Reply (Optional when only updating status)
                </label>
                <textarea
                  rows={4}
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder="Write your official support response..."
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSelected(null)}
                  className="h-10 rounded-xl border border-slate-200 px-4 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="h-10 rounded-xl bg-violet-700 px-5 text-xs font-bold text-white hover:bg-violet-800 disabled:opacity-60"
                >
                  {saving ? 'Sending...' : 'Save Reply & Status'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
