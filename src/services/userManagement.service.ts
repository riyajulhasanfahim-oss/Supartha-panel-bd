import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  type Timestamp,
} from 'firebase/firestore';
import { getFirebaseServices } from '../lib/firebase/client';
import {
  FIRESTORE_COLLECTIONS,
  type FirestoreAuditLogDoc,
  type FirestoreTransactionDoc,
  type FirestoreUserDoc,
  type UserAccountRole,
  type UserAccountStatus,
} from '../lib/firestore/collections';
import { OperationType, handleFirestoreError } from '../lib/firestore/errors';
import { APP_CONFIG } from '../config/app.config';
import { normalizeCurrencySymbol } from '../utils/pricing';

async function getCurrencySymbol(): Promise<string> {
  const services = getFirebaseServices();
  if (!services) return APP_CONFIG.currencySymbol;
  try {
    const snap = await getDoc(doc(services.db, FIRESTORE_COLLECTIONS.settings, 'system'));
    if (snap.exists()) {
      const data = snap.data() as { currencySymbol?: string; currency?: string };
      return normalizeCurrencySymbol(data.currencySymbol, data.currency);
    }
  } catch {
    // fallback
  }
  return APP_CONFIG.currencySymbol;
}

export interface ManagedUserRecord {
  uid: string;
  name: string;
  email: string;
  phone: string;
  balance: number;
  status: UserAccountStatus;
  role: UserAccountRole;
  createdAtLabel: string;
  createdAtMs: number;
}

export interface AdjustBalanceInput {
  uid: string;
  amount: number;
  mode: 'add' | 'deduct';
  reason: string;
  adminId: string;
}

export interface BalanceAdjustmentResult {
  balanceBefore: number;
  balanceAfter: number;
  transactionId: string;
}

function formatCreatedDate(ts: unknown): { label: string; ms: number } {
  try {
    if (ts && typeof ts === 'object' && 'toDate' in ts) {
      const date = (ts as Timestamp).toDate();
      return {
        label: date.toLocaleDateString('en-US', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        }),
        ms: date.getTime(),
      };
    }
  } catch {
    // Fallback
  }
  return { label: '—', ms: 0 };
}

export const userManagementService = {
  /**
   * Lists all customer/admin records for authorized Admins (enforced by firestore.rules).
   */
  async listAllUsers(): Promise<ManagedUserRecord[]> {
    const services = getFirebaseServices();
    if (!services) return [];

    try {
      const q = query(
        collection(services.db, FIRESTORE_COLLECTIONS.users),
        orderBy('createdAt', 'desc')
      );
      const snap = await getDocs(q);
      return snap.docs.map((d) => {
        const data = d.data() as FirestoreUserDoc;
        const created = formatCreatedDate(data.createdAt);
        return {
          uid: data.uid,
          name: data.name,
          email: data.email,
          phone: data.phone ?? '—',
          balance: Number(data.balance ?? 0),
          status: data.status,
          role: data.role,
          createdAtLabel: created.label,
          createdAtMs: created.ms,
        };
      });
    } catch (error) {
      handleFirestoreError(
        error,
        OperationType.LIST,
        FIRESTORE_COLLECTIONS.users,
        services.auth
      );
    }
  },

  /**
   * Admin-only: Updates a target user's status (active / suspended / blocked).
   */
  async updateUserStatus(uid: string, status: UserAccountStatus): Promise<void> {
    const services = getFirebaseServices();
    if (!services) throw new Error('Firebase is not connected.');

    const ref = doc(services.db, FIRESTORE_COLLECTIONS.users, uid);
    try {
      await updateDoc(ref, {
        status,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(
        error,
        OperationType.UPDATE,
        `${FIRESTORE_COLLECTIONS.users}/${uid}`,
        services.auth
      );
    }
  },

  /**
   * Admin-only: Updates a target user's RBAC role ('user' | 'admin') and syncs adminUsers registry.
   */
  async updateUserRole(uid: string, role: UserAccountRole, email?: string): Promise<void> {
    const services = getFirebaseServices();
    if (!services) throw new Error('Firebase is not connected.');

    const userRef = doc(services.db, FIRESTORE_COLLECTIONS.users, uid);
    const adminRef = doc(services.db, FIRESTORE_COLLECTIONS.adminUsers, uid);

    try {
      await updateDoc(userRef, {
        role,
        updatedAt: serverTimestamp(),
      });

      if (role === 'admin') {
        const existingAdmin = await getDoc(adminRef);
        const existingCreatedAt = existingAdmin.exists()
          ? (existingAdmin.data() as { createdAt?: unknown }).createdAt
          : undefined;

        await setDoc(adminRef, {
          uid,
          email: email || 'admin@suparthapanel.com',
          role: 'admin',
          status: 'active',
          createdAt: existingCreatedAt ?? serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } else {
        const existingAdmin = await getDoc(adminRef);
        if (existingAdmin.exists()) {
          await deleteDoc(adminRef);
        }
      }
    } catch (error) {
      handleFirestoreError(
        error,
        OperationType.UPDATE,
        `${FIRESTORE_COLLECTIONS.users}/${uid}`,
        services.auth
      );
    }
  },

  /**
   * Admin-only: Atomically adjusts a user's wallet balance, writes an audit transaction log,
   * writes an immutable admin auditLog entry, and sends a real-time customer notification.
   */
  async adjustUserBalance(input: AdjustBalanceInput): Promise<BalanceAdjustmentResult> {
    const services = getFirebaseServices();
    if (!services) throw new Error('Firebase is not connected.');

    const absAmount = Number(input.amount);
    if (!Number.isFinite(absAmount) || absAmount <= 0) {
      throw new Error('Adjustment amount must be greater than zero.');
    }

    const cleanReason = input.reason.trim();
    if (!cleanReason) {
      throw new Error('Audit reason is required for balance adjustment.');
    }

    const actingAdminUid = services.auth.currentUser?.uid || input.adminId;
    const isCredit = input.mode === 'add';
    const signedDelta = Number((isCredit ? absAmount : -absAmount).toFixed(2));
    const userRef = doc(services.db, FIRESTORE_COLLECTIONS.users, input.uid);
    const tsSuffix = `${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const txnId = `txn-${tsSuffix}`;
    const txnRef = doc(services.db, FIRESTORE_COLLECTIONS.transactions, txnId);
    const notifId = `ntf-bal-${tsSuffix}`;
    const notifRef = doc(services.db, FIRESTORE_COLLECTIONS.notifications, notifId);
    const auditId = `aud-bal-${tsSuffix}`;
    const auditRef = doc(services.db, FIRESTORE_COLLECTIONS.auditLogs, auditId);
    const refCode = `ADJ-${Date.now().toString().slice(-6)}`;
    const currencySymbol = await getCurrencySymbol();

    try {
      return await runTransaction(services.db, async (tx) => {
        const userSnap = await tx.get(userRef);
        if (!userSnap.exists()) {
          throw new Error('User record not found.');
        }

        const userData = userSnap.data() as FirestoreUserDoc;
        const balanceBefore = Number(userData.balance ?? 0);
        const balanceAfter = Number((balanceBefore + signedDelta).toFixed(2));

        if (balanceAfter < 0) {
          throw new Error('Insufficient user balance for deduction.');
        }

        tx.update(userRef, {
          balance: balanceAfter,
          lastTxnId: txnId,
          updatedAt: serverTimestamp(),
        });

        const txnPayload: FirestoreTransactionDoc = {
          id: txnId,
          transactionId: txnId,
          userId: input.uid,
          type: isCredit ? 'admin_credit' : 'admin_debit',
          amount: signedDelta,
          balanceBefore,
          balanceAfter,
          reference: refCode,
          referenceId: refCode,
          description: cleanReason,
          reason: cleanReason,
          createdBy: actingAdminUid,
          adminId: actingAdminUid,
          createdAt: serverTimestamp(),
        };

        tx.set(txnRef, txnPayload);

        tx.set(notifRef, {
          id: notifId,
          notificationId: notifId,
          userId: input.uid,
          targetType: 'user',
          title: isCredit ? 'Balance Added by Admin' : 'Balance Deducted by Admin',
          message: isCredit
            ? `অ্যাডমিন আপনার অ্যাকাউন্টে ${currencySymbol}${absAmount.toFixed(2)} যোগ করেছেন (${cleanReason})।`
            : `অ্যাডমিন আপনার অ্যাকাউন্ট থেকে ${currencySymbol}${absAmount.toFixed(2)} কর্তন করেছেন (${cleanReason})।`,
          type: 'wallet',
          referenceId: txnId,
          read: false,
          isRead: false,
          createdAt: serverTimestamp(),
        });

        const auditPayload: FirestoreAuditLogDoc = {
          id: auditId,
          action: 'balance_adjustment',
          adminId: actingAdminUid,
          targetId: input.uid,
          targetType: 'user',
          previousValue: `${currencySymbol}${balanceBefore.toFixed(2)}`,
          newValue: `${currencySymbol}${balanceAfter.toFixed(2)} (${isCredit ? '+' : '-'}${absAmount.toFixed(2)})`,
          note: cleanReason.slice(0, 300),
          timestamp: serverTimestamp(),
        };
        tx.set(auditRef, auditPayload);

        return {
          balanceBefore,
          balanceAfter,
          transactionId: txnId,
        };
      });
    } catch (error) {
      if (
        error instanceof Error &&
        (error.message.includes('Insufficient') || error.message.includes('not found'))
      ) {
        throw error;
      }
      handleFirestoreError(
        error,
        OperationType.WRITE,
        `${FIRESTORE_COLLECTIONS.users}/${input.uid}`,
        services.auth
      );
    }
  },
};
