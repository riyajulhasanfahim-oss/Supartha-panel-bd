import type {
  CreateOrderInput,
  CreateTicketInput,
  CustomerProfile,
  NotificationItem,
  OrderRecord,
  OrderStatsSummary,
  PlatformCategory,
  SmmService,
  SupportTicket,
  WalletSummary,
  WalletTransaction,
} from '../types';
import { MOCK_PLATFORMS, MOCK_SERVICES } from '../data/mockServices';
import { MOCK_ORDER_STATS, MOCK_ORDERS } from '../data/mockOrders';
import {
  MOCK_CUSTOMER_PROFILE,
  MOCK_NOTIFICATIONS,
  MOCK_SUPPORT_TICKETS,
  MOCK_TRANSACTIONS,
  MOCK_WALLET_SUMMARY,
} from '../data/mockUser';
import { calculateOrderCharge, isPackageService } from '../utils/pricing';

/**
 * Abstract Data Client Contract.
 * Phase 1 uses DemoDataClient backed by modular mock datasets.
 * Phase 2+ can swap in FirestoreDataClient (configured via Admin Panel app initialization)
 * without refactoring any React UI components.
 */
export interface IDataClient {
  getPlatforms(): Promise<PlatformCategory[]>;
  getServices(): Promise<SmmService[]>;
  getOrders(): Promise<OrderRecord[]>;
  getOrderStats(): Promise<OrderStatsSummary>;
  createOrder(input: CreateOrderInput, service: SmmService): Promise<OrderRecord>;
  getProfile(): Promise<CustomerProfile>;
  getWalletSummary(): Promise<WalletSummary>;
  getTransactions(): Promise<WalletTransaction[]>;
  getNotifications(): Promise<NotificationItem[]>;
  getTickets(): Promise<SupportTicket[]>;
  createTicket(input: CreateTicketInput): Promise<SupportTicket>;
}

class DemoDataClient implements IDataClient {
  async getPlatforms(): Promise<PlatformCategory[]> {
    return MOCK_PLATFORMS;
  }

  async getServices(): Promise<SmmService[]> {
    return MOCK_SERVICES;
  }

  async getOrders(): Promise<OrderRecord[]> {
    return MOCK_ORDERS;
  }

  async getOrderStats(): Promise<OrderStatsSummary> {
    return MOCK_ORDER_STATS;
  }

  async createOrder(input: CreateOrderInput, service: SmmService): Promise<OrderRecord> {
    const orderNumber = String(10258 + Math.floor(Math.random() * 900));
    const charge = calculateOrderCharge(
      input.quantity,
      service.ratePerThousand,
      isPackageService(service)
    );
    return {
      id: `ord-${orderNumber}`,
      orderNumber,
      categoryId: input.categoryId,
      serviceId: input.serviceId,
      serviceName: service.name.split('–')[0].trim(),
      link: input.link,
      quantity: input.quantity,
      charge,
      status: 'Pending',
      startCount: 0,
      remains: input.quantity,
      createdAtLabel: 'Just now',
      createdAtIso: new Date().toISOString(),
      updatedAtLabel: 'Just now',
      updatedAtIso: new Date().toISOString(),
    };
  }

  async getProfile(): Promise<CustomerProfile> {
    return MOCK_CUSTOMER_PROFILE;
  }

  async getWalletSummary(): Promise<WalletSummary> {
    return MOCK_WALLET_SUMMARY;
  }

  async getTransactions(): Promise<WalletTransaction[]> {
    return MOCK_TRANSACTIONS;
  }

  async getNotifications(): Promise<NotificationItem[]> {
    return MOCK_NOTIFICATIONS;
  }

  async getTickets(): Promise<SupportTicket[]> {
    return MOCK_SUPPORT_TICKETS;
  }

  async createTicket(input: CreateTicketInput): Promise<SupportTicket> {
    const num = 4013 + Math.floor(Math.random() * 500);
    return {
      id: `tkt-${num}`,
      ticketNumber: `TKT-${num}`,
      subject: input.subject,
      orderReference: input.orderReference,
      message: input.message,
      priority: input.priority ?? 'Medium',
      status: 'Open',
      createdAtLabel: 'Just now',
      updatedAtLabel: 'Just now',
    };
  }
}

export const dataClient: IDataClient = new DemoDataClient();
