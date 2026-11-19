import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  setDoc,
  updateDoc,
  where,
  serverTimestamp,
  type Timestamp,
  type Unsubscribe,
} from 'firebase/firestore';
import { getFirebaseServices } from '../lib/firebase/client';
import {
  FIRESTORE_COLLECTIONS,
  SETTINGS_DOC_IDS,
  type AdminNotificationTypeFirestore,
  type FirestoreAdminNotificationDoc,
  type FirestoreCategoryDoc,
  type FirestoreNotificationDoc,
  type FirestoreOrderDoc,
  type FirestorePaymentDoc,
  type FirestorePaymentMethodDoc,
  type FirestoreServiceDoc,
  type FirestoreSettingsDoc,
  type FirestoreSupportTicketDoc,
  type FirestoreTicketReplyDoc,
  type FirestoreTransactionDoc,
  type FirestoreUserDoc,
} from '../lib/firestore/collections';
import { OperationType, handleFirestoreError } from '../lib/firestore/errors';
import type {
  CreateOrderInput,
  CreateTicketInput,
  CustomerPaymentRequest,
  CustomerProfile,
  NotificationItem,
  OrderRecord,
  OrderStatsSummary,
  PaymentMethodItem,
  PlatformCategory,
  PlatformId,
  ServiceType,
  SmmService,
  SupportTicket,
  TicketPriority,
  TicketReply,
  TicketSubject,
  WalletSummary,
  WalletTransaction,
} from '../types';
import { APP_CONFIG } from '../config/app.config';
import { dataClient as demoClient, type IDataClient } from './dataClient';
import {
  calculateOrderCharge,
  isPackageService,
  normalizeCurrencySymbol,
} from '../utils/pricing';

export interface PublicCatalogBundle {
  platforms: PlatformCategory[];
  services: SmmService[];
  systemSettings: Partial<FirestoreSettingsDoc> | null;
  paymentMethods: PaymentMethodItem[];
}

const PUBLIC_MEMORY_TTL_MS = 15_000;
let memoryPublicBundle: PublicCatalogBundle | null = null;
let memoryPublicBundleAt = 0;
let inFlightPublicBundle: Promise<PublicCatalogBundle> | null = null;

export function invalidatePublicCatalogCache(): void {
  memoryPublicBundle = null;
  memoryPublicBundleAt = 0;
  inFlightPublicBundle = null;
}

async function getDynamicCurrencySymbol(): Promise<string> {
  const cachedSettings = memoryPublicBundle?.systemSettings;
  if (cachedSettings?.currencySymbol?.trim()) {
    return normalizeCurrencySymbol(cachedSettings.currencySymbol, cachedSettings.currency);
  }

  const services = getFirebaseServices();
  if (!services) return APP_CONFIG.currencySymbol;
  try {
    const sysSnap = await getDoc(doc(services.db, FIRESTORE_COLLECTIONS.settings, SETTINGS_DOC_IDS.system));
    if (sysSnap.exists()) {
      const data = sysSnap.data() as { currencySymbol?: string; currency?: string };
      return normalizeCurrencySymbol(data.currencySymbol, data.currency);
    }
  } catch {
    // Fallback cleanly
  }
  return APP_CONFIG.currencySymbol;
}

export function formatFirestoreTimestamp(
  ts: unknown,
  fallback = 'Recent'
): { label: string; iso: string; ms: number } {
  try {
    if (ts && typeof ts === 'object' && 'toDate' in ts) {
      const date = (ts as Timestamp).toDate();
      return {
        label: date.toLocaleString('en-US', {
          month: 'short',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
        }),
        iso: date.toISOString(),
        ms: date.getTime(),
      };
    }
  } catch {
    // Fallback
  }
  return { label: fallback, iso: new Date(0).toISOString(), ms: 0 };
}

export function mapCustomerOrderDoc(data: FirestoreOrderDoc): OrderRecord {
  const created = formatFirestoreTimestamp(data.createdAt, 'Synced');
  const updated = formatFirestoreTimestamp(data.updatedAt, created.label);
  const completed = data.completedAt ? formatFirestoreTimestamp(data.completedAt, '') : null;
  const lastChecked = data.lastCheckedAt ? formatFirestoreTimestamp(data.lastCheckedAt, '') : null;

  // Strictly omit providerId, providerOrderId, providerCharge, lastError, internalNote
  return {
    id: data.id,
    orderNumber: data.id.replace(/^ord-/, ''),
    categoryId: (data.categoryId ?? 'instagram') as PlatformId,
    serviceId: data.serviceId,
    serviceName: data.serviceName ?? 'SMM Service',
    link: data.link,
    quantity: Number(data.quantity ?? 0),
    charge: Number(data.charge ?? 0),
    status: data.status,
    startCount: Number(data.startCount ?? 0),
    remains: Number(data.remains ?? 0),
    paymentStatus: data.paymentStatus,
    paymentTransactionId: data.paymentTransactionId,
    refunded: Boolean(data.refunded),
    refundTransactionId: data.refundTransactionId,
    createdAtLabel: created.label,
    createdAtIso: created.iso,
    updatedAtLabel: updated.label,
    updatedAtIso: updated.iso,
    ...(completed?.label ? { completedAtLabel: completed.label } : {}),
    ...(lastChecked?.label ? { lastCheckedAtLabel: lastChecked.label } : {}),
  };
}

export function getLocalReadBroadcastIds(uid: string): Set<string> {
  try {
    const raw = localStorage.getItem(`rj_read_broadcasts_${uid}`);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? new Set(parsed.filter((x) => typeof x === 'string')) : new Set();
  } catch {
    return new Set();
  }
}

function saveLocalReadBroadcastIds(uid: string, ids: Set<string>): void {
  try {
    localStorage.setItem(`rj_read_broadcasts_${uid}`, JSON.stringify(Array.from(ids)));
  } catch {
    // Ignore storage issues
  }
}

function validateTargetUrl(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.length < 5 || trimmed.length > 500) {
    throw new Error('Please enter a valid target link (5 to 500 characters).');
  }
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new Error('Link must start with https:// or http://.');
    }
  } catch {
    throw new Error('Please enter a valid URL starting with https:// or http://.');
  }
  return trimmed;
}

function emitAdminNotification(
  type: Extract<AdminNotificationTypeFirestore, 'new_order' | 'new_payment' | 'new_ticket'>,
  title: string,
  message: string,
  referenceId?: string
): void {
  const services = getFirebaseServices();
  const uid = services?.auth.currentUser?.uid;
  if (!services || !uid) return;

  const notifId = `adm-${type}-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;
  const payload: FirestoreAdminNotificationDoc = {
    id: notifId,
    type,
    title: title.slice(0, 120),
    message: message.slice(0, 500),
    ...(referenceId ? { referenceId: referenceId.slice(0, 128) } : {}),
    actorUid: uid,
    read: false,
    createdAt: serverTimestamp(),
  };

  void setDoc(doc(services.db, FIRESTORE_COLLECTIONS.adminNotifications, notifId), payload).catch(
    () => undefined
  );
}

/**
 * Fetches settings, active categories, active services, and active payment methods
 * in a single parallel batch with in-flight deduplication and short-lived memory caching.
 */
export async function fetchPublicCatalogBundle(options?: {
  forceRefresh?: boolean;
}): Promise<PublicCatalogBundle> {
  const forceRefresh = Boolean(options?.forceRefresh);
  if (!forceRefresh) {
    if (memoryPublicBundle && Date.now() - memoryPublicBundleAt < PUBLIC_MEMORY_TTL_MS) {
      return memoryPublicBundle;
    }
    if (inFlightPublicBundle) {
      return inFlightPublicBundle;
    }
  }

  const services = getFirebaseServices();
  if (!services) {
    const [demoPlatforms, demoServices] = await Promise.all([
      demoClient.getPlatforms(),
      demoClient.getServices(),
    ]);
    return {
      platforms: demoPlatforms,
      services: demoServices,
      systemSettings: null,
      paymentMethods: [],
    };
  }

  const loadPromise = (async (): Promise<PublicCatalogBundle> => {
    const [sysSnap, catSnap, srvSnap, pmSnap] = await Promise.all([
      getDoc(doc(services.db, FIRESTORE_COLLECTIONS.settings, SETTINGS_DOC_IDS.system)).catch(
        () => null
      ),
      getDocs(
        query(collection(services.db, FIRESTORE_COLLECTIONS.categories), orderBy('sortOrder', 'asc'))
      ).catch(() => null),
      getDocs(collection(services.db, FIRESTORE_COLLECTIONS.services)).catch(() => null),
      getDocs(
        query(
          collection(services.db, FIRESTORE_COLLECTIONS.paymentMethods),
          where('status', '==', 'active')
        )
      ).catch(() => null),
    ]);

    const rawSystemSettings: Partial<FirestoreSettingsDoc> | null =
      sysSnap && sysSnap.exists() ? (sysSnap.data() as FirestoreSettingsDoc) : null;
    const systemSettings: Partial<FirestoreSettingsDoc> | null = rawSystemSettings
      ? {
          ...rawSystemSettings,
          currencySymbol: normalizeCurrencySymbol(
            rawSystemSettings.currencySymbol,
            rawSystemSettings.currency
          ),
        }
      : null;
    const hideDemo = Boolean(
      systemSettings?.productionMode && systemSettings?.demoDataEnabled === false
    );

    const categoryStatusMap = new Map<string, string>();
    let platforms: PlatformCategory[] = [];

    if (catSnap && !catSnap.empty) {
      const catDocs = catSnap.docs.map((d) => d.data() as FirestoreCategoryDoc);
      catDocs.forEach((cat) => categoryStatusMap.set(cat.id, cat.status));
      platforms = catDocs
        .filter((data) => data.status === 'active' && (!hideDemo || !data.isDemo))
        .map((data) => ({
          id: data.id as PlatformId,
          name: data.name,
          shortName: data.id === 'x' || data.name.toLowerCase().startsWith('x ') ? 'X' : data.name,
          icon: data.icon,
          description: data.description ?? '',
          accentColor: '#6D28D9',
          bgTint: 'bg-violet-50',
          serviceCount: 0,
        }));
    } else if (!hideDemo && catSnap && catSnap.empty) {
      platforms = await demoClient.getPlatforms();
    }

    let parsedServices: SmmService[] = [];
    if (srvSnap && !srvSnap.empty) {
      // Strictly omit providerId, providerServiceId, and costPrice from customer DTOs
      parsedServices = srvSnap.docs
        .map((d) => d.data() as FirestoreServiceDoc)
        .filter((s) => {
          if (s.status !== 'active') return false;
          if (hideDemo && s.isDemo) return false;
          if (categoryStatusMap.size > 0) {
            const catStatus = categoryStatusMap.get(s.categoryId);
            if (catStatus && catStatus !== 'active') return false;
          }
          return true;
        })
        .map((s) => ({
          id: s.id,
          categoryId: s.categoryId as PlatformId,
          name: s.name,
          serviceType: (s.serviceType as ServiceType) ?? 'Other',
          ratePerThousand: Number(s.sellingPrice ?? 0),
          minQuantity: Number(s.minQuantity ?? 1),
          maxQuantity: Number(s.maxQuantity ?? 10000),
          averageTime: s.averageTime ?? '15 minutes',
          deliverySpeed: s.deliverySpeed ?? 'Instant Delivery',
          refillGuaranteed: Boolean(s.refillGuaranteed),
          description: s.description ?? '',
        }));
    } else if (!hideDemo && srvSnap && srvSnap.empty) {
      parsedServices = await demoClient.getServices();
    }

    const paymentMethods: PaymentMethodItem[] = pmSnap
      ? pmSnap.docs
          .map((d) => {
            const data = d.data() as FirestorePaymentMethodDoc;
            return {
              id: data.id,
              name: data.name,
              type: data.type,
              accountNumber: data.accountNumber,
              instructions: data.instructions,
              note: data.note ?? '',
              minAmount: Number(data.minAmount ?? 10),
              maxAmount: Number(data.maxAmount ?? 100000),
              status: data.status,
              displayOrder: Number(data.displayOrder ?? 0),
            };
          })
          .sort((a, b) => a.displayOrder - b.displayOrder)
      : [];

    const bundle: PublicCatalogBundle = {
      platforms,
      services: parsedServices,
      systemSettings,
      paymentMethods,
    };
    memoryPublicBundle = bundle;
    memoryPublicBundleAt = Date.now();
    return bundle;
  })().finally(() => {
    if (inFlightPublicBundle === loadPromise) {
      inFlightPublicBundle = null;
    }
  });

  inFlightPublicBundle = loadPromise;
  return loadPromise;
}

export class FirestoreDataClient implements IDataClient {
  async getPlatforms(): Promise<PlatformCategory[]> {
    const bundle = await fetchPublicCatalogBundle();
    return bundle.platforms;
  }

  async getServices(): Promise<SmmService[]> {
    const bundle = await fetchPublicCatalogBundle();
    return bundle.services;
  }

  async getOrders(pageSize = 100): Promise<OrderRecord[]> {
    const services = getFirebaseServices();
    const uid = services?.auth.currentUser?.uid;
    if (!services || !uid) return [];

    try {
      const q = query(
        collection(services.db, FIRESTORE_COLLECTIONS.orders),
        where('userId', '==', uid),
        limit(pageSize)
      );
      const snap = await getDocs(q);
      if (snap.empty) return [];

      const rows: OrderRecord[] = snap.docs.map((d) =>
        mapCustomerOrderDoc(d.data() as FirestoreOrderDoc)
      );

      return rows.sort((a, b) => b.createdAtIso.localeCompare(a.createdAtIso));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, FIRESTORE_COLLECTIONS.orders, services.auth);
    }
  }

  async getOrderStats(): Promise<OrderStatsSummary> {
    const services = getFirebaseServices();
    const uid = services?.auth.currentUser?.uid;
    if (!services || !uid) {
      return { totalOrders: 0, completedOrders: 0, pendingOrders: 0 };
    }

    try {
      const orders = await this.getOrders(100);
      return {
        totalOrders: orders.length,
        completedOrders: orders.filter((o) => o.status === 'Completed').length,
        pendingOrders: orders.filter(
          (o) => o.status === 'Pending' || o.status === 'Processing' || o.status === 'In Progress'
        ).length,
      };
    } catch {
      return { totalOrders: 0, completedOrders: 0, pendingOrders: 0 };
    }
  }

  /**
   * Authoritative Atomic Order Creation & Wallet Deduction Flow:
   * 1. Runs inside Firestore runTransaction()
   * 2. Reads active service & customer user document
   * 3. Validates URL format, quantity bounds, and authoritative sellingPrice charge
   * 4. Rejects with Bengali message if wallet balance < charge
   * 5. Atomically deducts user balance, creates order (paymentStatus: 'paid'),
   *    creates order_payment transaction ledger record, logs customer notification,
   *    and emits non-blocking new_order admin alert.
   */
  async createOrder(input: CreateOrderInput, _service: SmmService): Promise<OrderRecord> {
    const services = getFirebaseServices();
    const uid = services?.auth.currentUser?.uid;
    if (!services || !uid) {
      throw new Error('Please sign in to place an order.');
    }

    const validatedLink = validateTargetUrl(input.link);
    const quantity = Math.floor(Number(input.quantity));
    if (!Number.isFinite(quantity) || quantity < 1) {
      throw new Error('Please enter a valid positive quantity.');
    }

    const srvRef = doc(services.db, FIRESTORE_COLLECTIONS.services, input.serviceId);
    const userRef = doc(services.db, FIRESTORE_COLLECTIONS.users, uid);

    const rawIdemKey = input.idempotencyKey?.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 48);
    const orderNumber =
      rawIdemKey && rawIdemKey.length >= 6
        ? rawIdemKey
        : `${10258 + Math.floor(Math.random() * 89000)}-${Date.now().toString().slice(-4)}`;
    const id = `ord-${orderNumber}`;
    const txnId = `txn-ord-${orderNumber}`;
    const notifId = `ntf-ord-${orderNumber}`;

    const orderRef = doc(services.db, FIRESTORE_COLLECTIONS.orders, id);
    const txnRef = doc(services.db, FIRESTORE_COLLECTIONS.transactions, txnId);
    const notifRef = doc(services.db, FIRESTORE_COLLECTIONS.notifications, notifId);
    const currencySymbol = await getDynamicCurrencySymbol();

    try {
      const createdRecord = await runTransaction(services.db, async (tx) => {
        const [existingOrderSnap, srvSnap, userSnap] = await Promise.all([
          tx.get(orderRef),
          tx.get(srvRef),
          tx.get(userRef),
        ]);

        if (existingOrderSnap.exists()) {
          throw new Error('Duplicate order request blocked. Please wait a moment before ordering again.');
        }

        if (!userSnap.exists()) {
          throw new Error('Your account profile could not be verified.');
        }
        const userDoc = userSnap.data() as FirestoreUserDoc;
        if (userDoc.status !== 'active') {
          throw new Error('Only active accounts can place new orders.');
        }

        if (!srvSnap.exists()) {
          throw new Error('Selected service is no longer available.');
        }
        const serviceDoc = srvSnap.data() as FirestoreServiceDoc;
        if (serviceDoc.status !== 'active') {
          throw new Error('This service is currently disabled. Please choose another service.');
        }

        if (quantity < serviceDoc.minQuantity || quantity > serviceDoc.maxQuantity) {
          throw new Error(
            `Quantity must be between ${serviceDoc.minQuantity.toLocaleString()} and ${serviceDoc.maxQuantity.toLocaleString()}.`
          );
        }

        const authoritativeCharge = calculateOrderCharge(
          quantity,
          Number(serviceDoc.sellingPrice ?? 0),
          isPackageService(serviceDoc)
        );
        const balanceBefore = Number(userDoc.balance ?? 0);

        if (balanceBefore < authoritativeCharge) {
          throw new Error(
            'আপনার পর্যাপ্ত ব্যালেন্স নেই। অনুগ্রহ করে Add Funds করে আবার চেষ্টা করুন।'
          );
        }

        const balanceAfter = Number((balanceBefore - authoritativeCharge).toFixed(2));
        const cleanServiceName = serviceDoc.name.split('–')[0].trim().slice(0, 160);

        const orderPayload: FirestoreOrderDoc = {
          id,
          userId: uid,
          serviceId: serviceDoc.id,
          serviceName: cleanServiceName,
          categoryId: serviceDoc.categoryId,
          providerId: '',
          providerOrderId: '',
          link: validatedLink,
          quantity,
          charge: authoritativeCharge,
          status: 'Pending',
          remains: quantity,
          startCount: 0,
          paymentStatus: 'paid',
          paymentTransactionId: txnId,
          refunded: false,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };

        const txnPayload: FirestoreTransactionDoc = {
          id: txnId,
          transactionId: txnId,
          userId: uid,
          type: 'order_payment',
          amount: Number((-authoritativeCharge).toFixed(2)),
          balanceBefore,
          balanceAfter,
          reference: id,
          referenceId: id,
          description: `Order #${orderNumber} · ${cleanServiceName} (${quantity.toLocaleString()})`.slice(
            0,
            280
          ),
          reason: `Order #${orderNumber} payment`,
          createdBy: uid,
          adminId: uid,
          createdAt: serverTimestamp(),
        };

        const notifPayload: FirestoreNotificationDoc = {
          id: notifId,
          notificationId: notifId,
          userId: uid,
          targetType: 'user',
          title: 'Order Placed Successfully',
          message: `অর্ডার #${orderNumber} (${cleanServiceName}) গ্রহণ করা হয়েছে। চার্জ: ${currencySymbol}${authoritativeCharge.toFixed(
            2
          )}।`,
          type: 'order_created',
          referenceId: id,
          read: false,
          isRead: false,
          createdAt: serverTimestamp(),
        };

        tx.set(orderRef, orderPayload);
        tx.update(userRef, {
          balance: balanceAfter,
          lastTxnId: txnId,
          updatedAt: serverTimestamp(),
        });
        tx.set(txnRef, txnPayload);
        tx.set(notifRef, notifPayload);

        const nowIso = new Date().toISOString();
        return {
          id,
          orderNumber: id.replace(/^ord-/, ''),
          categoryId: serviceDoc.categoryId as PlatformId,
          serviceId: serviceDoc.id,
          serviceName: cleanServiceName || serviceDoc.name,
          link: validatedLink,
          quantity,
          charge: authoritativeCharge,
          status: 'Pending' as const,
          startCount: 0,
          remains: quantity,
          paymentStatus: 'paid' as const,
          paymentTransactionId: txnId,
          refunded: false,
          createdAtLabel: 'Just now',
          createdAtIso: nowIso,
          updatedAtLabel: 'Just now',
          updatedAtIso: nowIso,
        };
      });

      emitAdminNotification(
        'new_order',
        `New Order #${createdRecord.orderNumber}`,
        `${createdRecord.serviceName} · Qty ${createdRecord.quantity.toLocaleString()} · ${currencySymbol}${createdRecord.charge.toFixed(
          2
        )}`,
        createdRecord.id
      );

      return createdRecord;
    } catch (error) {
      if (
        error instanceof Error &&
        (error.message.includes('পর্যাপ্ত ব্যালেন্স') ||
          error.message.includes('Duplicate order') ||
          error.message.includes('active') ||
          error.message.includes('Quantity') ||
          error.message.includes('available') ||
          error.message.includes('verified'))
      ) {
        throw error;
      }
      handleFirestoreError(
        error,
        OperationType.CREATE,
        `${FIRESTORE_COLLECTIONS.orders}/${id}`,
        services.auth
      );
    }
  }

  async getProfile(): Promise<CustomerProfile> {
    const services = getFirebaseServices();
    const uid = services?.auth.currentUser?.uid;
    if (!services || !uid) return demoClient.getProfile();

    try {
      const snap = await getDoc(doc(services.db, FIRESTORE_COLLECTIONS.users, uid));
      if (!snap.exists()) return demoClient.getProfile();
      const data = snap.data() as FirestoreUserDoc;
      const initials = data.name
        .split(' ')
        .map((p) => p[0])
        .join('')
        .slice(0, 2)
        .toUpperCase();

      return {
        id: data.uid,
        fullName: data.name,
        username: data.email.split('@')[0],
        email: data.email,
        phone: data.phone ?? '',
        photoUrl: data.photoUrl ?? '',
        role: data.role,
        status: data.status,
        tierLabel: data.role === 'admin' ? 'Administrator' : 'Customer Account',
        joinedDate: formatFirestoreTimestamp(data.createdAt, '2026').label,
        avatarInitials: initials || 'US',
      };
    } catch {
      return demoClient.getProfile();
    }
  }

  async getWalletSummary(): Promise<WalletSummary> {
    const services = getFirebaseServices();
    const uid = services?.auth.currentUser?.uid;
    if (!services || !uid) {
      return { balance: 0, totalSpent: 0, totalDeposited: 0 };
    }

    try {
      const snap = await getDoc(doc(services.db, FIRESTORE_COLLECTIONS.users, uid));
      if (!snap.exists()) return { balance: 0, totalSpent: 0, totalDeposited: 0 };
      const data = snap.data() as FirestoreUserDoc;
      return {
        balance: Number(data.balance ?? 0),
        totalSpent: 0,
        totalDeposited: Number(data.balance ?? 0),
      };
    } catch {
      return { balance: 0, totalSpent: 0, totalDeposited: 0 };
    }
  }

  async getTransactions(): Promise<WalletTransaction[]> {
    const services = getFirebaseServices();
    const uid = services?.auth.currentUser?.uid;
    if (!services || !uid) return [];

    try {
      const q = query(
        collection(services.db, FIRESTORE_COLLECTIONS.transactions),
        where('userId', '==', uid),
        limit(100)
      );
      const snap = await getDocs(q);
      const items = snap.docs.map((d) => {
        const data = d.data() as FirestoreTransactionDoc;
        const created = formatFirestoreTimestamp(data.createdAt, 'Synced');
        const methodLabel =
          data.type === 'deposit'
            ? 'Wallet Deposit'
            : data.type === 'admin_credit'
            ? 'Admin Balance Credit'
            : data.type === 'admin_debit'
            ? 'Admin Balance Deduction'
            : data.type === 'adjustment'
            ? 'Admin Adjustment'
            : data.type === 'refund'
            ? 'Order Refund'
            : 'Order Payment';
        return {
          id: data.id,
          reference: data.reference,
          referenceId: data.referenceId ?? data.reference,
          method: methodLabel,
          amount: Number(data.amount ?? 0),
          type: data.type,
          status: 'Completed' as const,
          description: data.description ?? data.reason,
          reason: data.reason ?? data.description,
          createdBy: data.createdBy ?? data.adminId,
          balanceBefore: Number(data.balanceBefore ?? 0),
          balanceAfter: Number(data.balanceAfter ?? 0),
          timestampLabel: created.label,
          _iso: created.iso,
        };
      });

      return items
        .sort((a, b) => b._iso.localeCompare(a._iso))
        .map(({ _iso: _unused, ...rest }) => rest);
    } catch {
      return [];
    }
  }

  async getActivePaymentMethods(forceRefresh = false): Promise<PaymentMethodItem[]> {
    const bundle = await fetchPublicCatalogBundle({ forceRefresh });
    return bundle.paymentMethods;
  }

  async getMyPaymentRequests(): Promise<CustomerPaymentRequest[]> {
    const services = getFirebaseServices();
    const uid = services?.auth.currentUser?.uid;
    if (!services || !uid) return [];

    try {
      const q = query(
        collection(services.db, FIRESTORE_COLLECTIONS.payments),
        where('userId', '==', uid),
        limit(50)
      );
      const snap = await getDocs(q);
      const rows = snap.docs.map((d) => {
        const data = d.data() as FirestorePaymentDoc;
        const created = formatFirestoreTimestamp(data.createdAt, 'Pending');
        const reviewed = data.reviewedAt ? formatFirestoreTimestamp(data.reviewedAt, '') : null;
        return {
          id: data.id,
          paymentId: data.paymentId ?? data.id,
          userId: data.userId,
          userName: data.userName ?? '',
          method: data.paymentMethod ?? data.method,
          amount: Number(data.amount ?? 0),
          transactionId: data.transactionId,
          status: data.status,
          adminNote: data.adminNote,
          reviewedBy: data.reviewedBy,
          reviewedAtLabel: reviewed?.label || undefined,
          createdAtLabel: created.label,
          _iso: created.iso,
        };
      });
      return rows
        .sort((a, b) => b._iso.localeCompare(a._iso))
        .map(({ _iso: _unused, ...rest }) => rest);
    } catch {
      return [];
    }
  }

  async submitPaymentRequest(input: {
    paymentMethodId: string;
    amount: number;
    transactionId: string;
    userName: string;
  }): Promise<CustomerPaymentRequest> {
    const services = getFirebaseServices();
    const uid = services?.auth.currentUser?.uid;
    if (!services || !uid) {
      throw new Error('Please sign in to submit a payment request.');
    }

    const cleanTxn = input.transactionId.trim();
    if (cleanTxn.length < 3 || cleanTxn.length > 128) {
      throw new Error('Please enter a valid Transaction ID (3 to 128 characters).');
    }

    const numericAmount = Number(Number(input.amount).toFixed(2));
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      throw new Error('Deposit amount must be greater than zero.');
    }

    const [methodSnap, userSnap] = await Promise.all([
      getDoc(doc(services.db, FIRESTORE_COLLECTIONS.paymentMethods, input.paymentMethodId)),
      getDoc(doc(services.db, FIRESTORE_COLLECTIONS.users, uid)),
    ]);

    if (!userSnap.exists() || (userSnap.data() as FirestoreUserDoc).status !== 'active') {
      throw new Error('Only active accounts can submit payment requests.');
    }

    if (!methodSnap.exists()) {
      throw new Error('Selected payment method is unavailable.');
    }

    const currencySymbol = await getDynamicCurrencySymbol();
    const methodDoc = methodSnap.data() as FirestorePaymentMethodDoc;
    if (methodDoc.status !== 'active') {
      throw new Error('This payment method is currently inactive.');
    }
    if (numericAmount < Number(methodDoc.minAmount)) {
      throw new Error(
        `Minimum deposit for ${methodDoc.name} is ${currencySymbol}${Number(methodDoc.minAmount).toLocaleString()}.`
      );
    }
    if (numericAmount > Number(methodDoc.maxAmount)) {
      throw new Error(
        `Maximum deposit for ${methodDoc.name} is ${currencySymbol}${Number(methodDoc.maxAmount).toLocaleString()}.`
      );
    }

    const payCode = `PAY-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;
    const id = payCode.toLowerCase();
    const userData = userSnap.data() as FirestoreUserDoc;

    const payload: FirestorePaymentDoc = {
      id,
      paymentId: payCode,
      userId: uid,
      userName: (input.userName || userData.name || 'Customer').trim().slice(0, 120),
      method: methodDoc.name.slice(0, 64),
      paymentMethod: methodDoc.name.slice(0, 64),
      amount: numericAmount,
      transactionId: cleanTxn,
      status: 'pending',
      createdAt: serverTimestamp(),
    };

    try {
      await setDoc(doc(services.db, FIRESTORE_COLLECTIONS.payments, id), payload);
      emitAdminNotification(
        'new_payment',
        `New Deposit Request · ${currencySymbol}${numericAmount.toFixed(2)}`,
        `${payload.userName} submitted ${methodDoc.name} (${cleanTxn}).`,
        id
      );
      return {
        id,
        paymentId: payCode,
        userId: uid,
        userName: payload.userName ?? '',
        method: methodDoc.name,
        amount: numericAmount,
        transactionId: cleanTxn,
        status: 'pending',
        createdAtLabel: 'Just now',
      };
    } catch (error) {
      handleFirestoreError(
        error,
        OperationType.CREATE,
        `${FIRESTORE_COLLECTIONS.payments}/${id}`,
        services.auth
      );
    }
  }

  async cancelMyPaymentRequest(paymentId: string): Promise<void> {
    const services = getFirebaseServices();
    const uid = services?.auth.currentUser?.uid;
    if (!services || !uid) throw new Error('Please sign in first.');

    try {
      await updateDoc(doc(services.db, FIRESTORE_COLLECTIONS.payments, paymentId), {
        status: 'cancelled',
      });
    } catch (error) {
      handleFirestoreError(
        error,
        OperationType.UPDATE,
        `${FIRESTORE_COLLECTIONS.payments}/${paymentId}`,
        services.auth
      );
    }
  }

  async getNotifications(): Promise<NotificationItem[]> {
    const services = getFirebaseServices();
    const uid = services?.auth.currentUser?.uid;
    if (!services || !uid) return [];

    try {
      const localReadBroadcasts = getLocalReadBroadcastIds(uid);
      const q = query(
        collection(services.db, FIRESTORE_COLLECTIONS.notifications),
        where('userId', 'in', [uid, 'all']),
        limit(60)
      );
      const snap = await getDocs(q);
      const items = snap.docs.map((d) => {
        const data = d.data() as FirestoreNotificationDoc;
        const created = formatFirestoreTimestamp(data.createdAt, 'Recent');
        const isBroadcast = data.userId === 'all';
        const effectiveRead = isBroadcast
          ? Boolean(data.isRead ?? data.read) || localReadBroadcasts.has(data.id)
          : Boolean(data.isRead ?? data.read);
        return {
          id: data.id,
          notificationId: data.notificationId ?? data.id,
          targetUserId: data.userId,
          title: data.title,
          message: data.message,
          timeLabel: created.label,
          read: effectiveRead,
          isRead: effectiveRead,
          category: data.type,
          referenceId: data.referenceId,
          _iso: created.iso,
        };
      });

      return items
        .sort((a, b) => b._iso.localeCompare(a._iso))
        .map(({ _iso: _unused, ...rest }) => rest);
    } catch {
      return [];
    }
  }

  async markNotificationRead(item: NotificationItem): Promise<void> {
    const services = getFirebaseServices();
    const uid = services?.auth.currentUser?.uid;
    if (!services || !uid) return;

    if (item.targetUserId === 'all') {
      const readSet = getLocalReadBroadcastIds(uid);
      readSet.add(item.id);
      saveLocalReadBroadcastIds(uid, readSet);
      return;
    }

    if (item.targetUserId === uid && !item.read) {
      try {
        await updateDoc(doc(services.db, FIRESTORE_COLLECTIONS.notifications, item.id), {
          read: true,
          isRead: true,
        });
      } catch {
        // Non-blocking fallback
      }
    }
  }

  async markAllNotificationsRead(items: NotificationItem[]): Promise<void> {
    const services = getFirebaseServices();
    const uid = services?.auth.currentUser?.uid;
    if (!services || !uid) return;

    const readSet = getLocalReadBroadcastIds(uid);
    const personalUnread: NotificationItem[] = [];

    for (const item of items) {
      if (item.targetUserId === 'all') {
        readSet.add(item.id);
      } else if (!item.read && item.targetUserId === uid) {
        personalUnread.push(item);
      }
    }
    saveLocalReadBroadcastIds(uid, readSet);

    await Promise.all(
      personalUnread.map((item) =>
        updateDoc(doc(services.db, FIRESTORE_COLLECTIONS.notifications, item.id), {
          read: true,
          isRead: true,
        }).catch(() => undefined)
      )
    );
  }

  async getTickets(): Promise<SupportTicket[]> {
    const services = getFirebaseServices();
    const uid = services?.auth.currentUser?.uid;
    if (!services || !uid) return [];

    try {
      const q = query(
        collection(services.db, FIRESTORE_COLLECTIONS.supportTickets),
        where('userId', '==', uid),
        limit(50)
      );
      const snap = await getDocs(q);
      const items = snap.docs.map((d) => {
        const data = d.data() as FirestoreSupportTicketDoc;
        const created = formatFirestoreTimestamp(data.createdAt, 'Synced');
        const updated = formatFirestoreTimestamp(data.updatedAt, created.label);
        return {
          id: data.id,
          ticketNumber: data.id.toUpperCase(),
          category: data.category,
          subject: data.subject as TicketSubject,
          orderReference: data.orderReference,
          attachmentUrl: data.attachmentUrl,
          message: data.message,
          adminReply: data.adminReply,
          priority: data.priority as TicketPriority,
          status: data.status,
          createdAtLabel: created.label,
          updatedAtLabel: updated.label,
          _iso: updated.iso,
        };
      });

      return items
        .sort((a, b) => b._iso.localeCompare(a._iso))
        .map(({ _iso: _unused, ...rest }) => rest);
    } catch {
      return [];
    }
  }

  async createTicket(input: CreateTicketInput): Promise<SupportTicket> {
    const services = getFirebaseServices();
    const uid = services?.auth.currentUser?.uid;
    if (!services || !uid) throw new Error('Please sign in to submit a support ticket.');

    const cleanSubject = input.subject.trim().slice(0, 120);
    const cleanMessage = input.message.trim().slice(0, 2000);
    if (!cleanSubject || !cleanMessage) {
      throw new Error('Subject and message are required.');
    }

    let cleanAttachmentUrl: string | undefined;
    if (input.attachmentUrl && input.attachmentUrl.trim()) {
      const candidate = input.attachmentUrl.trim().slice(0, 500);
      try {
        const parsed = new URL(candidate);
        if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
          throw new Error('Attachment link must use https:// or http://.');
        }
        cleanAttachmentUrl = candidate;
      } catch {
        throw new Error('Please provide a valid screenshot/attachment URL (https://...).');
      }
    }

    const num = 4013 + Math.floor(Math.random() * 9000);
    const id = `tkt-${num}-${Date.now().toString().slice(-4)}`;
    const priority: TicketPriority = input.priority ?? 'Medium';
    const cleanCategory = (input.category || 'Order Issue').trim().slice(0, 60);
    const cleanOrderRef = input.orderReference?.trim().slice(0, 64) || undefined;

    const payload: FirestoreSupportTicketDoc = {
      id,
      userId: uid,
      category: cleanCategory,
      subject: cleanSubject,
      ...(cleanOrderRef ? { orderReference: cleanOrderRef } : {}),
      ...(cleanAttachmentUrl ? { attachmentUrl: cleanAttachmentUrl } : {}),
      message: cleanMessage,
      status: 'Open',
      priority,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    try {
      await setDoc(doc(services.db, FIRESTORE_COLLECTIONS.supportTickets, id), payload);
      emitAdminNotification(
        'new_ticket',
        `New Support Ticket · ${id.toUpperCase()}`,
        `[${cleanCategory}] ${cleanSubject}${cleanOrderRef ? ` (Order #${cleanOrderRef})` : ''}`,
        id
      );
      return {
        id,
        ticketNumber: id.toUpperCase(),
        category: cleanCategory,
        subject: cleanSubject,
        orderReference: cleanOrderRef,
        attachmentUrl: cleanAttachmentUrl,
        message: payload.message,
        priority,
        status: 'Open',
        createdAtLabel: 'Just now',
        updatedAtLabel: 'Just now',
      };
    } catch (error) {
      handleFirestoreError(
        error,
        OperationType.CREATE,
        `${FIRESTORE_COLLECTIONS.supportTickets}/${id}`,
        services.auth
      );
    }
  }

  private mapTicketMessageDoc(data: FirestoreTicketReplyDoc): TicketReply & { _ms: number } {
    const created = formatFirestoreTimestamp(data.createdAt, 'Recent');
    const readAt = data.readAt ? formatFirestoreTimestamp(data.readAt, '') : null;
    return {
      id: data.id,
      messageId: data.messageId ?? data.id,
      ticketId: data.ticketId,
      senderId: data.senderId,
      senderName: data.senderName ?? (data.senderRole === 'admin' ? 'Support Team' : 'You'),
      senderRole: data.senderRole,
      message: data.message,
      createdAtLabel: created.label,
      ...(readAt?.label ? { readAtLabel: readAt.label } : {}),
      _ms: created.ms || Date.now(),
    };
  }

  async getTicketReplies(ticketId: string): Promise<TicketReply[]> {
    const services = getFirebaseServices();
    const uid = services?.auth.currentUser?.uid;
    if (!services || !uid) return [];

    try {
      const [msgSnap, legacySnap] = await Promise.all([
        getDocs(
          query(
            collection(
              services.db,
              FIRESTORE_COLLECTIONS.supportTickets,
              ticketId,
              'messages'
            ),
            orderBy('createdAt', 'asc')
          )
        ).catch(() => null),
        getDocs(
          query(
            collection(
              services.db,
              FIRESTORE_COLLECTIONS.supportTickets,
              ticketId,
              'replies'
            ),
            orderBy('createdAt', 'asc')
          )
        ).catch(() => null),
      ]);

      const merged = new Map<string, TicketReply & { _ms: number }>();
      for (const snap of [legacySnap, msgSnap]) {
        if (!snap) continue;
        for (const d of snap.docs) {
          const mapped = this.mapTicketMessageDoc(d.data() as FirestoreTicketReplyDoc);
          merged.set(mapped.id, mapped);
        }
      }

      return Array.from(merged.values())
        .sort((a, b) => a._ms - b._ms)
        .map(({ _ms: _unused, ...rest }) => rest);
    } catch {
      return [];
    }
  }

  subscribeTicketMessages(
    ticketId: string,
    onUpdate: (messages: TicketReply[]) => void,
    onError?: (err: Error) => void
  ): Unsubscribe {
    const services = getFirebaseServices();
    if (!services || !services.auth.currentUser) {
      return () => undefined;
    }

    let legacyItems: Array<TicketReply & { _ms: number }> = [];
    void getDocs(
      query(
        collection(services.db, FIRESTORE_COLLECTIONS.supportTickets, ticketId, 'replies'),
        orderBy('createdAt', 'asc')
      )
    )
      .then((snap) => {
        legacyItems = snap.docs.map((d) =>
          this.mapTicketMessageDoc(d.data() as FirestoreTicketReplyDoc)
        );
      })
      .catch(() => undefined);

    const q = query(
      collection(services.db, FIRESTORE_COLLECTIONS.supportTickets, ticketId, 'messages'),
      orderBy('createdAt', 'asc')
    );

    return onSnapshot(
      q,
      (snap) => {
        const merged = new Map<string, TicketReply & { _ms: number }>();
        for (const item of legacyItems) {
          merged.set(item.id, item);
        }
        for (const d of snap.docs) {
          const mapped = this.mapTicketMessageDoc(d.data() as FirestoreTicketReplyDoc);
          merged.set(mapped.id, mapped);
        }
        const sorted = Array.from(merged.values())
          .sort((a, b) => a._ms - b._ms)
          .map(({ _ms: _unused, ...rest }) => rest);
        onUpdate(sorted);
      },
      (err) => {
        if (onError) onError(err);
      }
    );
  }

  async addTicketReply(
    ticketId: string,
    message: string,
    senderName: string,
    senderRole: 'user' | 'admin' = 'user'
  ): Promise<TicketReply> {
    const services = getFirebaseServices();
    const uid = services?.auth.currentUser?.uid;
    if (!services || !uid) throw new Error('Please sign in to send a reply.');

    const cleanMessage = message.trim().slice(0, 2000);
    if (!cleanMessage) throw new Error('Reply message cannot be empty.');

    const replyId = `msg-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;
    const payload: FirestoreTicketReplyDoc = {
      id: replyId,
      messageId: replyId,
      ticketId,
      senderId: uid,
      senderName: senderName.slice(0, 120),
      senderRole,
      message: cleanMessage,
      createdAt: serverTimestamp(),
    };

    try {
      await setDoc(
        doc(
          services.db,
          FIRESTORE_COLLECTIONS.supportTickets,
          ticketId,
          'messages',
          replyId
        ),
        payload
      );

      if (senderRole === 'user') {
        await updateDoc(doc(services.db, FIRESTORE_COLLECTIONS.supportTickets, ticketId), {
          status: 'Open',
          updatedAt: serverTimestamp(),
        }).catch(() => undefined);

        emitAdminNotification(
          'new_ticket',
          `Customer Replied · ${ticketId.toUpperCase()}`,
          `${senderName.slice(0, 60)}: ${cleanMessage.slice(0, 140)}`,
          ticketId
        );
      }

      return {
        id: replyId,
        messageId: replyId,
        ticketId,
        senderId: uid,
        senderName: payload.senderName ?? 'You',
        senderRole,
        message: cleanMessage,
        createdAtLabel: 'Just now',
      };
    } catch (error) {
      handleFirestoreError(
        error,
        OperationType.CREATE,
        `${FIRESTORE_COLLECTIONS.supportTickets}/${ticketId}/messages/${replyId}`,
        services.auth
      );
    }
  }

  async markTicketMessagesRead(ticketId: string, viewerRole: 'user' | 'admin'): Promise<void> {
    const services = getFirebaseServices();
    if (!services || !services.auth.currentUser) return;

    try {
      const snap = await getDocs(
        collection(services.db, FIRESTORE_COLLECTIONS.supportTickets, ticketId, 'messages')
      );
      const updates: Promise<void>[] = [];
      for (const d of snap.docs) {
        const data = d.data() as FirestoreTicketReplyDoc;
        if (data.senderRole !== viewerRole && !data.readAt) {
          updates.push(
            updateDoc(d.ref, { readAt: serverTimestamp() }).catch(() => undefined)
          );
        }
      }
      await Promise.all(updates);
    } catch {
      // Non-blocking seen receipt update
    }
  }
}

export const firestoreDataClient = new FirestoreDataClient();
