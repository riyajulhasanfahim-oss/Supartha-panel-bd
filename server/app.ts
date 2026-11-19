import 'dotenv/config';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express, { type Express, type Request, type Response } from 'express';
import { registerGatewayRoutes } from './gateway.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const requireFromHere = createRequire(import.meta.url);

const UPSTREAM_TIMEOUT_MS = 45000;
const RETRY_BACKOFF_MINUTES = [2, 5, 15, 30, 60];
const DESIGNATED_ADMIN_EMAIL = 'mondalsupartha@gmail.com';
const ADMIN_BOOTSTRAP_PASSWORD =
  (process.env.ADMIN_BOOTSTRAP_PASSWORD || 'QEwyQ8thcspn8Hr').trim();

function safeEqualSecret(candidate: string, expected: string): boolean {
  const digestA = crypto.createHash('sha256').update(candidate).digest();
  const digestB = crypto.createHash('sha256').update(expected).digest();
  return crypto.timingSafeEqual(digestA, digestB);
}

interface ProviderProxyBody {
  action?: 'balance' | 'services' | 'testConnection' | 'add' | 'status';
  format?: string;
  providerId?: string;
  apiUrl?: string;
  apiKey?: string;
  service?: string;
  link?: string;
  quantity?: number;
  order?: string;
  firebaseProjectId?: string;
  firebaseDatabaseId?: string;
  firebaseApiKey?: string;
}

interface FirebaseAppletConfigFile {
  projectId?: string;
  firestoreDatabaseId?: string;
  apiKey?: string;
}

export interface FirebaseTarget {
  projectId: string;
  databaseId: string;
  apiKey?: string;
}

function loadFirebaseTargetConfig(): FirebaseTarget {
  try {
    const bundled = requireFromHere('../firebase-applet-config.json') as FirebaseAppletConfigFile;
    if (bundled?.projectId) {
      return {
        projectId: bundled.projectId,
        databaseId: bundled.firestoreDatabaseId || '(default)',
        apiKey:
          bundled.apiKey ||
          process.env.VITE_FIREBASE_API_KEY ||
          process.env.FIREBASE_API_KEY ||
          '',
      };
    }
  } catch {
    // Fallback to filesystem paths or env vars
  }

  const candidatePaths = [
    path.resolve(__dirname, '..', 'firebase-applet-config.json'),
    path.resolve(__dirname, 'firebase-applet-config.json'),
    path.resolve(process.cwd(), 'firebase-applet-config.json'),
  ];

  for (const cfgPath of candidatePaths) {
    try {
      if (fs.existsSync(cfgPath)) {
        const parsed = JSON.parse(fs.readFileSync(cfgPath, 'utf8')) as FirebaseAppletConfigFile;
        if (parsed.projectId) {
          return {
            projectId: parsed.projectId,
            databaseId: parsed.firestoreDatabaseId || '(default)',
            apiKey:
              parsed.apiKey ||
              process.env.VITE_FIREBASE_API_KEY ||
              process.env.FIREBASE_API_KEY ||
              '',
          };
        }
      }
    } catch {
      // Try next candidate path
    }
  }

  return {
    projectId: process.env.VITE_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID || '',
    databaseId:
      process.env.VITE_FIREBASE_DATABASE_ID || process.env.FIREBASE_DATABASE_ID || '(default)',
    apiKey: process.env.VITE_FIREBASE_API_KEY || process.env.FIREBASE_API_KEY || '',
  };
}

function resolveRequestFirebaseTarget(body: unknown): FirebaseTarget {
  const fallback = loadFirebaseTargetConfig();
  if (!body || typeof body !== 'object') return fallback;
  const record = body as Record<string, unknown>;
  const rawProj =
    typeof record.firebaseProjectId === 'string' ? record.firebaseProjectId.trim() : '';
  const rawDb =
    typeof record.firebaseDatabaseId === 'string' ? record.firebaseDatabaseId.trim() : '';
  const rawApiKey =
    typeof record.firebaseApiKey === 'string' ? record.firebaseApiKey.trim() : '';

  const validProject = /^[a-z0-9-]{4,80}$/.test(rawProj) ? rawProj : fallback.projectId;
  const validDb =
    rawDb === '(default)' || /^[a-z0-9-]{2,80}$/.test(rawDb) ? rawDb : fallback.databaseId;
  const validPayloadApiKey =
    /^AIza[0-9A-Za-z_-]{20,80}$/.test(rawApiKey) ? rawApiKey : '';

  const resolvedApiKey =
    (!fallback.apiKey || validProject !== fallback.projectId) && validPayloadApiKey
      ? validPayloadApiKey
      : fallback.apiKey;

  return {
    projectId: validProject,
    databaseId: validDb || '(default)',
    apiKey: resolvedApiKey,
  };
}

function parseFirestoreValue(raw: Record<string, unknown> | undefined): unknown {
  if (!raw || typeof raw !== 'object') return undefined;
  if ('stringValue' in raw) return String(raw.stringValue);
  if ('integerValue' in raw) return Number(raw.integerValue);
  if ('doubleValue' in raw) return Number(raw.doubleValue);
  if ('booleanValue' in raw) return Boolean(raw.booleanValue);
  if ('timestampValue' in raw) return String(raw.timestampValue);
  if ('nullValue' in raw) return null;
  return undefined;
}

function parseFirestoreDocumentFields(
  docJson: { fields?: Record<string, Record<string, unknown>> } | null
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  const fields = docJson?.fields ?? {};
  for (const [key, val] of Object.entries(fields)) {
    result[key] = parseFirestoreValue(val);
  }
  return result;
}

async function fetchFirestoreDocWithToken(
  docPath: string,
  idToken: string,
  targetOverride?: FirebaseTarget
): Promise<Record<string, unknown>> {
  const target = targetOverride ?? loadFirebaseTargetConfig();
  if (!target.projectId) {
    throw new Error('Firebase project configuration is not initialized on server.');
  }

  const url = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(
    target.projectId
  )}/databases/${encodeURIComponent(target.databaseId)}/documents/${docPath}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${idToken}`,
      Accept: 'application/json',
    },
  });

  if (response.status === 401 || response.status === 403) {
    throw new Error('Unauthorized: Admin verification required for server-side operation.');
  }
  if (response.status === 404) {
    throw new Error(`Requested document (${docPath}) was not found.`);
  }
  if (!response.ok) {
    throw new Error(`Unable to read Firestore record (${response.status}).`);
  }

  const json = (await response.json()) as { fields?: Record<string, Record<string, unknown>> };
  return parseFirestoreDocumentFields(json);
}

interface VerifiedFirebaseUser {
  uid: string;
  email: string;
  emailVerified: boolean;
  disabled: boolean;
  customClaims?: Record<string, unknown>;
}

async function lookupFirebaseAuthUser(
  idToken: string,
  apiKey?: string
): Promise<VerifiedFirebaseUser | null> {
  const resolvedKey = (apiKey || loadFirebaseTargetConfig().apiKey || '').trim();
  if (!resolvedKey) {
    return null;
  }

  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(
      resolvedKey
    )}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken }),
    }
  );

  if (!response.ok) {
    throw new Error('Unauthorized: Invalid or expired authentication session.');
  }

  const json = (await response.json()) as {
    users?: Array<{
      localId?: string;
      email?: string;
      emailVerified?: boolean;
      disabled?: boolean;
      customAttributes?: string;
    }>;
  };

  const user = json.users?.[0];
  if (!user || !user.localId) {
    throw new Error('Unauthorized: User account not found.');
  }

  let customClaims: Record<string, unknown> | undefined;
  if (typeof user.customAttributes === 'string' && user.customAttributes.trim()) {
    try {
      const parsed = JSON.parse(user.customAttributes) as unknown;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        customClaims = parsed as Record<string, unknown>;
      }
    } catch {
      // ignore malformed customAttributes
    }
  }

  return {
    uid: user.localId,
    email: (user.email || '').trim().toLowerCase(),
    emailVerified: Boolean(user.emailVerified),
    disabled: Boolean(user.disabled),
    customClaims,
  };
}

async function getIdentityToolkitAdminToken(): Promise<string | null> {
  try {
    const rawInline = (
      process.env.FIREBASE_SERVICE_ACCOUNT_JSON ||
      process.env.FIREBASE_SERVICE_ACCOUNT ||
      ''
    ).trim();
    let creds: { client_email?: string; private_key?: string; token_uri?: string } | null = null;
    if (rawInline) {
      creds = JSON.parse(rawInline) as {
        client_email?: string;
        private_key?: string;
        token_uri?: string;
      };
    } else {
      const credPath = (process.env.GOOGLE_APPLICATION_CREDENTIALS || '').trim();
      if (credPath && fs.existsSync(credPath)) {
        creds = JSON.parse(fs.readFileSync(credPath, 'utf8')) as {
          client_email?: string;
          private_key?: string;
          token_uri?: string;
        };
      }
    }

    if (creds?.client_email && creds?.private_key) {
      const nowSec = Math.floor(Date.now() / 1000);
      const tokenUri = creds.token_uri || 'https://oauth2.googleapis.com/token';
      const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString(
        'base64url'
      );
      const claimSet = Buffer.from(
        JSON.stringify({
          iss: creds.client_email,
          scope: 'https://www.googleapis.com/auth/identitytoolkit',
          aud: tokenUri,
          iat: nowSec,
          exp: nowSec + 3600,
        })
      ).toString('base64url');
      const signingInput = `${header}.${claimSet}`;
      const signer = crypto.createSign('RSA-SHA256');
      signer.update(signingInput);
      signer.end();
      const signature = signer.sign(creds.private_key.replace(/\\n/g, '\n'), 'base64url');
      const assertion = `${signingInput}.${signature}`;
      const tokenRes = await fetch(tokenUri, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
          assertion,
        }).toString(),
      });
      if (tokenRes.ok) {
        const json = (await tokenRes.json()) as { access_token?: string };
        if (json.access_token) return json.access_token;
      }
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 1200);
    try {
      const metaRes = await fetch(
        'http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token',
        {
          method: 'GET',
          headers: { 'Metadata-Flavor': 'Google' },
          signal: controller.signal,
        }
      );
      if (metaRes.ok) {
        const metaJson = (await metaRes.json()) as { access_token?: string };
        if (metaJson.access_token) return metaJson.access_token;
      }
    } finally {
      clearTimeout(timer);
    }
  } catch {
    // Non-blocking: host may not have Identity Toolkit Admin credentials
  }
  return null;
}

async function syncAdminCustomClaimsBestEffort(
  uid: string,
  existingClaims: Record<string, unknown> | undefined,
  target: FirebaseTarget,
  currentEmailVerified = true
): Promise<boolean> {
  const needsClaims = !(
    existingClaims?.admin === true &&
    existingClaims?.role === 'admin' &&
    existingClaims?.staffRole === 'super_admin'
  );
  const needsEmailVerified = !currentEmailVerified;

  if (!needsClaims && !needsEmailVerified) {
    return false;
  }

  try {
    const adminToken = await getIdentityToolkitAdminToken();
    if (!adminToken || !target.projectId) return false;

    const mergedClaims = {
      ...(existingClaims ?? {}),
      role: 'admin',
      admin: true,
      staffRole: 'super_admin',
    };

    const res = await fetch(
      `https://identitytoolkit.googleapis.com/v1/projects/${encodeURIComponent(
        target.projectId
      )}/accounts:update`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          localId: uid,
          ...(needsEmailVerified ? { emailVerified: true } : {}),
          ...(needsClaims ? { customAttributes: JSON.stringify(mergedClaims) } : {}),
        }),
      }
    );
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Verifies an Admin Firebase ID token directly against Firebase Auth AND Firestore REST RBAC rules.
 */
async function verifyAdminViaFirestoreRest(
  idToken: string,
  target: FirebaseTarget
): Promise<void> {
  if (!target.projectId) {
    throw new Error('Firebase project configuration is missing.');
  }

  const authUser = await lookupFirebaseAuthUser(idToken, target.apiKey);
  if (!authUser) {
    throw new Error('Unauthorized: Firebase API key configuration is missing.');
  }
  if (authUser.disabled || authUser.email !== DESIGNATED_ADMIN_EMAIL) {
    throw new Error('Unauthorized: Admin privileges required.');
  }

  const url = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(
    target.projectId
  )}/databases/${encodeURIComponent(target.databaseId)}/documents/settings/setup`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${idToken}`,
      Accept: 'application/json',
    },
  });

  if (response.status !== 200 && response.status !== 404) {
    throw new Error('Unauthorized: Admin privileges required.');
  }
}

function mapProviderStatusToInternal(
  rawStatus: string
): 'Pending' | 'Processing' | 'In Progress' | 'Completed' | 'Partial' | 'Cancelled' | 'Failed' {
  const lower = rawStatus.trim().toLowerCase();
  if (lower.includes('complete') || lower === 'finish' || lower === 'finished') {
    return 'Completed';
  }
  if (lower.includes('partial')) {
    return 'Partial';
  }
  if (lower.includes('in progress') || lower === 'inprogress') {
    return 'In Progress';
  }
  if (lower.includes('process')) {
    return 'Processing';
  }
  if (lower.includes('cancel') || lower.includes('refund')) {
    return 'Cancelled';
  }
  if (lower.includes('fail') || lower.includes('error')) {
    return 'Failed';
  }
  return 'Pending';
}

function computeNextRetrySchedule(currentRetryCount: number): {
  retryCount: number;
  backoffMinutes: number;
  nextRetryAtMs: number;
} {
  const nextCount = Math.min(20, Math.max(1, currentRetryCount + 1));
  const idx = Math.min(RETRY_BACKOFF_MINUTES.length - 1, nextCount - 1);
  const backoffMinutes = RETRY_BACKOFF_MINUTES[idx];
  return {
    retryCount: nextCount,
    backoffMinutes,
    nextRetryAtMs: Date.now() + backoffMinutes * 60 * 1000,
  };
}

function extractBearerToken(req: Request): string {
  const header = req.headers.authorization || '';
  if (header.startsWith('Bearer ')) {
    return header.slice('Bearer '.length).trim();
  }
  return '';
}

function isBlockedHostname(hostname: string): boolean {
  const lower = hostname.trim().toLowerCase();
  if (!lower) return true;
  if (
    lower === 'localhost' ||
    lower === '0.0.0.0' ||
    lower === '::1' ||
    lower === '[::1]' ||
    lower.endsWith('.local') ||
    lower.endsWith('.internal')
  ) {
    return true;
  }

  const ipv4Match = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(lower);
  if (ipv4Match) {
    const [, aStr, bStr] = ipv4Match;
    const a = Number(aStr);
    const b = Number(bStr);
    if (a === 10 || a === 127 || a === 0) return true;
    if (a === 169 && b === 254) return true;
    if (a === 192 && b === 168) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
  }

  return false;
}

function validateProviderUrl(rawUrl: string): URL {
  const trimmed = rawUrl.trim();
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error('Invalid API URL format. Please enter a valid https:// URL.');
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new Error('API URL must use https:// or http:// protocol.');
  }
  if (isBlockedHostname(parsed.hostname)) {
    throw new Error('Private or localhost provider URLs are not allowed.');
  }
  return parsed;
}

function normalizeServerErrorText(
  value: unknown,
  fallback: string = 'Provider API request failed.'
): string {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed || fallback;
  }
  if (value instanceof Error) {
    return value.message?.trim() || fallback;
  }
  if (Array.isArray(value)) {
    const parts = value.map((item) => normalizeServerErrorText(item, '')).filter(Boolean);
    return parts.length > 0 ? parts.join('; ') : fallback;
  }
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    for (const field of ['message', 'error', 'detail', 'reason', 'statusText', 'description']) {
      if (record[field] !== undefined && record[field] !== null) {
        const extracted = normalizeServerErrorText(record[field], '');
        if (extracted) {
          const codePrefix =
            typeof record.code === 'number' || typeof record.code === 'string'
              ? `[${record.code}] `
              : '';
          return `${codePrefix}${extracted}`;
        }
      }
    }
    try {
      const serialized = JSON.stringify(value);
      if (serialized && serialized !== '{}') return serialized;
    } catch {
      // ignore JSON serialization failure
    }
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return fallback;
}

function sanitizeErrorMessage(message: unknown, secretKey: unknown): string {
  let clean = normalizeServerErrorText(message, 'Provider API request failed.');
  const trimmedKey = typeof secretKey === 'string' ? secretKey.trim() : '';
  if (trimmedKey.length > 0) {
    clean = clean.split(trimmedKey).join('[REDACTED]');
  }
  return clean.slice(0, 260);
}

function parseUpstreamNumber(value: unknown): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : NaN;
  if (typeof value === 'string') {
    const cleaned = value.replace(/[^0-9.-]/g, '').trim();
    if (!cleaned) return NaN;
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : NaN;
  }
  return NaN;
}

function extractServicesArray(raw: unknown): Array<Record<string, unknown>> | null {
  if (Array.isArray(raw)) {
    return raw.filter(
      (row): row is Record<string, unknown> => Boolean(row && typeof row === 'object')
    );
  }
  if (raw && typeof raw === 'object') {
    const record = raw as Record<string, unknown>;
    for (const key of ['services', 'data', 'result', 'items']) {
      const candidate = record[key];
      if (Array.isArray(candidate)) {
        return candidate.filter(
          (row): row is Record<string, unknown> => Boolean(row && typeof row === 'object')
        );
      }
    }
    const entries = Object.entries(record);
    if (entries.length > 0 && entries.every(([, v]) => v && typeof v === 'object' && !Array.isArray(v))) {
      return entries.map(([keyId, v]) => {
        const obj = v as Record<string, unknown>;
        return obj.service !== undefined || obj.id !== undefined ? obj : { service: keyId, ...obj };
      });
    }
  }
  return null;
}

function describeNonJsonResponse(rawText: string, status: number, secretKey: string): string {
  const trimmed = rawText.trim();
  const titleMatch = /<title[^>]*>([^<]+)<\/title>/i.exec(trimmed);
  const snippet = titleMatch?.[1]
    ? titleMatch[1].replace(/\s+/g, ' ').trim()
    : trimmed.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 140);
  const base = snippet
    ? `Provider returned HTTP ${status} non-JSON response: ${snippet}`
    : `Provider returned HTTP ${status} empty or non-JSON response.`;
  return sanitizeErrorMessage(base, secretKey);
}

async function callUpstreamSmmV2(
  apiUrl: string,
  apiKey: string,
  params: Record<string, string>
): Promise<unknown> {
  let currentUrl = validateProviderUrl(apiUrl);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);

  try {
    const body = new URLSearchParams({
      key: apiKey,
      ...params,
    });

    let response: globalThis.Response | null = null;
    for (let hop = 0; hop < 4; hop += 1) {
      response = await fetch(currentUrl.toString(), {
        method: 'POST',
        redirect: 'manual',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          Accept: 'application/json, text/plain, */*',
          'User-Agent': 'Mozilla/5.0 (compatible; SuparthaPanel-SMM-Client/2.0)',
        },
        body: body.toString(),
        signal: controller.signal,
      });

      if (
        response.status === 301 ||
        response.status === 302 ||
        response.status === 303 ||
        response.status === 307 ||
        response.status === 308
      ) {
        const location = response.headers.get('location');
        if (!location) break;
        const resolved = new URL(location, currentUrl).toString();
        currentUrl = validateProviderUrl(resolved);
        continue;
      }
      break;
    }

    if (!response) {
      throw new Error('Unable to reach provider API endpoint.');
    }

    const rawText = (await response.text()).replace(/^\uFEFF/, '').trim();
    let parsed: unknown = null;
    if (rawText) {
      try {
        parsed = JSON.parse(rawText);
      } catch {
        parsed = null;
      }
    }

    if (!response.ok) {
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        const errObj = parsed as { error?: unknown; message?: unknown };
        const upstreamMsg = errObj.error ?? errObj.message;
        if (upstreamMsg !== undefined && upstreamMsg !== null && upstreamMsg !== '') {
          throw new Error(sanitizeErrorMessage(upstreamMsg, apiKey));
        }
      }
      throw new Error(describeNonJsonResponse(rawText, response.status, apiKey));
    }

    if (parsed === null) {
      throw new Error(describeNonJsonResponse(rawText, response.status, apiKey));
    }

    if (
      parsed &&
      typeof parsed === 'object' &&
      !Array.isArray(parsed) &&
      'error' in parsed &&
      (parsed as { error: unknown }).error
    ) {
      throw new Error(sanitizeErrorMessage((parsed as { error: unknown }).error, apiKey));
    }

    return parsed;
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error('Provider API request timed out after 45 seconds.');
    }
    if (err instanceof Error) {
      throw new Error(sanitizeErrorMessage(err.message, apiKey));
    }
    throw new Error('Unable to reach provider API endpoint.');
  } finally {
    clearTimeout(timer);
  }
}

export function createApiApp(): Express {
  const app = express();
  app.set('trust proxy', 1);

  // Restore original /api/* path when Vercel rewrites /api/(.*) -> /api/index?__api_path=$1
  app.use((req: Request, _res: Response, next: express.NextFunction) => {
    try {
      const parsed = new URL(req.url || '/', 'http://localhost');
      const rewrittenPath = parsed.searchParams.get('__api_path');
      if (rewrittenPath !== null) {
        parsed.searchParams.delete('__api_path');
        if (req.query && typeof req.query === 'object' && '__api_path' in req.query) {
          delete (req.query as Record<string, unknown>).__api_path;
        }
        const cleanSubpath = rewrittenPath.replace(/^\/+/, '').replace(/^api\/+/, '');
        const qs = parsed.searchParams.toString();
        req.url = `/api${cleanSubpath ? `/${cleanSubpath}` : ''}${qs ? `?${qs}` : ''}`;
      }
    } catch {
      // Keep original req.url if URL parsing fails
    }
    next();
  });

  app.use('/api', (req: Request, res: Response, next: express.NextFunction) => {
    const origin = req.headers.origin;
    if (origin) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
    } else {
      res.setHeader('Access-Control-Allow-Origin', '*');
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept');
    res.setHeader('Access-Control-Max-Age', '86400');
    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }
    next();
  });

  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: true, limit: '2mb' }));

  app.get('/api/health', (_req: Request, res: Response) => {
    const target = loadFirebaseTargetConfig();
    res.json({
      ok: true,
      runtime: process.env.VERCEL ? 'vercel-serverless' : 'node-express',
      firebaseConfigured: Boolean(target.projectId && target.apiKey),
    });
  });

  app.post('/api/auth/bootstrap-admin', async (req: Request, res: Response) => {
    const rawEmail = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const rawPassword = typeof req.body?.password === 'string' ? req.body.password : '';

    if (
      !rawEmail ||
      !rawPassword ||
      rawEmail !== DESIGNATED_ADMIN_EMAIL ||
      !safeEqualSecret(rawPassword, ADMIN_BOOTSTRAP_PASSWORD)
    ) {
      res.status(401).json({ ok: false, error: 'Incorrect email or password.' });
      return;
    }

    const fbTarget = resolveRequestFirebaseTarget(req.body);
    const resolvedKey = (fbTarget.apiKey || '').trim();
    if (!resolvedKey) {
      res.status(500).json({ ok: false, error: 'Firebase API key is not configured.' });
      return;
    }

    try {
      const signUpRes = await fetch(
        `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${encodeURIComponent(
          resolvedKey
        )}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: DESIGNATED_ADMIN_EMAIL,
            password: ADMIN_BOOTSTRAP_PASSWORD,
            returnSecureToken: true,
          }),
        }
      );

      const signUpJson = (await signUpRes.json().catch(() => ({}))) as {
        localId?: string;
        error?: { message?: string };
      };

      if (!signUpRes.ok || !signUpJson.localId) {
        const msg = String(signUpJson.error?.message || '').toUpperCase();
        if (msg.includes('OPERATION_NOT_ALLOWED')) {
          res.status(400).json({
            ok: false,
            code: 'EMAIL_PASSWORD_DISABLED',
            error:
              'Email/Password sign-in is not yet enabled in this Firebase project. Enable Authentication -> Sign-in method -> Email/Password in Firebase Console.',
          });
          return;
        }
        res.status(401).json({
          ok: false,
          code: msg.includes('EMAIL_EXISTS') ? 'EMAIL_EXISTS' : 'BOOTSTRAP_FAILED',
          error: 'Incorrect email or password.',
        });
        return;
      }

      await syncAdminCustomClaimsBestEffort(signUpJson.localId, undefined, fbTarget, false);
      res.json({ ok: true, created: true });
    } catch {
      res.status(500).json({ ok: false, error: 'Unable to initialize admin credentials.' });
    }
  });

  app.post('/api/auth/verify-admin', async (req: Request, res: Response) => {
    const idToken = extractBearerToken(req);
    if (!idToken) {
      res.status(401).json({ ok: false, isAdmin: false, error: 'Authentication token required.' });
      return;
    }

    const fbTarget = resolveRequestFirebaseTarget(req.body);
    try {
      const authUser = await lookupFirebaseAuthUser(idToken, fbTarget.apiKey);
      if (!authUser || authUser.disabled || authUser.email !== DESIGNATED_ADMIN_EMAIL) {
        res.json({
          ok: true,
          isAdmin: false,
          staffRole: null,
          reason: authUser?.disabled ? 'disabled' : 'not_admin',
        });
        return;
      }

      let firestoreVerified = false;
      try {
        await verifyAdminViaFirestoreRest(idToken, fbTarget);
        firestoreVerified = true;
      } catch (fsErr) {
        console.warn(
          '[verify-admin] Firestore REST verification skipped/failed for designated admin:',
          fsErr instanceof Error ? fsErr.message : String(fsErr)
        );
      }

      const claimsSynced = await syncAdminCustomClaimsBestEffort(
        authUser.uid,
        authUser.customClaims,
        fbTarget,
        authUser.emailVerified
      );

      res.json({
        ok: true,
        isAdmin: true,
        staffRole: 'super_admin',
        role: 'admin',
        claimsSynced,
        firestoreVerified,
        reason: 'verified',
      });
    } catch {
      res.json({
        ok: true,
        isAdmin: false,
        staffRole: null,
        reason: 'not_admin',
      });
    }
  });

  registerGatewayRoutes(app, {
    resolveRequestFirebaseTarget,
    extractBearerToken,
    verifyAdminViaFirestoreRest,
    fetchFirestoreDocWithToken,
    callUpstreamSmmV2,
    sanitizeErrorMessage,
    mapProviderStatusToInternal,
  });

  app.post('/api/orders/dispatch', async (req: Request, res: Response) => {
    const idToken = extractBearerToken(req);
    if (!idToken) {
      res.status(401).json({ ok: false, error: 'Authentication token required.' });
      return;
    }

    const orderId = typeof req.body?.orderId === 'string' ? req.body.orderId.trim() : '';
    const providerIdOverride =
      typeof req.body?.providerIdOverride === 'string' ? req.body.providerIdOverride.trim() : '';

    if (!orderId) {
      res.status(400).json({ ok: false, error: 'orderId is required.' });
      return;
    }

    const fbTarget = resolveRequestFirebaseTarget(req.body);
    let secretKey = '';
    try {
      await verifyAdminViaFirestoreRest(idToken, fbTarget);
      const orderDoc = await fetchFirestoreDocWithToken(`orders/${orderId}`, idToken, fbTarget);
      if (orderDoc.refunded) {
        res.status(400).json({ ok: false, error: 'Order was already refunded.' });
        return;
      }

      const serviceId = String(orderDoc.serviceId || '').trim();
      const serviceDoc = await fetchFirestoreDocWithToken(`services/${serviceId}`, idToken, fbTarget);

      const providerServiceId = String(serviceDoc.providerServiceId || serviceId || '').trim();
      const providerId =
        providerIdOverride ||
        String(orderDoc.providerId || '').trim() ||
        String(serviceDoc.providerId || '').trim();

      if (!providerId || !providerServiceId) {
        res.status(400).json({
          ok: false,
          error: 'Service is not mapped to an API Provider and Provider Service ID.',
        });
        return;
      }

      const providerDoc = await fetchFirestoreDocWithToken(
        `apiProviders/${providerId}`,
        idToken,
        fbTarget
      );
      if (providerDoc.status !== 'active') {
        res.status(400).json({ ok: false, error: 'Mapped API provider is currently inactive.' });
        return;
      }

      const apiUrl = String(providerDoc.apiUrl || '').trim();
      secretKey = String(providerDoc.apiKey || '').trim();
      if (!apiUrl || !secretKey) {
        res.status(400).json({ ok: false, error: 'Provider API credentials are incomplete.' });
        return;
      }

      const addRes = (await callUpstreamSmmV2(apiUrl, secretKey, {
        action: 'add',
        service: providerServiceId,
        link: String(orderDoc.link || ''),
        quantity: String(Math.floor(Number(orderDoc.quantity || 0))),
      })) as Record<string, unknown>;

      const providerOrderId = addRes.order !== undefined ? String(addRes.order) : '';
      if (!providerOrderId) {
        throw new Error('Provider did not return a valid order reference.');
      }

      res.json({
        ok: true,
        data: {
          providerId,
          providerOrderId,
        },
      });
    } catch (error) {
      const msg =
        error instanceof Error
          ? sanitizeErrorMessage(error.message, secretKey)
          : 'Unable to dispatch order to provider.';
      res.status(422).json({ ok: false, error: msg });
    }
  });

  app.post('/api/orders/sync-status', async (req: Request, res: Response) => {
    const idToken = extractBearerToken(req);
    if (!idToken) {
      res.status(401).json({ ok: false, error: 'Authentication token required.' });
      return;
    }

    const orderId = typeof req.body?.orderId === 'string' ? req.body.orderId.trim() : '';
    const forceRetry = Boolean(req.body?.forceRetry);
    if (!orderId) {
      res.status(400).json({ ok: false, error: 'orderId is required.' });
      return;
    }

    const fbTarget = resolveRequestFirebaseTarget(req.body);
    let secretKey = '';
    let currentRetryCount = 0;
    try {
      await verifyAdminViaFirestoreRest(idToken, fbTarget);
      const orderDoc = await fetchFirestoreDocWithToken(`orders/${orderId}`, idToken, fbTarget);
      const providerId = String(orderDoc.providerId || '').trim();
      const providerOrderId = String(orderDoc.providerOrderId || '').trim();
      currentRetryCount = Math.max(0, Number(orderDoc.retryCount || 0));

      if (!providerId || !providerOrderId) {
        res.status(400).json({
          ok: false,
          error: 'Order has not been dispatched to an API provider yet.',
        });
        return;
      }

      if (!forceRetry && typeof orderDoc.nextRetryAt === 'string') {
        const nextMs = Date.parse(orderDoc.nextRetryAt);
        if (Number.isFinite(nextMs) && nextMs > Date.now()) {
          res.status(429).json({
            ok: false,
            retryScheduled: true,
            retryCount: currentRetryCount,
            nextRetryAtMs: nextMs,
            error: 'Retry cooldown active to avoid overloading upstream provider.',
          });
          return;
        }
      }

      const providerDoc = await fetchFirestoreDocWithToken(
        `apiProviders/${providerId}`,
        idToken,
        fbTarget
      );
      const apiUrl = String(providerDoc.apiUrl || '').trim();
      secretKey = String(providerDoc.apiKey || '').trim();

      if (!apiUrl || !secretKey) {
        throw new Error('Provider credentials are missing or incomplete.');
      }

      const remote = (await callUpstreamSmmV2(apiUrl, secretKey, {
        action: 'status',
        order: providerOrderId,
      })) as Record<string, unknown>;

      const rawStatus = String(remote.status ?? 'Pending');
      const mappedStatus = mapProviderStatusToInternal(rawStatus);

      const parsedStart =
        remote.start_count !== undefined && Number.isFinite(Number(remote.start_count))
          ? Math.max(0, Number(remote.start_count))
          : undefined;
      const parsedRemains =
        remote.remains !== undefined && Number.isFinite(Number(remote.remains))
          ? Math.max(0, Number(remote.remains))
          : mappedStatus === 'Completed'
            ? 0
            : undefined;
      const parsedCharge =
        remote.charge !== undefined && Number.isFinite(Number(remote.charge))
          ? Math.max(0, Number(remote.charge))
          : undefined;

      res.json({
        ok: true,
        data: {
          rawStatus,
          mappedStatus,
          startCount: parsedStart,
          remains: parsedRemains,
          providerCharge: parsedCharge,
          refundEligible: mappedStatus === 'Partial',
          autoRefundRecommended: mappedStatus === 'Cancelled' || mappedStatus === 'Failed',
          lastCheckedAtMs: Date.now(),
        },
      });
    } catch (error) {
      const sanitized =
        error instanceof Error
          ? sanitizeErrorMessage(error.message, secretKey)
          : 'Provider status check failed.';
      const schedule = computeNextRetrySchedule(currentRetryCount);
      res.status(422).json({
        ok: false,
        retryScheduled: true,
        retryCount: schedule.retryCount,
        backoffMinutes: schedule.backoffMinutes,
        nextRetryAtMs: schedule.nextRetryAtMs,
        error: sanitized,
      });
    }
  });

  app.post('/api/provider/execute', async (req: Request, res: Response) => {
    const idToken = extractBearerToken(req);
    if (!idToken) {
      res.status(401).json({ ok: false, error: 'Admin authentication token required.' });
      return;
    }

    const payload = (req.body ?? {}) as ProviderProxyBody;
    const action = payload.action;
    const providerId = typeof payload.providerId === 'string' ? payload.providerId.trim() : '';
    let apiUrl = typeof payload.apiUrl === 'string' ? payload.apiUrl.trim() : '';
    let apiKey = typeof payload.apiKey === 'string' ? payload.apiKey.trim() : '';

    if (!action) {
      res.status(400).json({ ok: false, error: 'Missing provider action.' });
      return;
    }

    const fbTarget = resolveRequestFirebaseTarget(payload);

    try {
      const authUser = await lookupFirebaseAuthUser(idToken, fbTarget.apiKey);
      if (!authUser || authUser.disabled || authUser.email !== DESIGNATED_ADMIN_EMAIL) {
        res.status(403).json({ ok: false, error: 'Unauthorized: Admin privileges required.' });
        return;
      }

      if (providerId) {
        try {
          const provDoc = await fetchFirestoreDocWithToken(
            `apiProviders/${providerId}`,
            idToken,
            fbTarget
          );
          const storedUrl = String(provDoc.apiUrl || '').trim();
          const storedKey = String(provDoc.apiKey || '').trim();
          if (storedUrl) apiUrl = storedUrl;
          if (storedKey) apiKey = storedKey;
        } catch (fsErr) {
          if (!apiUrl || !apiKey) {
            throw fsErr;
          }
        }
      } else {
        try {
          await verifyAdminViaFirestoreRest(idToken, fbTarget);
        } catch (fsErr) {
          console.warn(
            '[provider/execute] Firestore RBAC probe warning:',
            fsErr instanceof Error ? fsErr.message : String(fsErr)
          );
        }
      }

      if (!apiUrl || !apiKey) {
        res.status(400).json({ ok: false, error: 'Provider API URL and API Key are required.' });
        return;
      }

      if (action === 'balance' || action === 'testConnection') {
        const balanceData = (await callUpstreamSmmV2(apiUrl, apiKey, {
          action: 'balance',
        })) as Record<string, unknown>;

        if (!balanceData || typeof balanceData !== 'object' || Array.isArray(balanceData)) {
          throw new Error('Provider balance response did not return a valid JSON object.');
        }

        const rawBalance = parseUpstreamNumber(balanceData.balance);
        const currency =
          typeof balanceData.currency === 'string' && balanceData.currency.trim()
            ? balanceData.currency.trim()
            : 'USD';

        if (!('balance' in balanceData) || !Number.isFinite(rawBalance)) {
          throw new Error('Provider balance response did not include a valid "balance" field.');
        }

        if (action === 'testConnection') {
          const rawServices = await callUpstreamSmmV2(apiUrl, apiKey, {
            action: 'services',
          });
          const serviceRows = extractServicesArray(rawServices);
          if (!serviceRows) {
            throw new Error(
              'Balance check succeeded, but provider services endpoint did not return a valid service list.'
            );
          }

          res.json({
            ok: true,
            data: {
              ok: true,
              message: `Connected (${serviceRows.length} services, Balance: ${rawBalance.toFixed(2)} ${currency})`,
              balance: rawBalance,
              currency,
              serviceCount: serviceRows.length,
            },
          });
          return;
        }

        res.json({
          ok: true,
          data: {
            balance: rawBalance,
            currency,
          },
        });
        return;
      }

      if (action === 'services') {
        const rawServices = await callUpstreamSmmV2(apiUrl, apiKey, {
          action: 'services',
        });
        const serviceRows = extractServicesArray(rawServices);

        if (!serviceRows) {
          throw new Error('Provider services endpoint did not return a valid service list array.');
        }

        res.json({
          ok: true,
          data: serviceRows,
        });
        return;
      }

      if (action === 'add') {
        const service = typeof payload.service === 'string' ? payload.service.trim() : '';
        const link = typeof payload.link === 'string' ? payload.link.trim() : '';
        const quantity = Math.floor(Number(payload.quantity ?? 0));

        if (!service || !link || !Number.isFinite(quantity) || quantity < 1) {
          res.status(400).json({
            ok: false,
            error: 'Valid service ID, link, and positive quantity are required.',
          });
          return;
        }

        const addRes = (await callUpstreamSmmV2(apiUrl, apiKey, {
          action: 'add',
          service,
          link,
          quantity: String(quantity),
        })) as Record<string, unknown>;

        res.json({
          ok: true,
          data: {
            order: addRes.order !== undefined ? String(addRes.order) : '',
          },
        });
        return;
      }

      if (action === 'status') {
        const order = typeof payload.order === 'string' ? payload.order.trim() : '';
        if (!order) {
          res.status(400).json({ ok: false, error: 'Provider order ID is required.' });
          return;
        }

        const statusRes = (await callUpstreamSmmV2(apiUrl, apiKey, {
          action: 'status',
          order,
        })) as Record<string, unknown>;

        res.json({
          ok: true,
          data: statusRes,
        });
        return;
      }

      res.status(400).json({ ok: false, error: 'Unsupported provider action.' });
    } catch (error) {
      const msg =
        error instanceof Error
          ? sanitizeErrorMessage(error.message, apiKey)
          : 'Provider request failed.';
      res.status(422).json({
        ok: false,
        error: msg,
      });
    }
  });

  app.use('/api', (_req: Request, res: Response) => {
    res.status(404).json({ ok: false, error: 'API endpoint not found.' });
  });

  app.use('/api', (err: unknown, _req: Request, res: Response, _next: express.NextFunction) => {
    const message = normalizeServerErrorText(err, 'Internal API server error.');
    res.status(500).json({ ok: false, error: message });
  });

  return app;
}
