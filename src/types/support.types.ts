export type TicketStatus =
  | 'Open'
  | 'Pending'
  | 'In Progress'
  | 'Waiting for Customer'
  | 'Answered'
  | 'Resolved'
  | 'Closed';

export type TicketCategory =
  | 'Order Issue'
  | 'Payment / Deposit'
  | 'Service Inquiry'
  | 'Account / General'
  | 'API / Reseller';

export type TicketSubject = string;

export type TicketPriority = 'Low' | 'Medium' | 'High';

export interface TicketReply {
  id: string;
  messageId?: string;
  ticketId: string;
  senderId: string;
  senderName: string;
  senderRole: 'user' | 'admin';
  message: string;
  createdAtLabel: string;
  readAtLabel?: string;
}

export interface SupportTicket {
  id: string;
  ticketNumber: string;
  category?: TicketCategory | string;
  subject: TicketSubject;
  orderReference?: string;
  attachmentUrl?: string;
  message: string;
  adminReply?: string;
  priority?: TicketPriority;
  status: TicketStatus;
  createdAtLabel?: string;
  updatedAtLabel: string;
}

export interface CreateTicketInput {
  category?: TicketCategory | string;
  subject: TicketSubject;
  orderReference?: string;
  attachmentUrl?: string;
  priority?: TicketPriority;
  message: string;
}
