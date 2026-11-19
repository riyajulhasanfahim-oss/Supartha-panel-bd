import { firestoreDataClient } from './firebaseDataClient';
import type {
  CustomerPaymentRequest,
  CustomerProfile,
  NotificationItem,
  PaymentMethodItem,
  WalletSummary,
  WalletTransaction,
} from '../types';

export const walletService = {
  getProfile: (): Promise<CustomerProfile> => firestoreDataClient.getProfile(),
  getSummary: (): Promise<WalletSummary> => firestoreDataClient.getWalletSummary(),
  getTransactions: (): Promise<WalletTransaction[]> => firestoreDataClient.getTransactions(),
  getActivePaymentMethods: (): Promise<PaymentMethodItem[]> =>
    firestoreDataClient.getActivePaymentMethods(),
  getMyPaymentRequests: (): Promise<CustomerPaymentRequest[]> =>
    firestoreDataClient.getMyPaymentRequests(),
  submitPaymentRequest: (input: {
    paymentMethodId: string;
    amount: number;
    transactionId: string;
    userName: string;
  }): Promise<CustomerPaymentRequest> => firestoreDataClient.submitPaymentRequest(input),
  cancelMyPaymentRequest: (paymentId: string): Promise<void> =>
    firestoreDataClient.cancelMyPaymentRequest(paymentId),
  getNotifications: (): Promise<NotificationItem[]> => firestoreDataClient.getNotifications(),
  markNotificationRead: (item: NotificationItem): Promise<void> =>
    firestoreDataClient.markNotificationRead(item),
  markAllNotificationsRead: (items: NotificationItem[]): Promise<void> =>
    firestoreDataClient.markAllNotificationsRead(items),
};
