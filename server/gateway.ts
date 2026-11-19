import crypto from 'node:crypto';
import fs from 'node:fs';
import type { Express, Request, Response } from 'express';

export interface FirebaseTarget {
  projectId: string;
  databaseId: string;
}

export interface GatewayDeps {
  resolveRequestFirebaseTarget: (body: unknown) => FirebaseTarget;
  extractBearerToken: (req: Request) => string;
  verifyAdminViaFirestoreRest: (idToken: string, target: FirebaseTarget) => Promise<void>;
  fetchFirestoreDocWithToken: (
    docPath: string,
    idToken: string,
    targetOverride?: FirebaseTarget
  ) => Promise<Record<string, unknown>>;
  callUpstreamSmmV2: (
    apiUrl: string,
    apiKey: string,
    params: Record<string, string>
  ) => Promise<unknown>;
  sanitizeErrorMessage: (message: string, secretKey: string) => string;
  mapProviderStatusToInternal: (
    rawStatus: string
  ) => 'Pending' | 'Processing' | 'In Progress' | 'Completed' | 'Partial' | 'Cancelled' | 'Failed';
}

interface ServiceAccountCreds {
  client_email: string;
  private_key: string;
  token_uri?: string;
}

interface TokenCache {
  accessToken: string;
  expiresAtMs: number;
}

interface RateBucket {
  count: number;
  resetAtMs: number;
}

let cachedServiceToken: TokenCache | null = null;
const rateLimitBuckets = new Map<string, RateBucket>();

function loadServiceAccountCreds(): ServiceAccountCreds | null {
  try {
    const rawInline = (
      process.env.FIREBASE_SERVICE_ACCOUNT_JSON ||
      process.env.FIREBASE_SERVICE_ACCOUNT ||
      ''
    ).trim();
    if (rawInline) {
      const parsed = JSON.parse(rawInline) as Partial<ServiceAccountCreds>;
      if (parsed.client_email && parsed.private_key) {
        return {
          client_email: parsed.client_email,
          private_key: parsed.private_key.replace(/\\n/g, '\n'),
          token_uri: parsed.token_uri || 'https://oauth2.googleapis.com/token',
        };
      }
    }

    const credPath = (process.env.GOOGLE_APPLICATION_CREDENTIALS || '').trim();
    if (credPath && fs.existsSync(credPath)) {
      const parsed = JSON.parse(fs.readFileSync(credPath, 'utf8')) as Partial<ServiceAccountCreds>;
      if (parsed.client_email && parsed.private_key) {
        return {
          client_email: parsed.client_email,
          private_key: parsed.private_key.replace(/\\n/g, '\n'),
          token_uri: parsed.token_uri || 'https://oauth2.googleapis.com/token',
        };
      }
    }
  } catch {
    // Ignore malformed credentials
  }
  return null;
}

export function hasServiceAccountConfigured(): boolean {
  return loadServiceAccountCreds() !== null;
}

async function fetchMetadataServerAccessToken(): Promise<TokenCache | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 1200);
  try {
    const res = await fetch(
      'http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token',
      {
        method: 'GET',
        headers: { 'Metadata-Flavor': 'Google' },
        signal: controller.signal,
      }
    );
    if (!res.ok) return null;
    const json = (await res.json()) as { access_token?: string; expires_in?: number };
    if (!json.access_token) return null;
    return {
      accessToken: json.access_token,
      expiresAtMs: Date.now() + Math.max(300, Number(json.expires_in || 3600)) * 1000,
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function getGatewayBackendAuthStatus(target: FirebaseTarget): Promise<{
  backendAuthConfigured: boolean;
  authMode: 'service_account' | 'adc_metadata' | 'none';
}> {
  if (hasServiceAccountConfigured()) {
    return { backendAuthConfigured: true, authMode: 'service_account' };
  }
  const metaToken = await fetchMetadataServerAccessToken();
  if (metaToken) {
    try {
      await getDocRawWithToken(target, metaToken.accessToken, 'settings/apiGateway');
      cachedServiceToken = metaToken;
      return { backendAuthConfigured: true, authMode: 'adc_metadata' };
    } catch {
      // Metadata server token lacks Datastore IAM permission on target Firebase project
    }
  }
  return { backendAuthConfigured: false, authMode: 'none' };
}

async function getServiceAccountAccessToken(target: FirebaseTarget): Promise<string> {
  if (cachedServiceToken && cachedServiceToken.expiresAtMs > Date.now() + 60_000) {
    return cachedServiceToken.accessToken;
  }

  const creds = loadServiceAccountCreds();
  if (!creds) {
    const metaToken = await fetchMetadataServerAccessToken();
    if (metaToken) {
      try {
        await getDocRawWithToken(target, metaToken.accessToken, 'settings/apiGateway');
        cachedServiceToken = metaToken;
        return metaToken.accessToken;
      } catch {
        // Metadata server token does not authorize target Firebase project Firestore
      }
    }
    throw new Error('Gateway backend Firebase credentials are not configured on the host.');
  }

  const nowSec = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
  const tokenUri = creds.token_uri || 'https://oauth2.googleapis.com/token';
  const claimSet = Buffer.from(
    JSON.stringify({
      iss: creds.client_email,
      scope: 'https://www.googleapis.com/auth/datastore',
      aud: tokenUri,
      iat: nowSec,
      exp: nowSec + 3600,
    })
  ).toString('base64url');

  const signingInput = `${header}.${claimSet}`;
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(signingInput);
  signer.end();
  const signature = signer.sign(creds.private_key, 'base64url');
  const assertion = `${signingInput}.${signature}`;

  const tokenRes = await fetch(tokenUri, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }).toString(),
  });

  if (!tokenRes.ok) {
    throw new Error(`Service account OAuth token exchange failed (${tokenRes.status}).`);
  }

  const tokenJson = (await tokenRes.json()) as { access_token?: string; expires_in?: number };
  if (!tokenJson.access_token) {
    throw new Error('Service account OAuth response did not include an access_token.');
  }

  cachedServiceToken = {
    accessToken: tokenJson.access_token,
    expiresAtMs: Date.now() + Math.max(300, Number(tokenJson.expires_in || 3600)) * 1000,
  };
  return cachedServiceToken.accessToken;
}

export function generateRawApiKey(): {
  rawKey: string;
  keyPrefix: string;
  keyLast4: string;
} {
  const keyPrefix = 'rjw_live_';
  const tokenBody = crypto.randomBytes(18).toString('hex');
  const rawKey = `${keyPrefix}${tokenBody}`;
  return {
    rawKey,
    keyPrefix,
    keyLast4: rawKey.slice(-4),
  };
}

export function hashApiKey(rawKey: string): string {
  return crypto.createHash('sha256').update(rawKey.trim()).digest('hex');
}

function checkRateLimit(bucketKey: string, limitPerMinute: number): {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
} {
  const now = Date.now();
  const limit = Math.max(1, Math.min(10000, Math.floor(limitPerMinute || 60)));
  const existing = rateLimitBuckets.get(bucketKey);

  if (!existing || existing.resetAtMs <= now) {
    rateLimitBuckets.set(bucketKey, { count: 1, resetAtMs: now + 60_000 });
    return { allowed: true, remaining: limit - 1, retryAfterSeconds: 0 };
  }

  if (existing.count >= limit) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAtMs - now) / 1000)),
    };
  }

  existing.count += 1;
  return {
    allowed: true,
    remaining: Math.max(0, limit - existing.count),
    retryAfterSeconds: 0,
  };
}

function firestoreBaseUrl(target: FirebaseTarget): string {
  return `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(
    target.projectId
  )}/databases/${encodeURIComponent(target.databaseId)}/documents`;
}

function encodeFsValue(val: unknown): Record<string, unknown> {
  if (val === null || val === undefined) return { nullValue: null };
  if (typeof val === 'boolean') return { booleanValue: val };
  if (typeof val === 'number') {
    if (Number.isInteger(val)) return { integerValue: String(val) };
    return { doubleValue: val };
  }
  if (typeof val === 'string') return { stringValue: val };
  if (val instanceof Date) return { timestampValue: val.toISOString() };
  if (Array.isArray(val)) {
    return {
      arrayValue: {
        values: val.map((item) => encodeFsValue(item)),
      },
    };
  }
  if (typeof val === 'object') {
    const fields: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
      if (v !== undefined) fields[k] = encodeFsValue(v);
    }
    return { mapValue: { fields } };
  }
  return { stringValue: String(val) };
}

function encodeFsFields(obj: Record<string, unknown>): Record<string, unknown> {
  const fields: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) {
      fields[k] = encodeFsValue(v);
    }
  }
  return fields;
}

function decodeFsValue(raw: Record<string, unknown> | undefined): unknown {
  if (!raw || typeof raw !== 'object') return undefined;
  if ('stringValue' in raw) return String(raw.stringValue);
  if ('integerValue' in raw) return Number(raw.integerValue);
  if ('doubleValue' in raw) return Number(raw.doubleValue);
  if ('booleanValue' in raw) return Boolean(raw.booleanValue);
  if ('timestampValue' in raw) return String(raw.timestampValue);
  if ('nullValue' in raw) return null;
  if ('arrayValue' in raw) {
    const arr = raw.arrayValue as { values?: Array<Record<string, unknown>> } | undefined;
    return (arr?.values ?? []).map((item) => decodeFsValue(item));
  }
  if ('mapValue' in raw) {
    const mp = raw.mapValue as { fields?: Record<string, Record<string, unknown>> } | undefined;
    return decodeFsDocFields(mp?.fields);
  }
  return undefined;
}

function decodeFsDocFields(
  fields?: Record<string, Record<string, unknown>>
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (!fields) return out;
  for (const [k, v] of Object.entries(fields)) {
    out[k] = decodeFsValue(v);
  }
  return out;
}

function encodeServerTimestampCommit(
  docPath: string,
  target: FirebaseTarget,
  data: Record<string, unknown>,
  timestampFields: string[]
) {
  const fullDocName = `projects/${target.projectId}/databases/${target.databaseId}/documents/${docPath}`;
  return {
    writes: [
      {
        update: {
          name: fullDocName,
          fields: encodeFsFields(data),
        },
        updateTransforms: timestampFields.map((fieldPath) => ({
          fieldPath,
          setToServerValue: 'REQUEST_TIME',
        })),
      },
    ],
  };
}

async function commitDocWithBearer(
  target: FirebaseTarget,
  bearerToken: string,
  docPath: string,
  data: Record<string, unknown>,
  timestampFields: string[]
): Promise<void> {
  const url = `${firestoreBaseUrl(target)}:commit`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${bearerToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(encodeServerTimestampCommit(docPath, target, data, timestampFields)),
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    if (res.status === 401 || res.status === 403) {
      throw new Error('Unauthorized: Permission denied while storing gateway credential.');
    }
    throw new Error(`Firestore write failed (${res.status}): ${txt.slice(0, 160)}`);
  }
}

async function runQueryWithToken(
  target: FirebaseTarget,
  accessToken: string,
  collectionId: string,
  whereField?: { field: string; value: unknown },
  queryLimit = 100
): Promise<Array<{ id: string; data: Record<string, unknown>; updateTime?: string }>> {
  const url = `${firestoreBaseUrl(target)}:runQuery`;
  const structuredQuery: Record<string, unknown> = {
    from: [{ collectionId }],
    limit: queryLimit,
  };
  if (whereField) {
    structuredQuery.where = {
      fieldFilter: {
        field: { fieldPath: whereField.field },
        op: 'EQUAL',
        value: encodeFsValue(whereField.value),
      },
    };
  }
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ structuredQuery }),
  });

  if (!res.ok) {
    throw new Error(`Firestore query failed (${res.status}).`);
  }

  const rows = (await res.json()) as Array<{
    document?: { name: string; fields?: Record<string, Record<string, unknown>>; updateTime?: string };
  }>;

  const out: Array<{ id: string; data: Record<string, unknown>; updateTime?: string }> = [];
  for (const row of rows) {
    if (!row.document) continue;
    const id = row.document.name.split('/').pop() || '';
    out.push({
      id,
      data: decodeFsDocFields(row.document.fields),
      updateTime: row.document.updateTime,
    });
  }
  return out;
}

async function getDocRawWithToken(
  target: FirebaseTarget,
  accessToken: string,
  docPath: string
): Promise<{ exists: boolean; data: Record<string, unknown>; updateTime?: string }> {
  const url = `${firestoreBaseUrl(target)}/${docPath}`;
  const res = await fetch(url, {
    method: 'GET',
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (res.status === 404) {
    return { exists: false, data: {} };
  }
  if (!res.ok) {
    throw new Error(`Unable to load ${docPath} (${res.status}).`);
  }
  const json = (await res.json()) as {
    fields?: Record<string, Record<string, unknown>>;
    updateTime?: string;
  };
  return {
    exists: true,
    data: decodeFsDocFields(json.fields),
    updateTime: json.updateTime,
  };
}

function verifyFirebaseUidFromJwt(idToken: string): string {
  try {
    const parts = idToken.split('.');
    if (parts.length !== 3) return '';
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8')) as {
      user_id?: string;
      sub?: string;
    };
    return String(payload.user_id || payload.sub || '').trim();
  } catch {
    return '';
  }
}

async function writeGatewayRequestLog(
  target: FirebaseTarget,
  accessToken: string,
  log: {
    customerId?: string;
    userId?: string;
    keyId?: string;
    installationId?: string;
    action: string;
    httpStatus: number;
    success: boolean;
    latencyMs: number;
    ipAddress: string;
    idempotencyKey?: string;
    errorMessage?: string;
  }
): Promise<void> {
  const logId = `apilog-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
  await commitDocWithBearer(
    target,
    accessToken,
    `apiRequestLogs/${logId}`,
    {
      id: logId,
      ...(log.customerId ? { customerId: log.customerId } : {}),
      ...(log.userId ? { userId: log.userId } : {}),
      ...(log.keyId ? { keyId: log.keyId } : {}),
      ...(log.installationId ? { installationId: log.installationId } : {}),
      action: log.action.slice(0, 40) || 'unknown',
      httpStatus: log.httpStatus,
      success: log.success,
      latencyMs: Math.max(0, Math.round(log.latencyMs)),
      ipAddress: log.ipAddress.slice(0, 64),
      ...(log.idempotencyKey ? { idempotencyKey: log.idempotencyKey.slice(0, 128) } : {}),
      ...(log.errorMessage ? { errorMessage: log.errorMessage.slice(0, 300) } : {}),
    },
    ['createdAt']
  ).catch(() => undefined);
}

export function registerGatewayRoutes(app: Express, deps: GatewayDeps): void {
  const syncResellerOrderFromUpstream = async (
    fbTarget: FirebaseTarget,
    accessToken: string,
    apiOrderId: string,
    apiOrderData: Record<string, unknown>,
    internalOrderId: string,
    internalOrderData: Record<string, unknown>
  ): Promise<Record<string, unknown>> => {
    const currentStatus = String(internalOrderData.status || apiOrderData.status || 'Pending');
    const isNonTerminal = ['Pending', 'Processing', 'In Progress'].includes(currentStatus);
    const providerId = String(internalOrderData.providerId || '').trim();
    const providerOrderId = String(internalOrderData.providerOrderId || '').trim();

    if (!isNonTerminal || !providerId || !providerOrderId) {
      return internalOrderData;
    }

    try {
      const provSnap = await getDocRawWithToken(
        fbTarget,
        accessToken,
        `apiProviders/${providerId}`
      );
      if (!provSnap.exists || provSnap.data.status !== 'active') {
        return internalOrderData;
      }
      const provUrl = String(provSnap.data.apiUrl || '').trim();
      const provKey = String(provSnap.data.apiKey || '').trim();
      if (!provUrl || !provKey) {
        return internalOrderData;
      }

      const remote = (await deps.callUpstreamSmmV2(provUrl, provKey, {
        action: 'status',
        order: providerOrderId,
      })) as Record<string, unknown>;

      const mappedStatus = deps.mapProviderStatusToInternal(String(remote.status ?? currentStatus));
      const nextStartCount =
        remote.start_count !== undefined && Number.isFinite(Number(remote.start_count))
          ? Math.max(0, Number(remote.start_count))
          : Number(internalOrderData.startCount ?? 0);
      const nextRemains =
        remote.remains !== undefined && Number.isFinite(Number(remote.remains))
          ? Math.max(0, Number(remote.remains))
          : mappedStatus === 'Completed'
            ? 0
            : Number(internalOrderData.remains ?? apiOrderData.quantity ?? 0);

      const fullDbPrefix = `projects/${fbTarget.projectId}/databases/${fbTarget.databaseId}/documents`;
      await fetch(`${firestoreBaseUrl(fbTarget)}:commit`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          writes: [
            {
              update: {
                name: `${fullDbPrefix}/orders/${internalOrderId}`,
                fields: encodeFsFields({
                  status: mappedStatus,
                  startCount: nextStartCount,
                  remains: nextRemains,
                }),
              },
              updateMask: { fieldPaths: ['status', 'startCount', 'remains'] },
              updateTransforms: [
                { fieldPath: 'lastCheckedAt', setToServerValue: 'REQUEST_TIME' },
                { fieldPath: 'updatedAt', setToServerValue: 'REQUEST_TIME' },
              ],
            },
            {
              update: {
                name: `${fullDbPrefix}/apiOrders/${apiOrderId}`,
                fields: encodeFsFields({
                  status: mappedStatus,
                  startCount: nextStartCount,
                  remains: nextRemains,
                }),
              },
              updateMask: { fieldPaths: ['status', 'startCount', 'remains'] },
              updateTransforms: [{ fieldPath: 'updatedAt', setToServerValue: 'REQUEST_TIME' }],
            },
          ],
        }),
      }).catch(() => undefined);

      return {
        ...internalOrderData,
        status: mappedStatus,
        startCount: nextStartCount,
        remains: nextRemains,
      };
    } catch {
      return internalOrderData;
    }
  };

  /**
   * Admin-only diagnostic check for Gateway Server Readiness.
   */
  app.get('/api/gateway/server-status', async (req: Request, res: Response) => {
    const idToken = deps.extractBearerToken(req);
    if (!idToken) {
      res.status(401).json({ ok: false, error: 'Admin authentication required.' });
      return;
    }
    try {
      const target = deps.resolveRequestFirebaseTarget({});
      await deps.verifyAdminViaFirestoreRest(idToken, target);
      const authStatus = await getGatewayBackendAuthStatus(target);
      res.json({
        ok: true,
        data: {
          backendAuthConfigured: authStatus.backendAuthConfigured,
          authMode: authStatus.authMode,
        },
      });
    } catch (err) {
      res.status(403).json({
        ok: false,
        error: err instanceof Error ? err.message : 'Admin verification failed.',
      });
    }
  });

  /**
   * Generates a new hashed API key and returns plaintext ONCE.
   * Writes to Firestore via caller's Firebase Bearer token so Firestore Security Rules
   * strictly enforce Admin or active-owner authorization.
   */
  app.post('/api/gateway/keys/generate', async (req: Request, res: Response) => {
    const idToken = deps.extractBearerToken(req);
    if (!idToken) {
      res.status(401).json({ ok: false, error: 'Authentication required.' });
      return;
    }

    const body = (req.body ?? {}) as Record<string, unknown>;
    const customerId = typeof body.customerId === 'string' ? body.customerId.trim() : '';
    const label =
      typeof body.label === 'string' && body.label.trim()
        ? body.label.trim().slice(0, 80)
        : 'Default API Key';
    const requestedPerms = Array.isArray(body.permissions)
      ? body.permissions.filter((p): p is string =>
          ['balance', 'services', 'add', 'status'].includes(String(p))
        )
      : ['balance', 'services', 'add', 'status'];
    const permissions =
      requestedPerms.length > 0 ? requestedPerms : ['balance', 'services', 'add', 'status'];
    const rateLimitPerMinute = Math.max(
      1,
      Math.min(10000, Math.floor(Number(body.rateLimitPerMinute || 60)))
    );

    if (!customerId || !/^[a-zA-Z0-9_-]{1,64}$/.test(customerId)) {
      res.status(400).json({ ok: false, error: 'Valid customerId is required.' });
      return;
    }

    const fbTarget = deps.resolveRequestFirebaseTarget(body);
    try {
      const customerDoc = await deps.fetchFirestoreDocWithToken(
        `apiCustomers/${customerId}`,
        idToken,
        fbTarget
      );
      if (customerDoc.status !== 'active') {
        res.status(403).json({
          ok: false,
          error: 'API Customer account must be active before generating API keys.',
        });
        return;
      }

      const actorUid = verifyFirebaseUidFromJwt(idToken);
      const { rawKey, keyPrefix, keyLast4 } = generateRawApiKey();
      const keyHash = hashApiKey(rawKey);
      const keyId = `key-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;

      await commitDocWithBearer(
        fbTarget,
        idToken,
        `apiKeys/${keyId}`,
        {
          id: keyId,
          customerId,
          userId: String(customerDoc.userId || actorUid || ''),
          installationId: String(customerDoc.installationId || ''),
          label,
          keyPrefix,
          keyLast4,
          keyHash,
          permissions,
          rateLimitPerMinute,
          status: 'active',
          requestCount: 0,
          createdBy: actorUid || 'system',
        },
        ['createdAt', 'updatedAt']
      );

      res.json({
        ok: true,
        data: {
          keyId,
          customerId,
          label,
          keyPrefix,
          keyLast4,
          plaintextKeyOnce: rawKey,
        },
      });
    } catch (err) {
      res.status(403).json({
        ok: false,
        error: err instanceof Error ? err.message : 'Unable to generate API key.',
      });
    }
  });

  /**
   * Regenerates an existing API key: revokes old key and creates a new hashed key,
   * returning the new plaintext key ONCE.
   */
  app.post('/api/gateway/keys/regenerate', async (req: Request, res: Response) => {
    const idToken = deps.extractBearerToken(req);
    if (!idToken) {
      res.status(401).json({ ok: false, error: 'Authentication required.' });
      return;
    }

    const body = (req.body ?? {}) as Record<string, unknown>;
    const keyId = typeof body.keyId === 'string' ? body.keyId.trim() : '';
    if (!keyId || !/^[a-zA-Z0-9_-]{1,64}$/.test(keyId)) {
      res.status(400).json({ ok: false, error: 'Valid keyId is required.' });
      return;
    }

    const fbTarget = deps.resolveRequestFirebaseTarget(body);
    try {
      const existingKey = await deps.fetchFirestoreDocWithToken(
        `apiKeys/${keyId}`,
        idToken,
        fbTarget
      );
      const customerId = String(existingKey.customerId || '').trim();
      const customerDoc = await deps.fetchFirestoreDocWithToken(
        `apiCustomers/${customerId}`,
        idToken,
        fbTarget
      );
      if (customerDoc.status !== 'active') {
        res.status(403).json({ ok: false, error: 'API Customer is not active.' });
        return;
      }

      const actorUid = verifyFirebaseUidFromJwt(idToken);
      const { rawKey, keyPrefix, keyLast4 } = generateRawApiKey();
      const keyHash = hashApiKey(rawKey);
      const newKeyId = `key-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;

      // 1. Create replacement active key
      await commitDocWithBearer(
        fbTarget,
        idToken,
        `apiKeys/${newKeyId}`,
        {
          id: newKeyId,
          customerId,
          userId: String(existingKey.userId || customerDoc.userId || actorUid || ''),
          installationId: String(existingKey.installationId || customerDoc.installationId || ''),
          label: String(existingKey.label || 'Regenerated Key'),
          keyPrefix,
          keyLast4,
          keyHash,
          permissions: Array.isArray(existingKey.permissions)
            ? existingKey.permissions
            : ['balance', 'services', 'add', 'status'],
          rateLimitPerMinute: Number(existingKey.rateLimitPerMinute || 60),
          status: 'active',
          requestCount: 0,
          createdBy: actorUid || 'system',
        },
        ['createdAt', 'updatedAt']
      );

      // 2. Revoke old key cleanly (patch status + updatedAt)
      const revokeRes = await fetch(
        `${firestoreBaseUrl(fbTarget)}/apiKeys/${encodeURIComponent(
          keyId
        )}?updateMask.fieldPaths=status&updateMask.fieldPaths=updatedAt`,
        {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${idToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            fields: encodeFsFields({
              status: 'revoked',
              updatedAt: new Date(),
            }),
          }),
        }
      );

      if (!revokeRes.ok) {
        // Note: rules require request.time for updatedAt; fallback via :commit updateTransform
        await fetch(`${firestoreBaseUrl(fbTarget)}:commit`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${idToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            writes: [
              {
                update: {
                  name: `projects/${fbTarget.projectId}/databases/${fbTarget.databaseId}/documents/apiKeys/${keyId}`,
                  fields: encodeFsFields({ status: 'revoked' }),
                },
                updateMask: { fieldPaths: ['status'] },
                updateTransforms: [{ fieldPath: 'updatedAt', setToServerValue: 'REQUEST_TIME' }],
              },
            ],
          }),
        });
      }

      res.json({
        ok: true,
        data: {
          keyId: newKeyId,
          revokedKeyId: keyId,
          customerId,
          label: String(existingKey.label || 'Regenerated Key'),
          keyPrefix,
          keyLast4,
          plaintextKeyOnce: rawKey,
        },
      });
    } catch (err) {
      res.status(403).json({
        ok: false,
        error: err instanceof Error ? err.message : 'Unable to regenerate API key.',
      });
    }
  });

  /**
   * Standard SMM Panel Public API v2 Gateway Endpoint:
   * External Website -> Supartha Panel API Gateway -> Internal Order Engine -> Upstream Provider
   * Supports: balance, services, add, status (single & comma-separated multi-order).
   */
  const handlePublicApiV2 = async (req: Request, res: Response) => {
    const startedAt = Date.now();
    const ipAddress =
      (typeof req.headers['x-forwarded-for'] === 'string'
        ? req.headers['x-forwarded-for'].split(',')[0]
        : req.socket.remoteAddress) || 'unknown';

    const params: Record<string, string> = {};
    const mergeSource = (src: unknown) => {
      if (!src || typeof src !== 'object') return;
      for (const [k, v] of Object.entries(src as Record<string, unknown>)) {
        if (v !== undefined && v !== null) {
          params[k] = String(v);
        }
      }
    };
    mergeSource(req.query);
    mergeSource(req.body);

    const rawKey = (params.key || '').trim();
    const action = (params.action || '').trim().toLowerCase();
    const idempotencyKey = (
      String(req.headers['idempotency-key'] || params.idempotency_key || '')
    ).trim();

    // Global per-IP DDoS/flood safety limit before DB calls
    const ipLimit = checkRateLimit(`ip:${ipAddress}`, 120);
    if (!ipLimit.allowed) {
      res.setHeader('Retry-After', String(ipLimit.retryAfterSeconds));
      res.status(429).json({ error: 'Rate limit exceeded. Please slow down requests.' });
      return;
    }

    if (!rawKey) {
      res.status(401).json({ error: 'API key is required.' });
      return;
    }
    if (!['balance', 'services', 'add', 'status'].includes(action)) {
      res.status(400).json({
        error: 'Invalid or missing action. Supported actions: balance, services, add, status.',
      });
      return;
    }

    const fbTarget = deps.resolveRequestFirebaseTarget({});
    let accessToken = '';
    try {
      accessToken = await getServiceAccountAccessToken(fbTarget);
    } catch {
      res.status(503).json({
        error:
          'Reseller API Gateway backend credentials are not available on this host. Configure Application Default Credentials or FIREBASE_SERVICE_ACCOUNT_JSON.',
        code: 'GATEWAY_BACKEND_CREDENTIALS_REQUIRED',
      });
      return;
    }

    let matchedCustomerId = '';
    let matchedUserId = '';
    let matchedKeyId = '';
    let matchedInstallationId = '';

    const failAndLog = async (status: number, message: string) => {
      if (accessToken) {
        await writeGatewayRequestLog(fbTarget, accessToken, {
          customerId: matchedCustomerId || undefined,
          userId: matchedUserId || undefined,
          keyId: matchedKeyId || undefined,
          installationId: matchedInstallationId || undefined,
          action,
          httpStatus: status,
          success: false,
          latencyMs: Date.now() - startedAt,
          ipAddress,
          idempotencyKey: idempotencyKey || undefined,
          errorMessage: deps.sanitizeErrorMessage(message, rawKey),
        });
      }
      res.status(status).json({ error: deps.sanitizeErrorMessage(message, rawKey) });
    };

    try {

      // 0. Check global gateway toggle & settings
      const gwSettingsSnap = await getDocRawWithToken(fbTarget, accessToken, 'settings/apiGateway');
      const gwSettings = gwSettingsSnap.exists ? gwSettingsSnap.data : {};
      if (gwSettingsSnap.exists && gwSettings.gatewayEnabled === false) {
        await failAndLog(503, 'API Gateway is temporarily disabled by administrator.');
        return;
      }

      // 1. Verify hashed API key
      const keyHash = hashApiKey(rawKey);
      const keyMatches = await runQueryWithToken(
        fbTarget,
        accessToken,
        'apiKeys',
        { field: 'keyHash', value: keyHash },
        1
      );
      if (keyMatches.length === 0) {
        await failAndLog(401, 'Invalid API key.');
        return;
      }

      const keyDoc = keyMatches[0].data;
      matchedKeyId = keyMatches[0].id;
      matchedCustomerId = String(keyDoc.customerId || '').trim();
      matchedUserId = String(keyDoc.userId || '').trim();
      matchedInstallationId = String(keyDoc.installationId || '').trim();

      if (keyDoc.status !== 'active') {
        await failAndLog(403, `API key is currently ${String(keyDoc.status || 'disabled')}.`);
        return;
      }

      const perms = Array.isArray(keyDoc.permissions)
        ? keyDoc.permissions.map((p) => String(p))
        : [];
      if (!perms.includes(action)) {
        await failAndLog(403, `API key does not have "${action}" permission.`);
        return;
      }

      // 2. Verify active API customer & installation status
      const customerSnap = await getDocRawWithToken(
        fbTarget,
        accessToken,
        `apiCustomers/${matchedCustomerId}`
      );
      if (!customerSnap.exists) {
        await failAndLog(403, 'API Customer profile not found.');
        return;
      }
      const customerDoc = customerSnap.data;
      if (customerDoc.status !== 'active') {
        await failAndLog(403, `API Customer account is ${String(customerDoc.status)}.`);
        return;
      }
      matchedUserId = String(customerDoc.userId || matchedUserId || '').trim();
      matchedInstallationId = String(customerDoc.installationId || matchedInstallationId || '').trim();

      if (matchedInstallationId) {
        const instSnap = await getDocRawWithToken(
          fbTarget,
          accessToken,
          `websiteInstallations/${matchedInstallationId}`
        );
        if (instSnap.exists && instSnap.data.status !== 'active') {
          await failAndLog(
            403,
            `Website installation (${matchedInstallationId}) is ${String(instSnap.data.status)}.`
          );
          return;
        }
      }

      // 3. Enforce per-key / per-customer rate limit
      const rpm = Math.min(
        Number(keyDoc.rateLimitPerMinute || 60),
        Number(customerDoc.rateLimitPerMinute || 60)
      );
      const keyLimit = checkRateLimit(`key:${matchedKeyId}`, rpm);
      if (!keyLimit.allowed) {
        res.setHeader('Retry-After', String(keyLimit.retryAfterSeconds));
        await failAndLog(429, `Rate limit exceeded (${rpm} requests/minute).`);
        return;
      }

      const sysSnap = await getDocRawWithToken(fbTarget, accessToken, 'settings/system');
      const currency = String(sysSnap.data.currency || 'BDT').trim() || 'BDT';

      // ACTION: BALANCE
      if (action === 'balance') {
        const balance = Number(customerDoc.apiBalance ?? 0);
        await writeGatewayRequestLog(fbTarget, accessToken, {
          customerId: matchedCustomerId,
          userId: matchedUserId || undefined,
          keyId: matchedKeyId,
          installationId: matchedInstallationId || undefined,
          action,
          httpStatus: 200,
          success: true,
          latencyMs: Date.now() - startedAt,
          ipAddress,
        });
        res.json({
          balance: balance.toFixed(2),
          currency,
        });
        return;
      }

      // ACTION: SERVICES
      if (action === 'services') {
        const rawServices = await runQueryWithToken(
          fbTarget,
          accessToken,
          'services',
          { field: 'status', value: 'active' },
          500
        );
        const discountPct = Math.max(
          0,
          Math.min(90, Number(customerDoc.customDiscountPercent || 0))
        );
        const multiplier = 1 - discountPct / 100;

        // Public catalog formatted cleanly without exposing upstream providerId or costPrice
        const catalog = rawServices.map((item) => {
          const s = item.data;
          const baseRate = Number(s.sellingPrice ?? 0);
          const customerRate = Number((baseRate * multiplier).toFixed(2));
          return {
            service: item.id,
            name: String(s.name || ''),
            type: String(s.serviceType || 'Default'),
            category: String(s.categoryId || 'general'),
            rate: customerRate.toFixed(2),
            min: String(Math.max(1, Number(s.minQuantity ?? 10))),
            max: String(Math.max(1, Number(s.maxQuantity ?? 10000))),
            refill: Boolean(s.refillGuaranteed),
            dripfeed: false,
            cancel: false,
          };
        });

        await writeGatewayRequestLog(fbTarget, accessToken, {
          customerId: matchedCustomerId,
          userId: matchedUserId || undefined,
          keyId: matchedKeyId,
          installationId: matchedInstallationId || undefined,
          action,
          httpStatus: 200,
          success: true,
          latencyMs: Date.now() - startedAt,
          ipAddress,
        });
        res.json(catalog);
        return;
      }

      // ACTION: STATUS (single `order` or bulk comma-separated `orders`)
      if (action === 'status') {
        const singleOrder = (params.order || '').trim();
        const bulkOrdersRaw = (params.orders || '').trim();

        if (!singleOrder && !bulkOrdersRaw) {
          await failAndLog(400, 'Parameter "order" or "orders" is required.');
          return;
        }

        if (singleOrder) {
          const apiOrdSnap = await getDocRawWithToken(
            fbTarget,
            accessToken,
            `apiOrders/${singleOrder}`
          );
          if (!apiOrdSnap.exists || apiOrdSnap.data.customerId !== matchedCustomerId) {
            await failAndLog(404, 'Incorrect order ID.');
            return;
          }
          // Sync latest safe status from internal orders doc + live upstream provider if active
          const internalOrdId = String(apiOrdSnap.data.internalOrderId || singleOrder);
          const intOrdSnap = await getDocRawWithToken(
            fbTarget,
            accessToken,
            `orders/${internalOrdId}`
          );
          const effective = await syncResellerOrderFromUpstream(
            fbTarget,
            accessToken,
            singleOrder,
            apiOrdSnap.data,
            internalOrdId,
            intOrdSnap.exists ? intOrdSnap.data : apiOrdSnap.data
          );

          await writeGatewayRequestLog(fbTarget, accessToken, {
            customerId: matchedCustomerId,
            userId: matchedUserId || undefined,
            keyId: matchedKeyId,
            installationId: matchedInstallationId || undefined,
            action,
            httpStatus: 200,
            success: true,
            latencyMs: Date.now() - startedAt,
            ipAddress,
          });
          res.json({
            charge: Number(apiOrdSnap.data.charge ?? 0).toFixed(2),
            start_count: String(Number(effective.startCount ?? 0)),
            status: String(effective.status ?? 'Pending'),
            remains: String(Number(effective.remains ?? apiOrdSnap.data.quantity ?? 0)),
            currency,
          });
          return;
        }

        const maxBulk = Math.max(1, Math.min(500, Number(gwSettings.maxBulkStatusIds || 100)));
        const ids = bulkOrdersRaw
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
          .slice(0, maxBulk);

        const bulkResult: Record<string, unknown> = {};
        for (const oid of ids) {
          if (!/^[a-zA-Z0-9_-]{1,64}$/.test(oid)) {
            bulkResult[oid] = { error: 'Incorrect order ID' };
            continue;
          }
          const apiOrdSnap = await getDocRawWithToken(fbTarget, accessToken, `apiOrders/${oid}`);
          if (!apiOrdSnap.exists || apiOrdSnap.data.customerId !== matchedCustomerId) {
            bulkResult[oid] = { error: 'Incorrect order ID' };
            continue;
          }
          const internalOrdId = String(apiOrdSnap.data.internalOrderId || oid);
          const intOrdSnap = await getDocRawWithToken(
            fbTarget,
            accessToken,
            `orders/${internalOrdId}`
          );
          const effective = await syncResellerOrderFromUpstream(
            fbTarget,
            accessToken,
            oid,
            apiOrdSnap.data,
            internalOrdId,
            intOrdSnap.exists ? intOrdSnap.data : apiOrdSnap.data
          );
          bulkResult[oid] = {
            charge: Number(apiOrdSnap.data.charge ?? 0).toFixed(2),
            start_count: String(Number(effective.startCount ?? 0)),
            status: String(effective.status ?? 'Pending'),
            remains: String(Number(effective.remains ?? apiOrdSnap.data.quantity ?? 0)),
            currency,
          };
        }

        await writeGatewayRequestLog(fbTarget, accessToken, {
          customerId: matchedCustomerId,
          userId: matchedUserId || undefined,
          keyId: matchedKeyId,
          installationId: matchedInstallationId || undefined,
          action: 'status_bulk',
          httpStatus: 200,
          success: true,
          latencyMs: Date.now() - startedAt,
          ipAddress,
        });
        res.json(bulkResult);
        return;
      }

      // ACTION: ADD ORDER
      const serviceId = (params.service || '').trim();
      const link = (params.link || '').trim();
      const quantity = Math.floor(Number(params.quantity || 0));

      if (!serviceId || !/^[a-zA-Z0-9_-]{1,64}$/.test(serviceId)) {
        await failAndLog(400, 'Valid service ID is required.');
        return;
      }
      if (!link || link.length < 5 || link.length > 500 || !/^https?:\/\//i.test(link)) {
        await failAndLog(400, 'A valid http:// or https:// target link is required.');
        return;
      }
      if (!Number.isFinite(quantity) || quantity < 1) {
        await failAndLog(400, 'A positive integer quantity is required.');
        return;
      }

      if (gwSettings.requireIdempotencyKey === true && !idempotencyKey) {
        await failAndLog(400, 'Idempotency-Key header or idempotency_key parameter is required.');
        return;
      }

      // Verify service active
      const srvSnap = await getDocRawWithToken(fbTarget, accessToken, `services/${serviceId}`);
      if (!srvSnap.exists || srvSnap.data.status !== 'active') {
        await failAndLog(404, 'Service not found or currently inactive.');
        return;
      }
      const srv = srvSnap.data;
      const minQty = Number(srv.minQuantity ?? 1);
      const maxQty = Number(srv.maxQuantity ?? 100000);
      if (quantity < minQty || quantity > maxQty) {
        await failAndLog(400, `Quantity must be between ${minQty} and ${maxQty}.`);
        return;
      }

      // Duplicate / Idempotency protection
      const effectiveIdem =
        idempotencyKey ||
        crypto
          .createHash('sha256')
          .update(
            `${matchedCustomerId}|${serviceId}|${link}|${quantity}|${Math.floor(
              Date.now() / 30_000
            )}`
          )
          .digest('hex')
          .slice(0, 32);

      const dupMatches = await runQueryWithToken(
        fbTarget,
        accessToken,
        'apiOrders',
        { field: 'idempotencyKey', value: effectiveIdem },
        1
      );
      if (dupMatches.length > 0 && dupMatches[0].data.customerId === matchedCustomerId) {
        await writeGatewayRequestLog(fbTarget, accessToken, {
          customerId: matchedCustomerId,
          userId: matchedUserId || undefined,
          keyId: matchedKeyId,
          installationId: matchedInstallationId || undefined,
          action: 'add_idempotent',
          httpStatus: 200,
          success: true,
          latencyMs: Date.now() - startedAt,
          ipAddress,
          idempotencyKey: effectiveIdem,
        });
        res.json({
          order: dupMatches[0].id,
          status: String(dupMatches[0].data.status || 'Pending'),
          duplicate: true,
        });
        return;
      }

      // Calculate price with optional customer discount (respecting Package vs per-1K pricing)
      const discountPct = Math.max(0, Math.min(90, Number(customerDoc.customDiscountPercent || 0)));
      const unitRate = Number(srv.sellingPrice ?? 0) * (1 - discountPct / 100);
      const isPkgService =
        /^package$/i.test(String(srv.serviceType || '').trim()) ||
        /\bpackage\b/i.test(String(srv.deliverySpeed || '')) ||
        /\(\s*package\s*\)/i.test(String(srv.description || '')) ||
        (minQty === 1 && maxQty === 1);
      const charge = isPkgService
        ? Number((quantity * unitRate).toFixed(2))
        : Number(((quantity / 1000) * unitRate).toFixed(2));

      // Atomic Firestore transaction: re-read customer with updateTime precondition & deduct
      const latestCust = await getDocRawWithToken(
        fbTarget,
        accessToken,
        `apiCustomers/${matchedCustomerId}`
      );
      const balanceBefore = Number(latestCust.data.apiBalance ?? 0);
      if (balanceBefore < charge) {
        await failAndLog(402, 'Insufficient API balance.');
        return;
      }
      const balanceAfter = Number((balanceBefore - charge).toFixed(2));

      const orderToken = `${Date.now().toString().slice(-6)}${crypto.randomInt(100, 999)}`;
      const internalOrderId = `ord-api-${orderToken}`;
      const apiOrderId = internalOrderId;
      const apiTxnId = `apitxn-${orderToken}`;

      const fullDbPrefix = `projects/${fbTarget.projectId}/databases/${fbTarget.databaseId}/documents`;
      const atomicCommitRes = await fetch(`${firestoreBaseUrl(fbTarget)}:commit`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          writes: [
            {
              update: {
                name: `${fullDbPrefix}/apiCustomers/${matchedCustomerId}`,
                fields: encodeFsFields({
                  apiBalance: balanceAfter,
                  totalSpent: Number(
                    (Number(latestCust.data.totalSpent ?? 0) + charge).toFixed(2)
                  ),
                  totalOrders: Number(latestCust.data.totalOrders ?? 0) + 1,
                }),
              },
              updateMask: { fieldPaths: ['apiBalance', 'totalSpent', 'totalOrders'] },
              currentDocument: latestCust.updateTime
                ? { updateTime: latestCust.updateTime }
                : { exists: true },
              updateTransforms: [{ fieldPath: 'updatedAt', setToServerValue: 'REQUEST_TIME' }],
            },
            {
              update: {
                name: `${fullDbPrefix}/orders/${internalOrderId}`,
                fields: encodeFsFields({
                  id: internalOrderId,
                  userId: matchedUserId || matchedCustomerId,
                  serviceId,
                  serviceName: String(srv.name || '').slice(0, 160),
                  categoryId: String(srv.categoryId || 'general'),
                  providerId: '',
                  providerOrderId: '',
                  link,
                  quantity,
                  charge,
                  status: 'Pending',
                  remains: quantity,
                  startCount: 0,
                  paymentStatus: 'paid',
                  paymentTransactionId: apiTxnId,
                  refunded: false,
                  internalNote: `API Gateway Order · Customer ${matchedCustomerId}`,
                }),
              },
              currentDocument: { exists: false },
              updateTransforms: [
                { fieldPath: 'createdAt', setToServerValue: 'REQUEST_TIME' },
                { fieldPath: 'updatedAt', setToServerValue: 'REQUEST_TIME' },
              ],
            },
            {
              update: {
                name: `${fullDbPrefix}/apiOrders/${apiOrderId}`,
                fields: encodeFsFields({
                  id: apiOrderId,
                  internalOrderId,
                  customerId: matchedCustomerId,
                  userId: matchedUserId || '',
                  keyId: matchedKeyId,
                  installationId: matchedInstallationId,
                  idempotencyKey: effectiveIdem,
                  serviceId,
                  serviceName: String(srv.name || '').slice(0, 160),
                  link,
                  quantity,
                  charge,
                  status: 'Pending',
                  startCount: 0,
                  remains: quantity,
                  refunded: false,
                  providerDispatched: false,
                }),
              },
              currentDocument: { exists: false },
              updateTransforms: [
                { fieldPath: 'createdAt', setToServerValue: 'REQUEST_TIME' },
                { fieldPath: 'updatedAt', setToServerValue: 'REQUEST_TIME' },
              ],
            },
            {
              update: {
                name: `${fullDbPrefix}/apiTransactions/${apiTxnId}`,
                fields: encodeFsFields({
                  id: apiTxnId,
                  customerId: matchedCustomerId,
                  userId: matchedUserId || '',
                  type: 'order_charge',
                  amount: Number((-charge).toFixed(2)),
                  balanceBefore,
                  balanceAfter,
                  referenceId: apiOrderId,
                  description: `API Order #${apiOrderId} · ${String(srv.name || serviceId).slice(0, 80)}`,
                  createdBy: matchedCustomerId,
                }),
              },
              currentDocument: { exists: false },
              updateTransforms: [{ fieldPath: 'createdAt', setToServerValue: 'REQUEST_TIME' }],
            },
            {
              update: {
                name: `${fullDbPrefix}/apiKeys/${matchedKeyId}`,
                fields: encodeFsFields({
                  requestCount: Number(keyDoc.requestCount ?? 0) + 1,
                }),
              },
              updateMask: { fieldPaths: ['requestCount'] },
              updateTransforms: [
                { fieldPath: 'lastUsedAt', setToServerValue: 'REQUEST_TIME' },
                { fieldPath: 'updatedAt', setToServerValue: 'REQUEST_TIME' },
              ],
            },
          ],
        }),
      });

      if (!atomicCommitRes.ok) {
        await failAndLog(409, 'Concurrent balance update conflict. Please retry order.');
        return;
      }

      // 8. Dispatch to upstream SMM provider if service is mapped and autoDispatchEnabled != false
      const mappedProviderId = String(srv.providerId || '').trim();
      const mappedProviderServiceId = String(srv.providerServiceId || '').trim();
      let finalStatus = 'Pending';

      if (mappedProviderId && mappedProviderServiceId && gwSettings.autoDispatchEnabled !== false) {
        try {
          const provSnap = await getDocRawWithToken(
            fbTarget,
            accessToken,
            `apiProviders/${mappedProviderId}`
          );
          if (!provSnap.exists || provSnap.data.status !== 'active') {
            throw new Error('Upstream fulfillment provider is currently unavailable.');
          }
          const provUrl = String(provSnap.data.apiUrl || '').trim();
          const provKey = String(provSnap.data.apiKey || '').trim();
          const addRes = (await deps.callUpstreamSmmV2(provUrl, provKey, {
            action: 'add',
            service: mappedProviderServiceId,
            link,
            quantity: String(quantity),
          })) as Record<string, unknown>;

          const upstreamOrderId = addRes.order !== undefined ? String(addRes.order) : '';
          if (!upstreamOrderId) {
            throw new Error('Upstream provider did not return an order reference.');
          }

          finalStatus = 'Processing';
          await fetch(`${firestoreBaseUrl(fbTarget)}:commit`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              writes: [
                {
                  update: {
                    name: `${fullDbPrefix}/orders/${internalOrderId}`,
                    fields: encodeFsFields({
                      providerId: mappedProviderId,
                      providerOrderId: upstreamOrderId,
                      status: 'Processing',
                    }),
                  },
                  updateMask: { fieldPaths: ['providerId', 'providerOrderId', 'status'] },
                  updateTransforms: [{ fieldPath: 'updatedAt', setToServerValue: 'REQUEST_TIME' }],
                },
                {
                  update: {
                    name: `${fullDbPrefix}/apiOrders/${apiOrderId}`,
                    fields: encodeFsFields({
                      status: 'Processing',
                      providerDispatched: true,
                    }),
                  },
                  updateMask: { fieldPaths: ['status', 'providerDispatched'] },
                  updateTransforms: [{ fieldPath: 'updatedAt', setToServerValue: 'REQUEST_TIME' }],
                },
              ],
            }),
          });
        } catch (dispatchErr) {
          // 10. Compensating atomic refund on upstream fulfillment failure
          const errMsg =
            dispatchErr instanceof Error
              ? dispatchErr.message
              : 'Upstream fulfillment failed.';
          const postDebitCust = await getDocRawWithToken(
            fbTarget,
            accessToken,
            `apiCustomers/${matchedCustomerId}`
          );
          const curBal = Number(postDebitCust.data.apiBalance ?? 0);
          const refundedBal = Number((curBal + charge).toFixed(2));
          const refundTxnId = `apiref-${orderToken}`;

          await fetch(`${firestoreBaseUrl(fbTarget)}:commit`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              writes: [
                {
                  update: {
                    name: `${fullDbPrefix}/apiCustomers/${matchedCustomerId}`,
                    fields: encodeFsFields({ apiBalance: refundedBal }),
                  },
                  updateMask: { fieldPaths: ['apiBalance'] },
                  updateTransforms: [{ fieldPath: 'updatedAt', setToServerValue: 'REQUEST_TIME' }],
                },
                {
                  update: {
                    name: `${fullDbPrefix}/orders/${internalOrderId}`,
                    fields: encodeFsFields({
                      status: 'Failed',
                      paymentStatus: 'refunded',
                      refunded: true,
                      refundTransactionId: refundTxnId,
                      lastError: errMsg.slice(0, 300),
                    }),
                  },
                  updateMask: {
                    fieldPaths: [
                      'status',
                      'paymentStatus',
                      'refunded',
                      'refundTransactionId',
                      'lastError',
                    ],
                  },
                  updateTransforms: [{ fieldPath: 'updatedAt', setToServerValue: 'REQUEST_TIME' }],
                },
                {
                  update: {
                    name: `${fullDbPrefix}/apiOrders/${apiOrderId}`,
                    fields: encodeFsFields({
                      status: 'Failed',
                      refunded: true,
                      refundTransactionId: refundTxnId,
                      errorMessage: errMsg.slice(0, 300),
                    }),
                  },
                  updateMask: {
                    fieldPaths: ['status', 'refunded', 'refundTransactionId', 'errorMessage'],
                  },
                  updateTransforms: [{ fieldPath: 'updatedAt', setToServerValue: 'REQUEST_TIME' }],
                },
                {
                  update: {
                    name: `${fullDbPrefix}/apiTransactions/${refundTxnId}`,
                    fields: encodeFsFields({
                      id: refundTxnId,
                      customerId: matchedCustomerId,
                      userId: matchedUserId || '',
                      type: 'refund',
                      amount: charge,
                      balanceBefore: curBal,
                      balanceAfter: refundedBal,
                      referenceId: apiOrderId,
                      description: `Auto-refund for failed API Order #${apiOrderId}`,
                      createdBy: 'gateway_auto_refund',
                    }),
                  },
                  currentDocument: { exists: false },
                  updateTransforms: [{ fieldPath: 'createdAt', setToServerValue: 'REQUEST_TIME' }],
                },
              ],
            }),
          });

          await failAndLog(422, 'Order fulfillment failed; balance has been refunded automatically.');
          return;
        }
      }

      await writeGatewayRequestLog(fbTarget, accessToken, {
        customerId: matchedCustomerId,
        userId: matchedUserId || undefined,
        keyId: matchedKeyId,
        installationId: matchedInstallationId || undefined,
        action: 'add',
        httpStatus: 200,
        success: true,
        latencyMs: Date.now() - startedAt,
        ipAddress,
        idempotencyKey: effectiveIdem,
      });

      res.json({
        order: apiOrderId,
        status: finalStatus,
      });
    } catch (error) {
      await failAndLog(
        500,
        error instanceof Error ? error.message : 'Internal API Gateway error.'
      );
    }
  };

  app.post('/api/v2', handlePublicApiV2);
  app.get('/api/v2', (_req: Request, res: Response) => {
    res.status(405).json({
      error: 'Use HTTP POST with form-urlencoded or JSON body (`key`, `action`, ...).',
    });
  });
}
