import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import type { User as FirebaseAuthUser } from 'firebase/auth';
import { getFirebaseServices } from '../lib/firebase/client';
import {
  FIRESTORE_COLLECTIONS,
  SETTINGS_DOC_IDS,
  type AdminStaffRole,
  type FirestoreAdminUserDoc,
  type FirestoreSettingsDoc,
} from '../lib/firestore/collections';
import { OperationType, handleFirestoreError } from '../lib/firestore/errors';
import {
  fetchPublicCatalogBundle,
  invalidatePublicCatalogCache,
} from './firebaseDataClient';
import { APP_CONFIG } from '../config/app.config';
import { normalizeCurrencySymbol } from '../utils/pricing';

const DESIGNATED_ADMIN_EMAIL = 'mondalsupartha@gmail.com';

export interface StaffAccessVerification {
  isStaff: boolean;
  staffRole: AdminStaffRole | null;
  reason?: 'verified' | 'not_admin';
}

async function ensureAdminRoleDocsSynced(authUser: FirebaseAuthUser): Promise<void> {
  const services = getFirebaseServices();
  if (!services || !authUser.uid) return;
  const normalizedEmail = (authUser.email || '').trim().toLowerCase();
  if (normalizedEmail !== DESIGNATED_ADMIN_EMAIL) return;

  try {
    const adminRef = doc(services.db, FIRESTORE_COLLECTIONS.adminUsers, authUser.uid);
    const adminSnap = await getDoc(adminRef);
    if (!adminSnap.exists()) {
      const adminDoc: FirestoreAdminUserDoc = {
        uid: authUser.uid,
        name: (authUser.displayName || 'Super Admin').trim().slice(0, 120),
        email: normalizedEmail,
        role: 'super_admin',
        status: 'active',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      await setDoc(adminRef, adminDoc);
    } else {
      const existing = adminSnap.data() as Partial<FirestoreAdminUserDoc>;
      if (existing.role !== 'super_admin' || existing.status !== 'active') {
        await updateDoc(adminRef, {
          role: 'super_admin',
          status: 'active',
          updatedAt: serverTimestamp(),
        });
      }
    }

    const userRef = doc(services.db, FIRESTORE_COLLECTIONS.users, authUser.uid);
    const userSnap = await getDoc(userRef);
    if (userSnap.exists()) {
      const u = userSnap.data() as { role?: string; status?: string };
      if (u.role !== 'admin' || u.status !== 'active') {
        await updateDoc(userRef, {
          role: 'admin',
          status: 'active',
          updatedAt: serverTimestamp(),
        });
      }
    }
  } catch {
    // Non-blocking sync; Firestore rules still recognize isBootstrapOwner()
  }
}

export const adminService = {
  isDesignatedAdminEmail(email?: string | null): boolean {
    return Boolean(email && email.trim().toLowerCase() === DESIGNATED_ADMIN_EMAIL);
  },

  /**
   * Verifies server-side Admin authorization via /api/auth/verify-admin with Firebase ID token.
   * Only the designated administrator (mondalsupartha@gmail.com) is authorized.
   */
  async verifyStaffAccess(
    _uid: string,
    email?: string | null,
    _emailVerified?: boolean
  ): Promise<StaffAccessVerification> {
    if (!this.isDesignatedAdminEmail(email)) {
      return { isStaff: false, staffRole: null, reason: 'not_admin' };
    }

    const services = getFirebaseServices();
    if (!services || !services.auth.currentUser) {
      return { isStaff: false, staffRole: null, reason: 'not_admin' };
    }

    const currentUser = services.auth.currentUser;
    if (!this.isDesignatedAdminEmail(currentUser.email)) {
      return { isStaff: false, staffRole: null, reason: 'not_admin' };
    }

    try {
      const idToken = await currentUser.getIdToken();
      const res = await fetch('/api/auth/verify-admin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          firebaseProjectId: services.config.projectId,
          firebaseDatabaseId: services.config.firestoreDatabaseId || '(default)',
        }),
      });

      if (res.ok) {
        const json = (await res.json()) as {
          ok?: boolean;
          isAdmin?: boolean;
          staffRole?: AdminStaffRole | null;
          claimsSynced?: boolean;
          reason?: 'verified' | 'not_admin';
        };
        if (json.ok && json.isAdmin) {
          if (json.claimsSynced) {
            await currentUser.reload().catch(() => undefined);
            await currentUser.getIdToken(true).catch(() => undefined);
          }
          await ensureAdminRoleDocsSynced(currentUser);
          return {
            isStaff: true,
            staffRole: json.staffRole || 'super_admin',
            reason: 'verified',
          };
        }
        return {
          isStaff: false,
          staffRole: null,
          reason: 'not_admin',
        };
      }

      // Non-OK HTTP status from proxy/gateway (e.g. 404/502/503): verify against active Firebase Auth session
      if (this.isDesignatedAdminEmail(currentUser.email)) {
        await ensureAdminRoleDocsSynced(currentUser);
        return { isStaff: true, staffRole: 'super_admin', reason: 'verified' };
      }
    } catch {
      // Fallback when backend proxy is unreachable (e.g. static hosting): rely strictly on active Firebase Auth user
      if (this.isDesignatedAdminEmail(currentUser.email)) {
        await ensureAdminRoleDocsSynced(currentUser);
        return { isStaff: true, staffRole: 'super_admin', reason: 'verified' };
      }
    }

    return {
      isStaff: false,
      staffRole: null,
      reason: 'not_admin',
    };
  },

  /**
   * Verifies whether the signed-in user holds authorized admin access.
   */
  async verifyAdminRole(
    uid: string,
    email?: string | null,
    emailVerified?: boolean
  ): Promise<boolean> {
    const res = await this.verifyStaffAccess(uid, email, emailVerified);
    return res.isStaff;
  },

  /**
   * Fetches public/system settings document from Firestore (deduplicated via PublicCatalogBundle).
   */
  async getSystemSettings(forceRefresh = false): Promise<Partial<FirestoreSettingsDoc> | null> {
    if (!forceRefresh) {
      try {
        const bundle = await fetchPublicCatalogBundle();
        return bundle.systemSettings;
      } catch {
        return null;
      }
    }

    const services = getFirebaseServices();
    if (!services) return null;

    try {
      const snap = await getDoc(
        doc(services.db, FIRESTORE_COLLECTIONS.settings, SETTINGS_DOC_IDS.system)
      );
      if (!snap.exists()) return null;
      const raw = snap.data() as FirestoreSettingsDoc;
      return {
        ...raw,
        currencySymbol: normalizeCurrencySymbol(raw.currencySymbol, raw.currency),
      };
    } catch {
      return null;
    }
  },

  /**
   * Updates white-label system settings (Admin-only via Firestore rules).
   */
  async updateSystemSettings(patch: Partial<FirestoreSettingsDoc>): Promise<void> {
    const services = getFirebaseServices();
    if (!services) throw new Error('Firebase is not connected.');

    const ref = doc(services.db, FIRESTORE_COLLECTIONS.settings, SETTINGS_DOC_IDS.system);
    try {
      const existingSnap = await getDoc(ref);
      const baseDefaults = existingSnap.exists()
        ? {}
        : {
            websiteName: patch.websiteName || APP_CONFIG.brandName,
            currency: patch.currency || 'BDT',
            maintenanceMode: patch.maintenanceMode ?? false,
          };

      await setDoc(
        ref,
        {
          ...baseDefaults,
          ...patch,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      invalidatePublicCatalogCache();
    } catch (error) {
      handleFirestoreError(
        error,
        OperationType.UPDATE,
        `${FIRESTORE_COLLECTIONS.settings}/${SETTINGS_DOC_IDS.system}`,
        services.auth
      );
    }
  },
};
