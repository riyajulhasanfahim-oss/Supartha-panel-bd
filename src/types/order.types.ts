import type { PlatformId } from './service.types';

export type OrderStatus =
  | 'Pending'
  | 'Processing'
  | 'In Progress'
  | 'Completed'
  | 'Partial'
  | 'Canceled'
  | 'Cancelled'
  | 'Failed';

export interface OrderRecord {
  id: string;
  orderNumber: string;
  categoryId: PlatformId;
  serviceId: string;
  serviceName: string;
  link: string;
  quantity: number;
  charge: number;
  status: OrderStatus;
  startCount?: number;
  remains?: number;
  paymentStatus?: 'paid' | 'refunded';
  paymentTransactionId?: string;
  refunded?: boolean;
  refundTransactionId?: string;
  createdAtLabel: string;
  createdAtIso: string;
  updatedAtLabel?: string;
  updatedAtIso?: string;
  completedAtLabel?: string;
  lastCheckedAtLabel?: string;
}

export interface OrderStatsSummary {
  totalOrders: number;
  completedOrders: number;
  pendingOrders: number;
}

export interface CreateOrderInput {
  categoryId: PlatformId;
  serviceId: string;
  link: string;
  quantity: number;
  idempotencyKey?: string;
}
