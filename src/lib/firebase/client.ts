import { initializeApp, getApps, deleteApp, type FirebaseApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  type Auth,
  type User as FirebaseAuthUser,
} from 'firebase/auth';
import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  doc,
  getDocFromServer,
  type Firestore,
} from 'firebase/firestore';
import { resolveActiveFirebaseConfig, type FirebaseRuntimeConfig } from './configManager';
import { toUserFriendlyFirebaseError } from '../firestore/errors';

export interface FirebaseServiceInstances {
  app: FirebaseApp;
  auth: Auth;
  db: Firestore;
  config: FirebaseRuntimeConfig;
}

let cachedInstances: FirebaseServiceInstances | null = null;
let cachedConfigKey = '';
let connectionProbeStarted = false;

function buildConfigKey(cfg: FirebaseRuntimeConfig): string {
  return `${cfg.projectId}::${cfg.appId}::${cfg.firestoreDatabaseId ?? 'default'}`;
}

function createPersistentFirestore(app: FirebaseApp, databaseId?: string): Firestore {
  try {
    return initializeFirestore(
      app,
      {
        localCache: persistentLocalCache({
          tabManager: persistentMultipleTabManager(),
        }),
      },
      databaseId
    );
  } catch {
    return databaseId ? getFirestore(app, databaseId) : getFirestore(app);
  }
}

/**
 * Lazily initializes or returns cached Firebase App, Auth, and Firestore instances.
 * Never crashes the application if configuration is missing or invalid.
 */
export function getFirebaseServices(): FirebaseServiceInstances | null {
  const config = resolveActiveFirebaseConfig();
  if (!config) {
    return null;
  }

  const nextKey = buildConfigKey(config);
  if (cachedInstances && cachedConfigKey === nextKey) {
    return cachedInstances;
  }

  try {
    const existingApp = getApps().find((a) => a.name === 'rj-smm-primary');
    const app = existingApp
      ? existingApp
      : initializeApp(
          {
            apiKey: config.apiKey,
            authDomain: config.authDomain,
            projectId: config.projectId,
            storageBucket: config.storageBucket,
            messagingSenderId: config.messagingSenderId,
            appId: config.appId,
          },
          'rj-smm-primary'
        );

    const db = createPersistentFirestore(app, config.firestoreDatabaseId);
    const auth = getAuth(app);

    cachedInstances = { app, auth, db, config };
    cachedConfigKey = nextKey;
    return cachedInstances;
  } catch (err) {
    console.error('Firebase initialization failed:', toUserFriendlyFirebaseError(err));
    return null;
  }
}

/**
 * Tears down and re-initializes Firebase SDK instances after Admin updates project configuration.
 */
export async function reinitializeFirebaseClient(): Promise<FirebaseServiceInstances | null> {
  if (cachedInstances) {
    try {
      await deleteApp(cachedInstances.app);
    } catch {
      // Ignore cleanup errors
    }
    cachedInstances = null;
    cachedConfigKey = '';
    connectionProbeStarted = false;
  }
  return getFirebaseServices();
}

export interface ConnectionCheckResult {
  connected: boolean;
  errorMessage: string | null;
}

/**
 * Verifies live Firestore server connectivity using getDocFromServer.
 */
export async function testFirestoreConnection(): Promise<ConnectionCheckResult> {
  const services = getFirebaseServices();
  if (!services) {
    return {
      connected: false,
      errorMessage: 'Firebase configuration is incomplete. Please configure your project in Admin Panel.',
    };
  }

  try {
    await getDocFromServer(doc(services.db, 'settings', 'system'));
    return { connected: true, errorMessage: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    // Permission denied or missing doc still confirms the Firestore server responded
    if (message.includes('permission-denied') || message.includes('not-found')) {
      return { connected: true, errorMessage: null };
    }
    return {
      connected: false,
      errorMessage: toUserFriendlyFirebaseError(error),
    };
  }
}

/**
 * Runs a silent, non-blocking single connection probe once per session boot.
 */
export function probeFirestoreConnectionOnce(): void {
  if (connectionProbeStarted) return;
  connectionProbeStarted = true;
  void testFirestoreConnection().catch(() => undefined);
}

export async function signInWithGooglePopup(): Promise<FirebaseAuthUser> {
  const services = getFirebaseServices();
  if (!services) {
    throw new Error('Firebase is not configured yet.');
  }
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  const result = await signInWithPopup(services.auth, provider);
  return result.user;
}

export async function signOutFirebase(): Promise<void> {
  const services = getFirebaseServices();
  if (!services) return;
  await signOut(services.auth);
}

export function subscribeFirebaseAuth(
  callback: (user: FirebaseAuthUser | null) => void
): () => void {
  const services = getFirebaseServices();
  if (!services) {
    callback(null);
    return () => {};
  }
  return onAuthStateChanged(services.auth, callback);
}

/**
 * Tests a candidate buyer Firebase configuration in an isolated temporary app instance
 * without disrupting the active session.
 */
export async function testCustomFirebaseConfigConnection(
  candidate: FirebaseRuntimeConfig
): Promise<ConnectionCheckResult> {
  const tempName = `rj-probe-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;
  let tempApp: FirebaseApp | null = null;
  try {
    tempApp = initializeApp(
      {
        apiKey: candidate.apiKey.trim(),
        authDomain: candidate.authDomain.trim(),
        projectId: candidate.projectId.trim(),
        storageBucket: candidate.storageBucket?.trim() ?? '',
        messagingSenderId: candidate.messagingSenderId?.trim() ?? '',
        appId: candidate.appId.trim(),
      },
      tempName
    );
    const db = candidate.firestoreDatabaseId?.trim()
      ? getFirestore(tempApp, candidate.firestoreDatabaseId.trim())
      : getFirestore(tempApp);
    await getDocFromServer(doc(db, 'settings', 'system'));
    return { connected: true, errorMessage: null };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes('permission-denied') || msg.includes('not-found')) {
      return { connected: true, errorMessage: null };
    }
    return {
      connected: false,
      errorMessage: toUserFriendlyFirebaseError(error),
    };
  } finally {
    if (tempApp) {
      await deleteApp(tempApp).catch(() => undefined);
    }
  }
}

/**
 * Creates a Firebase Auth user on an isolated secondary app instance
 * so the currently signed-in Super Admin session remains intact.
 */
export async function createAuthUserOnSecondaryApp(
  email: string,
  password: string,
  displayName: string
): Promise<string> {
  const config = resolveActiveFirebaseConfig();
  if (!config) {
    throw new Error('Firebase configuration is missing.');
  }
  const { createUserWithEmailAndPassword, updateProfile } = await import('firebase/auth');
  const { serverTimestamp, setDoc } = await import('firebase/firestore');
  const tempName = `rj-staff-create-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;
  let tempApp: FirebaseApp | null = null;
  try {
    tempApp = initializeApp(
      {
        apiKey: config.apiKey,
        authDomain: config.authDomain,
        projectId: config.projectId,
        storageBucket: config.storageBucket,
        messagingSenderId: config.messagingSenderId,
        appId: config.appId,
      },
      tempName
    );
    const tempAuth = getAuth(tempApp);
    const tempDb = config.firestoreDatabaseId
      ? getFirestore(tempApp, config.firestoreDatabaseId)
      : getFirestore(tempApp);

    const cred = await createUserWithEmailAndPassword(tempAuth, email.trim(), password);
    const cleanName = displayName.trim() || email.split('@')[0] || 'Staff Member';
    if (cleanName) {
      await updateProfile(cred.user, { displayName: cleanName }).catch(() => undefined);
    }

    const createdUid = cred.user.uid;
    await setDoc(doc(tempDb, 'users', createdUid), {
      uid: createdUid,
      name: cleanName.slice(0, 120),
      email: email.trim().toLowerCase(),
      role: 'user',
      balance: 0,
      status: 'active',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    await signOut(tempAuth).catch(() => undefined);
    return createdUid;
  } finally {
    if (tempApp) {
      await deleteApp(tempApp).catch(() => undefined);
    }
  }
}
