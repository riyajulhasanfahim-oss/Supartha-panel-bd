import type { Auth } from 'firebase/auth';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

/**
 * Throws structured FirestoreErrorInfo for permission/operation diagnostics
 * while sanitizing sensitive credential patterns.
 */
export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null,
  auth?: Auth | null
): never {
  const rawMessage = error instanceof Error ? error.message : String(error);
  const currentUser = auth?.currentUser;

  const errInfo: FirestoreErrorInfo = {
    error: rawMessage,
    operationType,
    path,
    authInfo: {
      userId: currentUser?.uid ?? null,
      email: currentUser?.email ?? null,
      emailVerified: currentUser?.emailVerified ?? null,
      isAnonymous: currentUser?.isAnonymous ?? null,
      tenantId: currentUser?.tenantId ?? null,
      providerInfo:
        currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) ?? [],
    },
  };

  console.error('Firestore Error:', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

/**
 * Converts internal Firebase/Firestore errors into safe, user-friendly messages
 * without exposing API keys, project tokens, or internal paths.
 */
export function toUserFriendlyFirebaseError(error: unknown): string {
  const msg = error instanceof Error ? error.message : String(error);
  const lower = msg.toLowerCase();

  if (lower.includes('the client is offline') || lower.includes('network-request-failed')) {
    return 'Unable to reach Firebase servers. Please check your internet connection and project settings.';
  }
  if (lower.includes('permission-denied') || lower.includes('insufficient permissions')) {
    return 'Permission denied. Sign in with an authorized account to perform this action.';
  }
  if (lower.includes('quota exceeded')) {
    return 'Firestore daily quota reached. Please check your Firebase Spark/Blaze usage limits.';
  }
  if (lower.includes('invalid-api-key') || lower.includes('api-key-not-valid')) {
    return 'The configured Firebase project credentials appear invalid. Please verify them in Admin Panel.';
  }
  if (lower.includes('popup-closed-by-user')) {
    return 'Sign-in window was closed before completing authentication.';
  }
  if (lower.includes('unauthorized-domain')) {
    return 'This preview domain is not yet authorized in your Firebase Authentication settings.';
  }

  return 'Could not connect to the database service right now. Please try again.';
}
