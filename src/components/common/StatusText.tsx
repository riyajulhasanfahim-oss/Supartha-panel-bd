import React from 'react';
import { CheckCircle2, Clock, Loader2, AlertCircle, XCircle } from 'lucide-react';
import type { OrderStatus, TicketStatus } from '../../types';

interface StatusTextProps {
  status:
    | OrderStatus
    | TicketStatus
    | 'Approved'
    | 'Rejected'
    | 'Refunded'
    | 'Failed'
    | 'pending'
    | 'approved'
    | 'rejected'
    | 'cancelled'
    | 'failed';
}

export function StatusText({ status }: StatusTextProps) {
  const normalized = status.toLowerCase();

  switch (normalized) {
    case 'completed':
    case 'answered':
    case 'resolved':
    case 'approved':
      return (
        <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 whitespace-nowrap shrink-0 capitalize">
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />
          {status}
        </span>
      );
    case 'processing':
    case 'in progress':
    case 'open':
      return (
        <span className="inline-flex items-center gap-1.5 rounded-lg bg-violet-50 px-2.5 py-1 text-xs font-semibold text-violet-700 whitespace-nowrap shrink-0 capitalize">
          <Loader2 className="h-3.5 w-3.5 text-violet-600" aria-hidden="true" />
          {status}
        </span>
      );
    case 'pending':
    case 'waiting for customer':
      return (
        <span className="inline-flex items-center gap-1.5 rounded-lg bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700 whitespace-nowrap shrink-0 capitalize">
          <Clock className="h-3.5 w-3.5 text-amber-600" aria-hidden="true" />
          {status}
        </span>
      );
    case 'partial':
    case 'refunded':
      return (
        <span className="inline-flex items-center gap-1.5 rounded-lg bg-orange-50 px-2.5 py-1 text-xs font-semibold text-orange-700 whitespace-nowrap shrink-0 capitalize">
          <AlertCircle className="h-3.5 w-3.5 text-orange-600" aria-hidden="true" />
          {status}
        </span>
      );
    case 'closed':
      return (
        <span className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700 whitespace-nowrap shrink-0 capitalize">
          <CheckCircle2 className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />
          {status}
        </span>
      );
    case 'canceled':
    case 'cancelled':
    case 'rejected':
    case 'failed':
    default:
      return (
        <span className="inline-flex items-center gap-1.5 rounded-lg bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700 whitespace-nowrap shrink-0 capitalize">
          <XCircle className="h-3.5 w-3.5 text-rose-600" aria-hidden="true" />
          {status}
        </span>
      );
  }
}
