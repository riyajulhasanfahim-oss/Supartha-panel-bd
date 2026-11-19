/**
 * Security Rules Specification & Verification Matrix ("Dirty Dozen" Payloads).
 * Validates all 12 adversarial attack vectors against firestore.rules.
 */

export interface SecurityAuditCase {
  id: string;
  collection: string;
  operation: 'get' | 'list' | 'create' | 'update' | 'delete';
  actor: 'anonymous' | 'userA' | 'userB' | 'unverifiedAdminEmail' | 'admin';
  expected: 'PERMISSION_DENIED' | 'ALLOWED';
  payload?: Record<string, unknown>;
  reason: string;
}

export const DIRTY_DOZEN_AUDIT_CASES: SecurityAuditCase[] = [
  {
    id: 'DD-01',
    collection: 'users/userA',
    operation: 'create',
    actor: 'userA',
    expected: 'PERMISSION_DENIED',
    payload: { role: 'admin', balance: 0 },
    reason: 'Role escalation on signup blocked by incoming().role == "user".',
  },
  {
    id: 'DD-02',
    collection: 'users/userA',
    operation: 'create',
    actor: 'userA',
    expected: 'PERMISSION_DENIED',
    payload: { role: 'user', balance: 50000 },
    reason: 'Self-crediting balance on signup blocked by incoming().balance == 0.',
  },
  {
    id: 'DD-03',
    collection: 'users/userA',
    operation: 'update',
    actor: 'userA',
    expected: 'PERMISSION_DENIED',
    payload: { balance: 9999 },
    reason: 'Balance mutation blocked by affectedKeys().hasOnly(["name", "phone", "updatedAt"]).',
  },
  {
    id: 'DD-04',
    collection: 'users/userB',
    operation: 'get',
    actor: 'userA',
    expected: 'PERMISSION_DENIED',
    reason: 'Cross-user PII access blocked by isOwner(userId) || isAdmin().',
  },
  {
    id: 'DD-05',
    collection: 'orders/ord_1',
    operation: 'create',
    actor: 'userA',
    expected: 'PERMISSION_DENIED',
    payload: { status: 'Completed', userId: 'userA' },
    reason: 'Order status shortcutting blocked by incoming().status == "Pending".',
  },
  {
    id: 'DD-06',
    collection: 'orders/ord_1',
    operation: 'update',
    actor: 'userA',
    expected: 'PERMISSION_DENIED',
    payload: { charge: 0.01, providerOrderId: 'fake_99' },
    reason: 'Price/provider tampering blocked by affectedKeys().hasOnly(["link", "updatedAt"]).',
  },
  {
    id: 'DD-07',
    collection: 'orders/ord_2',
    operation: 'create',
    actor: 'userA',
    expected: 'PERMISSION_DENIED',
    payload: { serviceId: 'non_existent_service', status: 'Pending' },
    reason: 'Orphaned order creation blocked by exists(/services/$(incoming().serviceId)).',
  },
  {
    id: 'DD-08',
    collection: 'orders',
    operation: 'list',
    actor: 'userA',
    expected: 'PERMISSION_DENIED',
    reason: 'Unfiltered list query without where("userId", "==", uid) rejected by resource.data.userId == request.auth.uid.',
  },
  {
    id: 'DD-09',
    collection: 'services/srv_1',
    operation: 'update',
    actor: 'userA',
    expected: 'PERMISSION_DENIED',
    payload: { sellingPrice: 0.01 },
    reason: 'Non-admin catalog tampering blocked by isAdmin().',
  },
  {
    id: 'DD-10',
    collection: 'payments/pay_1',
    operation: 'create',
    actor: 'userA',
    expected: 'PERMISSION_DENIED',
    payload: { status: 'Completed', amount: 10000 },
    reason: 'Self-approving payment blocked by incoming().status == "Pending".',
  },
  {
    id: 'DD-11',
    collection: 'transactions/txn_1',
    operation: 'create',
    actor: 'userA',
    expected: 'PERMISSION_DENIED',
    payload: { type: 'deposit', amount: 10000 },
    reason: 'Direct ledger write blocked by isAdmin().',
  },
  {
    id: 'DD-12',
    collection: 'apiProviders/prov_1',
    operation: 'get',
    actor: 'unverifiedAdminEmail',
    expected: 'PERMISSION_DENIED',
    reason: 'Unverified admin email spoofing blocked by request.auth.token.email_verified == true.',
  },
];
