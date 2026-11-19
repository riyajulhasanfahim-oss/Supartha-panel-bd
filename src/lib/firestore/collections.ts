import type { FieldValue, Timestamp } from 'firebase/firestore';

/**
 * Canonical Firestore collection names for the white-label SMM Panel.
 */
export const FIRESTORE_COLLECTIONS = {
  users: 'users',
  adminUsers: 'adminUsers',
  categories: 'categories',
  services: 'services',
  orders: 'orders',
  payments: 'payments',
  paymentMethods: 'paymentMethods',
  transactions: 'transactions',
  apiProviders: 'apiProviders',
  apiCustomers: 'apiCustomers',
  apiKeys: 'apiKeys',
  apiOrders: 'apiOrders',
  apiTransactions: 'apiTransactions',
  apiRequestLogs: 'apiRequestLogs',
  websiteInstallations: 'websiteInstallations',
  settings: 'settings',
  supportTickets: 'supportTickets',
  notifications: 'notifications',
  adminNotifications: 'adminNotifications',
  auditLogs: 'auditLogs',
} as const;

export const SETTINGS_DOC_IDS = {
  system: 'system',
  setup: 'setup',
  apiGateway: 'apiGateway',
} as const;

export type FirestoreTimestampValue = Timestamp | FieldValue;

export type UserAccountStatus = 'active' | 'suspended' | 'blocked';
export type UserAccountRole = 'user' | 'admin';
export type AdminStaffRole = 'super_admin' | 'admin' | 'manager' | 'support_staff';

export interface FirestoreUserDoc {
  uid: string;
  name: string;
  email: string;
  phone?: string;
  photoUrl?: string;
  role: UserAccountRole;
  balance: number;
  status: UserAccountStatus;
  lastTxnId?: string;
  createdAt: FirestoreTimestampValue;
  updatedAt: FirestoreTimestampValue;
}

export interface FirestoreAdminUserDoc {
  uid: string;
  name?: string;
  email: string;
  role: AdminStaffRole;
  status: 'active' | 'revoked';
  createdAt: FirestoreTimestampValue;
  updatedAt: FirestoreTimestampValue;
}

export interface FirestoreCategoryDoc {
  id: string;
  name: string;
  icon: string;
  description?: string;
  status: 'active' | 'inactive';
  sortOrder: number;
  isDemo?: boolean;
}

export interface FirestoreServiceDoc {
  id: string;
  categoryId: string;
  name: string;
  serviceType?: string;
  description?: string;
  providerId?: string;
  providerServiceId?: string;
  costPrice: number;
  sellingPrice: number;
  minQuantity: number;
  maxQuantity: number;
  averageTime?: string;
  deliverySpeed?: string;
  refillGuaranteed?: boolean;
  status: 'active' | 'inactive';
  isDemo?: boolean;
  createdAt: FirestoreTimestampValue;
  updatedAt: FirestoreTimestampValue;
}

export type OrderStatusFirestore =
  | 'Pending'
  | 'Processing'
  | 'In Progress'
  | 'Completed'
  | 'Partial'
  | 'Canceled'
  | 'Cancelled'
  | 'Failed';

export interface FirestoreOrderDoc {
  id: string;
  userId: string;
  serviceId: string;
  serviceName?: string;
  categoryId?: string;
  providerId?: string;
  providerOrderId?: string;
  providerCharge?: number;
  link: string;
  quantity: number;
  charge: number;
  status: OrderStatusFirestore;
  remains?: number;
  startCount?: number;
  paymentStatus?: 'paid' | 'refunded';
  paymentTransactionId?: string;
  refunded?: boolean;
  refundEligible?: boolean;
  refundedAt?: FirestoreTimestampValue;
  refundedBy?: string;
  refundTransactionId?: string;
  lastCheckedAt?: FirestoreTimestampValue;
  completedAt?: FirestoreTimestampValue;
  retryCount?: number;
  lastAttemptAt?: FirestoreTimestampValue;
  lastError?: string;
  nextRetryAt?: FirestoreTimestampValue;
  internalNote?: string;
  createdAt: FirestoreTimestampValue;
  updatedAt: FirestoreTimestampValue;
}

export type PaymentStatusFirestore =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'cancelled'
  | 'Pending'
  | 'Approved'
  | 'Rejected'
  | 'Completed'
  | 'Failed';

export interface FirestorePaymentDoc {
  id: string;
  paymentId?: string;
  userId: string;
  userName?: string;
  amount: number;
  method: string;
  paymentMethod?: string;
  transactionId: string;
  status: PaymentStatusFirestore;
  adminNote?: string;
  reviewedAt?: FirestoreTimestampValue;
  reviewedBy?: string;
  createdAt: FirestoreTimestampValue;
}

export interface FirestorePaymentMethodDoc {
  id: string;
  name: string;
  type: string;
  accountNumber: string;
  instructions: string;
  note?: string;
  minAmount: number;
  maxAmount: number;
  status: 'active' | 'inactive';
  displayOrder: number;
  createdAt: FirestoreTimestampValue;
  updatedAt: FirestoreTimestampValue;
}

export type TransactionTypeFirestore =
  | 'deposit'
  | 'order'
  | 'order_payment'
  | 'refund'
  | 'admin_credit'
  | 'admin_debit'
  | 'adjustment';

export interface FirestoreTransactionDoc {
  id: string;
  transactionId?: string;
  userId: string;
  type: TransactionTypeFirestore;
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  reference: string;
  referenceId?: string;
  description?: string;
  reason?: string;
  createdBy?: string;
  adminId?: string;
  createdAt: FirestoreTimestampValue;
}

export interface FirestoreApiProviderDoc {
  id: string;
  name: string;
  apiUrl: string;
  apiKey: string;
  providerFormat?: string;
  lastBalance?: number;
  lastBalanceCurrency?: string;
  status: 'active' | 'inactive';
  createdAt: FirestoreTimestampValue;
  updatedAt: FirestoreTimestampValue;
}

export interface SettingsSocialLinks {
  facebook?: string;
  telegram?: string;
  youtube?: string;
  instagram?: string;
}

export interface SettingsLandingFeatureItem {
  id: string;
  index: string;
  title: string;
  description: string;
  metric: string;
}

export interface SettingsHowItWorksItem {
  step: string;
  title: string;
  description: string;
}

export interface SettingsFaqItem {
  id: string;
  question: string;
  answer: string;
}

export interface FirestoreSettingsDoc {
  websiteName: string;
  websiteDescription?: string;
  brandTagline?: string;
  logo?: string;
  favicon?: string;
  theme?: string;
  themeColor?: string;
  secondaryColor?: string;
  currency: string;
  currencySymbol?: string;
  defaultProfitMargin?: number;
  autoSyncEnabled?: boolean;
  supportEmail?: string;
  supportWhatsapp?: string;
  supportHours?: string;
  footerText?: string;
  socialLinks?: SettingsSocialLinks;
  heroTitle?: string;
  heroSubtitle?: string;
  heroDescription?: string;
  heroCtaLabel?: string;
  aboutTitle?: string;
  aboutDescription?: string;
  landingFeatures?: SettingsLandingFeatureItem[];
  howItWorks?: SettingsHowItWorksItem[];
  landingFaqs?: SettingsFaqItem[];
  maintenanceMode: boolean;
  databaseInitialized?: boolean;
  setupCompleted?: boolean;
  brandingConfigured?: boolean;
  providerConfigured?: boolean;
  paymentConfigured?: boolean;
  productionMode?: boolean;
  demoDataEnabled?: boolean;
  installationId?: string;
  appVersion?: string;
  schemaVersion?: string;
  defaultSettings?: Record<string, unknown>;
  initializedAt?: FirestoreTimestampValue;
  initializedBy?: string;
  updatedAt: FirestoreTimestampValue;
}

export type SupportTicketStatusFirestore =
  | 'Open'
  | 'Pending'
  | 'In Progress'
  | 'Waiting for Customer'
  | 'Answered'
  | 'Resolved'
  | 'Closed';

export interface FirestoreSupportTicketDoc {
  id: string;
  userId: string;
  category?: string;
  subject: string;
  orderReference?: string;
  attachmentUrl?: string;
  message: string;
  adminReply?: string;
  repliedBy?: string;
  status: SupportTicketStatusFirestore;
  priority: 'Low' | 'Medium' | 'High';
  createdAt: FirestoreTimestampValue;
  updatedAt: FirestoreTimestampValue;
}

export interface FirestoreTicketReplyDoc {
  id: string;
  messageId?: string;
  ticketId: string;
  senderId: string;
  senderName?: string;
  senderRole: 'user' | 'admin';
  message: string;
  createdAt: FirestoreTimestampValue;
  readAt?: FirestoreTimestampValue;
}

export type NotificationTypeFirestore =
  | 'order'
  | 'wallet'
  | 'support'
  | 'system'
  | 'order_created'
  | 'order_processing'
  | 'order_completed'
  | 'order_partial'
  | 'order_failed'
  | 'payment_approved'
  | 'payment_rejected'
  | 'refund'
  | 'support_reply';

export interface FirestoreNotificationDoc {
  id: string;
  notificationId?: string;
  userId: string;
  targetType?: 'user' | 'all';
  title: string;
  message: string;
  type: NotificationTypeFirestore;
  referenceId?: string;
  read: boolean;
  isRead?: boolean;
  createdAt: FirestoreTimestampValue;
}

export type AdminNotificationTypeFirestore =
  | 'new_user'
  | 'new_payment'
  | 'new_order'
  | 'new_ticket'
  | 'failed_provider_api'
  | 'system_error';

export interface FirestoreAdminNotificationDoc {
  id: string;
  type: AdminNotificationTypeFirestore;
  title: string;
  message: string;
  referenceId?: string;
  actorUid?: string;
  read: boolean;
  createdAt: FirestoreTimestampValue;
}

export type AuditLogTargetType =
  | 'order'
  | 'ticket'
  | 'user'
  | 'payment'
  | 'provider'
  | 'system'
  | 'api_gateway';

export interface FirestoreAuditLogDoc {
  id: string;
  action: string;
  adminId: string;
  targetId: string;
  targetType: AuditLogTargetType;
  previousValue: string;
  newValue: string;
  note?: string;
  timestamp: FirestoreTimestampValue;
}

export type ApiCustomerStatus = 'active' | 'suspended' | 'revoked';
export type ApiKeyPermission = 'balance' | 'services' | 'add' | 'status';
export type ApiKeyStatus = 'active' | 'disabled' | 'revoked';
export type ApiTransactionType = 'credit' | 'debit' | 'order_charge' | 'refund' | 'adjustment';
export type WebsiteInstallationStatus = 'active' | 'suspended' | 'revoked';

export interface FirestoreApiCustomerDoc {
  id: string;
  userId?: string;
  name: string;
  email: string;
  companyName?: string;
  websiteDomain?: string;
  installationId: string;
  apiBalance: number;
  totalSpent?: number;
  totalOrders?: number;
  rateLimitPerMinute: number;
  customDiscountPercent?: number;
  status: ApiCustomerStatus;
  note?: string;
  createdAt: FirestoreTimestampValue;
  updatedAt: FirestoreTimestampValue;
}

export interface FirestoreApiKeyDoc {
  id: string;
  customerId: string;
  userId?: string;
  installationId?: string;
  label: string;
  keyPrefix: string;
  keyLast4: string;
  keyHash: string;
  permissions: ApiKeyPermission[];
  rateLimitPerMinute: number;
  status: ApiKeyStatus;
  requestCount?: number;
  lastUsedAt?: FirestoreTimestampValue;
  createdBy?: string;
  createdAt: FirestoreTimestampValue;
  updatedAt: FirestoreTimestampValue;
}

export interface FirestoreApiOrderDoc {
  id: string;
  internalOrderId: string;
  customerId: string;
  userId?: string;
  keyId?: string;
  installationId?: string;
  idempotencyKey?: string;
  serviceId: string;
  serviceName?: string;
  link: string;
  quantity: number;
  charge: number;
  status: OrderStatusFirestore;
  startCount?: number;
  remains?: number;
  refunded?: boolean;
  refundTransactionId?: string;
  providerDispatched?: boolean;
  errorMessage?: string;
  createdAt: FirestoreTimestampValue;
  updatedAt: FirestoreTimestampValue;
}

export interface FirestoreApiTransactionDoc {
  id: string;
  customerId: string;
  userId?: string;
  type: ApiTransactionType;
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  referenceId: string;
  description?: string;
  createdBy?: string;
  createdAt: FirestoreTimestampValue;
}

export interface FirestoreApiRequestLogDoc {
  id: string;
  customerId?: string;
  userId?: string;
  keyId?: string;
  installationId?: string;
  action: string;
  httpStatus: number;
  success: boolean;
  latencyMs?: number;
  ipAddress?: string;
  idempotencyKey?: string;
  errorMessage?: string;
  createdAt: FirestoreTimestampValue;
}

export interface FirestoreWebsiteInstallationDoc {
  id: string;
  installationId: string;
  customerId: string;
  userId?: string;
  buyerName: string;
  domain: string;
  appVersion?: string;
  apiLocked: boolean;
  status: WebsiteInstallationStatus;
  note?: string;
  createdAt: FirestoreTimestampValue;
  updatedAt: FirestoreTimestampValue;
}

export interface FirestoreApiGatewaySettingsDoc {
  gatewayEnabled: boolean;
  defaultBaseUrl: string;
  defaultRateLimitPerMinute: number;
  maxBulkStatusIds: number;
  requireIdempotencyKey: boolean;
  autoDispatchEnabled: boolean;
  allowCustomerSelfKeyGen: boolean;
  defaultLockMode: boolean;
  updatedAt: FirestoreTimestampValue;
  updatedBy?: string;
}

