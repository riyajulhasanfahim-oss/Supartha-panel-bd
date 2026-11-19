import type { OrderRecord, OrderStatus } from '../types';

export interface OrderStatusMeta {
  label: string;
  bnDescription: string;
  isTerminal: boolean;
}

export function getOrderStatusMeta(status: OrderStatus | string): OrderStatusMeta {
  const normalized = status.trim().toLowerCase();
  switch (normalized) {
    case 'pending':
      return {
        label: 'Pending',
        bnDescription: 'অর্ডার গ্রহণ করা হয়েছে',
        isTerminal: false,
      };
    case 'processing':
      return {
        label: 'Processing',
        bnDescription: 'অর্ডার প্রসেস হচ্ছে',
        isTerminal: false,
      };
    case 'in progress':
    case 'in_progress':
      return {
        label: 'In Progress',
        bnDescription: 'অর্ডার চলমান রয়েছে',
        isTerminal: false,
      };
    case 'completed':
      return {
        label: 'Completed',
        bnDescription: 'অর্ডার সম্পন্ন হয়েছে',
        isTerminal: true,
      };
    case 'partial':
      return {
        label: 'Partial',
        bnDescription: 'আংশিক সম্পন্ন হয়েছে',
        isTerminal: true,
      };
    case 'canceled':
    case 'cancelled':
      return {
        label: 'Cancelled',
        bnDescription: 'অর্ডার বাতিল হয়েছে',
        isTerminal: true,
      };
    case 'failed':
      return {
        label: 'Failed',
        bnDescription: 'অর্ডার সম্পন্ন করা যায়নি',
        isTerminal: true,
      };
    default:
      return {
        label: status,
        bnDescription: 'অর্ডার আপডেট হচ্ছে',
        isTerminal: false,
      };
  }
}

export function calculateOrderProgress(order: Pick<OrderRecord, 'quantity' | 'remains' | 'status'>): {
  delivered: number;
  remains: number;
  percent: number;
} {
  const qty = Math.max(1, Number(order.quantity || 1));
  const norm = order.status.trim().toLowerCase();

  if (norm === 'completed') {
    return { delivered: qty, remains: 0, percent: 100 };
  }
  if (norm === 'cancelled' || norm === 'canceled' || norm === 'failed') {
    const remains = Math.min(qty, Math.max(0, Number(order.remains ?? qty)));
    return { delivered: Math.max(0, qty - remains), remains, percent: 0 };
  }

  const rawRemains =
    typeof order.remains === 'number' && Number.isFinite(order.remains)
      ? Math.max(0, Math.min(qty, order.remains))
      : qty;
  const delivered = Math.max(0, qty - rawRemains);
  let percent = Math.round((delivered / qty) * 100);

  if (percent === 0 && (norm === 'processing' || norm === 'in progress')) {
    percent = 12;
  }

  return { delivered, remains: rawRemains, percent: Math.min(100, Math.max(0, percent)) };
}
