import provisionedConfig from '../../../firebase-applet-config.json';

/**
 * Runtime Firebase Configuration structure.
 * Allows each white-label buyer installation to bind its own Firebase Project
 * via the Admin Panel without modifying or hardcoding keys in UI components.
 */
export interface FirebaseRuntimeConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  firestoreDatabaseId?: string;
}

const ADMIN_RUNTIME_CONFIG_KEY = 'rj_admin_firebase_runtime_v1';

function isNonEmptyConfig(cfg: Partial<FirebaseRuntimeConfig> | null | undefined): cfg is FirebaseRuntimeConfig {
  if (!cfg) return false;
  return Boolean(
    cfg.apiKey?.trim() &&
      cfg.authDomain?.trim() &&
      cfg.projectId?.trim() &&
      cfg.appId?.trim() &&
      cfg.projectId !== 'remixed-project-id'
  );
}

/**
 * Resolves the active Firebase config for SDK initialization.
 * Checks Admin-managed runtime override first, then falls back to the provisioned applet config.
 */
export function resolveActiveFirebaseConfig(): FirebaseRuntimeConfig | null {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const raw = window.localStorage.getItem(ADMIN_RUNTIME_CONFIG_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<FirebaseRuntimeConfig>;
        if (isNonEmptyConfig(parsed)) {
          return {
            apiKey: parsed.apiKey.trim(),
            authDomain: parsed.authDomain.trim(),
            projectId: parsed.projectId.trim(),
            storageBucket: parsed.storageBucket?.trim() ?? '',
            messagingSenderId: parsed.messagingSenderId?.trim() ?? '',
            appId: parsed.appId.trim(),
            firestoreDatabaseId: parsed.firestoreDatabaseId?.trim() || undefined,
          };
        }
      }
    }
  } catch {
    // Ignore storage access or malformed JSON and fall back cleanly
  }

  const fallback = provisionedConfig as Partial<FirebaseRuntimeConfig>;
  if (isNonEmptyConfig(fallback)) {
    return {
      apiKey: fallback.apiKey.trim(),
      authDomain: fallback.authDomain.trim(),
      projectId: fallback.projectId.trim(),
      storageBucket: fallback.storageBucket?.trim() ?? '',
      messagingSenderId: fallback.messagingSenderId?.trim() ?? '',
      appId: fallback.appId.trim(),
      firestoreDatabaseId: fallback.firestoreDatabaseId?.trim() || undefined,
    };
  }

  return null;
}

export function hasValidFirebaseConfig(): boolean {
  return resolveActiveFirebaseConfig() !== null;
}

export function isUsingCustomAdminConfig(): boolean {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return false;
    const raw = window.localStorage.getItem(ADMIN_RUNTIME_CONFIG_KEY);
    if (!raw) return false;
    return isNonEmptyConfig(JSON.parse(raw) as Partial<FirebaseRuntimeConfig>);
  } catch {
    return false;
  }
}

export interface FirebaseConfigValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateFirebaseConfig(
  cfg: Partial<FirebaseRuntimeConfig> | null | undefined
): FirebaseConfigValidationResult {
  const errors: string[] = [];
  if (!cfg) {
    return { valid: false, errors: ['Firebase configuration object is empty.'] };
  }

  const apiKey = cfg.apiKey?.trim() ?? '';
  const authDomain = cfg.authDomain?.trim() ?? '';
  const projectId = cfg.projectId?.trim() ?? '';
  const appId = cfg.appId?.trim() ?? '';
  const dbId = cfg.firestoreDatabaseId?.trim() ?? '';

  if (!apiKey || apiKey.length < 20 || /\s/.test(apiKey)) {
    errors.push('API Key appears invalid (expected a valid Firebase Web API Key).');
  }
  if (!authDomain || !/^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(authDomain)) {
    errors.push('Auth Domain must be a valid domain (e.g. your-project.firebaseapp.com).');
  }
  if (!projectId || !/^[a-z0-9-]{4,80}$/.test(projectId) || projectId === 'remixed-project-id') {
    errors.push('Project ID must contain lowercase letters, numbers, or hyphens only.');
  }
  if (!appId || appId.length < 12 || !appId.includes(':')) {
    errors.push('App ID must be a valid Firebase Web App ID (e.g. 1:123456:web:abcdef).');
  }
  if (dbId && dbId !== '(default)' && !/^[a-z0-9-]{2,80}$/.test(dbId)) {
    errors.push('Firestore Database ID must be "(default)" or lowercase alphanumeric/hyphens.');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

export function getActiveFirebaseTargetPayload(): {
  firebaseProjectId?: string;
  firebaseDatabaseId?: string;
  firebaseApiKey?: string;
} {
  const active = resolveActiveFirebaseConfig();
  if (!active) return {};
  return {
    firebaseProjectId: active.projectId,
    ...(active.firestoreDatabaseId ? { firebaseDatabaseId: active.firestoreDatabaseId } : {}),
    ...(active.apiKey ? { firebaseApiKey: active.apiKey } : {}),
  };
}

/**
 * Admin-only: persists a buyer-specific Firebase Project configuration override.
 */
export function saveAdminFirebaseConfig(config: FirebaseRuntimeConfig): void {
  const check = validateFirebaseConfig(config);
  if (!check.valid) {
    throw new Error(check.errors[0] || 'Invalid Firebase configuration.');
  }
  if (typeof window !== 'undefined' && window.localStorage) {
    window.localStorage.setItem(ADMIN_RUNTIME_CONFIG_KEY, JSON.stringify(config));
  }
}

/**
 * Admin-only: clears custom override and reverts to the provisioned project config.
 */
export function resetAdminFirebaseConfig(): void {
  if (typeof window !== 'undefined' && window.localStorage) {
    window.localStorage.removeItem(ADMIN_RUNTIME_CONFIG_KEY);
  }
}

export function maskSecretValue(value: string): string {
  if (!value) return '';
  if (value.length <= 8) return '••••••••';
  return `${value.slice(0, 4)}••••••••${value.slice(-4)}`;
}
