import type {
  NotificationTypeFirestore,
  PaymentStatusFirestore,
  TransactionTypeFirestore,
  UserAccountRole,
  UserAccountStatus,
} from '../lib/firestore/collections';

export interface CustomerProfile {
  id: string;
  fullName: string;
  username: string;
  email: string;
  phone: string;
  photoUrl?: string;
  role: UserAccountRole;
  status: UserAccountStatus;
  tierLabel: string;
  joinedDate: string;
  avatarInitials: string;
}

export interface WalletSummary {
  balance: number;
  totalSpent: number;
  totalDeposited: number;
}

export interface PaymentMethodItem {
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
}

export interface CustomerPaymentRequest {
  id: string;
  paymentId: string;
  userId: string;
  userName: string;
  method: string;
  amount: number;
  transactionId: string;
  status: PaymentStatusFirestore;
  adminNote?: string;
  reviewedBy?: string;
  reviewedAtLabel?: string;
  createdAtLabel: string;
}

export interface WalletTransaction {
  id: string;
  reference: string;
  referenceId?: string;
  method: string;
  amount: number;
  type: TransactionTypeFirestore;
  status: 'Completed' | 'Pending' | 'Failed';
  description?: string;
  reason?: string;
  createdBy?: string;
  balanceBefore?: number;
  balanceAfter?: number;
  timestampLabel: string;
}

export interface NotificationItem {
  id: string;
  notificationId?: string;
  targetUserId?: string;
  title: string;
  message: string;
  timeLabel: string;
  read: boolean;
  isRead?: boolean;
  category: NotificationTypeFirestore;
  referenceId?: string;
}
