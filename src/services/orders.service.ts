import { firestoreDataClient } from './firebaseDataClient';
import type { CreateOrderInput, OrderRecord, OrderStatsSummary, SmmService } from '../types';

export const ordersService = {
  getAll: (): Promise<OrderRecord[]> => firestoreDataClient.getOrders(),
  getStats: (): Promise<OrderStatsSummary> => firestoreDataClient.getOrderStats(),
  placeDemoOrder: (input: CreateOrderInput, service: SmmService): Promise<OrderRecord> =>
    firestoreDataClient.createOrder(input, service),
};
