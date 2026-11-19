import {
  Timestamp,
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import {
  createAuthUserOnSecondaryApp,
  getFirebaseServices,
  testFirestoreConnection,
} from '../lib/firebase/client';
import {
  getActiveFirebaseTargetPayload,
  hasValidFirebaseConfig,
  resolveActiveFirebaseConfig,
} from '../lib/firebase/configManager';
import {
  FIRESTORE_COLLECTIONS,
  type AdminNotificationTypeFirestore,
  type AdminStaffRole,
  type AuditLogTargetType,
  type FirestoreAdminNotificationDoc,
  type FirestoreAdminUserDoc,
  type FirestoreApiProviderDoc,
  type FirestoreAuditLogDoc,
  type FirestoreCategoryDoc,
  type FirestoreNotificationDoc,
  type FirestoreOrderDoc,
  type FirestorePaymentDoc,
  type FirestorePaymentMethodDoc,
  type FirestoreServiceDoc,
  type FirestoreSupportTicketDoc,
  type FirestoreTicketReplyDoc,
  type FirestoreTransactionDoc,
  type FirestoreUserDoc,
  type NotificationTypeFirestore,
  type OrderStatusFirestore,
  type PaymentStatusFirestore,
  type SupportTicketStatusFirestore,
  type TransactionTypeFirestore,
} from '../lib/firestore/collections';
import { DEFAULT_PAYMENT_METHODS_SEED, inspectSetupState } from '../lib/firestore/initializer';
import { OperationType, handleFirestoreError } from '../lib/firestore/errors';
import { APP_CONFIG } from '../config/app.config';
import { PRODUCT_INFO } from '../config/product.config';
import type { ServiceType } from '../types/service.types';
import { adminService } from './admin.service';
import { invalidatePublicCatalogCache } from './firebaseDataClient';
import {
  getProviderAdapter,
  resolveCategoryForImportedService,
  type ProviderServiceDTO,
} from './providerAdapter';
import { userManagementService, type ManagedUserRecord } from './userManagement.service';
import {
  DEFAULT_USD_TO_BDT_RATE,
  calculateProviderServicePricing,
  hasCorruptedCurrencySymbol,
  isPackageService,
  normalizeCurrencySymbol,
  type ProviderRateCurrency,
} from '../utils/pricing';

async function getCurrencySymbol(): Promise<string> {
  const services = getFirebaseServices();
  if (!services) return APP_CONFIG.currencySymbol;
  try {
    const snap = await getDoc(doc(services.db, FIRESTORE_COLLECTIONS.settings, 'system'));
    if (snap.exists()) {
      const data = snap.data() as { currencySymbol?: string; currency?: string };
      return normalizeCurrencySymbol(data.currencySymbol, data.currency);
    }
  } catch {
    // fallback
  }
  return APP_CONFIG.currencySymbol;
}

export interface AdminStaffMember {
  uid: string;
  name: string;
  email: string;
  role: AdminStaffRole;
  status: 'active' | 'revoked';
  createdAtLabel: string;
  updatedAtLabel: string;
}

export interface SystemHealthCheckItem {
  id: string;
  label: string;
  ok: boolean;
  statusLabel: string;
  detail: string;
}

export interface SystemHealthReport {
  checkedAtLabel: string;
  overallOk: boolean;
  checks: SystemHealthCheckItem[];
}

export interface SafeConfigurationBackup {
  exportedAt: string;
  product: {
    name: string;
    version: string;
    schemaVersion: string;
    installationId: string;
  };
  settings: Record<string, unknown> | null;
  categories: Array<Record<string, unknown>>;
  services: Array<Record<string, unknown>>;
  paymentMethods: Array<Record<string, unknown>>;
  providersRedacted: Array<{
    id: string;
    name: string;
    apiUrl: string;
    apiKey: string;
    providerFormat: string;
    status: string;
  }>;
}

export interface AdminCategoryItem {
  id: string;
  name: string;
  icon: string;
  description: string;
  status: 'active' | 'inactive';
  sortOrder: number;
}

export interface AdminServiceItem {
  id: string;
  categoryId: string;
  name: string;
  serviceType: ServiceType;
  description: string;
  providerId: string;
  providerServiceId: string;
  costPrice: number;
  sellingPrice: number;
  minQuantity: number;
  maxQuantity: number;
  averageTime: string;
  deliverySpeed: string;
  refillGuaranteed: boolean;
  status: 'active' | 'inactive';
  createdAtLabel: string;
  updatedAtLabel: string;
}

export interface ExistingServiceUpdatePreviewItem {
  serviceId: string;
  providerServiceId: string;
  name: string;
  isPackage: boolean;
  oldCostPrice: number;
  newCostPrice: number;
  oldSellingPrice: number;
  newSellingPrice: number;
  minQuantity: number;
  maxQuantity: number;
  refillGuaranteed: boolean;
  deliverySpeed: string;
  priceChanged: boolean;
}

export interface UnavailableProviderServiceItem {
  serviceId: string;
  providerServiceId: string;
  name: string;
  status: 'active' | 'inactive';
}

export interface ExistingServicesUpdatePlan {
  providerId: string;
  providerCurrency: ProviderRateCurrency;
  exchangeRateUsdToBdt: number;
  profitPerThousand: number;
  updates: ExistingServiceUpdatePreviewItem[];
  unchangedCount: number;
  newAvailableCount: number;
  unavailableServices: UnavailableProviderServiceItem[];
  corruptedSymbolToRepair: { from: string; to: string } | null;
}

export interface ApplyExistingServicesUpdateResult {
  updatedCount: number;
  unchangedCount: number;
  newAvailableCount: number;
  unavailableCount: number;
  repairedCurrencySymbol: string | null;
}

export interface AdminOrderItem {
  id: string;
  userId: string;
  serviceId: string;
  serviceName: string;
  categoryId: string;
  providerId: string;
  providerOrderId: string;
  providerCharge?: number;
  link: string;
  quantity: number;
  charge: number;
  status: OrderStatusFirestore;
  remains: number;
  startCount: number;
  paymentStatus?: 'paid' | 'refunded';
  paymentTransactionId?: string;
  refunded: boolean;
  refundEligible: boolean;
  refundTransactionId?: string;
  lastCheckedAtLabel?: string;
  completedAtLabel?: string;
  retryCount: number;
  lastAttemptAtLabel?: string;
  lastError?: string;
  nextRetryAtLabel?: string;
  nextRetryAtMs: number;
  internalNote?: string;
  createdAtLabel: string;
  createdAtMs: number;
  updatedAtLabel: string;
  updatedAtMs: number;
}

export interface AdminPaymentItem {
  id: string;
  paymentId: string;
  userId: string;
  userName: string;
  amount: number;
  method: string;
  transactionId: string;
  status: PaymentStatusFirestore;
  adminNote: string;
  reviewedBy: string;
  reviewedAtLabel: string;
  reviewedAtMs: number;
  createdAtLabel: string;
  createdAtMs: number;
}

export interface AdminPaymentMethodItem {
  id: string;
  name: string;
  type: string;
  accountNumber: string;
  instructions: string;
  note: string;
  minAmount: number;
  maxAmount: number;
  status: 'active' | 'inactive';
  displayOrder: number;
  createdAtLabel: string;
  updatedAtLabel: string;
}

export interface AdminTransactionItem {
  id: string;
  transactionId: string;
  userId: string;
  type: TransactionTypeFirestore;
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  reference: string;
  referenceId: string;
  description: string;
  reason: string;
  createdBy: string;
  adminId: string;
  createdAtLabel: string;
}

export interface AdminApiProviderItem {
  id: string;
  name: string;
  apiUrl: string;
  apiKey: string;
  providerFormat: string;
  lastBalance?: number;
  lastBalanceCurrency?: string;
  status: 'active' | 'inactive';
  createdAtLabel: string;
  updatedAtLabel: string;
}

export interface AdminTicketItem {
  id: string;
  userId: string;
  category: string;
  subject: string;
  orderReference: string;
  attachmentUrl?: string;
  message: string;
  adminReply: string;
  repliedBy: string;
  status: SupportTicketStatusFirestore;
  priority: 'Low' | 'Medium' | 'High';
  createdAtLabel: string;
  updatedAtLabel: string;
}

export interface AdminNotificationItem {
  id: string;
  userId: string;
  targetType: 'user' | 'all';
  title: string;
  message: string;
  type: NotificationTypeFirestore;
  referenceId?: string;
  read: boolean;
  createdAtLabel: string;
}

export interface AdminSystemAlertItem {
  id: string;
  type: AdminNotificationTypeFirestore;
  title: string;
  message: string;
  referenceId?: string;
  actorUid?: string;
  read: boolean;
  createdAtLabel: string;
  createdAtMs: number;
}

export interface AdminAuditLogItem {
  id: string;
  action: string;
  adminId: string;
  targetId: string;
  targetType: AuditLogTargetType;
  previousValue: string;
  newValue: string;
  note?: string;
  timestampLabel: string;
  timestampMs: number;
}

export interface AdminDashboardSnapshot {
  totalUsers: number;
  activeUsers: number;
  suspendedUsers: number;
  totalOrders: number;
  pendingOrders: number;
  completedOrders: number;
  totalRevenue: number;
  totalBalance: number;
  totalDeposits: number;
  approvedTodayCount: number;
  approvedTodayAmount: number;
  rejectedPaymentsCount: number;
  recentOrders: AdminOrderItem[];
  recentUsers: ManagedUserRecord[];
  recentTransactions: AdminTransactionItem[];
  openTicketsCount: number;
  pendingPaymentsCount: number;
}

function formatTs(ts: unknown): string {
  try {
    if (ts && typeof ts === 'object' && 'toDate' in ts) {
      return (ts as Timestamp).toDate().toLocaleString('en-US', {
        month: 'short',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      });
    }
  } catch {
    // fallback
  }
  return '—';
}

function toTsMs(ts: unknown): number {
  try {
    if (ts && typeof ts === 'object' && 'toDate' in ts) {
      return (ts as Timestamp).toDate().getTime();
    }
  } catch {
    // fallback
  }
  return 0;
}

export function isPaymentPendingStatus(status: PaymentStatusFirestore): boolean {
  return status === 'pending' || status === 'Pending';
}

export function isPaymentApprovedStatus(status: PaymentStatusFirestore): boolean {
  return status === 'approved' || status === 'Approved' || status === 'Completed';
}

export function isPaymentRejectedStatus(status: PaymentStatusFirestore): boolean {
  return status === 'rejected' || status === 'Rejected' || status === 'Failed';
}

export function isPaymentCancelledStatus(status: PaymentStatusFirestore): boolean {
  return status === 'cancelled';
}

function toSafeId(prefix: string, raw?: string): string {
  const cleaned = (raw ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
  if (cleaned.length >= 2) return cleaned;
  return `${prefix}-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;
}

const RETRY_BACKOFF_MINUTES = [2, 5, 15, 30, 60];

function computeLocalRetrySchedule(currentRetryCount: number): {
  retryCount: number;
  backoffMinutes: number;
  nextRetryAtMs: number;
} {
  const nextCount = Math.min(20, Math.max(1, currentRetryCount + 1));
  const idx = Math.min(RETRY_BACKOFF_MINUTES.length - 1, nextCount - 1);
  const backoffMinutes = RETRY_BACKOFF_MINUTES[idx];
  return {
    retryCount: nextCount,
    backoffMinutes,
    nextRetryAtMs: Date.now() + backoffMinutes * 60 * 1000,
  };
}

export const adminPanelService = {
  // ---------------------------------------------------------------------------
  // 0. Audit Logging & Admin Alerts Helpers
  // ---------------------------------------------------------------------------
  async logAuditEvent(input: {
    action: string;
    adminId: string;
    targetId: string;
    targetType: AuditLogTargetType;
    previousValue: string;
    newValue: string;
    note?: string;
  }): Promise<void> {
    const services = getFirebaseServices();
    const actingAdminUid = services?.auth.currentUser?.uid || input.adminId;
    if (!services || !actingAdminUid) return;

    const logId = `aud-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;
    const payload: FirestoreAuditLogDoc = {
      id: logId,
      action: input.action.trim().slice(0, 64),
      adminId: actingAdminUid,
      targetId: input.targetId.trim().slice(0, 128),
      targetType: input.targetType,
      previousValue: String(input.previousValue ?? '').slice(0, 500),
      newValue: String(input.newValue ?? '').slice(0, 500),
      ...(input.note?.trim() ? { note: input.note.trim().slice(0, 300) } : {}),
      timestamp: serverTimestamp(),
    };

    await setDoc(doc(services.db, FIRESTORE_COLLECTIONS.auditLogs, logId), payload).catch(
      () => undefined
    );
  },

  async createAdminNotification(input: {
    type: AdminNotificationTypeFirestore;
    title: string;
    message: string;
    referenceId?: string;
  }): Promise<void> {
    const services = getFirebaseServices();
    const uid = services?.auth.currentUser?.uid;
    if (!services || !uid) return;

    const notifId = `adm-${input.type}-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;
    const payload: FirestoreAdminNotificationDoc = {
      id: notifId,
      type: input.type,
      title: input.title.trim().slice(0, 120),
      message: input.message.trim().slice(0, 500),
      ...(input.referenceId ? { referenceId: input.referenceId.trim().slice(0, 128) } : {}),
      actorUid: uid,
      read: false,
      createdAt: serverTimestamp(),
    };

    await setDoc(doc(services.db, FIRESTORE_COLLECTIONS.adminNotifications, notifId), payload).catch(
      () => undefined
    );
  },

  async listAuditLogsAdmin(limitCount = 80): Promise<AdminAuditLogItem[]> {
    const services = getFirebaseServices();
    if (!services) return [];
    try {
      const q = query(
        collection(services.db, FIRESTORE_COLLECTIONS.auditLogs),
        orderBy('timestamp', 'desc'),
        limit(limitCount)
      );
      const snap = await getDocs(q);
      return snap.docs.map((d) => {
        const data = d.data() as FirestoreAuditLogDoc;
        return {
          id: data.id,
          action: data.action,
          adminId: data.adminId,
          targetId: data.targetId,
          targetType: data.targetType,
          previousValue: data.previousValue,
          newValue: data.newValue,
          note: data.note,
          timestampLabel: formatTs(data.timestamp),
          timestampMs: toTsMs(data.timestamp),
        };
      });
    } catch (error) {
      handleFirestoreError(
        error,
        OperationType.LIST,
        FIRESTORE_COLLECTIONS.auditLogs,
        services.auth
      );
    }
  },

  async listAdminNotifications(limitCount = 60): Promise<AdminSystemAlertItem[]> {
    const services = getFirebaseServices();
    if (!services) return [];
    try {
      const q = query(
        collection(services.db, FIRESTORE_COLLECTIONS.adminNotifications),
        orderBy('createdAt', 'desc'),
        limit(limitCount)
      );
      const snap = await getDocs(q);
      return snap.docs.map((d) => {
        const data = d.data() as FirestoreAdminNotificationDoc;
        return {
          id: data.id,
          type: data.type,
          title: data.title,
          message: data.message,
          referenceId: data.referenceId,
          actorUid: data.actorUid,
          read: Boolean(data.read),
          createdAtLabel: formatTs(data.createdAt),
          createdAtMs: toTsMs(data.createdAt),
        };
      });
    } catch (error) {
      handleFirestoreError(
        error,
        OperationType.LIST,
        FIRESTORE_COLLECTIONS.adminNotifications,
        services.auth
      );
    }
  },

  async markAdminNotificationRead(notifId: string): Promise<void> {
    const services = getFirebaseServices();
    if (!services) return;
    await updateDoc(doc(services.db, FIRESTORE_COLLECTIONS.adminNotifications, notifId), {
      read: true,
    }).catch(() => undefined);
  },

  async markAllAdminNotificationsRead(items: AdminSystemAlertItem[]): Promise<void> {
    const services = getFirebaseServices();
    if (!services) return;
    const unread = items.filter((item) => !item.read);
    await Promise.all(
      unread.map((item) =>
        updateDoc(doc(services.db, FIRESTORE_COLLECTIONS.adminNotifications, item.id), {
          read: true,
        }).catch(() => undefined)
      )
    );
  },

  // ---------------------------------------------------------------------------
  // 1. Dashboard Overview Aggregation
  // ---------------------------------------------------------------------------
  async getDashboardSnapshot(): Promise<AdminDashboardSnapshot> {
    const [users, orders, transactions, payments, tickets] = await Promise.all([
      userManagementService.listAllUsers().catch(() => []),
      this.listOrdersAdmin(100).catch(() => []),
      this.listTransactionsAdmin().catch(() => []),
      this.listPaymentsAdmin().catch(() => []),
      this.listTicketsAdmin().catch(() => []),
    ]);

    const activeUsers = users.filter((u) => u.status === 'active').length;
    const suspendedUsers = users.filter((u) => u.status === 'suspended').length;
    const totalBalance = Number(
      users.reduce((sum, u) => sum + Number(u.balance || 0), 0).toFixed(2)
    );

    const pendingOrders = orders.filter(
      (o) => o.status === 'Pending' || o.status === 'Processing' || o.status === 'In Progress'
    ).length;
    const completedOrders = orders.filter((o) => o.status === 'Completed').length;
    const totalRevenue = Number(
      orders
        .filter(
          (o) =>
            !o.refunded &&
            o.status !== 'Canceled' &&
            o.status !== 'Cancelled' &&
            o.status !== 'Failed'
        )
        .reduce((sum, o) => sum + Number(o.charge || 0), 0)
        .toFixed(2)
    );

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const startOfTodayMs = startOfToday.getTime();

    const approvedPayments = payments.filter((p) => isPaymentApprovedStatus(p.status));
    const approvedToday = approvedPayments.filter(
      (p) => (p.reviewedAtMs || p.createdAtMs) >= startOfTodayMs
    );
    const totalDeposits = Number(
      approvedPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0).toFixed(2)
    );
    const approvedTodayAmount = Number(
      approvedToday.reduce((sum, p) => sum + Number(p.amount || 0), 0).toFixed(2)
    );

    return {
      totalUsers: users.length,
      activeUsers,
      suspendedUsers,
      totalOrders: orders.length,
      pendingOrders,
      completedOrders,
      totalRevenue,
      totalBalance,
      totalDeposits,
      approvedTodayCount: approvedToday.length,
      approvedTodayAmount,
      rejectedPaymentsCount: payments.filter((p) => isPaymentRejectedStatus(p.status)).length,
      recentOrders: orders.slice(0, 6),
      recentUsers: users.slice(0, 6),
      recentTransactions: transactions.slice(0, 6),
      openTicketsCount: tickets.filter(
        (t) => t.status === 'Open' || t.status === 'Pending' || t.status === 'In Progress'
      ).length,
      pendingPaymentsCount: payments.filter((p) => isPaymentPendingStatus(p.status)).length,
    };
  },

  // ---------------------------------------------------------------------------
  // 2. Categories Management
  // ---------------------------------------------------------------------------
  async listCategories(): Promise<AdminCategoryItem[]> {
    const services = getFirebaseServices();
    if (!services) return [];
    try {
      const q = query(
        collection(services.db, FIRESTORE_COLLECTIONS.categories),
        orderBy('sortOrder', 'asc')
      );
      const snap = await getDocs(q);
      const items: AdminCategoryItem[] = snap.docs.map((d) => {
        const data = d.data() as FirestoreCategoryDoc;
        return {
          id: data.id,
          name: data.name,
          icon: data.icon,
          description: data.description ?? '',
          status: data.status,
          sortOrder: Number(data.sortOrder ?? 0),
        };
      });

      let deletedBuiltIns = new Set<string>();
      try {
        const raw = localStorage.getItem('rj_deleted_builtin_categories');
        const parsed = raw ? (JSON.parse(raw) as unknown) : [];
        if (Array.isArray(parsed)) {
          deletedBuiltIns = new Set(parsed.filter((x) => typeof x === 'string'));
        }
      } catch {
        // ignore storage access issues
      }

      const hasLinkedIn = items.some(
        (c) => c.id.toLowerCase().includes('linkedin') || c.name.toLowerCase().includes('linkedin')
      );
      const hasWebTraffic = items.some((c) => {
        const cid = c.id.toLowerCase();
        const cname = c.name.toLowerCase();
        return cid.includes('traffic') || cname.includes('traffic');
      });

      const missingDefaults: FirestoreCategoryDoc[] = [];
      if (!hasLinkedIn && !deletedBuiltIns.has('linkedin')) {
        missingDefaults.push({
          id: 'linkedin',
          name: 'LinkedIn',
          icon: 'linkedin',
          description: 'Profile followers, connections, company page growth, and post engagement.',
          status: 'active',
          sortOrder: Math.max(7, items.length + 1),
        });
      }
      if (!hasWebTraffic && !deletedBuiltIns.has('webtraffic')) {
        missingDefaults.push({
          id: 'webtraffic',
          name: 'Web Traffic',
          icon: 'webtraffic',
          description: 'Targeted website visitors, organic search traffic, and geo-targeted hits.',
          status: 'active',
          sortOrder: Math.max(8, items.length + missingDefaults.length + 1),
        });
      }

      if (missingDefaults.length > 0 && services.auth.currentUser) {
        for (const def of missingDefaults) {
          try {
            await setDoc(doc(services.db, FIRESTORE_COLLECTIONS.categories, def.id), def);
            items.push({
              id: def.id,
              name: def.name,
              icon: def.icon,
              description: def.description ?? '',
              status: def.status,
              sortOrder: def.sortOrder,
            });
          } catch {
            // Non-manager roles (e.g. support_staff) cannot write categories; skip silently
          }
        }
        items.sort((a, b) => a.sortOrder - b.sortOrder);
      }

      return items;
    } catch (error) {
      handleFirestoreError(
        error,
        OperationType.LIST,
        FIRESTORE_COLLECTIONS.categories,
        services.auth
      );
    }
  },

  async saveCategory(input: {
    id?: string;
    name: string;
    icon: string;
    description?: string;
    status: 'active' | 'inactive';
    sortOrder: number;
  }): Promise<string> {
    const services = getFirebaseServices();
    if (!services) throw new Error('Firebase is not connected.');
    const catId = input.id ? toSafeId('cat', input.id) : toSafeId('cat', input.name);

    const payload: FirestoreCategoryDoc = {
      id: catId,
      name: input.name.trim(),
      icon: input.icon.trim() || 'more',
      ...(input.description?.trim() ? { description: input.description.trim() } : {}),
      status: input.status,
      sortOrder: Math.max(0, Math.min(10000, Number(input.sortOrder) || 0)),
    };

    try {
      await setDoc(doc(services.db, FIRESTORE_COLLECTIONS.categories, catId), payload);
      return catId;
    } catch (error) {
      handleFirestoreError(
        error,
        OperationType.WRITE,
        `${FIRESTORE_COLLECTIONS.categories}/${catId}`,
        services.auth
      );
    }
  },

  async deleteCategory(catId: string): Promise<void> {
    const services = getFirebaseServices();
    if (!services) throw new Error('Firebase is not connected.');
    try {
      await deleteDoc(doc(services.db, FIRESTORE_COLLECTIONS.categories, catId));
      if (catId === 'linkedin' || catId === 'webtraffic') {
        try {
          const raw = localStorage.getItem('rj_deleted_builtin_categories');
          const parsed = raw ? (JSON.parse(raw) as unknown) : [];
          const next = new Set(Array.isArray(parsed) ? parsed.filter((x) => typeof x === 'string') : []);
          next.add(catId);
          localStorage.setItem('rj_deleted_builtin_categories', JSON.stringify(Array.from(next)));
        } catch {
          // ignore storage errors
        }
      }
    } catch (error) {
      handleFirestoreError(
        error,
        OperationType.DELETE,
        `${FIRESTORE_COLLECTIONS.categories}/${catId}`,
        services.auth
      );
    }
  },

  // ---------------------------------------------------------------------------
  // 3. Services & Price Management
  // ---------------------------------------------------------------------------
  async listServicesAdmin(): Promise<AdminServiceItem[]> {
    const services = getFirebaseServices();
    if (!services) return [];
    try {
      const snap = await getDocs(collection(services.db, FIRESTORE_COLLECTIONS.services));
      return snap.docs.map((d) => {
        const data = d.data() as FirestoreServiceDoc;
        return {
          id: data.id,
          categoryId: data.categoryId,
          name: data.name,
          serviceType: (data.serviceType as ServiceType) ?? 'Other',
          description: data.description ?? '',
          providerId: data.providerId ?? '',
          providerServiceId: data.providerServiceId ?? '',
          costPrice: Number(data.costPrice ?? 0),
          sellingPrice: Number(data.sellingPrice ?? 0),
          minQuantity: Number(data.minQuantity ?? 100),
          maxQuantity: Number(data.maxQuantity ?? 10000),
          averageTime: data.averageTime ?? '15 minutes',
          deliverySpeed: data.deliverySpeed ?? 'Instant Delivery',
          refillGuaranteed: Boolean(data.refillGuaranteed),
          status: data.status,
          createdAtLabel: formatTs(data.createdAt),
          updatedAtLabel: formatTs(data.updatedAt),
        };
      });
    } catch (error) {
      handleFirestoreError(
        error,
        OperationType.LIST,
        FIRESTORE_COLLECTIONS.services,
        services.auth
      );
    }
  },

  async saveService(input: {
    id?: string;
    categoryId: string;
    name: string;
    serviceType?: ServiceType;
    description: string;
    providerId: string;
    providerServiceId: string;
    costPrice: number;
    sellingPrice: number;
    minQuantity: number;
    maxQuantity: number;
    averageTime?: string;
    deliverySpeed?: string;
    refillGuaranteed?: boolean;
    status: 'active' | 'inactive';
  }): Promise<string> {
    const services = getFirebaseServices();
    if (!services) throw new Error('Firebase is not connected.');

    const cleanName = input.name.trim();
    const cleanCategoryId = input.categoryId.trim();
    const cleanProviderId = input.providerId.trim();
    const cleanProviderServiceId = input.providerServiceId.trim();

    if (!cleanName || !cleanCategoryId) {
      throw new Error('Service name and category are required.');
    }

    const minQty = Math.floor(Number(input.minQuantity));
    const maxQty = Math.floor(Number(input.maxQuantity));
    const cost = Number(input.costPrice);
    const selling = Number(input.sellingPrice);

    if (!Number.isFinite(minQty) || minQty < 1) {
      throw new Error('Minimum quantity must be at least 1.');
    }
    if (!Number.isFinite(maxQty) || maxQty < minQty) {
      throw new Error('Maximum quantity must be greater than or equal to minimum quantity.');
    }
    if (!Number.isFinite(cost) || cost < 0 || !Number.isFinite(selling) || selling < 0) {
      throw new Error('Cost and selling prices must be zero or positive numbers.');
    }

    const isUpdate = Boolean(input.id);
    const srvId = input.id ? input.id : `srv-${Date.now().toString().slice(-6)}`;
    const ref = doc(services.db, FIRESTORE_COLLECTIONS.services, srvId);

    // Prevent duplicate mapping of the same (providerId, providerServiceId)
    if (cleanProviderId && cleanProviderServiceId) {
      const dupQuery = query(
        collection(services.db, FIRESTORE_COLLECTIONS.services),
        where('providerId', '==', cleanProviderId),
        where('providerServiceId', '==', cleanProviderServiceId)
      );
      const dupSnap = await getDocs(dupQuery);
      const conflict = dupSnap.docs.find((d) => d.id !== srvId);
      if (conflict) {
        const conflictData = conflict.data() as FirestoreServiceDoc;
        throw new Error(
          `Duplicate mapping detected: Provider Service ID #${cleanProviderServiceId} is already linked to "${conflictData.name}".`
        );
      }
    }

    try {
      let existingCreatedAt: unknown = null;
      if (isUpdate) {
        const snap = await getDoc(ref);
        if (snap.exists()) {
          existingCreatedAt = (snap.data() as FirestoreServiceDoc).createdAt;
        }
      }

      const payload: FirestoreServiceDoc = {
        id: srvId,
        categoryId: cleanCategoryId,
        name: cleanName,
        serviceType: input.serviceType ?? 'Other',
        description: input.description.trim(),
        providerId: cleanProviderId,
        providerServiceId: cleanProviderServiceId,
        costPrice: Number(cost.toFixed(4)),
        sellingPrice: Number(selling.toFixed(4)),
        minQuantity: minQty,
        maxQuantity: maxQty,
        averageTime: input.averageTime?.trim() || '15 minutes',
        deliverySpeed: input.deliverySpeed?.trim() || 'Instant Delivery',
        refillGuaranteed: Boolean(input.refillGuaranteed),
        status: input.status,
        createdAt: (existingCreatedAt as FirestoreServiceDoc['createdAt']) ?? serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      await setDoc(ref, payload);
      invalidatePublicCatalogCache();
      return srvId;
    } catch (error) {
      if (error instanceof Error && error.message.includes('Duplicate mapping detected')) {
        throw error;
      }
      handleFirestoreError(
        error,
        isUpdate ? OperationType.UPDATE : OperationType.CREATE,
        `${FIRESTORE_COLLECTIONS.services}/${srvId}`,
        services.auth
      );
    }
  },

  async bulkImportProviderServices(input: {
    providerId: string;
    items: ProviderServiceDTO[];
    profitPerThousand: number;
    providerCurrency?: ProviderRateCurrency;
    exchangeRateUsdToBdt?: number;
    categories: AdminCategoryItem[];
    status?: 'active' | 'inactive';
  }): Promise<{
    importedCount: number;
    skippedDuplicateCount: number;
    categoryCounts: Record<string, number>;
  }> {
    const services = getFirebaseServices();
    if (!services) throw new Error('Firebase is not connected.');

    const cleanProviderId = input.providerId.trim().slice(0, 64);
    if (!cleanProviderId) {
      throw new Error('Valid provider ID is required for bulk import.');
    }

    const profit = Number(input.profitPerThousand);
    if (!Number.isFinite(profit) || profit < 0) {
      throw new Error('Profit amount per 1,000 units must be 0 or a positive number.');
    }

    const providerCurrency: ProviderRateCurrency =
      input.providerCurrency === 'USD' ? 'USD' : 'BDT';
    const exchangeRateUsdToBdt =
      providerCurrency === 'USD'
        ? Number(input.exchangeRateUsdToBdt) > 0
          ? Number(input.exchangeRateUsdToBdt)
          : DEFAULT_USD_TO_BDT_RATE
        : 1;

    if (!Array.isArray(input.categories) || input.categories.length === 0) {
      throw new Error('At least one category must exist in Firestore before importing services.');
    }

    if (!Array.isArray(input.items) || input.items.length === 0) {
      return { importedCount: 0, skippedDuplicateCount: 0, categoryCounts: {} };
    }

    try {
      const existingSnap = await getDocs(collection(services.db, FIRESTORE_COLLECTIONS.services));
      const existingDocIds = new Set<string>();
      const existingProviderServiceIds = new Set<string>();

      for (const docSnap of existingSnap.docs) {
        existingDocIds.add(docSnap.id);
        const data = docSnap.data() as Partial<FirestoreServiceDoc>;
        if (
          data.providerId === cleanProviderId &&
          typeof data.providerServiceId === 'string' &&
          data.providerServiceId.trim()
        ) {
          existingProviderServiceIds.add(data.providerServiceId.trim());
        }
      }

      const validCategoryIds = new Set(input.categories.map((c) => c.id));
      const fallbackCategoryId = input.categories[0].id;
      const safeProv = cleanProviderId.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 32) || 'prov';
      const targetStatus: 'active' | 'inactive' = input.status ?? 'active';

      const toWrite: Array<{ id: string; payload: FirestoreServiceDoc; categoryName: string }> = [];
      let skippedDuplicateCount = 0;
      const categoryCounts: Record<string, number> = {};

      for (const item of input.items) {
        const cleanRemoteId = String(item.providerServiceId || '').trim().slice(0, 64);
        const cleanName = String(item.name || '').trim();
        if (!cleanRemoteId || !cleanName) continue;

        if (existingProviderServiceIds.has(cleanRemoteId)) {
          skippedDuplicateCount += 1;
          continue;
        }
        existingProviderServiceIds.add(cleanRemoteId);

        const resolved = resolveCategoryForImportedService(
          cleanName,
          String(item.category || ''),
          input.categories
        );
        const finalCategoryId = validCategoryIds.has(resolved.categoryId)
          ? resolved.categoryId
          : fallbackCategoryId;

        const safeRemote = cleanRemoteId.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 60) || 'srv';
        let srvId = `imp-${safeProv}-${safeRemote}`.slice(0, 128);
        let collisionCounter = 1;
        while (existingDocIds.has(srvId)) {
          const suffix = `-${collisionCounter++}`;
          srvId = `imp-${safeProv}-${safeRemote}`.slice(0, 128 - suffix.length) + suffix;
        }
        existingDocIds.add(srvId);

        const { costPriceBdt, sellingPriceBdt } = calculateProviderServicePricing({
          rawProviderRate: Number(item.rate || 0),
          providerCurrency,
          exchangeRateUsdToBdt,
          profitAmount: profit,
        });
        const minQty = Math.max(1, Math.floor(Number(item.min) || 1));
        const maxQty = Math.max(minQty, Math.floor(Number(item.max) || minQty));
        const itemIsPackage = isPackageService({
          providerType: item.type,
          description: item.description,
          minQuantity: minQty,
          maxQuantity: maxQty,
        });
        const rawDesc = (
          item.description || `${item.category || 'SMM'} (${item.type || 'Default'})`
        )
          .trim()
          .slice(0, 500);

        const payload: FirestoreServiceDoc = {
          id: srvId,
          categoryId: finalCategoryId,
          name: cleanName.slice(0, 160),
          serviceType: (resolved.serviceType || 'Other').slice(0, 40) as ServiceType,
          description: rawDesc,
          providerId: cleanProviderId,
          providerServiceId: cleanRemoteId,
          costPrice: costPriceBdt,
          sellingPrice: sellingPriceBdt,
          minQuantity: minQty,
          maxQuantity: maxQty,
          averageTime: '15 minutes',
          deliverySpeed: (itemIsPackage
            ? 'Package Delivery'
            : item.dripfeed
              ? 'Drip-feed Enabled'
              : 'Instant Delivery'
          ).slice(0, 64),
          refillGuaranteed: Boolean(item.refill),
          status: targetStatus,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };

        toWrite.push({
          id: srvId,
          payload,
          categoryName: resolved.categoryName,
        });
        categoryCounts[resolved.categoryName] = (categoryCounts[resolved.categoryName] ?? 0) + 1;
      }

      const CHUNK_SIZE = 400;
      for (let i = 0; i < toWrite.length; i += CHUNK_SIZE) {
        const chunk = toWrite.slice(i, i + CHUNK_SIZE);
        const batch = writeBatch(services.db);
        for (const entry of chunk) {
          batch.set(doc(services.db, FIRESTORE_COLLECTIONS.services, entry.id), entry.payload);
        }
        await batch.commit();
      }

      if (toWrite.length > 0) {
        invalidatePublicCatalogCache();
      }

      return {
        importedCount: toWrite.length,
        skippedDuplicateCount,
        categoryCounts,
      };
    } catch (error) {
      handleFirestoreError(
        error,
        OperationType.CREATE,
        FIRESTORE_COLLECTIONS.services,
        services.auth
      );
    }
  },

  async buildExistingServicesUpdatePlan(input: {
    providerId: string;
    items: ProviderServiceDTO[];
    profitPerThousand: number;
    providerCurrency: ProviderRateCurrency;
    exchangeRateUsdToBdt: number;
  }): Promise<ExistingServicesUpdatePlan> {
    const services = getFirebaseServices();
    if (!services) throw new Error('Firebase is not connected.');

    const cleanProviderId = input.providerId.trim().slice(0, 64);
    if (!cleanProviderId) {
      throw new Error('Valid provider ID is required.');
    }

    const profit = Number(input.profitPerThousand);
    if (!Number.isFinite(profit) || profit < 0) {
      throw new Error('Profit amount per 1,000 units must be 0 or a positive number.');
    }

    const providerCurrency: ProviderRateCurrency =
      input.providerCurrency === 'USD' ? 'USD' : 'BDT';
    const exchangeRateUsdToBdt =
      providerCurrency === 'USD'
        ? Number(input.exchangeRateUsdToBdt) > 0
          ? Number(input.exchangeRateUsdToBdt)
          : DEFAULT_USD_TO_BDT_RATE
        : 1;

    try {
      const [existingSnap, sysSnap] = await Promise.all([
        getDocs(
          query(
            collection(services.db, FIRESTORE_COLLECTIONS.services),
            where('providerId', '==', cleanProviderId)
          )
        ),
        getDoc(doc(services.db, FIRESTORE_COLLECTIONS.settings, 'system')).catch(() => null),
      ]);

      let corruptedSymbolToRepair: { from: string; to: string } | null = null;
      if (sysSnap && sysSnap.exists()) {
        const sysData = sysSnap.data() as { currencySymbol?: string; currency?: string };
        if (hasCorruptedCurrencySymbol(sysData.currencySymbol, sysData.currency)) {
          corruptedSymbolToRepair = {
            from: String(sysData.currencySymbol || '').trim(),
            to: normalizeCurrencySymbol(sysData.currencySymbol, sysData.currency),
          };
        }
      }

      const existingByRemoteId = new Map<string, FirestoreServiceDoc>();
      for (const docSnap of existingSnap.docs) {
        const data = docSnap.data() as FirestoreServiceDoc;
        const remoteId = String(data.providerServiceId || '').trim();
        if (remoteId && !existingByRemoteId.has(remoteId)) {
          existingByRemoteId.set(remoteId, data);
        }
      }

      const liveByRemoteId = new Map<string, ProviderServiceDTO>();
      for (const item of input.items) {
        const remoteId = String(item.providerServiceId || '').trim().slice(0, 64);
        if (remoteId && !liveByRemoteId.has(remoteId)) {
          liveByRemoteId.set(remoteId, item);
        }
      }

      const updates: ExistingServiceUpdatePreviewItem[] = [];
      let unchangedCount = 0;
      let newAvailableCount = 0;

      for (const [remoteId, item] of liveByRemoteId.entries()) {
        const existing = existingByRemoteId.get(remoteId);
        if (!existing) {
          newAvailableCount += 1;
          continue;
        }

        const { costPriceBdt, sellingPriceBdt } = calculateProviderServicePricing({
          rawProviderRate: Number(item.rate || 0),
          providerCurrency,
          exchangeRateUsdToBdt,
          profitAmount: profit,
        });
        const minQty = Math.max(1, Math.floor(Number(item.min) || 1));
        const maxQty = Math.max(minQty, Math.floor(Number(item.max) || minQty));
        const itemIsPackage = isPackageService({
          serviceType: existing.serviceType,
          providerType: item.type,
          description: existing.description || item.description,
          minQuantity: minQty,
          maxQuantity: maxQty,
        });
        const nextDeliverySpeed = (
          itemIsPackage
            ? 'Package Delivery'
            : item.dripfeed
              ? 'Drip-feed Enabled'
              : 'Instant Delivery'
        ).slice(0, 64);
        const nextRefill = Boolean(item.refill);

        const oldCostPrice = Number(existing.costPrice ?? 0);
        const oldSellingPrice = Number(existing.sellingPrice ?? 0);
        const oldMinQty = Math.floor(Number(existing.minQuantity ?? 1));
        const oldMaxQty = Math.floor(Number(existing.maxQuantity ?? oldMinQty));
        const oldRefill = Boolean(existing.refillGuaranteed);
        const oldDeliverySpeed = String(existing.deliverySpeed || '').trim();

        const priceChanged =
          Math.abs(oldCostPrice - costPriceBdt) > 0.0001 ||
          Math.abs(oldSellingPrice - sellingPriceBdt) > 0.0001;
        const metaChanged =
          oldMinQty !== minQty ||
          oldMaxQty !== maxQty ||
          oldRefill !== nextRefill ||
          (itemIsPackage && oldDeliverySpeed !== nextDeliverySpeed);

        if (!priceChanged && !metaChanged) {
          unchangedCount += 1;
          continue;
        }

        updates.push({
          serviceId: existing.id,
          providerServiceId: remoteId,
          name: existing.name,
          isPackage: itemIsPackage,
          oldCostPrice,
          newCostPrice: costPriceBdt,
          oldSellingPrice,
          newSellingPrice: sellingPriceBdt,
          minQuantity: minQty,
          maxQuantity: maxQty,
          refillGuaranteed: nextRefill,
          deliverySpeed: nextDeliverySpeed,
          priceChanged,
        });
      }

      const unavailableServices: UnavailableProviderServiceItem[] = [];
      for (const [remoteId, existing] of existingByRemoteId.entries()) {
        if (!liveByRemoteId.has(remoteId)) {
          unavailableServices.push({
            serviceId: existing.id,
            providerServiceId: remoteId,
            name: existing.name,
            status: existing.status,
          });
        }
      }

      return {
        providerId: cleanProviderId,
        providerCurrency,
        exchangeRateUsdToBdt,
        profitPerThousand: profit,
        updates,
        unchangedCount,
        newAvailableCount,
        unavailableServices,
        corruptedSymbolToRepair,
      };
    } catch (error) {
      handleFirestoreError(
        error,
        OperationType.LIST,
        FIRESTORE_COLLECTIONS.services,
        services.auth
      );
    }
  },

  async applyExistingServicesUpdatePlan(
    plan: ExistingServicesUpdatePlan
  ): Promise<ApplyExistingServicesUpdateResult> {
    const services = getFirebaseServices();
    if (!services) throw new Error('Firebase is not connected.');

    try {
      const CHUNK_SIZE = 400;
      for (let i = 0; i < plan.updates.length; i += CHUNK_SIZE) {
        const chunk = plan.updates.slice(i, i + CHUNK_SIZE);
        const batch = writeBatch(services.db);
        for (const item of chunk) {
          batch.update(doc(services.db, FIRESTORE_COLLECTIONS.services, item.serviceId), {
            costPrice: item.newCostPrice,
            sellingPrice: item.newSellingPrice,
            minQuantity: item.minQuantity,
            maxQuantity: item.maxQuantity,
            refillGuaranteed: item.refillGuaranteed,
            deliverySpeed: item.deliverySpeed,
            updatedAt: serverTimestamp(),
          });
        }
        await batch.commit();
      }

      let repairedCurrencySymbol: string | null = null;
      if (plan.corruptedSymbolToRepair) {
        await adminService.updateSystemSettings({
          currencySymbol: plan.corruptedSymbolToRepair.to,
        });
        repairedCurrencySymbol = plan.corruptedSymbolToRepair.to;
      }

      if (plan.updates.length > 0 || repairedCurrencySymbol) {
        invalidatePublicCatalogCache();
      }

      return {
        updatedCount: plan.updates.length,
        unchangedCount: plan.unchangedCount,
        newAvailableCount: plan.newAvailableCount,
        unavailableCount: plan.unavailableServices.length,
        repairedCurrencySymbol,
      };
    } catch (error) {
      handleFirestoreError(
        error,
        OperationType.UPDATE,
        FIRESTORE_COLLECTIONS.services,
        services.auth
      );
    }
  },

  async bulkUpdateServiceStatus(
    ids: string[],
    status: 'active' | 'inactive'
  ): Promise<void> {
    const services = getFirebaseServices();
    if (!services) throw new Error('Firebase is not connected.');
    for (const srvId of ids) {
      try {
        await updateDoc(doc(services.db, FIRESTORE_COLLECTIONS.services, srvId), {
          status,
          updatedAt: serverTimestamp(),
        });
      } catch (error) {
        handleFirestoreError(
          error,
          OperationType.UPDATE,
          `${FIRESTORE_COLLECTIONS.services}/${srvId}`,
          services.auth
        );
      }
    }
  },

  /**
   * Preserves historical order integrity:
   * Services referenced by existing orders are archived (set to inactive) instead of hard-deleted.
   */
  async safeDeleteServices(
    ids: string[]
  ): Promise<{ deletedIds: string[]; archivedIds: string[] }> {
    const services = getFirebaseServices();
    if (!services) throw new Error('Firebase is not connected.');

    const deletedIds: string[] = [];
    const archivedIds: string[] = [];

    for (const srvId of ids) {
      try {
        const orderRefQuery = query(
          collection(services.db, FIRESTORE_COLLECTIONS.orders),
          where('serviceId', '==', srvId),
          limit(1)
        );
        const refSnap = await getDocs(orderRefQuery);

        if (!refSnap.empty) {
          await updateDoc(doc(services.db, FIRESTORE_COLLECTIONS.services, srvId), {
            status: 'inactive',
            updatedAt: serverTimestamp(),
          });
          archivedIds.push(srvId);
        } else {
          await deleteDoc(doc(services.db, FIRESTORE_COLLECTIONS.services, srvId));
          deletedIds.push(srvId);
        }
      } catch (error) {
        handleFirestoreError(
          error,
          OperationType.DELETE,
          `${FIRESTORE_COLLECTIONS.services}/${srvId}`,
          services.auth
        );
      }
    }

    return { deletedIds, archivedIds };
  },

  async deleteService(srvId: string): Promise<void> {
    await this.safeDeleteServices([srvId]);
  },

  // ---------------------------------------------------------------------------
  // 4. Orders Management
  // ---------------------------------------------------------------------------
  async listOrdersAdmin(maxLimit = 120): Promise<AdminOrderItem[]> {
    const services = getFirebaseServices();
    if (!services) return [];
    try {
      const q = query(
        collection(services.db, FIRESTORE_COLLECTIONS.orders),
        orderBy('createdAt', 'desc'),
        limit(maxLimit)
      );
      const snap = await getDocs(q);
      return snap.docs.map((d) => {
        const data = d.data() as FirestoreOrderDoc;
        const nextRetryAtMs = data.nextRetryAt ? toTsMs(data.nextRetryAt) : 0;
        return {
          id: data.id,
          userId: data.userId,
          serviceId: data.serviceId,
          serviceName: data.serviceName ?? data.serviceId,
          categoryId: data.categoryId ?? 'other',
          providerId: data.providerId ?? '',
          providerOrderId: data.providerOrderId ?? '',
          ...(typeof data.providerCharge === 'number'
            ? { providerCharge: Number(data.providerCharge) }
            : {}),
          link: data.link,
          quantity: Number(data.quantity ?? 0),
          charge: Number(data.charge ?? 0),
          status: data.status,
          remains: Number(data.remains ?? 0),
          startCount: Number(data.startCount ?? 0),
          paymentStatus: data.paymentStatus,
          paymentTransactionId: data.paymentTransactionId,
          refunded: Boolean(data.refunded),
          refundEligible: Boolean(data.refundEligible),
          refundTransactionId: data.refundTransactionId,
          ...(data.lastCheckedAt ? { lastCheckedAtLabel: formatTs(data.lastCheckedAt) } : {}),
          ...(data.completedAt ? { completedAtLabel: formatTs(data.completedAt) } : {}),
          retryCount: Number(data.retryCount ?? 0),
          ...(data.lastAttemptAt ? { lastAttemptAtLabel: formatTs(data.lastAttemptAt) } : {}),
          ...(data.lastError ? { lastError: data.lastError } : {}),
          ...(nextRetryAtMs > 0 ? { nextRetryAtLabel: formatTs(data.nextRetryAt) } : {}),
          nextRetryAtMs,
          ...(data.internalNote ? { internalNote: data.internalNote } : {}),
          createdAtLabel: formatTs(data.createdAt),
          createdAtMs: toTsMs(data.createdAt),
          updatedAtLabel: formatTs(data.updatedAt),
          updatedAtMs: toTsMs(data.updatedAt),
        };
      });
    } catch (error) {
      handleFirestoreError(
        error,
        OperationType.LIST,
        FIRESTORE_COLLECTIONS.orders,
        services.auth
      );
    }
  },

  async updateOrderAdmin(
    orderId: string,
    patch: {
      status: OrderStatusFirestore;
      providerId?: string;
      providerOrderId?: string;
      remains?: number;
      startCount?: number;
      internalNote?: string;
    }
  ): Promise<void> {
    const services = getFirebaseServices();
    if (!services) throw new Error('Firebase is not connected.');

    const ref = doc(services.db, FIRESTORE_COLLECTIONS.orders, orderId);
    try {
      const prevSnap = await getDoc(ref);
      const prevData = prevSnap.exists() ? (prevSnap.data() as FirestoreOrderDoc) : null;
      const actingAdminUid = services.auth.currentUser?.uid || 'admin';
      const cleanNote =
        patch.internalNote !== undefined ? patch.internalNote.trim().slice(0, 1000) : undefined;

      await updateDoc(ref, {
        status: patch.status,
        ...(patch.providerId !== undefined ? { providerId: patch.providerId.trim() } : {}),
        ...(patch.providerOrderId !== undefined
          ? { providerOrderId: patch.providerOrderId.trim() }
          : {}),
        ...(patch.remains !== undefined ? { remains: Math.max(0, Number(patch.remains)) } : {}),
        ...(patch.startCount !== undefined
          ? { startCount: Math.max(0, Number(patch.startCount)) }
          : {}),
        ...(cleanNote !== undefined ? { internalNote: cleanNote } : {}),
        ...(patch.status === 'Completed' ? { completedAt: serverTimestamp(), remains: 0 } : {}),
        ...(patch.status === 'Partial' ? { refundEligible: true } : {}),
        updatedAt: serverTimestamp(),
      });

      if (prevData && prevData.status !== patch.status) {
        const orderShort = orderId.replace(/^ord-/, '');
        let notifType: NotificationTypeFirestore | null = null;
        let notifTitle = '';
        let notifMsg = '';

        if (patch.status === 'Processing' || patch.status === 'In Progress') {
          notifType = 'order_processing';
          notifTitle = `Order #${orderShort} In Progress`;
          notifMsg = `আপনার অর্ডার #${orderShort} (${prevData.serviceName || 'SMM Service'}) এখন প্রসেস হচ্ছে।`;
        } else if (patch.status === 'Completed') {
          notifType = 'order_completed';
          notifTitle = `Order #${orderShort} Completed`;
          notifMsg = `আপনার অর্ডার #${orderShort} (${prevData.serviceName || 'SMM Service'}) সফলভাবে সম্পন্ন হয়েছে।`;
        } else if (patch.status === 'Partial') {
          notifType = 'order_partial';
          notifTitle = `Order #${orderShort} Partially Completed`;
          notifMsg = `আপনার অর্ডার #${orderShort} আংশিক সম্পন্ন হয়েছে। বাকি অংশের জন্য সাপোর্টে যোগাযোগ করতে পারেন।`;
        } else if (patch.status === 'Failed' || patch.status === 'Cancelled') {
          notifType = 'order_failed';
          notifTitle = `Order #${orderShort} ${patch.status}`;
          notifMsg = `আপনার অর্ডার #${orderShort} ${
            patch.status === 'Failed' ? 'সম্পন্ন করা যায়নি' : 'বাতিল করা হয়েছে'
          }।`;
        }

        if (notifType) {
          const notifId = `ntf-ordst-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;
          await setDoc(doc(services.db, FIRESTORE_COLLECTIONS.notifications, notifId), {
            id: notifId,
            notificationId: notifId,
            userId: prevData.userId,
            targetType: 'user',
            title: notifTitle,
            message: notifMsg,
            type: notifType,
            referenceId: orderId,
            read: false,
            isRead: false,
            createdAt: serverTimestamp(),
          } satisfies FirestoreNotificationDoc).catch(() => undefined);
        }

        await this.logAuditEvent({
          action: 'manual_status_change',
          adminId: actingAdminUid,
          targetId: orderId,
          targetType: 'order',
          previousValue: prevData.status,
          newValue: patch.status,
          note: cleanNote,
        });
      } else if (prevData && cleanNote !== undefined && cleanNote !== (prevData.internalNote ?? '')) {
        await this.logAuditEvent({
          action: 'internal_note_added',
          adminId: actingAdminUid,
          targetId: orderId,
          targetType: 'order',
          previousValue: prevData.internalNote || '—',
          newValue: cleanNote || 'Cleared',
        });
      }
    } catch (error) {
      handleFirestoreError(
        error,
        OperationType.UPDATE,
        `${FIRESTORE_COLLECTIONS.orders}/${orderId}`,
        services.auth
      );
    }
  },

  /**
   * Idempotent Atomic Order Refund:
   * Credits order.charge back to the customer's wallet, marks order as Cancelled/Failed + refunded,
   * logs an immutable refund transaction + audit log, and notifies the customer.
   */
  async refundOrderAtomic(
    orderId: string,
    adminId: string,
    reason: string = 'Order cancelled & refunded',
    targetStatus: 'Cancelled' | 'Failed' = 'Cancelled'
  ): Promise<{ refundAmount: number; transactionId: string }> {
    const services = getFirebaseServices();
    if (!services) throw new Error('Firebase is not connected.');

    const actingAdminUid = services.auth.currentUser?.uid || adminId;
    const orderRef = doc(services.db, FIRESTORE_COLLECTIONS.orders, orderId);
    const refundTxnId = `txn-refund-${orderId}`;
    const txnRef = doc(services.db, FIRESTORE_COLLECTIONS.transactions, refundTxnId);
    const notifId = `ntf-ref-${orderId}`;
    const notifRef = doc(services.db, FIRESTORE_COLLECTIONS.notifications, notifId);
    const auditId = `aud-ref-${orderId}-${Date.now().toString().slice(-4)}`;
    const auditRef = doc(services.db, FIRESTORE_COLLECTIONS.auditLogs, auditId);
    const currencySymbol = await getCurrencySymbol();

    try {
      return await runTransaction(services.db, async (tx) => {
        const [orderSnap, existingTxnSnap] = await Promise.all([
          tx.get(orderRef),
          tx.get(txnRef),
        ]);

        if (!orderSnap.exists()) {
          throw new Error('Order record not found.');
        }

        const orderData = orderSnap.data() as FirestoreOrderDoc;
        if (orderData.refunded || orderData.paymentStatus === 'refunded' || existingTxnSnap.exists()) {
          throw new Error('This order has already been refunded. Duplicate refunds are blocked.');
        }

        const refundAmount = Number(Number(orderData.charge ?? 0).toFixed(2));
        if (refundAmount <= 0) {
          throw new Error('Order charge is zero; nothing to refund.');
        }

        const userRef = doc(services.db, FIRESTORE_COLLECTIONS.users, orderData.userId);
        const userSnap = await tx.get(userRef);
        if (!userSnap.exists()) {
          throw new Error('Target customer profile not found.');
        }

        const userData = userSnap.data() as FirestoreUserDoc;
        const balanceBefore = Number(userData.balance ?? 0);
        const balanceAfter = Number((balanceBefore + refundAmount).toFixed(2));
        const cleanReason = reason.trim().slice(0, 280) || 'Order cancelled & refunded';

        tx.update(userRef, {
          balance: balanceAfter,
          lastTxnId: refundTxnId,
          updatedAt: serverTimestamp(),
        });

        tx.update(orderRef, {
          status: targetStatus,
          paymentStatus: 'refunded',
          refunded: true,
          refundEligible: false,
          refundedAt: serverTimestamp(),
          refundedBy: actingAdminUid,
          refundTransactionId: refundTxnId,
          updatedAt: serverTimestamp(),
        });

        const txnPayload: FirestoreTransactionDoc = {
          id: refundTxnId,
          transactionId: refundTxnId,
          userId: orderData.userId,
          type: 'refund',
          amount: refundAmount,
          balanceBefore,
          balanceAfter,
          reference: orderId,
          referenceId: orderId,
          description: cleanReason,
          reason: cleanReason,
          createdBy: actingAdminUid,
          adminId: actingAdminUid,
          createdAt: serverTimestamp(),
        };
        tx.set(txnRef, txnPayload);

        tx.set(notifRef, {
          id: notifId,
          notificationId: notifId,
          userId: orderData.userId,
          targetType: 'user',
          title: 'Order Refund Credited',
          message: `অর্ডার #${orderId.replace(/^ord-/, '')} ${
            targetStatus === 'Failed' ? 'ব্যর্থ' : 'বাতিল'
          } হওয়ায় ${currencySymbol}${refundAmount.toFixed(2)} আপনার balance-এ ফেরত দেওয়া হয়েছে।`,
          type: 'refund',
          referenceId: orderId,
          read: false,
          isRead: false,
          createdAt: serverTimestamp(),
        });

        tx.set(auditRef, {
          id: auditId,
          action: 'order_refund',
          adminId: actingAdminUid,
          targetId: orderId,
          targetType: 'order',
          previousValue: orderData.status,
          newValue: `${targetStatus} (Refunded ${currencySymbol}${refundAmount.toFixed(2)})`,
          note: cleanReason.slice(0, 300),
          timestamp: serverTimestamp(),
        } satisfies FirestoreAuditLogDoc);

        return { refundAmount, transactionId: refundTxnId };
      });
    } catch (error) {
      if (
        error instanceof Error &&
        (error.message.includes('already been refunded') ||
          error.message.includes('not found') ||
          error.message.includes('nothing to refund'))
      ) {
        throw error;
      }
      handleFirestoreError(
        error,
        OperationType.WRITE,
        `${FIRESTORE_COLLECTIONS.orders}/${orderId}`,
        services.auth
      );
    }
  },

  /**
   * Secure server-side order dispatch:
   * Browser sends ONLY { orderId, providerIdOverride? } with Bearer Firebase ID token.
   * Server reads provider credentials directly from Firestore and dispatches upstream.
   */
  async dispatchOrderToProviderAdmin(
    orderId: string,
    providerIdOverride?: string
  ): Promise<{ providerOrderId: string }> {
    const services = getFirebaseServices();
    if (!services || !services.auth.currentUser) {
      throw new Error('Admin authentication required.');
    }

    const orderRef = doc(services.db, FIRESTORE_COLLECTIONS.orders, orderId);
    const orderSnap = await getDoc(orderRef);
    if (!orderSnap.exists()) throw new Error('Order record not found.');
    const orderData = orderSnap.data() as FirestoreOrderDoc;

    if (orderData.refunded) {
      throw new Error('Cannot dispatch an order that was already refunded.');
    }

    const idToken = await services.auth.currentUser.getIdToken();
    const res = await fetch('/api/orders/dispatch', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({
        orderId,
        ...(providerIdOverride ? { providerIdOverride } : {}),
        ...getActiveFirebaseTargetPayload(),
      }),
    });

    const json = (await res.json().catch(() => null)) as {
      ok?: boolean;
      error?: string;
      data?: { providerId: string; providerOrderId: string };
    } | null;

    if (!res.ok || !json?.ok || !json.data?.providerOrderId) {
      const errMsg = json?.error || 'Unable to dispatch order to upstream provider.';
      const schedule = computeLocalRetrySchedule(Number(orderData.retryCount ?? 0));

      await updateDoc(orderRef, {
        retryCount: schedule.retryCount,
        lastAttemptAt: serverTimestamp(),
        lastError: errMsg.slice(0, 500),
        nextRetryAt: Timestamp.fromMillis(schedule.nextRetryAtMs),
        updatedAt: serverTimestamp(),
      }).catch(() => undefined);

      await this.createAdminNotification({
        type: 'failed_provider_api',
        title: `Dispatch Failed · #${orderId.replace(/^ord-/, '')}`,
        message: `${errMsg.slice(0, 300)} (Retry #${schedule.retryCount} in ${schedule.backoffMinutes}m)`,
        referenceId: orderId,
      });

      throw new Error(errMsg);
    }

    await updateDoc(orderRef, {
      providerId: json.data.providerId,
      providerOrderId: json.data.providerOrderId,
      status: 'Processing',
      retryCount: 0,
      lastError: '',
      nextRetryAt: deleteField(),
      lastAttemptAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    const orderShort = orderId.replace(/^ord-/, '');
    const notifId = `ntf-proc-${orderId}`;
    await setDoc(doc(services.db, FIRESTORE_COLLECTIONS.notifications, notifId), {
      id: notifId,
      notificationId: notifId,
      userId: orderData.userId,
      targetType: 'user',
      title: `Order #${orderShort} Processing`,
      message: `আপনার অর্ডার #${orderShort} (${orderData.serviceName || 'SMM Service'}) এখন প্রসেস হচ্ছে।`,
      type: 'order_processing',
      referenceId: orderId,
      read: false,
      isRead: false,
      createdAt: serverTimestamp(),
    } satisfies FirestoreNotificationDoc).catch(() => undefined);

    await this.logAuditEvent({
      action: 'provider_dispatch',
      adminId: services.auth.currentUser.uid,
      targetId: orderId,
      targetType: 'order',
      previousValue: orderData.status,
      newValue: `Processing (${json.data.providerId}: ${json.data.providerOrderId})`,
    });

    return { providerOrderId: json.data.providerOrderId };
  },

  /**
   * Secure server-side live provider status synchronization with controlled backoff retry.
   * - Completed -> sets completedAt, remains=0, notifies customer
   * - Partial -> marks refundEligible=true (never auto-guesses partial refund)
   * - Cancelled / Failed -> triggers idempotent atomic refund if not yet refunded
   * - Transient API error -> updates retryCount/nextRetryAt without failing the order
   */
  async syncProviderOrderStatusAdmin(
    orderId: string,
    adminId: string,
    forceRetry: boolean = false
  ): Promise<{ status: OrderStatusFirestore; autoRefunded: boolean }> {
    const services = getFirebaseServices();
    if (!services || !services.auth.currentUser) {
      throw new Error('Admin authentication required.');
    }

    const actingAdminUid = services.auth.currentUser.uid || adminId;
    const orderRef = doc(services.db, FIRESTORE_COLLECTIONS.orders, orderId);
    const orderSnap = await getDoc(orderRef);
    if (!orderSnap.exists()) throw new Error('Order not found.');
    const orderData = orderSnap.data() as FirestoreOrderDoc;

    if (!orderData.providerId || !orderData.providerOrderId) {
      throw new Error('Order has not been dispatched to an API provider yet.');
    }

    const idToken = await services.auth.currentUser.getIdToken();
    const res = await fetch('/api/orders/sync-status', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({
        orderId,
        forceRetry,
        ...getActiveFirebaseTargetPayload(),
      }),
    });

    const json = (await res.json().catch(() => null)) as {
      ok?: boolean;
      error?: string;
      retryScheduled?: boolean;
      retryCount?: number;
      backoffMinutes?: number;
      nextRetryAtMs?: number;
      data?: {
        rawStatus: string;
        mappedStatus: OrderStatusFirestore;
        startCount?: number;
        remains?: number;
        providerCharge?: number;
        refundEligible?: boolean;
        autoRefundRecommended?: boolean;
        lastCheckedAtMs: number;
      };
    } | null;

    if (!res.ok || !json?.ok || !json.data) {
      const errMsg = json?.error || 'Unable to sync order status from provider.';
      if (json?.retryScheduled && typeof json.nextRetryAtMs === 'number') {
        const nextRetryCount = Number(json.retryCount ?? Number(orderData.retryCount ?? 0) + 1);
        await updateDoc(orderRef, {
          retryCount: nextRetryCount,
          lastAttemptAt: serverTimestamp(),
          lastError: errMsg.slice(0, 500),
          nextRetryAt: Timestamp.fromMillis(json.nextRetryAtMs),
          updatedAt: serverTimestamp(),
        }).catch(() => undefined);

        await this.createAdminNotification({
          type: 'failed_provider_api',
          title: `Provider Sync Error · #${orderId.replace(/^ord-/, '')}`,
          message: `${errMsg.slice(0, 300)} (Retry #${nextRetryCount} scheduled)`,
          referenceId: orderId,
        });
      }
      throw new Error(errMsg);
    }

    const syncData = json.data;
    const mappedStatus = syncData.mappedStatus;

    if ((mappedStatus === 'Cancelled' || mappedStatus === 'Failed') && !orderData.refunded) {
      await this.refundOrderAtomic(
        orderId,
        actingAdminUid,
        `Auto-refund after provider status "${syncData.rawStatus}"`,
        mappedStatus === 'Failed' ? 'Failed' : 'Cancelled'
      );
      await updateDoc(orderRef, {
        lastCheckedAt: serverTimestamp(),
        retryCount: 0,
        lastError: '',
        nextRetryAt: deleteField(),
        ...(typeof syncData.providerCharge === 'number'
          ? { providerCharge: syncData.providerCharge }
          : {}),
        updatedAt: serverTimestamp(),
      }).catch(() => undefined);
      return { status: mappedStatus, autoRefunded: true };
    }

    await updateDoc(orderRef, {
      status: mappedStatus,
      ...(typeof syncData.startCount === 'number' && Number.isFinite(syncData.startCount)
        ? { startCount: Math.max(0, syncData.startCount) }
        : {}),
      ...(typeof syncData.remains === 'number' && Number.isFinite(syncData.remains)
        ? { remains: Math.max(0, syncData.remains) }
        : {}),
      ...(typeof syncData.providerCharge === 'number' && Number.isFinite(syncData.providerCharge)
        ? { providerCharge: Math.max(0, syncData.providerCharge) }
        : {}),
      ...(mappedStatus === 'Completed' ? { completedAt: serverTimestamp(), remains: 0 } : {}),
      ...(mappedStatus === 'Partial' ? { refundEligible: true } : {}),
      lastCheckedAt: serverTimestamp(),
      retryCount: 0,
      lastError: '',
      nextRetryAt: deleteField(),
      updatedAt: serverTimestamp(),
    });

    const orderShort = orderId.replace(/^ord-/, '');
    if (orderData.status !== mappedStatus) {
      let notifType: NotificationTypeFirestore | null = null;
      let notifTitle = '';
      let notifMsg = '';

      if (mappedStatus === 'Completed') {
        notifType = 'order_completed';
        notifTitle = `Order #${orderShort} Completed`;
        notifMsg = `আপনার অর্ডার #${orderShort} (${orderData.serviceName || 'SMM Service'}) সফলভাবে সম্পন্ন হয়েছে।`;
      } else if (mappedStatus === 'Partial') {
        notifType = 'order_partial';
        notifTitle = `Order #${orderShort} Partially Completed`;
        notifMsg = `আপনার অর্ডার #${orderShort} আংশিক সম্পন্ন হয়েছে। বাকি অংশের রিফান্ড রিভিউয়ের জন্য সাপোর্টে জানান।`;
      } else if (mappedStatus === 'Processing' || mappedStatus === 'In Progress') {
        notifType = 'order_processing';
        notifTitle = `Order #${orderShort} In Progress`;
        notifMsg = `আপনার অর্ডার #${orderShort} ডেলিভারি চলমান রয়েছে।`;
      }

      if (notifType) {
        const notifId = `ntf-sync-${orderId}-${Date.now().toString().slice(-4)}`;
        await setDoc(doc(services.db, FIRESTORE_COLLECTIONS.notifications, notifId), {
          id: notifId,
          notificationId: notifId,
          userId: orderData.userId,
          targetType: 'user',
          title: notifTitle,
          message: notifMsg,
          type: notifType,
          referenceId: orderId,
          read: false,
          isRead: false,
          createdAt: serverTimestamp(),
        } satisfies FirestoreNotificationDoc).catch(() => undefined);
      }

      await this.logAuditEvent({
        action: 'provider_status_sync',
        adminId: actingAdminUid,
        targetId: orderId,
        targetType: 'order',
        previousValue: orderData.status,
        newValue: `${mappedStatus} (Remote: ${syncData.rawStatus})`,
      });
    }

    return { status: mappedStatus, autoRefunded: false };
  },

  async syncDueProviderOrdersBatchAdmin(
    adminId: string,
    maxBatch = 8
  ): Promise<{ checkedCount: number; updatedCount: number; refundedCount: number; failedCount: number }> {
    const orders = await this.listOrdersAdmin(120);
    const now = Date.now();
    const dueOrders = orders
      .filter(
        (o) =>
          (o.status === 'Pending' || o.status === 'Processing' || o.status === 'In Progress') &&
          Boolean(o.providerId && o.providerOrderId) &&
          (o.nextRetryAtMs === 0 || o.nextRetryAtMs <= now)
      )
      .slice(0, maxBatch);

    let checkedCount = 0;
    let updatedCount = 0;
    let refundedCount = 0;
    let failedCount = 0;

    for (const order of dueOrders) {
      checkedCount += 1;
      try {
        const res = await this.syncProviderOrderStatusAdmin(order.id, adminId, false);
        if (res.autoRefunded) refundedCount += 1;
        if (res.status !== order.status) updatedCount += 1;
      } catch {
        failedCount += 1;
      }
    }

    return { checkedCount, updatedCount, refundedCount, failedCount };
  },

  // ---------------------------------------------------------------------------
  // 5. Payment Methods & Payments Management (Admin review + Atomic Ledger)
  // ---------------------------------------------------------------------------
  async ensureDefaultPaymentMethodsSeeded(): Promise<void> {
    const services = getFirebaseServices();
    if (!services) return;
    try {
      const existing = await getDocs(
        query(collection(services.db, FIRESTORE_COLLECTIONS.paymentMethods), limit(1))
      );
      if (!existing.empty) return;

      for (const pm of DEFAULT_PAYMENT_METHODS_SEED) {
        const pmRef = doc(services.db, FIRESTORE_COLLECTIONS.paymentMethods, pm.id);
        await setDoc(pmRef, {
          ...pm,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
    } catch {
      // Ignore non-admin or offline seeding fallback
    }
  },

  async listPaymentMethodsAdmin(): Promise<AdminPaymentMethodItem[]> {
    const services = getFirebaseServices();
    if (!services) return [];
    try {
      await this.ensureDefaultPaymentMethodsSeeded();
      const q = query(
        collection(services.db, FIRESTORE_COLLECTIONS.paymentMethods),
        orderBy('displayOrder', 'asc')
      );
      const snap = await getDocs(q);
      return snap.docs.map((d) => {
        const data = d.data() as FirestorePaymentMethodDoc;
        return {
          id: data.id,
          name: data.name,
          type: data.type,
          accountNumber: data.accountNumber,
          instructions: data.instructions,
          note: data.note ?? '',
          minAmount: Number(data.minAmount ?? 50),
          maxAmount: Number(data.maxAmount ?? 50000),
          status: data.status,
          displayOrder: Number(data.displayOrder ?? 1),
          createdAtLabel: formatTs(data.createdAt),
          updatedAtLabel: formatTs(data.updatedAt),
        };
      });
    } catch (error) {
      handleFirestoreError(
        error,
        OperationType.LIST,
        FIRESTORE_COLLECTIONS.paymentMethods,
        services.auth
      );
    }
  },

  async savePaymentMethod(input: {
    id?: string;
    name: string;
    type: string;
    accountNumber: string;
    instructions: string;
    note?: string;
    minAmount: number;
    maxAmount: number;
    status: 'active' | 'inactive';
    displayOrder: number;
  }): Promise<string> {
    const services = getFirebaseServices();
    if (!services) throw new Error('Firebase is not connected.');

    const cleanName = input.name.trim();
    const cleanType = input.type.trim();
    const cleanAccount = input.accountNumber.trim();
    const cleanInstructions = input.instructions.trim();
    if (!cleanName || !cleanType || !cleanAccount || !cleanInstructions) {
      throw new Error('Name, Type, Account Number, and Instructions are required.');
    }

    const minAmount = Math.max(1, Number(input.minAmount) || 1);
    const maxAmount = Math.max(minAmount, Number(input.maxAmount) || minAmount);
    const isUpdate = Boolean(input.id);
    const methodId = input.id ? toSafeId('pm', input.id) : toSafeId('pm', cleanName);
    const ref = doc(services.db, FIRESTORE_COLLECTIONS.paymentMethods, methodId);

    try {
      let existingCreatedAt: unknown = null;
      if (isUpdate) {
        const snap = await getDoc(ref);
        if (snap.exists()) {
          existingCreatedAt = (snap.data() as FirestorePaymentMethodDoc).createdAt;
        }
      }

      const payload: FirestorePaymentMethodDoc = {
        id: methodId,
        name: cleanName.slice(0, 80),
        type: cleanType.slice(0, 60),
        accountNumber: cleanAccount.slice(0, 120),
        instructions: cleanInstructions.slice(0, 1500),
        ...(input.note?.trim() ? { note: input.note.trim().slice(0, 120) } : {}),
        minAmount,
        maxAmount,
        status: input.status,
        displayOrder: Math.max(0, Math.min(10000, Number(input.displayOrder) || 0)),
        createdAt:
          (existingCreatedAt as FirestorePaymentMethodDoc['createdAt']) ?? serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      await setDoc(ref, payload);
      return methodId;
    } catch (error) {
      handleFirestoreError(
        error,
        isUpdate ? OperationType.UPDATE : OperationType.CREATE,
        `${FIRESTORE_COLLECTIONS.paymentMethods}/${methodId}`,
        services.auth
      );
    }
  },

  async deletePaymentMethod(methodId: string): Promise<void> {
    const services = getFirebaseServices();
    if (!services) throw new Error('Firebase is not connected.');
    try {
      await deleteDoc(doc(services.db, FIRESTORE_COLLECTIONS.paymentMethods, methodId));
    } catch (error) {
      handleFirestoreError(
        error,
        OperationType.DELETE,
        `${FIRESTORE_COLLECTIONS.paymentMethods}/${methodId}`,
        services.auth
      );
    }
  },

  async listPaymentsAdmin(): Promise<AdminPaymentItem[]> {
    const services = getFirebaseServices();
    if (!services) return [];
    try {
      const q = query(
        collection(services.db, FIRESTORE_COLLECTIONS.payments),
        orderBy('createdAt', 'desc')
      );
      const snap = await getDocs(q);
      return snap.docs.map((d) => {
        const data = d.data() as FirestorePaymentDoc;
        return {
          id: data.id,
          paymentId: data.paymentId ?? data.id.toUpperCase(),
          userId: data.userId,
          userName: data.userName ?? 'Customer',
          amount: Number(data.amount ?? 0),
          method: data.paymentMethod ?? data.method,
          transactionId: data.transactionId,
          status: data.status,
          adminNote: data.adminNote ?? '',
          reviewedBy: data.reviewedBy ?? '',
          reviewedAtLabel: data.reviewedAt ? formatTs(data.reviewedAt) : '—',
          reviewedAtMs: toTsMs(data.reviewedAt),
          createdAtLabel: formatTs(data.createdAt),
          createdAtMs: toTsMs(data.createdAt),
        };
      });
    } catch (error) {
      handleFirestoreError(
        error,
        OperationType.LIST,
        FIRESTORE_COLLECTIONS.payments,
        services.auth
      );
    }
  },

  /**
   * Idempotent Atomic Payment Approval / Rejection:
   * - Guards against reviewing non-pending records twice
   * - Uses deterministic ledger ID (`txn-pay-${paymentId}`) to block double-credit race conditions
   * - Atomically updates user balance, writes `deposit` ledger record + `auditLogs` entry,
   *   updates payment metadata, and creates a Bengali customer notification.
   */
  async reviewPaymentAdmin(
    paymentId: string,
    decision: 'approved' | 'rejected',
    adminId: string,
    adminNote: string = ''
  ): Promise<void> {
    const services = getFirebaseServices();
    if (!services) throw new Error('Firebase is not connected.');

    const actingAdminUid = services.auth.currentUser?.uid || adminId;
    const payRef = doc(services.db, FIRESTORE_COLLECTIONS.payments, paymentId);
    const depositTxnId = `txn-pay-${paymentId}`;
    const txnRef = doc(services.db, FIRESTORE_COLLECTIONS.transactions, depositTxnId);
    const notifId =
      decision === 'approved' ? `ntf-pay-ok-${paymentId}` : `ntf-pay-rej-${paymentId}`;
    const notifRef = doc(services.db, FIRESTORE_COLLECTIONS.notifications, notifId);
    const auditId = `aud-pay-${paymentId}-${Date.now().toString().slice(-4)}`;
    const auditRef = doc(services.db, FIRESTORE_COLLECTIONS.auditLogs, auditId);
    const cleanNote = adminNote.trim().slice(0, 500);
    const currencySymbol = await getCurrencySymbol();

    try {
      await runTransaction(services.db, async (tx) => {
        const [paySnap, existingTxnSnap] = await Promise.all([
          tx.get(payRef),
          tx.get(txnRef),
        ]);
        if (!paySnap.exists()) throw new Error('Payment record not found.');

        const payData = paySnap.data() as FirestorePaymentDoc;
        if (!isPaymentPendingStatus(payData.status)) {
          throw new Error('This payment request has already been reviewed.');
        }

        const amount = Number(Number(payData.amount ?? 0).toFixed(2));
        const methodName = payData.paymentMethod ?? payData.method;

        if (decision === 'approved') {
          if (existingTxnSnap.exists()) {
            throw new Error('Duplicate payment protection: this deposit was already credited.');
          }

          const userRef = doc(services.db, FIRESTORE_COLLECTIONS.users, payData.userId);
          const userSnap = await tx.get(userRef);
          if (!userSnap.exists()) throw new Error('Target user account not found.');

          const userData = userSnap.data() as FirestoreUserDoc;
          const balanceBefore = Number(userData.balance ?? 0);
          const balanceAfter = Number((balanceBefore + amount).toFixed(2));

          tx.update(userRef, {
            balance: balanceAfter,
            lastTxnId: depositTxnId,
            updatedAt: serverTimestamp(),
          });

          const txnPayload: FirestoreTransactionDoc = {
            id: depositTxnId,
            transactionId: depositTxnId,
            userId: payData.userId,
            type: 'deposit',
            amount,
            balanceBefore,
            balanceAfter,
            reference: payData.transactionId,
            referenceId: paymentId,
            description: `${methodName} deposit approved (${payData.transactionId})`.slice(0, 280),
            reason: `${methodName} deposit approved`,
            createdBy: actingAdminUid,
            adminId: actingAdminUid,
            createdAt: serverTimestamp(),
          };
          tx.set(txnRef, txnPayload);

          tx.set(notifRef, {
            id: notifId,
            notificationId: notifId,
            userId: payData.userId,
            targetType: 'user',
            title: 'Payment Approved',
            message: `আপনার ${currencySymbol}${amount.toFixed(
              2
            )} payment সফলভাবে approve হয়েছে এবং আপনার balance-এ যোগ হয়েছে।`,
            type: 'payment_approved',
            referenceId: paymentId,
            read: false,
            isRead: false,
            createdAt: serverTimestamp(),
          });
        } else {
          tx.set(notifRef, {
            id: notifId,
            notificationId: notifId,
            userId: payData.userId,
            targetType: 'user',
            title: 'Payment Rejected',
            message: cleanNote
              ? `আপনার payment request reject করা হয়েছে। কারণ: ${cleanNote}`
              : 'আপনার payment request reject করা হয়েছে।',
            type: 'payment_rejected',
            referenceId: paymentId,
            read: false,
            isRead: false,
            createdAt: serverTimestamp(),
          });
        }

        tx.update(payRef, {
          status: decision,
          reviewedAt: serverTimestamp(),
          reviewedBy: actingAdminUid,
          ...(cleanNote ? { adminNote: cleanNote } : {}),
        });

        tx.set(auditRef, {
          id: auditId,
          action: decision === 'approved' ? 'payment_approval' : 'payment_rejection',
          adminId: actingAdminUid,
          targetId: paymentId,
          targetType: 'payment',
          previousValue: String(payData.status),
          newValue: `${decision} (${currencySymbol}${amount.toFixed(2)})`,
          ...(cleanNote ? { note: cleanNote.slice(0, 300) } : {}),
          timestamp: serverTimestamp(),
        } satisfies FirestoreAuditLogDoc);
      });
    } catch (error) {
      if (
        error instanceof Error &&
        (error.message.includes('already been reviewed') ||
          error.message.includes('Duplicate payment') ||
          error.message.includes('not found'))
      ) {
        throw error;
      }
      handleFirestoreError(
        error,
        OperationType.UPDATE,
        `${FIRESTORE_COLLECTIONS.payments}/${paymentId}`,
        services.auth
      );
    }
  },

  async updatePaymentStatusAdmin(
    paymentId: string,
    status: 'Approved' | 'Rejected',
    adminId: string,
    adminNote?: string
  ): Promise<void> {
    await this.reviewPaymentAdmin(
      paymentId,
      status === 'Approved' ? 'approved' : 'rejected',
      adminId,
      adminNote
    );
  },

  // ---------------------------------------------------------------------------
  // 6. Transactions Audit Ledger
  // ---------------------------------------------------------------------------
  async listTransactionsAdmin(): Promise<AdminTransactionItem[]> {
    const services = getFirebaseServices();
    if (!services) return [];
    try {
      const q = query(
        collection(services.db, FIRESTORE_COLLECTIONS.transactions),
        orderBy('createdAt', 'desc'),
        limit(120)
      );
      const snap = await getDocs(q);
      return snap.docs.map((d) => {
        const data = d.data() as FirestoreTransactionDoc;
        return {
          id: data.id,
          transactionId: data.transactionId ?? data.id,
          userId: data.userId,
          type: data.type,
          amount: Number(data.amount ?? 0),
          balanceBefore: Number(data.balanceBefore ?? 0),
          balanceAfter: Number(data.balanceAfter ?? 0),
          reference: data.reference,
          referenceId: data.referenceId ?? data.reference,
          description: data.description ?? data.reason ?? '—',
          reason: data.reason ?? data.description ?? '—',
          createdBy: data.createdBy ?? data.adminId ?? 'System',
          adminId: data.adminId ?? data.createdBy ?? 'System',
          createdAtLabel: formatTs(data.createdAt),
        };
      });
    } catch (error) {
      handleFirestoreError(
        error,
        OperationType.LIST,
        FIRESTORE_COLLECTIONS.transactions,
        services.auth
      );
    }
  },

  // ---------------------------------------------------------------------------
  // 7. API Providers Management (Admin-only)
  // ---------------------------------------------------------------------------
  async listApiProviders(): Promise<AdminApiProviderItem[]> {
    const services = getFirebaseServices();
    if (!services) return [];
    try {
      const snap = await getDocs(collection(services.db, FIRESTORE_COLLECTIONS.apiProviders));
      return snap.docs.map((d) => {
        const data = d.data() as FirestoreApiProviderDoc;
        return {
          id: data.id,
          name: data.name,
          apiUrl: data.apiUrl,
          apiKey: data.apiKey,
          providerFormat: data.providerFormat ?? 'standard_v2',
          lastBalance:
            typeof data.lastBalance === 'number' ? Number(data.lastBalance) : undefined,
          lastBalanceCurrency: data.lastBalanceCurrency ?? undefined,
          status: data.status,
          createdAtLabel: formatTs(data.createdAt),
          updatedAtLabel: formatTs(data.updatedAt),
        };
      });
    } catch (error) {
      handleFirestoreError(
        error,
        OperationType.LIST,
        FIRESTORE_COLLECTIONS.apiProviders,
        services.auth
      );
    }
  },

  async saveApiProvider(input: {
    id?: string;
    name: string;
    apiUrl: string;
    apiKey: string;
    providerFormat?: string;
    lastBalance?: number;
    lastBalanceCurrency?: string;
    status: 'active' | 'inactive';
  }): Promise<string> {
    const services = getFirebaseServices();
    if (!services) throw new Error('Firebase is not connected.');

    const cleanUrl = input.apiUrl.trim();
    try {
      const parsed = new URL(cleanUrl);
      if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
        throw new Error('API URL must begin with https:// or http://.');
      }
    } catch {
      throw new Error('Please enter a valid Provider API URL (e.g. https://example.com/api/v2).');
    }

    const isUpdate = Boolean(input.id);
    const provId = input.id ? input.id : `prov-${Date.now().toString().slice(-6)}`;
    const ref = doc(services.db, FIRESTORE_COLLECTIONS.apiProviders, provId);

    try {
      let existingData: FirestoreApiProviderDoc | null = null;
      if (isUpdate) {
        const snap = await getDoc(ref);
        if (snap.exists()) {
          existingData = snap.data() as FirestoreApiProviderDoc;
        }
      }

      const resolvedBalance =
        typeof input.lastBalance === 'number' && Number.isFinite(input.lastBalance)
          ? Number(input.lastBalance)
          : typeof existingData?.lastBalance === 'number'
            ? existingData.lastBalance
            : undefined;
      const resolvedCurrency =
        input.lastBalanceCurrency?.trim() || existingData?.lastBalanceCurrency || undefined;

      const payload: FirestoreApiProviderDoc = {
        id: provId,
        name: input.name.trim(),
        apiUrl: cleanUrl,
        apiKey: input.apiKey.trim(),
        providerFormat: input.providerFormat?.trim() || 'standard_v2',
        ...(typeof resolvedBalance === 'number' ? { lastBalance: resolvedBalance } : {}),
        ...(resolvedCurrency ? { lastBalanceCurrency: resolvedCurrency.slice(0, 16) } : {}),
        status: input.status,
        createdAt: existingData?.createdAt ?? serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      await setDoc(ref, payload);
      return provId;
    } catch (error) {
      handleFirestoreError(
        error,
        isUpdate ? OperationType.UPDATE : OperationType.CREATE,
        `${FIRESTORE_COLLECTIONS.apiProviders}/${provId}`,
        services.auth
      );
    }
  },

  async saveProviderBalance(
    provId: string,
    balance: number,
    currency: string
  ): Promise<void> {
    const services = getFirebaseServices();
    if (!services) return;
    try {
      await updateDoc(doc(services.db, FIRESTORE_COLLECTIONS.apiProviders, provId), {
        lastBalance: Number(balance),
        lastBalanceCurrency: currency.slice(0, 16) || 'USD',
        updatedAt: serverTimestamp(),
      });
    } catch {
      // Non-blocking balance cache update
    }
  },

  async deleteApiProvider(provId: string): Promise<void> {
    const services = getFirebaseServices();
    if (!services) throw new Error('Firebase is not connected.');
    try {
      await deleteDoc(doc(services.db, FIRESTORE_COLLECTIONS.apiProviders, provId));
    } catch (error) {
      handleFirestoreError(
        error,
        OperationType.DELETE,
        `${FIRESTORE_COLLECTIONS.apiProviders}/${provId}`,
        services.auth
      );
    }
  },

  // ---------------------------------------------------------------------------
  // 8. Support Tickets Management
  // ---------------------------------------------------------------------------
  async listTicketsAdmin(): Promise<AdminTicketItem[]> {
    const services = getFirebaseServices();
    if (!services) return [];
    try {
      const q = query(
        collection(services.db, FIRESTORE_COLLECTIONS.supportTickets),
        orderBy('updatedAt', 'desc'),
        limit(100)
      );
      const snap = await getDocs(q);
      return snap.docs.map((d) => {
        const data = d.data() as FirestoreSupportTicketDoc;
        return {
          id: data.id,
          userId: data.userId,
          category: data.category ?? 'Order Issue',
          subject: data.subject,
          orderReference: data.orderReference ?? '',
          ...(data.attachmentUrl ? { attachmentUrl: data.attachmentUrl } : {}),
          message: data.message,
          adminReply: data.adminReply ?? '',
          repliedBy: data.repliedBy ?? '',
          status: data.status,
          priority: data.priority,
          createdAtLabel: formatTs(data.createdAt),
          updatedAtLabel: formatTs(data.updatedAt),
        };
      });
    } catch (error) {
      handleFirestoreError(
        error,
        OperationType.LIST,
        FIRESTORE_COLLECTIONS.supportTickets,
        services.auth
      );
    }
  },

  async updateTicketAdmin(
    ticketId: string,
    patch: {
      adminReply?: string;
      repliedBy?: string;
      status: SupportTicketStatusFirestore;
      priority: 'Low' | 'Medium' | 'High';
    }
  ): Promise<void> {
    const services = getFirebaseServices();
    if (!services) throw new Error('Firebase is not connected.');
    const ref = doc(services.db, FIRESTORE_COLLECTIONS.supportTickets, ticketId);

    try {
      const prevSnap = await getDoc(ref);
      const prevData = prevSnap.exists() ? (prevSnap.data() as FirestoreSupportTicketDoc) : null;
      const actingAdminUid = services.auth.currentUser?.uid || patch.repliedBy || 'admin';
      const cleanReply = patch.adminReply?.trim();

      await updateDoc(ref, {
        status: patch.status,
        priority: patch.priority,
        ...(cleanReply ? { adminReply: cleanReply } : {}),
        ...(patch.repliedBy !== undefined ? { repliedBy: patch.repliedBy } : {}),
        updatedAt: serverTimestamp(),
      });

      if (cleanReply && actingAdminUid) {
        const replyId = `msg-adm-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;
        const replyPayload: FirestoreTicketReplyDoc = {
          id: replyId,
          messageId: replyId,
          ticketId,
          senderId: actingAdminUid,
          senderName: 'Support Team',
          senderRole: 'admin',
          message: cleanReply.slice(0, 2000),
          createdAt: serverTimestamp(),
        };
        await setDoc(
          doc(
            services.db,
            FIRESTORE_COLLECTIONS.supportTickets,
            ticketId,
            'messages',
            replyId
          ),
          replyPayload
        );
      }

      if (prevData) {
        const ticketUpper = ticketId.toUpperCase();
        if (cleanReply || prevData.status !== patch.status) {
          const notifId = `ntf-tkt-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;
          await setDoc(doc(services.db, FIRESTORE_COLLECTIONS.notifications, notifId), {
            id: notifId,
            notificationId: notifId,
            userId: prevData.userId,
            targetType: 'user',
            title: cleanReply
              ? `Support Reply · ${ticketUpper}`
              : `Ticket Status Updated · ${ticketUpper}`,
            message: cleanReply
              ? `সাপোর্ট টিকেট ${ticketUpper}-এ নতুন উত্তর এসেছে: ${cleanReply.slice(0, 120)}`
              : `আপনার সাপোর্ট টিকেট ${ticketUpper} এর অবস্থা "${patch.status}" করা হয়েছে।`,
            type: 'support_reply',
            referenceId: ticketId,
            read: false,
            isRead: false,
            createdAt: serverTimestamp(),
          } satisfies FirestoreNotificationDoc).catch(() => undefined);
        }

        await this.logAuditEvent({
          action: cleanReply ? 'ticket_reply' : 'ticket_status_change',
          adminId: actingAdminUid,
          targetId: ticketId,
          targetType: 'ticket',
          previousValue: prevData.status,
          newValue: patch.status,
          note: cleanReply ? cleanReply.slice(0, 250) : undefined,
        });
      }
    } catch (error) {
      handleFirestoreError(
        error,
        OperationType.UPDATE,
        `${FIRESTORE_COLLECTIONS.supportTickets}/${ticketId}`,
        services.auth
      );
    }
  },

  // ---------------------------------------------------------------------------
  // 9. Notifications Management
  // ---------------------------------------------------------------------------
  async listNotificationsAdmin(): Promise<AdminNotificationItem[]> {
    const services = getFirebaseServices();
    if (!services) return [];
    try {
      const q = query(
        collection(services.db, FIRESTORE_COLLECTIONS.notifications),
        orderBy('createdAt', 'desc'),
        limit(100)
      );
      const snap = await getDocs(q);
      return snap.docs.map((d) => {
        const data = d.data() as FirestoreNotificationDoc;
        return {
          id: data.id,
          userId: data.userId,
          targetType: data.targetType ?? (data.userId === 'all' ? 'all' : 'user'),
          title: data.title,
          message: data.message,
          type: data.type,
          referenceId: data.referenceId,
          read: Boolean(data.isRead ?? data.read),
          createdAtLabel: formatTs(data.createdAt),
        };
      });
    } catch (error) {
      handleFirestoreError(
        error,
        OperationType.LIST,
        FIRESTORE_COLLECTIONS.notifications,
        services.auth
      );
    }
  },

  async sendNotification(input: {
    targetType: 'all' | 'user';
    userId?: string;
    title: string;
    message: string;
    type: NotificationTypeFirestore;
    referenceId?: string;
  }): Promise<string> {
    const services = getFirebaseServices();
    if (!services) throw new Error('Firebase is not connected.');

    const targetUid = input.targetType === 'all' ? 'all' : (input.userId ?? '').trim();
    if (!targetUid) {
      throw new Error('Target user ID is required for targeted notifications.');
    }

    const notifId = `ntf-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;
    const payload: FirestoreNotificationDoc = {
      id: notifId,
      notificationId: notifId,
      userId: targetUid,
      targetType: input.targetType,
      title: input.title.trim().slice(0, 120),
      message: input.message.trim().slice(0, 500),
      type: input.type,
      ...(input.referenceId?.trim() ? { referenceId: input.referenceId.trim().slice(0, 128) } : {}),
      read: false,
      isRead: false,
      createdAt: serverTimestamp(),
    };

    try {
      await setDoc(doc(services.db, FIRESTORE_COLLECTIONS.notifications, notifId), payload);
      return notifId;
    } catch (error) {
      handleFirestoreError(
        error,
        OperationType.CREATE,
        `${FIRESTORE_COLLECTIONS.notifications}/${notifId}`,
        services.auth
      );
    }
  },

  async deleteNotification(notifId: string): Promise<void> {
    const services = getFirebaseServices();
    if (!services) throw new Error('Firebase is not connected.');
    try {
      await deleteDoc(doc(services.db, FIRESTORE_COLLECTIONS.notifications, notifId));
    } catch (error) {
      handleFirestoreError(
        error,
        OperationType.DELETE,
        `${FIRESTORE_COLLECTIONS.notifications}/${notifId}`,
        services.auth
      );
    }
  },

  // ---------------------------------------------------------------------------
  // 10. Staff RBAC Management (Super Admin / Admin)
  // ---------------------------------------------------------------------------
  async listAdminStaff(): Promise<AdminStaffMember[]> {
    const services = getFirebaseServices();
    if (!services) return [];
    try {
      const snap = await getDocs(collection(services.db, FIRESTORE_COLLECTIONS.adminUsers));
      return snap.docs
        .map((d) => {
          const data = d.data() as FirestoreAdminUserDoc;
          return {
            uid: data.uid,
            name: data.name ?? data.email.split('@')[0] ?? 'Staff',
            email: data.email,
            role: data.role,
            status: data.status,
            createdAtLabel: formatTs(data.createdAt),
            updatedAtLabel: formatTs(data.updatedAt),
          };
        })
        .sort((a, b) => a.email.localeCompare(b.email));
    } catch (error) {
      handleFirestoreError(
        error,
        OperationType.LIST,
        FIRESTORE_COLLECTIONS.adminUsers,
        services.auth
      );
    }
  },

  async createAdminStaffAccount(input: {
    name: string;
    email: string;
    password: string;
    role: AdminStaffRole;
  }): Promise<string> {
    const services = getFirebaseServices();
    if (!services || !services.auth.currentUser) {
      throw new Error('Super Admin session is required.');
    }

    const cleanName = input.name.trim();
    const cleanEmail = input.email.trim().toLowerCase();
    if (!cleanName || !cleanEmail || input.password.length < 6) {
      throw new Error('Name, valid email, and password (minimum 6 characters) are required.');
    }

    const createdUid = await createAuthUserOnSecondaryApp(cleanEmail, input.password, cleanName);

    const adminPayload: FirestoreAdminUserDoc = {
      uid: createdUid,
      name: cleanName.slice(0, 120),
      email: cleanEmail.slice(0, 180),
      role: input.role,
      status: 'active',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    try {
      await setDoc(doc(services.db, FIRESTORE_COLLECTIONS.adminUsers, createdUid), adminPayload);
      await updateDoc(doc(services.db, FIRESTORE_COLLECTIONS.users, createdUid), {
        role: 'admin',
        updatedAt: serverTimestamp(),
      }).catch(() => undefined);

      await this.logAuditEvent({
        action: 'staff_created',
        adminId: services.auth.currentUser.uid,
        targetId: createdUid,
        targetType: 'user',
        previousValue: 'none',
        newValue: `${cleanEmail} (${input.role})`,
      });
    } catch (error) {
      handleFirestoreError(
        error,
        OperationType.CREATE,
        `${FIRESTORE_COLLECTIONS.adminUsers}/${createdUid}`,
        services.auth
      );
    }

    return createdUid;
  },

  async updateAdminStaffRole(
    uid: string,
    role: AdminStaffRole,
    status: 'active' | 'revoked'
  ): Promise<void> {
    const services = getFirebaseServices();
    if (!services || !services.auth.currentUser) {
      throw new Error('Super Admin session is required.');
    }

    const adminRef = doc(services.db, FIRESTORE_COLLECTIONS.adminUsers, uid);
    try {
      const prevSnap = await getDoc(adminRef);
      const prevData = prevSnap.exists() ? (prevSnap.data() as FirestoreAdminUserDoc) : null;

      await updateDoc(adminRef, {
        role,
        status,
        updatedAt: serverTimestamp(),
      });

      await updateDoc(doc(services.db, FIRESTORE_COLLECTIONS.users, uid), {
        role: status === 'active' ? 'admin' : 'user',
        updatedAt: serverTimestamp(),
      }).catch(() => undefined);

      await this.logAuditEvent({
        action: 'staff_role_updated',
        adminId: services.auth.currentUser.uid,
        targetId: uid,
        targetType: 'user',
        previousValue: prevData ? `${prevData.role} (${prevData.status})` : 'unknown',
        newValue: `${role} (${status})`,
      });
    } catch (error) {
      handleFirestoreError(
        error,
        OperationType.UPDATE,
        `${FIRESTORE_COLLECTIONS.adminUsers}/${uid}`,
        services.auth
      );
    }
  },

  // ---------------------------------------------------------------------------
  // 11. System Health Diagnostics & Safe White-Label Backup
  // ---------------------------------------------------------------------------
  async runSystemHealthCheck(): Promise<SystemHealthReport> {
    const services = getFirebaseServices();
    const activeCfg = resolveActiveFirebaseConfig();
    const fbConfigured = hasValidFirebaseConfig();

    const [connRes, setupState, providers, payMethods] = await Promise.all([
      testFirestoreConnection(),
      inspectSetupState(),
      this.listApiProviders().catch(() => []),
      this.listPaymentMethodsAdmin().catch(() => []),
    ]);

    const currentUser = services?.auth.currentUser ?? null;
    const activeProviders = providers.filter((p) => p.status === 'active');
    let providerCheck: SystemHealthCheckItem;

    if (activeProviders.length === 0) {
      providerCheck = {
        id: 'provider',
        label: 'SMM Provider API',
        ok: false,
        statusLabel: 'Not Configured',
        detail: 'No active upstream SMM provider added yet.',
      };
    } else {
      const primaryProv = activeProviders[0];
      try {
        const res = await getProviderAdapter().testConnection({
          providerId: primaryProv.id,
          apiUrl: '',
          apiKey: '',
          format: primaryProv.providerFormat,
        });
        providerCheck = {
          id: 'provider',
          label: 'SMM Provider API',
          ok: res.ok,
          statusLabel: res.ok ? 'Connected' : 'Unreachable',
          detail: res.ok
            ? `${primaryProv.name} · Live balance ${res.balance?.toFixed(2) ?? '0.00'} ${res.currency ?? 'USD'}`
            : `${primaryProv.name} · ${res.message || 'API probe failed'}`,
        };
      } catch (err) {
        providerCheck = {
          id: 'provider',
          label: 'SMM Provider API',
          ok: false,
          statusLabel: 'Error',
          detail: err instanceof Error ? err.message : 'Unable to probe provider balance.',
        };
      }
    }

    const activePayMethods = payMethods.filter((m) => m.status === 'active');

    const checks: SystemHealthCheckItem[] = [
      {
        id: 'firebase',
        label: 'Firebase Configuration',
        ok: fbConfigured,
        statusLabel: fbConfigured ? 'Configured' : 'Missing',
        detail: activeCfg
          ? `Project: ${activeCfg.projectId}${activeCfg.firestoreDatabaseId ? ` (${activeCfg.firestoreDatabaseId})` : ''}`
          : 'No valid Firebase runtime configuration active.',
      },
      {
        id: 'firestore',
        label: 'Firestore Database',
        ok: connRes.connected,
        statusLabel: connRes.connected ? 'Reachable' : 'Offline',
        detail: connRes.connected
          ? 'Live server roundtrip verified via getDocFromServer.'
          : connRes.errorMessage || 'Firestore unreachable.',
      },
      {
        id: 'auth',
        label: 'Authentication',
        ok: Boolean(currentUser),
        statusLabel: currentUser ? 'Active Session' : 'Signed Out',
        detail: currentUser?.email
          ? `Authenticated as ${currentUser.email}`
          : 'No active Firebase Auth session.',
      },
      providerCheck,
      {
        id: 'payments',
        label: 'Payment System',
        ok: activePayMethods.length > 0,
        statusLabel: activePayMethods.length > 0 ? 'Ready' : 'No Active Methods',
        detail: `${activePayMethods.length} active payment method(s) enabled (${payMethods.length} total).`,
      },
      {
        id: 'schema',
        label: 'Database Schema & Setup',
        ok: setupState.databaseInitialized,
        statusLabel: setupState.databaseInitialized ? 'Initialized' : 'Needs Init',
        detail: setupState.installationId
          ? `Installation ID ${setupState.installationId} · Schema ${PRODUCT_INFO.schemaVersion}`
          : `Run initializeDatabase() to assign an Installation ID.`,
      },
    ];

    return {
      checkedAtLabel: new Date().toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }),
      overallOk: checks.every((c) => c.ok),
      checks,
    };
  },

  async exportSafeConfigurationBackup(): Promise<SafeConfigurationBackup> {
    const [sysSettings, categories, services, paymentMethods, providers] = await Promise.all([
      adminService.getSystemSettings(),
      this.listCategories(),
      this.listServicesAdmin(),
      this.listPaymentMethodsAdmin(),
      this.listApiProviders(),
    ]);

    const safeSettings = sysSettings
      ? {
          ...sysSettings,
          initializedAt: undefined,
          updatedAt: undefined,
        }
      : null;

    return {
      exportedAt: new Date().toISOString(),
      product: {
        name: PRODUCT_INFO.name,
        version: PRODUCT_INFO.version,
        schemaVersion: PRODUCT_INFO.schemaVersion,
        installationId: sysSettings?.installationId || 'UNASSIGNED',
      },
      settings: safeSettings,
      categories: categories.map((c) => ({
        id: c.id,
        name: c.name,
        icon: c.icon,
        description: c.description,
        status: c.status,
        sortOrder: c.sortOrder,
      })),
      services: services.map((s) => ({
        id: s.id,
        categoryId: s.categoryId,
        name: s.name,
        serviceType: s.serviceType,
        description: s.description,
        sellingPrice: s.sellingPrice,
        minQuantity: s.minQuantity,
        maxQuantity: s.maxQuantity,
        averageTime: s.averageTime,
        deliverySpeed: s.deliverySpeed,
        refillGuaranteed: s.refillGuaranteed,
        status: s.status,
      })),
      paymentMethods: paymentMethods.map((m) => ({
        id: m.id,
        name: m.name,
        type: m.type,
        accountNumber: m.accountNumber,
        instructions: m.instructions,
        note: m.note,
        minAmount: m.minAmount,
        maxAmount: m.maxAmount,
        status: m.status,
        displayOrder: m.displayOrder,
      })),
      providersRedacted: providers.map((p) => ({
        id: p.id,
        name: p.name,
        apiUrl: p.apiUrl,
        apiKey: '[REDACTED]',
        providerFormat: p.providerFormat,
        status: p.status,
      })),
    };
  },
};
