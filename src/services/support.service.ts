import type { Unsubscribe } from 'firebase/firestore';
import { firestoreDataClient } from './firebaseDataClient';
import type { CreateTicketInput, SupportTicket, TicketReply } from '../types';

export const supportService = {
  getTickets: (): Promise<SupportTicket[]> => firestoreDataClient.getTickets(),
  createTicket: (input: CreateTicketInput): Promise<SupportTicket> =>
    firestoreDataClient.createTicket(input),
  getReplies: (ticketId: string): Promise<TicketReply[]> =>
    firestoreDataClient.getTicketReplies(ticketId),
  subscribeMessages: (
    ticketId: string,
    onUpdate: (messages: TicketReply[]) => void,
    onError?: (err: Error) => void
  ): Unsubscribe => firestoreDataClient.subscribeTicketMessages(ticketId, onUpdate, onError),
  addReply: (
    ticketId: string,
    message: string,
    senderName: string,
    senderRole: 'user' | 'admin' = 'user'
  ): Promise<TicketReply> =>
    firestoreDataClient.addTicketReply(ticketId, message, senderName, senderRole),
  markMessagesRead: (ticketId: string, viewerRole: 'user' | 'admin'): Promise<void> =>
    firestoreDataClient.markTicketMessagesRead(ticketId, viewerRole),
};
