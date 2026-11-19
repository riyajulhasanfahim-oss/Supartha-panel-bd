import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  CheckCheck,
  ChevronRight,
  ExternalLink,
  HeadphonesIcon,
  MessageSquare,
  Paperclip,
  Send,
  ShieldCheck,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { supportService } from '../services/support.service';
import type {
  TicketCategory,
  TicketPriority,
  TicketReply,
  TicketStatus,
} from '../types';
import { StatusText } from '../components/common/StatusText';
import { toUserFriendlyFirebaseError } from '../lib/firestore/errors';

const CATEGORY_OPTIONS: TicketCategory[] = [
  'Order Issue',
  'Payment / Deposit',
  'Service Inquiry',
  'Account / General',
  'API / Reseller',
];

const PRIORITY_OPTIONS: TicketPriority[] = ['Low', 'Medium', 'High'];

type TicketStatusFilter =
  | 'All'
  | 'Open'
  | 'In Progress'
  | 'Waiting for Customer'
  | 'Resolved'
  | 'Closed';

const TICKET_STATUS_FILTERS: TicketStatusFilter[] = [
  'All',
  'Open',
  'In Progress',
  'Waiting for Customer',
  'Resolved',
  'Closed',
];

function isSafeAttachmentUrl(url?: string): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

export function SupportPage() {
  const {
    tickets,
    orders,
    submitDemoTicket,
    profile,
    showToast,
    isLoading,
    selectedTicketId,
    setSelectedTicketId,
    ticketDraftOrderRef,
    setTicketDraftOrderRef,
  } = useApp();

  const [category, setCategory] = useState<TicketCategory>('Order Issue');
  const [subject, setSubject] = useState('Order Issue');
  const [priority, setPriority] = useState<TicketPriority>('Medium');
  const [orderReference, setOrderReference] = useState('');
  const [attachmentUrl, setAttachmentUrl] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [statusFilter, setStatusFilter] = useState<TicketStatusFilter>('All');
  const [replies, setReplies] = useState<TicketReply[]>([]);
  const [loadingReplies, setLoadingReplies] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [sendingReply, setSendingReply] = useState(false);

  useEffect(() => {
    if (ticketDraftOrderRef) {
      setCategory('Order Issue');
      setSubject(`Order Support (${ticketDraftOrderRef})`);
      setOrderReference(ticketDraftOrderRef);
      setTicketDraftOrderRef('');
    }
  }, [setTicketDraftOrderRef, ticketDraftOrderRef]);

  const selectedTicket = useMemo(
    () => tickets.find((t) => t.id === selectedTicketId) ?? null,
    [selectedTicketId, tickets]
  );

  const filteredTickets = useMemo(() => {
    if (statusFilter === 'All') return tickets;
    return tickets.filter((t) => {
      if (statusFilter === 'Open') return t.status === 'Open' || t.status === 'Pending';
      if (statusFilter === 'Waiting for Customer') {
        return t.status === 'Waiting for Customer' || t.status === 'Answered';
      }
      return t.status === (statusFilter as TicketStatus);
    });
  }, [statusFilter, tickets]);

  useEffect(() => {
    if (!selectedTicket) {
      setReplies([]);
      setReplyText('');
      return;
    }

    setLoadingReplies(true);
    const unsub = supportService.subscribeMessages(
      selectedTicket.id,
      (list) => {
        setReplies(list);
        setLoadingReplies(false);
        supportService.markMessagesRead(selectedTicket.id, 'user').catch(() => undefined);
      },
      () => {
        setLoadingReplies(false);
      }
    );

    return () => {
      unsub();
    };
  }, [selectedTicket?.id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;
    setSubmitting(true);
    try {
      await submitDemoTicket({
        category,
        subject: subject.trim() || category,
        priority,
        orderReference: orderReference.trim() || undefined,
        attachmentUrl: attachmentUrl.trim() || undefined,
        message: message.trim(),
      });
      setOrderReference('');
      setAttachmentUrl('');
      setMessage('');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSendCustomerReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicket || !replyText.trim()) return;
    setSendingReply(true);
    try {
      const created = await supportService.addReply(
        selectedTicket.id,
        replyText.trim(),
        profile?.fullName ?? 'Customer',
        'user'
      );
      setReplies((prev) =>
        prev.some((r) => r.id === created.id) ? prev : [...prev, created]
      );
      setReplyText('');
      showToast({
        title: 'Reply Sent',
        description: 'Your follow-up reply was delivered to our support team.',
        tone: 'success',
      });
    } catch (error) {
      showToast({
        title: 'Reply Failed',
        description: toUserFriendlyFirebaseError(error),
        tone: 'error',
      });
    } finally {
      setSendingReply(false);
    }
  };

  // Ticket Detail Live Conversation View
  if (selectedTicket) {
    const hasSubcollectionAdminReply = replies.some((r) => r.senderRole === 'admin');
    const validAttachment = isSafeAttachmentUrl(selectedTicket.attachmentUrl);

    return (
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setSelectedTicketId(null)}
            className="inline-flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-xs sm:text-sm font-bold text-slate-800 hover:border-violet-200 hover:text-violet-800"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            <span>Back to All Tickets</span>
          </button>

          <StatusText status={selectedTicket.status} />
        </div>

        <div className="rounded-3xl border border-violet-100 bg-white p-5 sm:p-6 shadow-xs space-y-5">
          <div className="border-b border-slate-100 pb-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs font-bold text-violet-700">
                {selectedTicket.ticketNumber}
              </span>
              {selectedTicket.category && (
                <span className="rounded-md bg-violet-50 px-2 py-0.5 text-[10px] font-bold uppercase text-violet-700">
                  {selectedTicket.category}
                </span>
              )}
              {selectedTicket.priority && (
                <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase text-slate-600">
                  {selectedTicket.priority} Priority
                </span>
              )}
              {selectedTicket.orderReference && (
                <span className="rounded-md bg-emerald-50 px-2 py-0.5 font-mono text-[10px] font-semibold text-emerald-700">
                  Order {selectedTicket.orderReference}
                </span>
              )}
            </div>
            <h1 className="mt-1.5 font-display text-lg sm:text-xl font-extrabold text-slate-950">
              {selectedTicket.subject}
            </h1>
            <p className="mt-0.5 text-xs text-slate-400">
              Opened {selectedTicket.createdAtLabel ?? 'Recently'} · Last updated{' '}
              {selectedTicket.updatedAtLabel}
            </p>
            {validAttachment && (
              <a
                href={selectedTicket.attachmentUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-violet-700 hover:bg-violet-50"
              >
                <Paperclip className="h-3.5 w-3.5" />
                <span>View Attachment Screenshot</span>
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>

          {/* Live Chronological Thread */}
          <div className="space-y-3">
            {/* Initial Message */}
            <div className="rounded-2xl border border-slate-200/80 bg-slate-50 p-4">
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="font-bold text-slate-900">
                  {profile?.fullName ?? 'You'} (Customer)
                </span>
                <span className="text-[11px] text-slate-400">
                  {selectedTicket.createdAtLabel ?? selectedTicket.updatedAtLabel}
                </span>
              </div>
              <p className="mt-2 text-xs sm:text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
                {selectedTicket.message}
              </p>
            </div>

            {/* Legacy single adminReply fallback */}
            {!hasSubcollectionAdminReply && selectedTicket.adminReply && (
              <div className="rounded-2xl border border-violet-200 bg-violet-50/70 p-4">
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="font-bold text-violet-900">Support Team (Admin)</span>
                  <span className="text-[11px] text-violet-500">{selectedTicket.updatedAtLabel}</span>
                </div>
                <p className="mt-2 text-xs sm:text-sm text-slate-800 leading-relaxed whitespace-pre-wrap">
                  {selectedTicket.adminReply}
                </p>
              </div>
            )}

            {/* Real-time Messages Subcollection */}
            {loadingReplies ? (
              <div className="h-16 rounded-2xl bg-slate-100 animate-pulse" />
            ) : (
              replies.map((rep) => {
                const isAdmin = rep.senderRole === 'admin';
                return (
                  <div
                    key={rep.id}
                    className={`rounded-2xl border p-4 ${
                      isAdmin
                        ? 'border-violet-200 bg-violet-50/70'
                        : 'border-slate-200/80 bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span
                        className={`font-bold ${isAdmin ? 'text-violet-900' : 'text-slate-900'}`}
                      >
                        {isAdmin ? `${rep.senderName} (Admin)` : `${rep.senderName} (Customer)`}
                      </span>
                      <div className="flex items-center gap-2 text-[11px] text-slate-400">
                        {!isAdmin && rep.readAtLabel && (
                          <span className="inline-flex items-center gap-0.5 font-semibold text-emerald-600">
                            <CheckCheck className="h-3.5 w-3.5" />
                            <span>Seen</span>
                          </span>
                        )}
                        <span>{rep.createdAtLabel}</span>
                      </div>
                    </div>
                    <p className="mt-2 text-xs sm:text-sm text-slate-800 leading-relaxed whitespace-pre-wrap">
                      {rep.message}
                    </p>
                  </div>
                );
              })
            )}
          </div>

          {/* Follow-up Reply Box */}
          {selectedTicket.status === 'Closed' ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3.5 text-center text-xs font-semibold text-slate-500">
              This ticket is closed. Open a new ticket if you need further assistance.
            </div>
          ) : (
            <form onSubmit={handleSendCustomerReply} className="space-y-3 border-t border-slate-100 pt-4">
              <label
                htmlFor="customer-ticket-reply"
                className="block text-xs font-semibold text-slate-700"
              >
                Send Follow-up Reply
              </label>
              <textarea
                id="customer-ticket-reply"
                rows={3}
                required
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                placeholder="Write a reply to the support team..."
                className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-violet-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-violet-500/20"
              />
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={sendingReply}
                  className="inline-flex h-11 items-center gap-2 rounded-xl bg-violet-700 px-5 text-xs sm:text-sm font-bold text-white shadow-sm hover:bg-violet-800 disabled:opacity-60"
                >
                  <Send className="h-4 w-4" aria-hidden="true" />
                  <span>{sendingReply ? 'Sending...' : 'Send Reply'}</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-xl sm:text-2xl font-extrabold text-slate-950">
          Support Desk
        </h1>
        <p className="mt-0.5 text-xs sm:text-sm text-slate-500">
          Open a ticket for order tracking, refill requests, payment verification, or technical help.
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-12">
        {/* New Ticket Form */}
        <form
          onSubmit={handleSubmit}
          className="lg:col-span-6 rounded-3xl border border-violet-100 bg-white p-5 sm:p-6 shadow-xs space-y-4"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-50 text-violet-700">
                <HeadphonesIcon className="h-5 w-5" aria-hidden="true" />
              </span>
              <h2 className="font-display text-base sm:text-lg font-bold text-slate-900">
                Open New Ticket
              </h2>
            </div>
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700">
              <ShieldCheck className="h-4 w-4 text-emerald-600" aria-hidden="true" />
              24/7 Desk
            </span>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label
                htmlFor="ticket-category"
                className="block text-xs font-semibold text-slate-700 mb-1.5"
              >
                Category
              </label>
              <select
                id="ticket-category"
                value={category}
                onChange={(e) => {
                  const val = e.target.value as TicketCategory;
                  setCategory(val);
                  if (!subject.trim() || CATEGORY_OPTIONS.includes(subject as TicketCategory)) {
                    setSubject(val);
                  }
                }}
                className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-sm font-medium text-slate-900 focus:border-violet-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-violet-500/20"
              >
                {CATEGORY_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="ticket-priority"
                className="block text-xs font-semibold text-slate-700 mb-1.5"
              >
                Priority
              </label>
              <select
                id="ticket-priority"
                value={priority}
                onChange={(e) => setPriority(e.target.value as TicketPriority)}
                className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-sm font-medium text-slate-900 focus:border-violet-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-violet-500/20"
              >
                {PRIORITY_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label
              htmlFor="ticket-subject"
              className="block text-xs font-semibold text-slate-700 mb-1.5"
            >
              Subject
            </label>
            <input
              id="ticket-subject"
              type="text"
              required
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Briefly summarize your issue..."
              className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-violet-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-violet-500/20"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label
                htmlFor="ticket-order"
                className="block text-xs font-semibold text-slate-700 mb-1.5"
              >
                Order ID (Optional)
              </label>
              <input
                id="ticket-order"
                type="text"
                list="recent-order-ids"
                value={orderReference}
                onChange={(e) => setOrderReference(e.target.value)}
                placeholder="#10257"
                className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-violet-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-violet-500/20"
              />
              {orders.length > 0 && (
                <datalist id="recent-order-ids">
                  {orders.slice(0, 15).map((ord) => (
                    <option key={ord.id} value={`#${ord.orderNumber}`}>
                      {ord.serviceName}
                    </option>
                  ))}
                </datalist>
              )}
            </div>

            <div>
              <label
                htmlFor="ticket-attachment"
                className="block text-xs font-semibold text-slate-700 mb-1.5"
              >
                Screenshot Link (Optional)
              </label>
              <input
                id="ticket-attachment"
                type="url"
                value={attachmentUrl}
                onChange={(e) => setAttachmentUrl(e.target.value)}
                placeholder="https://..."
                className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-violet-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-violet-500/20"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="ticket-message"
              className="block text-xs font-semibold text-slate-700 mb-1.5"
            >
              Message
            </label>
            <textarea
              id="ticket-message"
              required
              rows={4}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Describe how our team can assist you..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-violet-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-violet-500/20"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-violet-700 px-5 text-sm font-bold text-white shadow-sm hover:bg-violet-800 disabled:opacity-60"
          >
            <Send className="h-4 w-4" aria-hidden="true" />
            <span>{submitting ? 'Submitting...' : 'Submit Ticket'}</span>
          </button>
        </form>

        {/* Ticket List */}
        <div className="lg:col-span-6 rounded-3xl border border-slate-200/80 bg-white shadow-xs overflow-hidden flex flex-col">
          <div className="border-b border-slate-100 px-5 py-4 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-base font-bold text-slate-900">Your Tickets</h2>
              <span className="text-xs font-medium text-slate-500 tabular-nums">
                {filteredTickets.length} shown
              </span>
            </div>

            <div className="flex items-center gap-1 overflow-x-auto no-scrollbar rounded-xl bg-slate-50 p-1">
              {TICKET_STATUS_FILTERS.map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setStatusFilter(st)}
                  className={`h-8 rounded-lg px-2.5 text-[11px] font-semibold whitespace-nowrap shrink-0 transition-colors ${
                    statusFilter === st
                      ? 'bg-violet-700 text-white shadow-xs'
                      : 'text-slate-600 hover:bg-violet-50 hover:text-violet-800'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>

          {isLoading ? (
            <div className="space-y-2 p-4">
              <div className="h-20 rounded-xl bg-slate-100 animate-pulse" />
              <div className="h-20 rounded-xl bg-slate-100 animate-pulse" />
            </div>
          ) : filteredTickets.length === 0 ? (
            <div className="p-8 text-center">
              <MessageSquare className="mx-auto h-7 w-7 text-slate-300" aria-hidden="true" />
              <p className="mt-2 text-sm font-semibold text-slate-800">
                {tickets.length === 0 ? 'No support tickets yet' : 'No matching tickets'}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Submit a ticket on the left and track real-time replies here.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {filteredTickets.map((ticket) => (
                <button
                  key={ticket.id}
                  type="button"
                  onClick={() => setSelectedTicketId(ticket.id)}
                  className="w-full p-4 sm:p-5 text-left transition-colors hover:bg-violet-50/40"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                      <span className="font-mono text-xs font-bold text-violet-700">
                        {ticket.ticketNumber}
                      </span>
                      {ticket.category && (
                        <span className="rounded bg-violet-50 px-1.5 py-0.5 text-[10px] font-bold text-violet-700">
                          {ticket.category}
                        </span>
                      )}
                      {ticket.priority && (
                        <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-slate-600">
                          {ticket.priority}
                        </span>
                      )}
                      {ticket.orderReference && (
                        <span className="text-[11px] font-mono text-emerald-700">
                          {ticket.orderReference}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusText status={ticket.status} />
                      <ChevronRight className="h-4 w-4 text-slate-400" aria-hidden="true" />
                    </div>
                  </div>
                  <p className="mt-1.5 text-xs sm:text-sm font-bold text-slate-900">
                    {ticket.subject}
                  </p>
                  <p className="mt-1 line-clamp-2 text-xs text-slate-600 leading-relaxed">
                    {ticket.message}
                  </p>
                  {ticket.adminReply && (
                    <div className="mt-2.5 rounded-xl border border-violet-100 bg-violet-50/70 p-2.5 text-xs text-slate-700 line-clamp-2">
                      <span className="font-bold text-violet-800">Latest Reply: </span>
                      {ticket.adminReply}
                    </div>
                  )}
                  <p className="mt-2 text-[11px] text-slate-400">
                    Updated {ticket.updatedAtLabel} · Tap to open live conversation
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
