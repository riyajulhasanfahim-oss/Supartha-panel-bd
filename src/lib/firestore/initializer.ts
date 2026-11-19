import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocFromServer,
  getDocs,
  limit,
  query,
  setDoc,
  updateDoc,
  where,
  serverTimestamp,
} from 'firebase/firestore';
import { APP_CONFIG } from '../../config/app.config';
import { generateInstallationId, PRODUCT_INFO } from '../../config/product.config';
import { MOCK_PLATFORMS, MOCK_SERVICES } from '../../data/mockServices';
import { getFirebaseServices, testFirestoreConnection } from '../firebase/client';
import {
  FIRESTORE_COLLECTIONS,
  SETTINGS_DOC_IDS,
  type FirestoreAdminUserDoc,
  type FirestoreCategoryDoc,
  type FirestorePaymentMethodDoc,
  type FirestoreServiceDoc,
  type FirestoreSettingsDoc,
  type FirestoreUserDoc,
} from './collections';
import { OperationType, handleFirestoreError, toUserFriendlyFirebaseError } from './errors';

export const DEFAULT_PAYMENT_METHODS_SEED: Array<
  Omit<FirestorePaymentMethodDoc, 'createdAt' | 'updatedAt'>
> = [
  {
    id: 'bkash',
    name: 'bKash Personal',
    type: 'Mobile Banking',
    accountNumber: '01700-000001',
    note: 'Send Money (Personal)',
    instructions:
      '1. Open the bKash App and select Send Money.\n2. Enter account number 01700-000001 and your exact deposit amount.\n3. Confirm the transfer and copy the 10-character Transaction ID (TrxID).\n4. Submit the deposit amount and TrxID below for admin verification.',
    minAmount: 50,
    maxAmount: 50000,
    status: 'active',
    displayOrder: 1,
  },
  {
    id: 'nagad',
    name: 'Nagad Merchant',
    type: 'Mobile Banking',
    accountNumber: '01800-000002',
    note: 'Zero gateway fee',
    instructions:
      '1. Open the Nagad App and select Merchant Payment or Send Money.\n2. Transfer your deposit amount to 01800-000002.\n3. Copy your Nagad Transaction ID (TrxID).\n4. Submit the request below and await verification.',
    minAmount: 50,
    maxAmount: 50000,
    status: 'active',
    displayOrder: 2,
  },
  {
    id: 'rocket',
    name: 'Rocket Mobile Banking',
    type: 'Mobile Banking',
    accountNumber: '01900-000003',
    note: 'DBBL Rocket Transfer',
    instructions:
      '1. Dial *322# or open the Rocket App.\n2. Send Money to 01900-000003 for your chosen deposit amount.\n3. Copy the Rocket TrxID and submit your payment request below.',
    minAmount: 100,
    maxAmount: 50000,
    status: 'active',
    displayOrder: 3,
  },
];

export interface SetupState {
  setupRequired: boolean;
  firebaseConnected: boolean;
  databaseInitialized: boolean;
  adminConfigured: boolean;
  brandingConfigured: boolean;
  providerConfigured: boolean;
  paymentConfigured: boolean;
  setupCompleted: boolean;
  productionMode: boolean;
  demoDataEnabled: boolean;
  installationId: string;
  lastError: string | null;
}

export interface DatabaseInitReport {
  success: boolean;
  verifiedConnection: boolean;
  createdDocsCount: number;
  skippedExistingCount: number;
  collectionsReady: string[];
  setupState: SetupState;
  message: string;
}

const SCHEMA_VERSION = PRODUCT_INFO.schemaVersion;

function buildEmptySetupState(lastError: string | null = null): SetupState {
  return {
    setupRequired: true,
    firebaseConnected: false,
    databaseInitialized: false,
    adminConfigured: false,
    brandingConfigured: false,
    providerConfigured: false,
    paymentConfigured: false,
    setupCompleted: false,
    productionMode: false,
    demoDataEnabled: true,
    installationId: '',
    lastError,
  };
}

/**
 * Inspects current Firebase + Firestore initialization state without mutating data.
 */
export async function inspectSetupState(): Promise<SetupState> {
  const services = getFirebaseServices();
  if (!services) {
    return buildEmptySetupState(null);
  }

  const conn = await testFirestoreConnection();
  if (!conn.connected) {
    return buildEmptySetupState(conn.errorMessage);
  }

  const { db, auth } = services;
  let databaseInitialized = false;
  let adminConfigured = false;
  let brandingConfigured = false;
  let providerConfigured = false;
  let paymentConfigured = false;
  let setupCompleted = false;
  let productionMode = false;
  let demoDataEnabled = true;
  let installationId = '';

  try {
    const sysSnap = await getDocFromServer(
      doc(db, FIRESTORE_COLLECTIONS.settings, SETTINGS_DOC_IDS.system)
    );
    if (sysSnap.exists()) {
      const data = sysSnap.data() as Partial<FirestoreSettingsDoc>;
      databaseInitialized = Boolean(data.databaseInitialized);
      brandingConfigured = Boolean(data.brandingConfigured || data.websiteName);
      providerConfigured = Boolean(data.providerConfigured);
      paymentConfigured = Boolean(data.paymentConfigured);
      // Backward compatibility for existing Steps 2-9 installations
      setupCompleted =
        data.setupCompleted !== undefined ? Boolean(data.setupCompleted) : databaseInitialized;
      productionMode = Boolean(data.productionMode);
      demoDataEnabled = data.demoDataEnabled !== undefined ? Boolean(data.demoDataEnabled) : true;
      installationId = data.installationId ?? '';
    }
  } catch {
    // System settings doc may not exist yet on a fresh Firebase project
  }

  try {
    const pmSnap = await getDocs(
      query(collection(db, FIRESTORE_COLLECTIONS.paymentMethods), limit(1))
    );
    if (!pmSnap.empty) {
      paymentConfigured = true;
    }
  } catch {
    // ignore permission check for unauthenticated checks
  }

  if (auth.currentUser) {
    try {
      const adminSnap = await getDoc(
        doc(db, FIRESTORE_COLLECTIONS.adminUsers, auth.currentUser.uid)
      );
      if (auth.currentUser.email?.trim().toLowerCase() === 'mondalsupartha@gmail.com') {
        adminConfigured = true;
      } else if (adminSnap.exists()) {
        const admData = adminSnap.data() as { status?: string; email?: string };
        adminConfigured =
          admData.status === 'active' &&
          auth.currentUser.email?.trim().toLowerCase() === 'mondalsupartha@gmail.com';
      }
    } catch {
      adminConfigured = false;
    }

    if (adminConfigured && !providerConfigured) {
      try {
        const provSnap = await getDocs(
          query(collection(db, FIRESTORE_COLLECTIONS.apiProviders), limit(1))
        );
        if (!provSnap.empty) {
          providerConfigured = true;
        }
      } catch {
        // non-staff cannot list apiProviders
      }
    }
  }

  return {
    setupRequired: !databaseInitialized,
    firebaseConnected: true,
    databaseInitialized,
    adminConfigured,
    brandingConfigured,
    providerConfigured,
    paymentConfigured,
    setupCompleted,
    productionMode,
    demoDataEnabled,
    installationId,
    lastError: null,
  };
}

/**
 * Idempotent Database Initialization Engine.
 * Safely verifies connection, ensures admin & user registry docs exist,
 * seeds default system settings, categories, and starter services ONLY if missing,
 * and never overwrites existing customer or admin data.
 */
export async function initializeDatabase(options?: {
  seedDemo?: boolean;
}): Promise<DatabaseInitReport> {
  const seedDemo = options?.seedDemo ?? true;
  const services = getFirebaseServices();
  if (!services) {
    const setupState = buildEmptySetupState('Firebase configuration is missing.');
    return {
      success: false,
      verifiedConnection: false,
      createdDocsCount: 0,
      skippedExistingCount: 0,
      collectionsReady: [],
      setupState,
      message: 'Please configure your Firebase project credentials first.',
    };
  }

  const conn = await testFirestoreConnection();
  if (!conn.connected) {
    const setupState = buildEmptySetupState(conn.errorMessage);
    return {
      success: false,
      verifiedConnection: false,
      createdDocsCount: 0,
      skippedExistingCount: 0,
      collectionsReady: [],
      setupState,
      message: conn.errorMessage ?? 'Could not verify Firestore connection.',
    };
  }

  const { db, auth } = services;
  const currentUser = auth.currentUser;
  if (!currentUser) {
    return {
      success: false,
      verifiedConnection: true,
      createdDocsCount: 0,
      skippedExistingCount: 0,
      collectionsReady: [],
      setupState: {
        ...buildEmptySetupState(
          'Sign in with an authorized Admin account before running database initialization.'
        ),
        firebaseConnected: true,
      },
      message: 'Please sign in as an Admin before initializing Firestore collections.',
    };
  }

  let createdDocsCount = 0;
  let skippedExistingCount = 0;
  const collectionsReady: string[] = [];
  let resolvedInstallationId = generateInstallationId();

  try {
    // 1. Ensure AdminUser record exists (bootstrap first installer as super_admin)
    const adminRef = doc(db, FIRESTORE_COLLECTIONS.adminUsers, currentUser.uid);
    const adminSnap = await getDoc(adminRef);
    if (!adminSnap.exists()) {
      const adminDoc: FirestoreAdminUserDoc = {
        uid: currentUser.uid,
        name: currentUser.displayName ?? 'Super Admin',
        email: currentUser.email ?? 'mondalsupartha@gmail.com',
        role: 'super_admin',
        status: 'active',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      try {
        await setDoc(adminRef, adminDoc);
        createdDocsCount += 1;
      } catch (error) {
        handleFirestoreError(
          error,
          OperationType.CREATE,
          `${FIRESTORE_COLLECTIONS.adminUsers}/${currentUser.uid}`,
          auth
        );
      }
    } else {
      skippedExistingCount += 1;
    }
    collectionsReady.push(FIRESTORE_COLLECTIONS.adminUsers);

    // 2. Ensure Admin's User profile exists (never overwrite existing balance/profile)
    const userRef = doc(db, FIRESTORE_COLLECTIONS.users, currentUser.uid);
    const userSnap = await getDoc(userRef);
    if (!userSnap.exists()) {
      const userDoc: FirestoreUserDoc = {
        uid: currentUser.uid,
        name: currentUser.displayName ?? 'Panel Administrator',
        email: currentUser.email ?? 'mondalsupartha@gmail.com',
        role: 'admin',
        balance: 0,
        status: 'active',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      try {
        await setDoc(userRef, userDoc);
        createdDocsCount += 1;
      } catch (error) {
        handleFirestoreError(
          error,
          OperationType.CREATE,
          `${FIRESTORE_COLLECTIONS.users}/${currentUser.uid}`,
          auth
        );
      }
    } else {
      skippedExistingCount += 1;
    }
    collectionsReady.push(FIRESTORE_COLLECTIONS.users);

    // 3. Seed default system settings if missing (or backfill installationId/version)
    const sysRef = doc(db, FIRESTORE_COLLECTIONS.settings, SETTINGS_DOC_IDS.system);
    const sysSnap = await getDoc(sysRef);
    if (!sysSnap.exists()) {
      const systemSettings: FirestoreSettingsDoc = {
        websiteName: APP_CONFIG.brandName,
        brandTagline: APP_CONFIG.brandTagline,
        websiteDescription:
          'Mobile-first Social Media Marketing Panel for creators, agencies, and resellers.',
        logo: APP_CONFIG.brandLogoUrl,
        favicon: APP_CONFIG.brandLogoUrl,
        theme: 'violet-light',
        themeColor: '#6D28D9',
        secondaryColor: '#4F46E5',
        currency: APP_CONFIG.currencyCode,
        currencySymbol: APP_CONFIG.currencySymbol,
        defaultProfitMargin: 30,
        autoSyncEnabled: true,
        supportEmail: APP_CONFIG.supportEmail,
        supportHours: APP_CONFIG.supportHours,
        footerText: `All rights reserved.`,
        heroTitle: 'Grow Your Social Media',
        heroSubtitle: 'Faster • Cheaper • More Reliable',
        heroCtaLabel: 'Browse Services',
        maintenanceMode: false,
        databaseInitialized: true,
        brandingConfigured: true,
        paymentConfigured: seedDemo,
        setupCompleted: false,
        productionMode: false,
        demoDataEnabled: seedDemo,
        installationId: resolvedInstallationId,
        appVersion: PRODUCT_INFO.version,
        schemaVersion: SCHEMA_VERSION,
        defaultSettings: {
          minDeposit: 50,
          defaultOrderStatus: 'Pending',
          refillDays: 30,
        },
        initializedAt: serverTimestamp(),
        initializedBy: currentUser.uid,
        updatedAt: serverTimestamp(),
      };
      try {
        await setDoc(sysRef, systemSettings);
        createdDocsCount += 1;
      } catch (error) {
        handleFirestoreError(
          error,
          OperationType.CREATE,
          `${FIRESTORE_COLLECTIONS.settings}/${SETTINGS_DOC_IDS.system}`,
          auth
        );
      }
    } else {
      const existingData = sysSnap.data() as Partial<FirestoreSettingsDoc>;
      const sysPatch: Record<string, unknown> = {};
      if (existingData.installationId) {
        resolvedInstallationId = existingData.installationId;
      } else {
        sysPatch.installationId = resolvedInstallationId;
        sysPatch.appVersion = PRODUCT_INFO.version;
      }
      const normalizedLegacyName = existingData.websiteName?.trim().toLowerCase() ?? '';
      if (
        normalizedLegacyName === 'rj world bd' ||
        normalizedLegacyName === 'dukhu vibes panel' ||
        normalizedLegacyName === 'dukhu vibes'
      ) {
        sysPatch.websiteName = APP_CONFIG.brandName;
        sysPatch.brandTagline = APP_CONFIG.brandTagline;
        if (
          existingData.supportEmail === 'support@rjworldbd.com' ||
          existingData.supportEmail === 'support@dukhuvibespanel.com'
        ) {
          sysPatch.supportEmail = APP_CONFIG.supportEmail;
        }
      }
      if (!existingData.logo?.trim()) {
        sysPatch.logo = APP_CONFIG.brandLogoUrl;
      }
      if (!existingData.favicon?.trim()) {
        sysPatch.favicon = APP_CONFIG.brandLogoUrl;
      }
      if (!existingData.databaseInitialized) {
        sysPatch.databaseInitialized = true;
      }
      if (Object.keys(sysPatch).length > 0) {
        sysPatch.updatedAt = serverTimestamp();
        await updateDoc(sysRef, sysPatch).catch(() => undefined);
      }
      skippedExistingCount += 1;
    }

    // 4. Seed setup tracker document if missing
    const setupRef = doc(db, FIRESTORE_COLLECTIONS.settings, SETTINGS_DOC_IDS.setup);
    const setupSnap = await getDoc(setupRef);
    if (!setupSnap.exists()) {
      const setupDoc: FirestoreSettingsDoc = {
        websiteName: APP_CONFIG.brandName,
        currency: APP_CONFIG.currencyCode,
        maintenanceMode: false,
        databaseInitialized: true,
        installationId: resolvedInstallationId,
        appVersion: PRODUCT_INFO.version,
        schemaVersion: SCHEMA_VERSION,
        initializedAt: serverTimestamp(),
        initializedBy: currentUser.uid,
        updatedAt: serverTimestamp(),
      };
      try {
        await setDoc(setupRef, setupDoc);
        createdDocsCount += 1;
      } catch (error) {
        handleFirestoreError(
          error,
          OperationType.CREATE,
          `${FIRESTORE_COLLECTIONS.settings}/${SETTINGS_DOC_IDS.setup}`,
          auth
        );
      }
    } else {
      const setupData = setupSnap.data() as Partial<FirestoreSettingsDoc>;
      const setupName = setupData.websiteName?.trim().toLowerCase() ?? '';
      if (
        setupName === 'rj world bd' ||
        setupName === 'dukhu vibes panel' ||
        setupName === 'dukhu vibes'
      ) {
        await updateDoc(setupRef, {
          websiteName: APP_CONFIG.brandName,
          updatedAt: serverTimestamp(),
        }).catch(() => undefined);
      }
      skippedExistingCount += 1;
    }
    collectionsReady.push(FIRESTORE_COLLECTIONS.settings);

    // 5. Seed default categories idempotently (no duplicates)
    for (let i = 0; i < MOCK_PLATFORMS.length; i += 1) {
      const plat = MOCK_PLATFORMS[i];
      const catRef = doc(db, FIRESTORE_COLLECTIONS.categories, plat.id);
      const catSnap = await getDoc(catRef);
      if (!catSnap.exists()) {
        const isBuiltInNonDemo = plat.id === 'linkedin' || plat.id === 'webtraffic';
        const catDoc: FirestoreCategoryDoc = {
          id: plat.id,
          name: plat.name,
          icon: plat.id,
          description: plat.description,
          status: 'active',
          sortOrder: i + 1,
          ...(isBuiltInNonDemo ? {} : { isDemo: true }),
        };
        try {
          await setDoc(catRef, catDoc);
          createdDocsCount += 1;
        } catch (error) {
          handleFirestoreError(
            error,
            OperationType.CREATE,
            `${FIRESTORE_COLLECTIONS.categories}/${plat.id}`,
            auth
          );
        }
      } else {
        skippedExistingCount += 1;
      }
    }
    collectionsReady.push(FIRESTORE_COLLECTIONS.categories);

    // 6. Seed starter demo services idempotently if seedDemo is enabled
    if (seedDemo) {
      for (const srv of MOCK_SERVICES) {
        const srvRef = doc(db, FIRESTORE_COLLECTIONS.services, srv.id);
        const srvSnap = await getDoc(srvRef);
        if (!srvSnap.exists()) {
          const srvDoc: FirestoreServiceDoc = {
            id: srv.id,
            categoryId: srv.categoryId,
            name: srv.name,
            serviceType: srv.serviceType ?? 'Other',
            description: srv.description,
            providerId: '',
            providerServiceId: '',
            costPrice: Number((srv.ratePerThousand * 0.72).toFixed(2)),
            sellingPrice: srv.ratePerThousand,
            minQuantity: srv.minQuantity,
            maxQuantity: srv.maxQuantity,
            averageTime: srv.averageTime,
            deliverySpeed: srv.deliverySpeed,
            refillGuaranteed: srv.refillGuaranteed,
            status: 'active',
            isDemo: true,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          };
          try {
            await setDoc(srvRef, srvDoc);
            createdDocsCount += 1;
          } catch (error) {
            handleFirestoreError(
              error,
              OperationType.CREATE,
              `${FIRESTORE_COLLECTIONS.services}/${srv.id}`,
              auth
            );
          }
        } else {
          skippedExistingCount += 1;
        }
      }
    }
    collectionsReady.push(FIRESTORE_COLLECTIONS.services);

    // 7. Seed default payment methods idempotently only when seedDemo is enabled
    if (seedDemo) {
      for (const pm of DEFAULT_PAYMENT_METHODS_SEED) {
        const pmRef = doc(db, FIRESTORE_COLLECTIONS.paymentMethods, pm.id);
        const pmSnap = await getDoc(pmRef);
        if (!pmSnap.exists()) {
          const pmDoc: FirestorePaymentMethodDoc = {
            ...pm,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          };
          try {
            await setDoc(pmRef, pmDoc);
            createdDocsCount += 1;
          } catch (error) {
            handleFirestoreError(
              error,
              OperationType.CREATE,
              `${FIRESTORE_COLLECTIONS.paymentMethods}/${pm.id}`,
              auth
            );
          }
        } else {
          skippedExistingCount += 1;
        }
      }
    }
    collectionsReady.push(FIRESTORE_COLLECTIONS.paymentMethods);

    collectionsReady.push(
      FIRESTORE_COLLECTIONS.orders,
      FIRESTORE_COLLECTIONS.payments,
      FIRESTORE_COLLECTIONS.transactions,
      FIRESTORE_COLLECTIONS.apiProviders,
      FIRESTORE_COLLECTIONS.supportTickets,
      FIRESTORE_COLLECTIONS.notifications,
      FIRESTORE_COLLECTIONS.adminNotifications,
      FIRESTORE_COLLECTIONS.auditLogs
    );

    const latestState = await inspectSetupState();

    return {
      success: true,
      verifiedConnection: true,
      createdDocsCount,
      skippedExistingCount,
      collectionsReady,
      setupState: {
        ...latestState,
        setupRequired: false,
        firebaseConnected: true,
        databaseInitialized: true,
        adminConfigured: true,
        installationId: latestState.installationId || resolvedInstallationId,
      },
      message:
        createdDocsCount > 0
          ? `Database initialized: ${createdDocsCount} default documents created, ${skippedExistingCount} existing preserved.`
          : `Database already initialized (${skippedExistingCount} existing documents verified, zero duplicates created).`,
    };
  } catch (error) {
    const friendly = toUserFriendlyFirebaseError(error);
    return {
      success: false,
      verifiedConnection: true,
      createdDocsCount,
      skippedExistingCount,
      collectionsReady,
      setupState: {
        ...buildEmptySetupState(friendly),
        firebaseConnected: true,
      },
      message: friendly,
    };
  }
}

/**
 * Non-destructive Database Repair Utility.
 * Verifies required configuration docs, default categories (if collection empty),
 * and payment methods (if collection empty) without modifying existing users, orders, or payments.
 */
export async function repairDatabase(): Promise<{
  repairedItems: string[];
  verifiedIntactCount: number;
  message: string;
}> {
  const services = getFirebaseServices();
  if (!services || !services.auth.currentUser) {
    throw new Error('Admin authentication is required to repair the database.');
  }

  const { db, auth } = services;
  const uid = auth.currentUser!.uid;
  const repairedItems: string[] = [];
  let verifiedIntactCount = 0;

  // 1. Repair settings/system if missing or lacking installationId/version
  const sysRef = doc(db, FIRESTORE_COLLECTIONS.settings, SETTINGS_DOC_IDS.system);
  const sysSnap = await getDoc(sysRef);
  let installId = generateInstallationId();

  if (!sysSnap.exists()) {
    await setDoc(sysRef, {
      websiteName: APP_CONFIG.brandName,
      brandTagline: APP_CONFIG.brandTagline,
      logo: APP_CONFIG.brandLogoUrl,
      favicon: APP_CONFIG.brandLogoUrl,
      currency: APP_CONFIG.currencyCode,
      currencySymbol: APP_CONFIG.currencySymbol,
      supportEmail: APP_CONFIG.supportEmail,
      supportHours: APP_CONFIG.supportHours,
      maintenanceMode: false,
      databaseInitialized: true,
      brandingConfigured: true,
      installationId: installId,
      appVersion: PRODUCT_INFO.version,
      schemaVersion: SCHEMA_VERSION,
      initializedAt: serverTimestamp(),
      initializedBy: uid,
      updatedAt: serverTimestamp(),
    } satisfies FirestoreSettingsDoc);
    repairedItems.push('settings/system');
  } else {
    const data = sysSnap.data() as Partial<FirestoreSettingsDoc>;
    installId = data.installationId || installId;
    const patch: Record<string, unknown> = {};
    if (!data.installationId) patch.installationId = installId;
    if (!data.appVersion) patch.appVersion = PRODUCT_INFO.version;
    if (!data.databaseInitialized) patch.databaseInitialized = true;
    if (!data.schemaVersion) patch.schemaVersion = SCHEMA_VERSION;
    const repairName = data.websiteName?.trim().toLowerCase() ?? '';
    if (
      repairName === 'rj world bd' ||
      repairName === 'dukhu vibes panel' ||
      repairName === 'dukhu vibes'
    ) {
      patch.websiteName = APP_CONFIG.brandName;
      patch.brandTagline = APP_CONFIG.brandTagline;
    }
    if (!data.logo?.trim()) patch.logo = APP_CONFIG.brandLogoUrl;
    if (!data.favicon?.trim()) patch.favicon = APP_CONFIG.brandLogoUrl;
    if (Object.keys(patch).length > 0) {
      patch.updatedAt = serverTimestamp();
      await updateDoc(sysRef, patch);
      repairedItems.push('settings/system metadata');
    } else {
      verifiedIntactCount += 1;
    }
  }

  // 2. Repair settings/setup if missing
  const setupRef = doc(db, FIRESTORE_COLLECTIONS.settings, SETTINGS_DOC_IDS.setup);
  const setupSnap = await getDoc(setupRef);
  if (!setupSnap.exists()) {
    await setDoc(setupRef, {
      websiteName: APP_CONFIG.brandName,
      currency: APP_CONFIG.currencyCode,
      maintenanceMode: false,
      databaseInitialized: true,
      installationId: installId,
      appVersion: PRODUCT_INFO.version,
      schemaVersion: SCHEMA_VERSION,
      initializedAt: serverTimestamp(),
      initializedBy: uid,
      updatedAt: serverTimestamp(),
    } satisfies FirestoreSettingsDoc);
    repairedItems.push('settings/setup');
  } else {
    verifiedIntactCount += 1;
  }

  // 3. Ensure built-in categories exist without overwriting existing category docs
  let repairedCategoriesCount = 0;
  for (let i = 0; i < MOCK_PLATFORMS.length; i += 1) {
    const plat = MOCK_PLATFORMS[i];
    const catRef = doc(db, FIRESTORE_COLLECTIONS.categories, plat.id);
    const catSnap = await getDoc(catRef);
    if (!catSnap.exists()) {
      const isBuiltInNonDemo = plat.id === 'linkedin' || plat.id === 'webtraffic';
      await setDoc(catRef, {
        id: plat.id,
        name: plat.name,
        icon: plat.id,
        description: plat.description,
        status: 'active',
        sortOrder: i + 1,
        ...(isBuiltInNonDemo ? {} : { isDemo: true }),
      } satisfies FirestoreCategoryDoc);
      repairedCategoriesCount += 1;
    }
  }
  if (repairedCategoriesCount > 0) {
    repairedItems.push(`categories (${repairedCategoriesCount} restored)`);
  } else {
    verifiedIntactCount += 1;
  }

  // 4. Ensure paymentMethods exists if empty
  const pmExisting = await getDocs(
    query(collection(db, FIRESTORE_COLLECTIONS.paymentMethods), limit(1))
  );
  if (pmExisting.empty) {
    for (const pm of DEFAULT_PAYMENT_METHODS_SEED) {
      await setDoc(doc(db, FIRESTORE_COLLECTIONS.paymentMethods, pm.id), {
        ...pm,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      } satisfies FirestorePaymentMethodDoc);
    }
    repairedItems.push(`paymentMethods (${DEFAULT_PAYMENT_METHODS_SEED.length} defaults)`);
  } else {
    verifiedIntactCount += 1;
  }

  return {
    repairedItems,
    verifiedIntactCount,
    message:
      repairedItems.length > 0
        ? `Repaired ${repairedItems.join(', ')}. Existing customer, order, and payment records were preserved untouched.`
        : `All ${verifiedIntactCount} core system structures are healthy and intact.`,
  };
}

/**
 * Removes or archives ONLY demo-tagged starter catalog entries (`isDemo: true`).
 * Never removes buyer-created services or services referenced by existing orders.
 */
export async function clearDemoCatalog(): Promise<{
  removedServices: number;
  archivedServices: number;
}> {
  const services = getFirebaseServices();
  if (!services || !services.auth.currentUser) {
    throw new Error('Admin authentication is required.');
  }
  const { db } = services;
  let removedServices = 0;
  let archivedServices = 0;

  const demoSrvSnap = await getDocs(
    query(collection(db, FIRESTORE_COLLECTIONS.services), where('isDemo', '==', true))
  );

  for (const d of demoSrvSnap.docs) {
    const refOrderSnap = await getDocs(
      query(collection(db, FIRESTORE_COLLECTIONS.orders), where('serviceId', '==', d.id), limit(1))
    );
    if (!refOrderSnap.empty) {
      await updateDoc(d.ref, { status: 'inactive', updatedAt: serverTimestamp() });
      archivedServices += 1;
    } else {
      await deleteDoc(d.ref);
      removedServices += 1;
    }
  }

  await updateDoc(doc(db, FIRESTORE_COLLECTIONS.settings, SETTINGS_DOC_IDS.system), {
    demoDataEnabled: false,
    updatedAt: serverTimestamp(),
  }).catch(() => undefined);

  return { removedServices, archivedServices };
}
