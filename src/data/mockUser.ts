import type {
  CustomerProfile,
  NotificationItem,
  SupportTicket,
  WalletSummary,
  WalletTransaction,
} from '../types';

export const MOCK_CUSTOMER_PROFILE: CustomerProfile = {
  id: 'cust-demo-01',
  fullName: 'Rafiqul Islam',
  username: 'rafiq_rj',
  email: 'rafiqul@example.com',
  phone: '+880 1712-000128',
  photoUrl: '',
  role: 'user',
  status: 'active',
  tierLabel: 'Verified Member',
  joinedDate: 'March 2026',
  avatarInitials: 'RI',
};

export const MOCK_WALLET_SUMMARY: WalletSummary = {
  balance: 1250,
  totalSpent: 14820,
  totalDeposited: 16070,
};

export const MOCK_TRANSACTIONS: WalletTransaction[] = [
  {
    id: 'txn-901',
    reference: 'BK-884129',
    method: 'bKash Personal',
    amount: 1000,
    type: 'deposit',
    status: 'Completed',
    timestampLabel: 'Today, 11:20 AM',
  },
  {
    id: 'txn-900',
    reference: 'ORD-10257',
    method: 'Wallet Deduction',
    amount: -35,
    type: 'order',
    status: 'Completed',
    timestampLabel: '2 min ago',
  },
  {
    id: 'txn-899',
    reference: 'NG-552014',
    method: 'Nagad Merchant',
    amount: 500,
    type: 'deposit',
    status: 'Completed',
    timestampLabel: 'Yesterday, 6:45 PM',
  },
];

export const MOCK_NOTIFICATIONS: NotificationItem[] = [
  {
    id: 'notif-1',
    title: 'Order #10257 Completed',
    message: '1,000 Instagram Followers have been delivered to your link.',
    timeLabel: '2 min ago',
    read: false,
    category: 'order',
  },
  {
    id: 'notif-2',
    title: 'Wallet Credited ৳1,000',
    message: 'Your bKash deposit reference BK-884129 has been confirmed.',
    timeLabel: '3 hours ago',
    read: false,
    category: 'wallet',
  },
  {
    id: 'notif-3',
    title: 'New YouTube Shorts Rates',
    message: 'Updated high-retention YouTube packages are now available.',
    timeLabel: 'Yesterday',
    read: true,
    category: 'system',
  },
];

export const MOCK_SUPPORT_TICKETS: SupportTicket[] = [
  {
    id: 'tkt-401',
    ticketNumber: 'TKT-4012',
    subject: 'Order Issue',
    orderReference: '#10254',
    message: 'Please prioritize speed boost for Facebook Page Followers order #10254.',
    status: 'Answered',
    updatedAtLabel: '1 hour ago',
  },
  {
    id: 'tkt-400',
    ticketNumber: 'TKT-3998',
    subject: 'API / Reseller',
    message: 'Requesting reseller API tier discount documentation for upcoming store.',
    status: 'Closed',
    updatedAtLabel: '3 days ago',
  },
];
