import {
  Timestamp,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { getFirebaseServices } from '../lib/firebase/client';
import { getActiveFirebaseTargetPayload } from '../lib/firebase/configManager';
import {
  FIRESTORE_COLLECTIONS,
  SETTINGS_DOC_IDS,
  type ApiCustomerStatus,
  type ApiKeyPermission,
  type ApiKeyStatus,
  type ApiTransactionType,
  type FirestoreApiCustomerDoc,
  type FirestoreApiGatewaySettingsDoc,
  type FirestoreApiKeyDoc,
  type FirestoreApiOrderDoc,
  type FirestoreApiRequestLogDoc,
  type FirestoreApiTransactionDoc,
  type FirestoreAuditLogDoc,
  type FirestoreOrderDoc,
  type FirestoreWebsiteInstallationDoc,
  type OrderStatusFirestore,
  type WebsiteInstallationStatus,
} from '../lib/firestore/collections';
import { OperationType, handleFirestoreError } from '../lib/firestore/errors';

export interface GatewayServerStatus {
  backendAuthConfigured: boolean;
  authMode: 'service_account' | 'adc_metadata' | 'none';
}

export interface ApiCustomerItem {
  id: string;
  userId: string;
  name: string;
  email: string;
  companyName: string;
  websiteDomain: string;
  installationId: string;
  apiBalance: number;
  totalSpent: number;
  totalOrders: number;
  rateLimitPerMinute: number;
  customDiscountPercent: number;
  status: ApiCustomerStatus;
  note: string;
  createdAtLabel: string;
  updatedAtLabel: string;
  createdAtMs: number;
}

export interface ApiKeyItem {
  id: string;
  customerId: string;
  userId: string;
  installationId: string;
  label: string;
  keyPrefix: string;
  keyLast4: string;
  maskedKey: string;
  permissions: ApiKeyPermission[];
  rateLimitPerMinute: number;
  status: ApiKeyStatus;
  requestCount: number;
  lastUsedAtLabel: string;
  createdAtLabel: string;
  updatedAtLabel: string;
  createdAtMs: number;
}

export interface ApiOrderItem {
  id: string;
  internalOrderId: string;
  customerId: string;
  userId: string;
  keyId: string;
  installationId: string;
  idempotencyKey: string;
  serviceId: string;
  serviceName: string;
  link: string;
  quantity: number;
  charge: number;
  status: OrderStatusFirestore;
  startCount: number;
  remains: number;
  refunded: boolean;
  refundTransactionId: string;
  providerDispatched: boolean;
  errorMessage: string;
  createdAtLabel: string;
  updatedAtLabel: string;
  createdAtMs: number;
}

export interface ApiTransactionItem {
  id: string;
  customerId: string;
  userId: string;
  type: ApiTransactionType;
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  referenceId: string;
  description: string;
  createdBy: string;
  createdAtLabel: string;
  createdAtMs: number;
}

export interface ApiRequestLogItem {
  id: string;
  customerId: string;
  userId: string;
  keyId: string;
  installationId: string;
  action: string;
  httpStatus: number;
  success: boolean;
  latencyMs: number;
  ipAddress: string;
  idempotencyKey: string;
  errorMessage: string;
  createdAtLabel: string;
  createdAtMs: number;
}

export interface WebsiteInstallationItem {
  id: string;
  installationId: string;
  customerId: string;
  userId: string;
  buyerName: string;
  domain: string;
  appVersion: string;
  apiLocked: boolean;
  status: WebsiteInstallationStatus;
  note: string;
  createdAtLabel: string;
  updatedAtLabel: string;
  createdAtMs: number;
}

export interface ApiGatewaySettingsItem {
  gatewayEnabled: boolean;
  defaultBaseUrl: string;
  defaultRateLimitPerMinute: number;
  maxBulkStatusIds: number;
  requireIdempotencyKey: boolean;
  autoDispatchEnabled: boolean;
  allowCustomerSelfKeyGen: boolean;
  defaultLockMode: boolean;
  updatedAtLabel: string;
  updatedBy: string;
}

export interface GeneratedApiKeyResponse {
  keyId: string;
  customerId: string;
  label: string;
  keyPrefix: string;
  keyLast4: string;
  plaintextKeyOnce: string;
}

export const DEFAULT_GATEWAY_SETTINGS: ApiGatewaySettingsItem = {
  gatewayEnabled: true,
  defaultBaseUrl: '',
  defaultRateLimitPerMinute: 60,
  maxBulkStatusIds: 100,
  requireIdempotencyKey: false,
  autoDispatchEnabled: true,
  allowCustomerSelfKeyGen: true,
  defaultLockMode: false,
  updatedAtLabel: 'Default',
  updatedBy: 'system',
};

function tsToInfo(val: unknown): { label: string; ms: number } {
  if (val instanceof Timestamp) {
    const d = val.toDate();
    return {
      label: d.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }),
      ms: d.getTime(),
    };
  }
  return { label: 'Recent', ms: 0 };
}

function makeClientId(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}-${Date.now()}-${rand}`;
}

function requireFirebaseContext() {
  const services = getFirebaseServices();
  if (!services) {
    throw new Error('Firebase is not initialized.');
  }
  const user = services.auth.currentUser;
  if (!user) {
    throw new Error('Authentication required.');
  }
  return { db: services.db, user };
}

async function appendGatewayAuditLog(input: {
  action: string;
  adminId: string;
  targetId: string;
  previousValue: string;
  newValue: string;
  note?: string;
}): Promise<void> {
  const services = getFirebaseServices();
  if (!services) return;
  const logId = makeClientId('audit');
  const payload: FirestoreAuditLogDoc = {
    id: logId,
    action: input.action.slice(0, 64),
    adminId: input.adminId,
    targetId: input.targetId.slice(0, 128),
    targetType: 'api_gateway',
    previousValue: input.previousValue.slice(0, 500),
    newValue: input.newValue.slice(0, 500),
    ...(input.note ? { note: input.note.slice(0, 300) } : {}),
    timestamp: serverTimestamp(),
  };
  await setDoc(doc(services.db, FIRESTORE_COLLECTIONS.auditLogs, logId), payload).catch(
    () => undefined
  );
}

function mapCustomer(docData: FirestoreApiCustomerDoc): ApiCustomerItem {
  const created = tsToInfo(docData.createdAt);
  const updated = tsToInfo(docData.updatedAt);
  return {
    id: docData.id,
    userId: docData.userId ?? '',
    name: docData.name,
    email: docData.email,
    companyName: docData.companyName ?? '',
    websiteDomain: docData.websiteDomain ?? '',
    installationId: docData.installationId,
    apiBalance: Number(docData.apiBalance ?? 0),
    totalSpent: Number(docData.totalSpent ?? 0),
    totalOrders: Number(docData.totalOrders ?? 0),
    rateLimitPerMinute: Number(docData.rateLimitPerMinute ?? 60),
    customDiscountPercent: Number(docData.customDiscountPercent ?? 0),
    status: docData.status,
    note: docData.note ?? '',
    createdAtLabel: created.label,
    updatedAtLabel: updated.label,
    createdAtMs: created.ms,
  };
}

function mapKey(docData: FirestoreApiKeyDoc): ApiKeyItem {
  const created = tsToInfo(docData.createdAt);
  const updated = tsToInfo(docData.updatedAt);
  const lastUsed = docData.lastUsedAt ? tsToInfo(docData.lastUsedAt) : { label: 'Never', ms: 0 };
  const prefix = docData.keyPrefix || 'rjw_live_';
  const last4 = docData.keyLast4 || '****';
  return {
    id: docData.id,
    customerId: docData.customerId,
    userId: docData.userId ?? '',
    installationId: docData.installationId ?? '',
    label: docData.label,
    keyPrefix: prefix,
    keyLast4: last4,
    maskedKey: `${prefix}••••••••••••${last4}`,
    permissions: Array.isArray(docData.permissions)
      ? docData.permissions
      : ['balance', 'services', 'add', 'status'],
    rateLimitPerMinute: Number(docData.rateLimitPerMinute ?? 60),
    status: docData.status,
    requestCount: Number(docData.requestCount ?? 0),
    lastUsedAtLabel: lastUsed.label,
    createdAtLabel: created.label,
    updatedAtLabel: updated.label,
    createdAtMs: created.ms,
  };
}

function mapApiOrder(docData: FirestoreApiOrderDoc): ApiOrderItem {
  const created = tsToInfo(docData.createdAt);
  const updated = tsToInfo(docData.updatedAt);
  return {
    id: docData.id,
    internalOrderId: docData.internalOrderId,
    customerId: docData.customerId,
    userId: docData.userId ?? '',
    keyId: docData.keyId ?? '',
    installationId: docData.installationId ?? '',
    idempotencyKey: docData.idempotencyKey ?? '',
    serviceId: docData.serviceId,
    serviceName: docData.serviceName ?? `Service #${docData.serviceId}`,
    link: docData.link,
    quantity: Number(docData.quantity ?? 0),
    charge: Number(docData.charge ?? 0),
    status: docData.status,
    startCount: Number(docData.startCount ?? 0),
    remains: Number(docData.remains ?? 0),
    refunded: Boolean(docData.refunded),
    refundTransactionId: docData.refundTransactionId ?? '',
    providerDispatched: Boolean(docData.providerDispatched),
    errorMessage: docData.errorMessage ?? '',
    createdAtLabel: created.label,
    updatedAtLabel: updated.label,
    createdAtMs: created.ms,
  };
}

function mapApiTransaction(docData: FirestoreApiTransactionDoc): ApiTransactionItem {
  const created = tsToInfo(docData.createdAt);
  return {
    id: docData.id,
    customerId: docData.customerId,
    userId: docData.userId ?? '',
    type: docData.type,
    amount: Number(docData.amount ?? 0),
    balanceBefore: Number(docData.balanceBefore ?? 0),
    balanceAfter: Number(docData.balanceAfter ?? 0),
    referenceId: docData.referenceId,
    description: docData.description ?? '',
    createdBy: docData.createdBy ?? '',
    createdAtLabel: created.label,
    createdAtMs: created.ms,
  };
}

function mapRequestLog(docData: FirestoreApiRequestLogDoc): ApiRequestLogItem {
  const created = tsToInfo(docData.createdAt);
  return {
    id: docData.id,
    customerId: docData.customerId ?? '',
    userId: docData.userId ?? '',
    keyId: docData.keyId ?? '',
    installationId: docData.installationId ?? '',
    action: docData.action,
    httpStatus: Number(docData.httpStatus ?? 0),
    success: Boolean(docData.success),
    latencyMs: Number(docData.latencyMs ?? 0),
    ipAddress: docData.ipAddress ?? '',
    idempotencyKey: docData.idempotencyKey ?? '',
    errorMessage: docData.errorMessage ?? '',
    createdAtLabel: created.label,
    createdAtMs: created.ms,
  };
}

function mapInstallation(docData: FirestoreWebsiteInstallationDoc): WebsiteInstallationItem {
  const created = tsToInfo(docData.createdAt);
  const updated = tsToInfo(docData.updatedAt);
  return {
    id: docData.id,
    installationId: docData.installationId,
    customerId: docData.customerId,
    userId: docData.userId ?? '',
    buyerName: docData.buyerName,
    domain: docData.domain,
    appVersion: docData.appVersion ?? '1.0.0',
    apiLocked: Boolean(docData.apiLocked),
    status: docData.status,
    note: docData.note ?? '',
    createdAtLabel: created.label,
    updatedAtLabel: updated.label,
    createdAtMs: created.ms,
  };
}

export const apiGatewayService = {
  async getGatewayServerStatus(): Promise<GatewayServerStatus> {
    const { user } = requireFirebaseContext();
    const idToken = await user.getIdToken();
    const res = await fetch('/api/gateway/server-status', {
      method: 'GET',
      headers: { Authorization: `Bearer ${idToken}` },
    });
    const json = (await res.json()) as { ok?: boolean; data?: GatewayServerStatus; error?: string };
    if (!res.ok || !json.ok || !json.data) {
      throw new Error(json.error || 'Unable to inspect gateway server status.');
    }
    return json.data;
  },

  async getApiGatewaySettings(): Promise<ApiGatewaySettingsItem> {
    const services = getFirebaseServices();
    if (!services) return DEFAULT_GATEWAY_SETTINGS;
    try {
      const snap = await getDoc(
        doc(services.db, FIRESTORE_COLLECTIONS.settings, SETTINGS_DOC_IDS.apiGateway)
      );
      if (!snap.exists()) return DEFAULT_GATEWAY_SETTINGS;
      const raw = snap.data() as FirestoreApiGatewaySettingsDoc;
      return {
        gatewayEnabled: Boolean(raw.gatewayEnabled ?? true),
        defaultBaseUrl: raw.defaultBaseUrl ?? '',
        defaultRateLimitPerMinute: Number(raw.defaultRateLimitPerMinute ?? 60),
        maxBulkStatusIds: Number(raw.maxBulkStatusIds ?? 100),
        requireIdempotencyKey: Boolean(raw.requireIdempotencyKey ?? false),
        autoDispatchEnabled: Boolean(raw.autoDispatchEnabled ?? true),
        allowCustomerSelfKeyGen: Boolean(raw.allowCustomerSelfKeyGen ?? true),
        defaultLockMode: Boolean(raw.defaultLockMode ?? true),
        updatedAtLabel: tsToInfo(raw.updatedAt).label,
        updatedBy: raw.updatedBy ?? 'admin',
      };
    } catch {
      return DEFAULT_GATEWAY_SETTINGS;
    }
  },

  async saveApiGatewaySettings(
    input: Omit<ApiGatewaySettingsItem, 'updatedAtLabel' | 'updatedBy'>
  ): Promise<void> {
    const { db, user } = requireFirebaseContext();
    const payload: FirestoreApiGatewaySettingsDoc = {
      gatewayEnabled: Boolean(input.gatewayEnabled),
      defaultBaseUrl: input.defaultBaseUrl.trim().slice(0, 300),
      defaultRateLimitPerMinute: Math.max(
        1,
        Math.min(10000, Math.floor(Number(input.defaultRateLimitPerMinute || 60)))
      ),
      maxBulkStatusIds: Math.max(
        1,
        Math.min(500, Math.floor(Number(input.maxBulkStatusIds || 100)))
      ),
      requireIdempotencyKey: Boolean(input.requireIdempotencyKey),
      autoDispatchEnabled: Boolean(input.autoDispatchEnabled),
      allowCustomerSelfKeyGen: Boolean(input.allowCustomerSelfKeyGen),
      defaultLockMode: Boolean(input.defaultLockMode),
      updatedBy: user.uid,
      updatedAt: serverTimestamp(),
    };
    try {
      await setDoc(
        doc(db, FIRESTORE_COLLECTIONS.settings, SETTINGS_DOC_IDS.apiGateway),
        payload
      );
      await appendGatewayAuditLog({
        action: 'API_GATEWAY_SETTINGS_UPDATED',
        adminId: user.uid,
        targetId: SETTINGS_DOC_IDS.apiGateway,
        previousValue: '-',
        newValue: `enabled=${payload.gatewayEnabled}, rate=${payload.defaultRateLimitPerMinute}/m, selfKeyGen=${payload.allowCustomerSelfKeyGen}`,
      });
    } catch (error) {
      handleFirestoreError(
        error,
        OperationType.WRITE,
        `${FIRESTORE_COLLECTIONS.settings}/${SETTINGS_DOC_IDS.apiGateway}`
      );
    }
  },

  // ---------------------------------------------------------------------------
  // Customer-Facing Queries & Key Lifecycle
  // ---------------------------------------------------------------------------
  async getMyApiCustomer(uid: string): Promise<ApiCustomerItem | null> {
    const services = getFirebaseServices();
    if (!services || !uid) return null;
    try {
      const directSnap = await getDoc(
        doc(services.db, FIRESTORE_COLLECTIONS.apiCustomers, `reseller-${uid}`)
      );
      if (directSnap.exists()) {
        return mapCustomer(directSnap.data() as FirestoreApiCustomerDoc);
      }
      const snap = await getDocs(
        query(
          collection(services.db, FIRESTORE_COLLECTIONS.apiCustomers),
          where('userId', '==', uid),
          limit(5)
        )
      );
      if (snap.empty) return null;
      return mapCustomer(snap.docs[0].data() as FirestoreApiCustomerDoc);
    } catch {
      return null;
    }
  },

  async ensureMyResellerAccess(input: {
    uid: string;
    name: string;
    email: string;
  }): Promise<{
    customer: ApiCustomerItem;
    keys: ApiKeyItem[];
    initialGeneratedKey: GeneratedApiKeyResponse | null;
  }> {
    const { db } = requireFirebaseContext();
    let customer = await this.getMyApiCustomer(input.uid);

    if (!customer) {
      const customerId = `reseller-${input.uid}`;
      const ref = doc(db, FIRESTORE_COLLECTIONS.apiCustomers, customerId);
      const cleanName = input.name.trim().slice(0, 120) || 'Reseller';
      const cleanEmail = input.email.trim().toLowerCase().slice(0, 180) || `${input.uid}@panel.local`;
      const payload: FirestoreApiCustomerDoc = {
        id: customerId,
        userId: input.uid,
        name: cleanName,
        email: cleanEmail,
        installationId: `rsw-${input.uid.slice(0, 12)}`,
        apiBalance: 0,
        totalSpent: 0,
        totalOrders: 0,
        rateLimitPerMinute: 60,
        customDiscountPercent: 0,
        status: 'active',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      try {
        await setDoc(ref, payload);
        const createdSnap = await getDoc(ref);
        if (!createdSnap.exists()) {
          throw new Error('Failed to verify provisioned Reseller API profile.');
        }
        customer = mapCustomer(createdSnap.data() as FirestoreApiCustomerDoc);
      } catch (error) {
        handleFirestoreError(
          error,
          OperationType.CREATE,
          `${FIRESTORE_COLLECTIONS.apiCustomers}/${customerId}`
        );
      }
    }

    let keys = await this.listMyApiKeys(input.uid).catch(() => []);
    let initialGeneratedKey: GeneratedApiKeyResponse | null = null;

    if (keys.length === 0 && customer.status === 'active') {
      initialGeneratedKey = await this.generateApiKey({
        customerId: customer.id,
        label: 'Primary Reseller API Key',
        permissions: ['balance', 'services', 'add', 'status'],
        rateLimitPerMinute: customer.rateLimitPerMinute || 60,
      });
      keys = await this.listMyApiKeys(input.uid).catch(() => []);
    }

    return { customer, keys, initialGeneratedKey };
  },

  async listMyApiKeys(uid: string): Promise<ApiKeyItem[]> {
    const services = getFirebaseServices();
    if (!services || !uid) return [];
    const snap = await getDocs(
      query(
        collection(services.db, FIRESTORE_COLLECTIONS.apiKeys),
        where('userId', '==', uid),
        limit(50)
      )
    );
    return snap.docs
      .map((d) => mapKey(d.data() as FirestoreApiKeyDoc))
      .sort((a, b) => b.createdAtMs - a.createdAtMs);
  },

  async listMyApiOrders(uid: string): Promise<ApiOrderItem[]> {
    const services = getFirebaseServices();
    if (!services || !uid) return [];
    const snap = await getDocs(
      query(
        collection(services.db, FIRESTORE_COLLECTIONS.apiOrders),
        where('userId', '==', uid),
        limit(120)
      )
    );
    return snap.docs
      .map((d) => mapApiOrder(d.data() as FirestoreApiOrderDoc))
      .sort((a, b) => b.createdAtMs - a.createdAtMs);
  },

  async listMyApiTransactions(uid: string): Promise<ApiTransactionItem[]> {
    const services = getFirebaseServices();
    if (!services || !uid) return [];
    const snap = await getDocs(
      query(
        collection(services.db, FIRESTORE_COLLECTIONS.apiTransactions),
        where('userId', '==', uid),
        limit(120)
      )
    );
    return snap.docs
      .map((d) => mapApiTransaction(d.data() as FirestoreApiTransactionDoc))
      .sort((a, b) => b.createdAtMs - a.createdAtMs);
  },

  async listMyApiRequestLogs(uid: string): Promise<ApiRequestLogItem[]> {
    const services = getFirebaseServices();
    if (!services || !uid) return [];
    const snap = await getDocs(
      query(
        collection(services.db, FIRESTORE_COLLECTIONS.apiRequestLogs),
        where('userId', '==', uid),
        limit(150)
      )
    );
    return snap.docs
      .map((d) => mapRequestLog(d.data() as FirestoreApiRequestLogDoc))
      .sort((a, b) => b.createdAtMs - a.createdAtMs);
  },

  async generateApiKey(input: {
    customerId: string;
    label?: string;
    permissions?: ApiKeyPermission[];
    rateLimitPerMinute?: number;
  }): Promise<GeneratedApiKeyResponse> {
    const { user } = requireFirebaseContext();
    const idToken = await user.getIdToken();
    const res = await fetch('/api/gateway/keys/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({
        customerId: input.customerId,
        label: input.label || 'Production API Key',
        permissions: input.permissions ?? ['balance', 'services', 'add', 'status'],
        rateLimitPerMinute: input.rateLimitPerMinute ?? 60,
        ...getActiveFirebaseTargetPayload(),
      }),
    });
    const json = (await res.json()) as {
      ok?: boolean;
      data?: GeneratedApiKeyResponse;
      error?: string;
    };
    if (!res.ok || !json.ok || !json.data) {
      throw new Error(json.error || 'Failed to generate API key.');
    }
    return json.data;
  },

  async regenerateApiKey(keyId: string): Promise<GeneratedApiKeyResponse> {
    const { user } = requireFirebaseContext();
    const idToken = await user.getIdToken();
    const res = await fetch('/api/gateway/keys/regenerate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({
        keyId,
        ...getActiveFirebaseTargetPayload(),
      }),
    });
    const json = (await res.json()) as {
      ok?: boolean;
      data?: GeneratedApiKeyResponse;
      error?: string;
    };
    if (!res.ok || !json.ok || !json.data) {
      throw new Error(json.error || 'Failed to regenerate API key.');
    }
    return json.data;
  },

  async updateOwnApiKey(input: {
    keyId: string;
    status: ApiKeyStatus;
    label?: string;
  }): Promise<void> {
    const { db } = requireFirebaseContext();
    const ref = doc(db, FIRESTORE_COLLECTIONS.apiKeys, input.keyId);
    const updatePayload: Record<string, unknown> = {
      status: input.status,
      updatedAt: serverTimestamp(),
    };
    if (input.label && input.label.trim()) {
      updatePayload.label = input.label.trim().slice(0, 80);
    }
    try {
      await updateDoc(ref, updatePayload);
    } catch (error) {
      handleFirestoreError(
        error,
        OperationType.UPDATE,
        `${FIRESTORE_COLLECTIONS.apiKeys}/${input.keyId}`
      );
    }
  },

  // ---------------------------------------------------------------------------
  // Master Admin Controls
  // ---------------------------------------------------------------------------
  async listAllApiCustomers(): Promise<ApiCustomerItem[]> {
    const { db } = requireFirebaseContext();
    try {
      const snap = await getDocs(
        query(collection(db, FIRESTORE_COLLECTIONS.apiCustomers), limit(250))
      );
      return snap.docs
        .map((d) => mapCustomer(d.data() as FirestoreApiCustomerDoc))
        .sort((a, b) => b.createdAtMs - a.createdAtMs);
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, FIRESTORE_COLLECTIONS.apiCustomers);
    }
  },

  async saveApiCustomer(input: {
    id?: string;
    userId?: string;
    name: string;
    email: string;
    companyName?: string;
    websiteDomain?: string;
    installationId?: string;
    rateLimitPerMinute: number;
    customDiscountPercent?: number;
    status: ApiCustomerStatus;
    note?: string;
  }): Promise<ApiCustomerItem> {
    const { db, user } = requireFirebaseContext();
    const isUpdate = Boolean(input.id);
    const customerId = input.id?.trim() || makeClientId('apicus');
    const installationId =
      input.installationId?.trim() ||
      `inst-${Math.random().toString(36).slice(2, 6).toUpperCase()}-${Date.now()
        .toString()
        .slice(-4)}`;
    const ref = doc(db, FIRESTORE_COLLECTIONS.apiCustomers, customerId);

    try {
      if (isUpdate) {
        const snap = await getDoc(ref);
        if (!snap.exists()) {
          throw new Error('API Customer record not found.');
        }
        const existing = snap.data() as FirestoreApiCustomerDoc;
        const nextPayload: Record<string, unknown> = {
          userId: input.userId?.trim() || existing.userId || '',
          name: input.name.trim().slice(0, 120),
          email: input.email.trim().toLowerCase().slice(0, 180),
          companyName: (input.companyName ?? '').trim().slice(0, 120),
          websiteDomain: (input.websiteDomain ?? '').trim().slice(0, 200),
          installationId,
          rateLimitPerMinute: Math.max(1, Math.min(10000, Math.floor(input.rateLimitPerMinute))),
          customDiscountPercent: Math.max(
            0,
            Math.min(90, Number(input.customDiscountPercent ?? 0))
          ),
          status: input.status,
          note: (input.note ?? '').trim().slice(0, 500),
          updatedAt: serverTimestamp(),
        };
        await updateDoc(ref, nextPayload);
        await appendGatewayAuditLog({
          action: 'API_CUSTOMER_UPDATED',
          adminId: user.uid,
          targetId: customerId,
          previousValue: `status=${existing.status}, rate=${existing.rateLimitPerMinute}`,
          newValue: `status=${input.status}, rate=${nextPayload.rateLimitPerMinute}`,
        });
        const refreshed = await getDoc(ref);
        return mapCustomer(refreshed.data() as FirestoreApiCustomerDoc);
      }

      const payload: FirestoreApiCustomerDoc = {
        id: customerId,
        userId: input.userId?.trim() || '',
        name: input.name.trim().slice(0, 120),
        email: input.email.trim().toLowerCase().slice(0, 180),
        ...(input.companyName?.trim()
          ? { companyName: input.companyName.trim().slice(0, 120) }
          : {}),
        ...(input.websiteDomain?.trim()
          ? { websiteDomain: input.websiteDomain.trim().slice(0, 200) }
          : {}),
        installationId,
        apiBalance: 0,
        totalSpent: 0,
        totalOrders: 0,
        rateLimitPerMinute: Math.max(1, Math.min(10000, Math.floor(input.rateLimitPerMinute || 60))),
        customDiscountPercent: Math.max(
          0,
          Math.min(90, Number(input.customDiscountPercent ?? 0))
        ),
        status: input.status,
        ...(input.note?.trim() ? { note: input.note.trim().slice(0, 500) } : {}),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      await setDoc(ref, payload);
      await appendGatewayAuditLog({
        action: 'API_CUSTOMER_CREATED',
        adminId: user.uid,
        targetId: customerId,
        previousValue: '-',
        newValue: `${payload.name} (${payload.email}) · ${payload.installationId}`,
      });
      const createdSnap = await getDoc(ref);
      return mapCustomer(createdSnap.data() as FirestoreApiCustomerDoc);
    } catch (error) {
      handleFirestoreError(
        error,
        OperationType.WRITE,
        `${FIRESTORE_COLLECTIONS.apiCustomers}/${customerId}`
      );
    }
  },

  async setApiCustomerStatus(customerId: string, status: ApiCustomerStatus): Promise<void> {
    const { db, user } = requireFirebaseContext();
    const ref = doc(db, FIRESTORE_COLLECTIONS.apiCustomers, customerId);
    try {
      const snap = await getDoc(ref);
      const prevStatus = snap.exists()
        ? String((snap.data() as FirestoreApiCustomerDoc).status)
        : 'unknown';
      await updateDoc(ref, { status, updatedAt: serverTimestamp() });
      await appendGatewayAuditLog({
        action: 'API_CUSTOMER_STATUS_CHANGED',
        adminId: user.uid,
        targetId: customerId,
        previousValue: prevStatus,
        newValue: status,
      });
    } catch (error) {
      handleFirestoreError(
        error,
        OperationType.UPDATE,
        `${FIRESTORE_COLLECTIONS.apiCustomers}/${customerId}`
      );
    }
  },

  async adjustApiCustomerBalance(input: {
    customerId: string;
    operation: 'credit' | 'debit' | 'adjustment';
    amount: number;
    description: string;
  }): Promise<{ balanceBefore: number; balanceAfter: number; txnId: string }> {
    const { db, user } = requireFirebaseContext();
    const amountNum = Number(input.amount);
    if (!Number.isFinite(amountNum) || amountNum <= 0) {
      throw new Error('Adjustment amount must be greater than zero.');
    }

    const customerRef = doc(db, FIRESTORE_COLLECTIONS.apiCustomers, input.customerId);
    const txnId = makeClientId('apitxn');
    const txnRef = doc(db, FIRESTORE_COLLECTIONS.apiTransactions, txnId);

    try {
      const result = await runTransaction(db, async (tx) => {
        const snap = await tx.get(customerRef);
        if (!snap.exists()) {
          throw new Error('API Customer not found.');
        }
        const customer = snap.data() as FirestoreApiCustomerDoc;
        const balanceBefore = Number(customer.apiBalance ?? 0);
        const signedDelta = input.operation === 'debit' ? -amountNum : amountNum;
        const balanceAfter = Number((balanceBefore + signedDelta).toFixed(4));
        if (balanceAfter < 0) {
          throw new Error(
            `Insufficient API balance for debit. Current balance is ${balanceBefore.toFixed(2)}.`
          );
        }

        tx.update(customerRef, {
          apiBalance: balanceAfter,
          updatedAt: serverTimestamp(),
        });

        const txnPayload: FirestoreApiTransactionDoc = {
          id: txnId,
          customerId: input.customerId,
          ...(customer.userId ? { userId: customer.userId } : {}),
          type: input.operation,
          amount: Number(signedDelta.toFixed(4)),
          balanceBefore,
          balanceAfter,
          referenceId: txnId,
          description: input.description.trim().slice(0, 300) || `Admin ${input.operation}`,
          createdBy: user.uid,
          createdAt: serverTimestamp(),
        };
        tx.set(txnRef, txnPayload);

        return { balanceBefore, balanceAfter, txnId };
      });

      await appendGatewayAuditLog({
        action: `API_BALANCE_${input.operation.toUpperCase()}`,
        adminId: user.uid,
        targetId: input.customerId,
        previousValue: String(result.balanceBefore),
        newValue: String(result.balanceAfter),
        note: input.description,
      });

      return result;
    } catch (error) {
      handleFirestoreError(
        error,
        OperationType.WRITE,
        `${FIRESTORE_COLLECTIONS.apiCustomers}/${input.customerId}`
      );
    }
  },

  async listAllApiKeys(): Promise<ApiKeyItem[]> {
    const { db } = requireFirebaseContext();
    try {
      const snap = await getDocs(query(collection(db, FIRESTORE_COLLECTIONS.apiKeys), limit(300)));
      return snap.docs
        .map((d) => mapKey(d.data() as FirestoreApiKeyDoc))
        .sort((a, b) => b.createdAtMs - a.createdAtMs);
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, FIRESTORE_COLLECTIONS.apiKeys);
    }
  },

  async updateApiKeyAdmin(input: {
    keyId: string;
    status?: ApiKeyStatus;
    label?: string;
    rateLimitPerMinute?: number;
    permissions?: ApiKeyPermission[];
  }): Promise<void> {
    const { db, user } = requireFirebaseContext();
    const ref = doc(db, FIRESTORE_COLLECTIONS.apiKeys, input.keyId);
    const updates: Record<string, unknown> = {
      updatedAt: serverTimestamp(),
    };
    if (input.status) updates.status = input.status;
    if (input.label?.trim()) updates.label = input.label.trim().slice(0, 80);
    if (typeof input.rateLimitPerMinute === 'number') {
      updates.rateLimitPerMinute = Math.max(1, Math.min(10000, Math.floor(input.rateLimitPerMinute)));
    }
    if (Array.isArray(input.permissions) && input.permissions.length > 0) {
      updates.permissions = input.permissions;
    }
    try {
      await updateDoc(ref, updates);
      await appendGatewayAuditLog({
        action: 'API_KEY_UPDATED',
        adminId: user.uid,
        targetId: input.keyId,
        previousValue: '-',
        newValue: JSON.stringify({
          ...(input.status ? { status: input.status } : {}),
          ...(input.rateLimitPerMinute ? { rate: input.rateLimitPerMinute } : {}),
        }),
      });
    } catch (error) {
      handleFirestoreError(
        error,
        OperationType.UPDATE,
        `${FIRESTORE_COLLECTIONS.apiKeys}/${input.keyId}`
      );
    }
  },

  async listAllApiOrders(): Promise<ApiOrderItem[]> {
    const { db } = requireFirebaseContext();
    try {
      const snap = await getDocs(
        query(collection(db, FIRESTORE_COLLECTIONS.apiOrders), limit(300))
      );
      return snap.docs
        .map((d) => mapApiOrder(d.data() as FirestoreApiOrderDoc))
        .sort((a, b) => b.createdAtMs - a.createdAtMs);
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, FIRESTORE_COLLECTIONS.apiOrders);
    }
  },

  async syncApiOrderStatusFromInternal(apiOrder: ApiOrderItem): Promise<ApiOrderItem> {
    const { db, user } = requireFirebaseContext();
    try {
      const internalSnap = await getDoc(
        doc(db, FIRESTORE_COLLECTIONS.orders, apiOrder.internalOrderId)
      );
      if (!internalSnap.exists()) {
        throw new Error(`Internal order ${apiOrder.internalOrderId} not found.`);
      }
      const internal = internalSnap.data() as FirestoreOrderDoc;
      const apiOrderRef = doc(db, FIRESTORE_COLLECTIONS.apiOrders, apiOrder.id);
      await updateDoc(apiOrderRef, {
        status: internal.status,
        startCount: Number(internal.startCount ?? 0),
        remains: Number(internal.remains ?? 0),
        refunded: Boolean(internal.refunded),
        ...(internal.refundTransactionId
          ? { refundTransactionId: internal.refundTransactionId }
          : {}),
        updatedAt: serverTimestamp(),
      });
      await appendGatewayAuditLog({
        action: 'API_ORDER_SYNCED',
        adminId: user.uid,
        targetId: apiOrder.id,
        previousValue: apiOrder.status,
        newValue: internal.status,
      });
      const updatedSnap = await getDoc(apiOrderRef);
      return mapApiOrder(updatedSnap.data() as FirestoreApiOrderDoc);
    } catch (error) {
      handleFirestoreError(
        error,
        OperationType.UPDATE,
        `${FIRESTORE_COLLECTIONS.apiOrders}/${apiOrder.id}`
      );
    }
  },

  async listAllApiTransactions(): Promise<ApiTransactionItem[]> {
    const { db } = requireFirebaseContext();
    try {
      const snap = await getDocs(
        query(collection(db, FIRESTORE_COLLECTIONS.apiTransactions), limit(300))
      );
      return snap.docs
        .map((d) => mapApiTransaction(d.data() as FirestoreApiTransactionDoc))
        .sort((a, b) => b.createdAtMs - a.createdAtMs);
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, FIRESTORE_COLLECTIONS.apiTransactions);
    }
  },

  async listAllApiRequestLogs(): Promise<ApiRequestLogItem[]> {
    const { db } = requireFirebaseContext();
    try {
      const snap = await getDocs(
        query(collection(db, FIRESTORE_COLLECTIONS.apiRequestLogs), limit(350))
      );
      return snap.docs
        .map((d) => mapRequestLog(d.data() as FirestoreApiRequestLogDoc))
        .sort((a, b) => b.createdAtMs - a.createdAtMs);
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, FIRESTORE_COLLECTIONS.apiRequestLogs);
    }
  },

  async listWebsiteInstallations(): Promise<WebsiteInstallationItem[]> {
    const { db } = requireFirebaseContext();
    try {
      const snap = await getDocs(
        query(collection(db, FIRESTORE_COLLECTIONS.websiteInstallations), limit(250))
      );
      return snap.docs
        .map((d) => mapInstallation(d.data() as FirestoreWebsiteInstallationDoc))
        .sort((a, b) => b.createdAtMs - a.createdAtMs);
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, FIRESTORE_COLLECTIONS.websiteInstallations);
    }
  },

  async saveWebsiteInstallation(input: {
    id?: string;
    installationId: string;
    customerId: string;
    userId?: string;
    buyerName: string;
    domain: string;
    appVersion?: string;
    apiLocked: boolean;
    status: WebsiteInstallationStatus;
    note?: string;
  }): Promise<WebsiteInstallationItem> {
    const { db, user } = requireFirebaseContext();
    const cleanInstallId = input.installationId.trim().slice(0, 64);
    const docId = input.id?.trim() || cleanInstallId;
    if (!/^[a-zA-Z0-9_-]{1,64}$/.test(docId)) {
      throw new Error('Installation ID may only contain letters, numbers, hyphens, and underscores.');
    }
    const ref = doc(db, FIRESTORE_COLLECTIONS.websiteInstallations, docId);
    try {
      const existingSnap = await getDoc(ref);
      if (existingSnap.exists()) {
        await updateDoc(ref, {
          customerId: input.customerId.trim(),
          userId: input.userId?.trim() || '',
          buyerName: input.buyerName.trim().slice(0, 120),
          domain: input.domain.trim().slice(0, 200),
          appVersion: (input.appVersion ?? '1.0.0').trim().slice(0, 24),
          apiLocked: Boolean(input.apiLocked),
          status: input.status,
          note: (input.note ?? '').trim().slice(0, 300),
          updatedAt: serverTimestamp(),
        });
      } else {
        const payload: FirestoreWebsiteInstallationDoc = {
          id: docId,
          installationId: cleanInstallId,
          customerId: input.customerId.trim(),
          ...(input.userId?.trim() ? { userId: input.userId.trim() } : {}),
          buyerName: input.buyerName.trim().slice(0, 120),
          domain: input.domain.trim().slice(0, 200),
          appVersion: (input.appVersion ?? '1.0.0').trim().slice(0, 24),
          apiLocked: Boolean(input.apiLocked),
          status: input.status,
          ...(input.note?.trim() ? { note: input.note.trim().slice(0, 300) } : {}),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };
        await setDoc(ref, payload);
      }
      await appendGatewayAuditLog({
        action: existingSnap.exists() ? 'INSTALLATION_UPDATED' : 'INSTALLATION_REGISTERED',
        adminId: user.uid,
        targetId: docId,
        previousValue: '-',
        newValue: `${input.domain} · locked=${input.apiLocked} · status=${input.status}`,
      });
      const savedSnap = await getDoc(ref);
      return mapInstallation(savedSnap.data() as FirestoreWebsiteInstallationDoc);
    } catch (error) {
      handleFirestoreError(
        error,
        OperationType.WRITE,
        `${FIRESTORE_COLLECTIONS.websiteInstallations}/${docId}`
      );
    }
  },
};
