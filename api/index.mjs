// server/app.ts
import "dotenv/config";
import crypto2 from "node:crypto";
import fs2 from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";

// server/gateway.ts
import crypto from "node:crypto";
import fs from "node:fs";
var cachedServiceToken = null;
var rateLimitBuckets = /* @__PURE__ */ new Map();
function loadServiceAccountCreds() {
  try {
    const rawInline = (process.env.FIREBASE_SERVICE_ACCOUNT_JSON || process.env.FIREBASE_SERVICE_ACCOUNT || "").trim();
    if (rawInline) {
      const parsed = JSON.parse(rawInline);
      if (parsed.client_email && parsed.private_key) {
        return {
          client_email: parsed.client_email,
          private_key: parsed.private_key.replace(/\\n/g, "\n"),
          token_uri: parsed.token_uri || "https://oauth2.googleapis.com/token"
        };
      }
    }
    const credPath = (process.env.GOOGLE_APPLICATION_CREDENTIALS || "").trim();
    if (credPath && fs.existsSync(credPath)) {
      const parsed = JSON.parse(fs.readFileSync(credPath, "utf8"));
      if (parsed.client_email && parsed.private_key) {
        return {
          client_email: parsed.client_email,
          private_key: parsed.private_key.replace(/\\n/g, "\n"),
          token_uri: parsed.token_uri || "https://oauth2.googleapis.com/token"
        };
      }
    }
  } catch {
  }
  return null;
}
function hasServiceAccountConfigured() {
  return loadServiceAccountCreds() !== null;
}
async function fetchMetadataServerAccessToken() {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 1200);
  try {
    const res = await fetch(
      "http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token",
      {
        method: "GET",
        headers: { "Metadata-Flavor": "Google" },
        signal: controller.signal
      }
    );
    if (!res.ok) return null;
    const json = await res.json();
    if (!json.access_token) return null;
    return {
      accessToken: json.access_token,
      expiresAtMs: Date.now() + Math.max(300, Number(json.expires_in || 3600)) * 1e3
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
async function getGatewayBackendAuthStatus(target) {
  if (hasServiceAccountConfigured()) {
    return { backendAuthConfigured: true, authMode: "service_account" };
  }
  const metaToken = await fetchMetadataServerAccessToken();
  if (metaToken) {
    try {
      await getDocRawWithToken(target, metaToken.accessToken, "settings/apiGateway");
      cachedServiceToken = metaToken;
      return { backendAuthConfigured: true, authMode: "adc_metadata" };
    } catch {
    }
  }
  return { backendAuthConfigured: false, authMode: "none" };
}
async function getServiceAccountAccessToken(target) {
  if (cachedServiceToken && cachedServiceToken.expiresAtMs > Date.now() + 6e4) {
    return cachedServiceToken.accessToken;
  }
  const creds = loadServiceAccountCreds();
  if (!creds) {
    const metaToken = await fetchMetadataServerAccessToken();
    if (metaToken) {
      try {
        await getDocRawWithToken(target, metaToken.accessToken, "settings/apiGateway");
        cachedServiceToken = metaToken;
        return metaToken.accessToken;
      } catch {
      }
    }
    throw new Error("Gateway backend Firebase credentials are not configured on the host.");
  }
  const nowSec = Math.floor(Date.now() / 1e3);
  const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
  const tokenUri = creds.token_uri || "https://oauth2.googleapis.com/token";
  const claimSet = Buffer.from(
    JSON.stringify({
      iss: creds.client_email,
      scope: "https://www.googleapis.com/auth/datastore",
      aud: tokenUri,
      iat: nowSec,
      exp: nowSec + 3600
    })
  ).toString("base64url");
  const signingInput = `${header}.${claimSet}`;
  const signer = crypto.createSign("RSA-SHA256");
  signer.update(signingInput);
  signer.end();
  const signature = signer.sign(creds.private_key, "base64url");
  const assertion = `${signingInput}.${signature}`;
  const tokenRes = await fetch(tokenUri, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion
    }).toString()
  });
  if (!tokenRes.ok) {
    throw new Error(`Service account OAuth token exchange failed (${tokenRes.status}).`);
  }
  const tokenJson = await tokenRes.json();
  if (!tokenJson.access_token) {
    throw new Error("Service account OAuth response did not include an access_token.");
  }
  cachedServiceToken = {
    accessToken: tokenJson.access_token,
    expiresAtMs: Date.now() + Math.max(300, Number(tokenJson.expires_in || 3600)) * 1e3
  };
  return cachedServiceToken.accessToken;
}
function generateRawApiKey() {
  const keyPrefix = "rjw_live_";
  const tokenBody = crypto.randomBytes(18).toString("hex");
  const rawKey = `${keyPrefix}${tokenBody}`;
  return {
    rawKey,
    keyPrefix,
    keyLast4: rawKey.slice(-4)
  };
}
function hashApiKey(rawKey) {
  return crypto.createHash("sha256").update(rawKey.trim()).digest("hex");
}
function checkRateLimit(bucketKey, limitPerMinute) {
  const now = Date.now();
  const limit = Math.max(1, Math.min(1e4, Math.floor(limitPerMinute || 60)));
  const existing = rateLimitBuckets.get(bucketKey);
  if (!existing || existing.resetAtMs <= now) {
    rateLimitBuckets.set(bucketKey, { count: 1, resetAtMs: now + 6e4 });
    return { allowed: true, remaining: limit - 1, retryAfterSeconds: 0 };
  }
  if (existing.count >= limit) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAtMs - now) / 1e3))
    };
  }
  existing.count += 1;
  return {
    allowed: true,
    remaining: Math.max(0, limit - existing.count),
    retryAfterSeconds: 0
  };
}
function firestoreBaseUrl(target) {
  return `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(
    target.projectId
  )}/databases/${encodeURIComponent(target.databaseId)}/documents`;
}
function encodeFsValue(val) {
  if (val === null || val === void 0) return { nullValue: null };
  if (typeof val === "boolean") return { booleanValue: val };
  if (typeof val === "number") {
    if (Number.isInteger(val)) return { integerValue: String(val) };
    return { doubleValue: val };
  }
  if (typeof val === "string") return { stringValue: val };
  if (val instanceof Date) return { timestampValue: val.toISOString() };
  if (Array.isArray(val)) {
    return {
      arrayValue: {
        values: val.map((item) => encodeFsValue(item))
      }
    };
  }
  if (typeof val === "object") {
    const fields = {};
    for (const [k, v] of Object.entries(val)) {
      if (v !== void 0) fields[k] = encodeFsValue(v);
    }
    return { mapValue: { fields } };
  }
  return { stringValue: String(val) };
}
function encodeFsFields(obj) {
  const fields = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== void 0) {
      fields[k] = encodeFsValue(v);
    }
  }
  return fields;
}
function decodeFsValue(raw) {
  if (!raw || typeof raw !== "object") return void 0;
  if ("stringValue" in raw) return String(raw.stringValue);
  if ("integerValue" in raw) return Number(raw.integerValue);
  if ("doubleValue" in raw) return Number(raw.doubleValue);
  if ("booleanValue" in raw) return Boolean(raw.booleanValue);
  if ("timestampValue" in raw) return String(raw.timestampValue);
  if ("nullValue" in raw) return null;
  if ("arrayValue" in raw) {
    const arr = raw.arrayValue;
    return (arr?.values ?? []).map((item) => decodeFsValue(item));
  }
  if ("mapValue" in raw) {
    const mp = raw.mapValue;
    return decodeFsDocFields(mp?.fields);
  }
  return void 0;
}
function decodeFsDocFields(fields) {
  const out = {};
  if (!fields) return out;
  for (const [k, v] of Object.entries(fields)) {
    out[k] = decodeFsValue(v);
  }
  return out;
}
function encodeServerTimestampCommit(docPath, target, data, timestampFields) {
  const fullDocName = `projects/${target.projectId}/databases/${target.databaseId}/documents/${docPath}`;
  return {
    writes: [
      {
        update: {
          name: fullDocName,
          fields: encodeFsFields(data)
        },
        updateTransforms: timestampFields.map((fieldPath) => ({
          fieldPath,
          setToServerValue: "REQUEST_TIME"
        }))
      }
    ]
  };
}
async function commitDocWithBearer(target, bearerToken, docPath, data, timestampFields) {
  const url = `${firestoreBaseUrl(target)}:commit`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${bearerToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(encodeServerTimestampCommit(docPath, target, data, timestampFields))
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    if (res.status === 401 || res.status === 403) {
      throw new Error("Unauthorized: Permission denied while storing gateway credential.");
    }
    throw new Error(`Firestore write failed (${res.status}): ${txt.slice(0, 160)}`);
  }
}
async function runQueryWithToken(target, accessToken, collectionId, whereField, queryLimit = 100) {
  const url = `${firestoreBaseUrl(target)}:runQuery`;
  const structuredQuery = {
    from: [{ collectionId }],
    limit: queryLimit
  };
  if (whereField) {
    structuredQuery.where = {
      fieldFilter: {
        field: { fieldPath: whereField.field },
        op: "EQUAL",
        value: encodeFsValue(whereField.value)
      }
    };
  }
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ structuredQuery })
  });
  if (!res.ok) {
    throw new Error(`Firestore query failed (${res.status}).`);
  }
  const rows = await res.json();
  const out = [];
  for (const row of rows) {
    if (!row.document) continue;
    const id = row.document.name.split("/").pop() || "";
    out.push({
      id,
      data: decodeFsDocFields(row.document.fields),
      updateTime: row.document.updateTime
    });
  }
  return out;
}
async function getDocRawWithToken(target, accessToken, docPath) {
  const url = `${firestoreBaseUrl(target)}/${docPath}`;
  const res = await fetch(url, {
    method: "GET",
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  if (res.status === 404) {
    return { exists: false, data: {} };
  }
  if (!res.ok) {
    throw new Error(`Unable to load ${docPath} (${res.status}).`);
  }
  const json = await res.json();
  return {
    exists: true,
    data: decodeFsDocFields(json.fields),
    updateTime: json.updateTime
  };
}
function verifyFirebaseUidFromJwt(idToken) {
  try {
    const parts = idToken.split(".");
    if (parts.length !== 3) return "";
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
    return String(payload.user_id || payload.sub || "").trim();
  } catch {
    return "";
  }
}
async function writeGatewayRequestLog(target, accessToken, log) {
  const logId = `apilog-${Date.now()}-${crypto.randomBytes(3).toString("hex")}`;
  await commitDocWithBearer(
    target,
    accessToken,
    `apiRequestLogs/${logId}`,
    {
      id: logId,
      ...log.customerId ? { customerId: log.customerId } : {},
      ...log.userId ? { userId: log.userId } : {},
      ...log.keyId ? { keyId: log.keyId } : {},
      ...log.installationId ? { installationId: log.installationId } : {},
      action: log.action.slice(0, 40) || "unknown",
      httpStatus: log.httpStatus,
      success: log.success,
      latencyMs: Math.max(0, Math.round(log.latencyMs)),
      ipAddress: log.ipAddress.slice(0, 64),
      ...log.idempotencyKey ? { idempotencyKey: log.idempotencyKey.slice(0, 128) } : {},
      ...log.errorMessage ? { errorMessage: log.errorMessage.slice(0, 300) } : {}
    },
    ["createdAt"]
  ).catch(() => void 0);
}
function registerGatewayRoutes(app2, deps) {
  const syncResellerOrderFromUpstream = async (fbTarget, accessToken, apiOrderId, apiOrderData, internalOrderId, internalOrderData) => {
    const currentStatus = String(internalOrderData.status || apiOrderData.status || "Pending");
    const isNonTerminal = ["Pending", "Processing", "In Progress"].includes(currentStatus);
    const providerId = String(internalOrderData.providerId || "").trim();
    const providerOrderId = String(internalOrderData.providerOrderId || "").trim();
    if (!isNonTerminal || !providerId || !providerOrderId) {
      return internalOrderData;
    }
    try {
      const provSnap = await getDocRawWithToken(
        fbTarget,
        accessToken,
        `apiProviders/${providerId}`
      );
      if (!provSnap.exists || provSnap.data.status !== "active") {
        return internalOrderData;
      }
      const provUrl = String(provSnap.data.apiUrl || "").trim();
      const provKey = String(provSnap.data.apiKey || "").trim();
      if (!provUrl || !provKey) {
        return internalOrderData;
      }
      const remote = await deps.callUpstreamSmmV2(provUrl, provKey, {
        action: "status",
        order: providerOrderId
      });
      const mappedStatus = deps.mapProviderStatusToInternal(String(remote.status ?? currentStatus));
      const nextStartCount = remote.start_count !== void 0 && Number.isFinite(Number(remote.start_count)) ? Math.max(0, Number(remote.start_count)) : Number(internalOrderData.startCount ?? 0);
      const nextRemains = remote.remains !== void 0 && Number.isFinite(Number(remote.remains)) ? Math.max(0, Number(remote.remains)) : mappedStatus === "Completed" ? 0 : Number(internalOrderData.remains ?? apiOrderData.quantity ?? 0);
      const fullDbPrefix = `projects/${fbTarget.projectId}/databases/${fbTarget.databaseId}/documents`;
      await fetch(`${firestoreBaseUrl(fbTarget)}:commit`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          writes: [
            {
              update: {
                name: `${fullDbPrefix}/orders/${internalOrderId}`,
                fields: encodeFsFields({
                  status: mappedStatus,
                  startCount: nextStartCount,
                  remains: nextRemains
                })
              },
              updateMask: { fieldPaths: ["status", "startCount", "remains"] },
              updateTransforms: [
                { fieldPath: "lastCheckedAt", setToServerValue: "REQUEST_TIME" },
                { fieldPath: "updatedAt", setToServerValue: "REQUEST_TIME" }
              ]
            },
            {
              update: {
                name: `${fullDbPrefix}/apiOrders/${apiOrderId}`,
                fields: encodeFsFields({
                  status: mappedStatus,
                  startCount: nextStartCount,
                  remains: nextRemains
                })
              },
              updateMask: { fieldPaths: ["status", "startCount", "remains"] },
              updateTransforms: [{ fieldPath: "updatedAt", setToServerValue: "REQUEST_TIME" }]
            }
          ]
        })
      }).catch(() => void 0);
      return {
        ...internalOrderData,
        status: mappedStatus,
        startCount: nextStartCount,
        remains: nextRemains
      };
    } catch {
      return internalOrderData;
    }
  };
  app2.get("/api/gateway/server-status", async (req, res) => {
    const idToken = deps.extractBearerToken(req);
    if (!idToken) {
      res.status(401).json({ ok: false, error: "Admin authentication required." });
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
          authMode: authStatus.authMode
        }
      });
    } catch (err) {
      res.status(403).json({
        ok: false,
        error: err instanceof Error ? err.message : "Admin verification failed."
      });
    }
  });
  app2.post("/api/gateway/keys/generate", async (req, res) => {
    const idToken = deps.extractBearerToken(req);
    if (!idToken) {
      res.status(401).json({ ok: false, error: "Authentication required." });
      return;
    }
    const body = req.body ?? {};
    const customerId = typeof body.customerId === "string" ? body.customerId.trim() : "";
    const label = typeof body.label === "string" && body.label.trim() ? body.label.trim().slice(0, 80) : "Default API Key";
    const requestedPerms = Array.isArray(body.permissions) ? body.permissions.filter(
      (p) => ["balance", "services", "add", "status"].includes(String(p))
    ) : ["balance", "services", "add", "status"];
    const permissions = requestedPerms.length > 0 ? requestedPerms : ["balance", "services", "add", "status"];
    const rateLimitPerMinute = Math.max(
      1,
      Math.min(1e4, Math.floor(Number(body.rateLimitPerMinute || 60)))
    );
    if (!customerId || !/^[a-zA-Z0-9_-]{1,64}$/.test(customerId)) {
      res.status(400).json({ ok: false, error: "Valid customerId is required." });
      return;
    }
    const fbTarget = deps.resolveRequestFirebaseTarget(body);
    try {
      const customerDoc = await deps.fetchFirestoreDocWithToken(
        `apiCustomers/${customerId}`,
        idToken,
        fbTarget
      );
      if (customerDoc.status !== "active") {
        res.status(403).json({
          ok: false,
          error: "API Customer account must be active before generating API keys."
        });
        return;
      }
      const actorUid = verifyFirebaseUidFromJwt(idToken);
      const { rawKey, keyPrefix, keyLast4 } = generateRawApiKey();
      const keyHash = hashApiKey(rawKey);
      const keyId = `key-${Date.now()}-${crypto.randomBytes(3).toString("hex")}`;
      await commitDocWithBearer(
        fbTarget,
        idToken,
        `apiKeys/${keyId}`,
        {
          id: keyId,
          customerId,
          userId: String(customerDoc.userId || actorUid || ""),
          installationId: String(customerDoc.installationId || ""),
          label,
          keyPrefix,
          keyLast4,
          keyHash,
          permissions,
          rateLimitPerMinute,
          status: "active",
          requestCount: 0,
          createdBy: actorUid || "system"
        },
        ["createdAt", "updatedAt"]
      );
      res.json({
        ok: true,
        data: {
          keyId,
          customerId,
          label,
          keyPrefix,
          keyLast4,
          plaintextKeyOnce: rawKey
        }
      });
    } catch (err) {
      res.status(403).json({
        ok: false,
        error: err instanceof Error ? err.message : "Unable to generate API key."
      });
    }
  });
  app2.post("/api/gateway/keys/regenerate", async (req, res) => {
    const idToken = deps.extractBearerToken(req);
    if (!idToken) {
      res.status(401).json({ ok: false, error: "Authentication required." });
      return;
    }
    const body = req.body ?? {};
    const keyId = typeof body.keyId === "string" ? body.keyId.trim() : "";
    if (!keyId || !/^[a-zA-Z0-9_-]{1,64}$/.test(keyId)) {
      res.status(400).json({ ok: false, error: "Valid keyId is required." });
      return;
    }
    const fbTarget = deps.resolveRequestFirebaseTarget(body);
    try {
      const existingKey = await deps.fetchFirestoreDocWithToken(
        `apiKeys/${keyId}`,
        idToken,
        fbTarget
      );
      const customerId = String(existingKey.customerId || "").trim();
      const customerDoc = await deps.fetchFirestoreDocWithToken(
        `apiCustomers/${customerId}`,
        idToken,
        fbTarget
      );
      if (customerDoc.status !== "active") {
        res.status(403).json({ ok: false, error: "API Customer is not active." });
        return;
      }
      const actorUid = verifyFirebaseUidFromJwt(idToken);
      const { rawKey, keyPrefix, keyLast4 } = generateRawApiKey();
      const keyHash = hashApiKey(rawKey);
      const newKeyId = `key-${Date.now()}-${crypto.randomBytes(3).toString("hex")}`;
      await commitDocWithBearer(
        fbTarget,
        idToken,
        `apiKeys/${newKeyId}`,
        {
          id: newKeyId,
          customerId,
          userId: String(existingKey.userId || customerDoc.userId || actorUid || ""),
          installationId: String(existingKey.installationId || customerDoc.installationId || ""),
          label: String(existingKey.label || "Regenerated Key"),
          keyPrefix,
          keyLast4,
          keyHash,
          permissions: Array.isArray(existingKey.permissions) ? existingKey.permissions : ["balance", "services", "add", "status"],
          rateLimitPerMinute: Number(existingKey.rateLimitPerMinute || 60),
          status: "active",
          requestCount: 0,
          createdBy: actorUid || "system"
        },
        ["createdAt", "updatedAt"]
      );
      const revokeRes = await fetch(
        `${firestoreBaseUrl(fbTarget)}/apiKeys/${encodeURIComponent(
          keyId
        )}?updateMask.fieldPaths=status&updateMask.fieldPaths=updatedAt`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${idToken}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            fields: encodeFsFields({
              status: "revoked",
              updatedAt: /* @__PURE__ */ new Date()
            })
          })
        }
      );
      if (!revokeRes.ok) {
        await fetch(`${firestoreBaseUrl(fbTarget)}:commit`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${idToken}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            writes: [
              {
                update: {
                  name: `projects/${fbTarget.projectId}/databases/${fbTarget.databaseId}/documents/apiKeys/${keyId}`,
                  fields: encodeFsFields({ status: "revoked" })
                },
                updateMask: { fieldPaths: ["status"] },
                updateTransforms: [{ fieldPath: "updatedAt", setToServerValue: "REQUEST_TIME" }]
              }
            ]
          })
        });
      }
      res.json({
        ok: true,
        data: {
          keyId: newKeyId,
          revokedKeyId: keyId,
          customerId,
          label: String(existingKey.label || "Regenerated Key"),
          keyPrefix,
          keyLast4,
          plaintextKeyOnce: rawKey
        }
      });
    } catch (err) {
      res.status(403).json({
        ok: false,
        error: err instanceof Error ? err.message : "Unable to regenerate API key."
      });
    }
  });
  const handlePublicApiV2 = async (req, res) => {
    const startedAt = Date.now();
    const ipAddress = (typeof req.headers["x-forwarded-for"] === "string" ? req.headers["x-forwarded-for"].split(",")[0] : req.socket.remoteAddress) || "unknown";
    const params = {};
    const mergeSource = (src) => {
      if (!src || typeof src !== "object") return;
      for (const [k, v] of Object.entries(src)) {
        if (v !== void 0 && v !== null) {
          params[k] = String(v);
        }
      }
    };
    mergeSource(req.query);
    mergeSource(req.body);
    const rawKey = (params.key || "").trim();
    const action = (params.action || "").trim().toLowerCase();
    const idempotencyKey = String(req.headers["idempotency-key"] || params.idempotency_key || "").trim();
    const ipLimit = checkRateLimit(`ip:${ipAddress}`, 120);
    if (!ipLimit.allowed) {
      res.setHeader("Retry-After", String(ipLimit.retryAfterSeconds));
      res.status(429).json({ error: "Rate limit exceeded. Please slow down requests." });
      return;
    }
    if (!rawKey) {
      res.status(401).json({ error: "API key is required." });
      return;
    }
    if (!["balance", "services", "add", "status"].includes(action)) {
      res.status(400).json({
        error: "Invalid or missing action. Supported actions: balance, services, add, status."
      });
      return;
    }
    const fbTarget = deps.resolveRequestFirebaseTarget({});
    let accessToken = "";
    try {
      accessToken = await getServiceAccountAccessToken(fbTarget);
    } catch {
      res.status(503).json({
        error: "Reseller API Gateway backend credentials are not available on this host. Configure Application Default Credentials or FIREBASE_SERVICE_ACCOUNT_JSON.",
        code: "GATEWAY_BACKEND_CREDENTIALS_REQUIRED"
      });
      return;
    }
    let matchedCustomerId = "";
    let matchedUserId = "";
    let matchedKeyId = "";
    let matchedInstallationId = "";
    const failAndLog = async (status, message) => {
      if (accessToken) {
        await writeGatewayRequestLog(fbTarget, accessToken, {
          customerId: matchedCustomerId || void 0,
          userId: matchedUserId || void 0,
          keyId: matchedKeyId || void 0,
          installationId: matchedInstallationId || void 0,
          action,
          httpStatus: status,
          success: false,
          latencyMs: Date.now() - startedAt,
          ipAddress,
          idempotencyKey: idempotencyKey || void 0,
          errorMessage: deps.sanitizeErrorMessage(message, rawKey)
        });
      }
      res.status(status).json({ error: deps.sanitizeErrorMessage(message, rawKey) });
    };
    try {
      const gwSettingsSnap = await getDocRawWithToken(fbTarget, accessToken, "settings/apiGateway");
      const gwSettings = gwSettingsSnap.exists ? gwSettingsSnap.data : {};
      if (gwSettingsSnap.exists && gwSettings.gatewayEnabled === false) {
        await failAndLog(503, "API Gateway is temporarily disabled by administrator.");
        return;
      }
      const keyHash = hashApiKey(rawKey);
      const keyMatches = await runQueryWithToken(
        fbTarget,
        accessToken,
        "apiKeys",
        { field: "keyHash", value: keyHash },
        1
      );
      if (keyMatches.length === 0) {
        await failAndLog(401, "Invalid API key.");
        return;
      }
      const keyDoc = keyMatches[0].data;
      matchedKeyId = keyMatches[0].id;
      matchedCustomerId = String(keyDoc.customerId || "").trim();
      matchedUserId = String(keyDoc.userId || "").trim();
      matchedInstallationId = String(keyDoc.installationId || "").trim();
      if (keyDoc.status !== "active") {
        await failAndLog(403, `API key is currently ${String(keyDoc.status || "disabled")}.`);
        return;
      }
      const perms = Array.isArray(keyDoc.permissions) ? keyDoc.permissions.map((p) => String(p)) : [];
      if (!perms.includes(action)) {
        await failAndLog(403, `API key does not have "${action}" permission.`);
        return;
      }
      const customerSnap = await getDocRawWithToken(
        fbTarget,
        accessToken,
        `apiCustomers/${matchedCustomerId}`
      );
      if (!customerSnap.exists) {
        await failAndLog(403, "API Customer profile not found.");
        return;
      }
      const customerDoc = customerSnap.data;
      if (customerDoc.status !== "active") {
        await failAndLog(403, `API Customer account is ${String(customerDoc.status)}.`);
        return;
      }
      matchedUserId = String(customerDoc.userId || matchedUserId || "").trim();
      matchedInstallationId = String(customerDoc.installationId || matchedInstallationId || "").trim();
      if (matchedInstallationId) {
        const instSnap = await getDocRawWithToken(
          fbTarget,
          accessToken,
          `websiteInstallations/${matchedInstallationId}`
        );
        if (instSnap.exists && instSnap.data.status !== "active") {
          await failAndLog(
            403,
            `Website installation (${matchedInstallationId}) is ${String(instSnap.data.status)}.`
          );
          return;
        }
      }
      const rpm = Math.min(
        Number(keyDoc.rateLimitPerMinute || 60),
        Number(customerDoc.rateLimitPerMinute || 60)
      );
      const keyLimit = checkRateLimit(`key:${matchedKeyId}`, rpm);
      if (!keyLimit.allowed) {
        res.setHeader("Retry-After", String(keyLimit.retryAfterSeconds));
        await failAndLog(429, `Rate limit exceeded (${rpm} requests/minute).`);
        return;
      }
      const sysSnap = await getDocRawWithToken(fbTarget, accessToken, "settings/system");
      const currency = String(sysSnap.data.currency || "BDT").trim() || "BDT";
      if (action === "balance") {
        const balance = Number(customerDoc.apiBalance ?? 0);
        await writeGatewayRequestLog(fbTarget, accessToken, {
          customerId: matchedCustomerId,
          userId: matchedUserId || void 0,
          keyId: matchedKeyId,
          installationId: matchedInstallationId || void 0,
          action,
          httpStatus: 200,
          success: true,
          latencyMs: Date.now() - startedAt,
          ipAddress
        });
        res.json({
          balance: balance.toFixed(2),
          currency
        });
        return;
      }
      if (action === "services") {
        const rawServices = await runQueryWithToken(
          fbTarget,
          accessToken,
          "services",
          { field: "status", value: "active" },
          500
        );
        const discountPct2 = Math.max(
          0,
          Math.min(90, Number(customerDoc.customDiscountPercent || 0))
        );
        const multiplier = 1 - discountPct2 / 100;
        const catalog = rawServices.map((item) => {
          const s = item.data;
          const baseRate = Number(s.sellingPrice ?? 0);
          const customerRate = Number((baseRate * multiplier).toFixed(2));
          return {
            service: item.id,
            name: String(s.name || ""),
            type: String(s.serviceType || "Default"),
            category: String(s.categoryId || "general"),
            rate: customerRate.toFixed(2),
            min: String(Math.max(1, Number(s.minQuantity ?? 10))),
            max: String(Math.max(1, Number(s.maxQuantity ?? 1e4))),
            refill: Boolean(s.refillGuaranteed),
            dripfeed: false,
            cancel: false
          };
        });
        await writeGatewayRequestLog(fbTarget, accessToken, {
          customerId: matchedCustomerId,
          userId: matchedUserId || void 0,
          keyId: matchedKeyId,
          installationId: matchedInstallationId || void 0,
          action,
          httpStatus: 200,
          success: true,
          latencyMs: Date.now() - startedAt,
          ipAddress
        });
        res.json(catalog);
        return;
      }
      if (action === "status") {
        const singleOrder = (params.order || "").trim();
        const bulkOrdersRaw = (params.orders || "").trim();
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
            await failAndLog(404, "Incorrect order ID.");
            return;
          }
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
            userId: matchedUserId || void 0,
            keyId: matchedKeyId,
            installationId: matchedInstallationId || void 0,
            action,
            httpStatus: 200,
            success: true,
            latencyMs: Date.now() - startedAt,
            ipAddress
          });
          res.json({
            charge: Number(apiOrdSnap.data.charge ?? 0).toFixed(2),
            start_count: String(Number(effective.startCount ?? 0)),
            status: String(effective.status ?? "Pending"),
            remains: String(Number(effective.remains ?? apiOrdSnap.data.quantity ?? 0)),
            currency
          });
          return;
        }
        const maxBulk = Math.max(1, Math.min(500, Number(gwSettings.maxBulkStatusIds || 100)));
        const ids = bulkOrdersRaw.split(",").map((s) => s.trim()).filter(Boolean).slice(0, maxBulk);
        const bulkResult = {};
        for (const oid of ids) {
          if (!/^[a-zA-Z0-9_-]{1,64}$/.test(oid)) {
            bulkResult[oid] = { error: "Incorrect order ID" };
            continue;
          }
          const apiOrdSnap = await getDocRawWithToken(fbTarget, accessToken, `apiOrders/${oid}`);
          if (!apiOrdSnap.exists || apiOrdSnap.data.customerId !== matchedCustomerId) {
            bulkResult[oid] = { error: "Incorrect order ID" };
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
            status: String(effective.status ?? "Pending"),
            remains: String(Number(effective.remains ?? apiOrdSnap.data.quantity ?? 0)),
            currency
          };
        }
        await writeGatewayRequestLog(fbTarget, accessToken, {
          customerId: matchedCustomerId,
          userId: matchedUserId || void 0,
          keyId: matchedKeyId,
          installationId: matchedInstallationId || void 0,
          action: "status_bulk",
          httpStatus: 200,
          success: true,
          latencyMs: Date.now() - startedAt,
          ipAddress
        });
        res.json(bulkResult);
        return;
      }
      const serviceId = (params.service || "").trim();
      const link = (params.link || "").trim();
      const quantity = Math.floor(Number(params.quantity || 0));
      if (!serviceId || !/^[a-zA-Z0-9_-]{1,64}$/.test(serviceId)) {
        await failAndLog(400, "Valid service ID is required.");
        return;
      }
      if (!link || link.length < 5 || link.length > 500 || !/^https?:\/\//i.test(link)) {
        await failAndLog(400, "A valid http:// or https:// target link is required.");
        return;
      }
      if (!Number.isFinite(quantity) || quantity < 1) {
        await failAndLog(400, "A positive integer quantity is required.");
        return;
      }
      if (gwSettings.requireIdempotencyKey === true && !idempotencyKey) {
        await failAndLog(400, "Idempotency-Key header or idempotency_key parameter is required.");
        return;
      }
      const srvSnap = await getDocRawWithToken(fbTarget, accessToken, `services/${serviceId}`);
      if (!srvSnap.exists || srvSnap.data.status !== "active") {
        await failAndLog(404, "Service not found or currently inactive.");
        return;
      }
      const srv = srvSnap.data;
      const minQty = Number(srv.minQuantity ?? 1);
      const maxQty = Number(srv.maxQuantity ?? 1e5);
      if (quantity < minQty || quantity > maxQty) {
        await failAndLog(400, `Quantity must be between ${minQty} and ${maxQty}.`);
        return;
      }
      const effectiveIdem = idempotencyKey || crypto.createHash("sha256").update(
        `${matchedCustomerId}|${serviceId}|${link}|${quantity}|${Math.floor(
          Date.now() / 3e4
        )}`
      ).digest("hex").slice(0, 32);
      const dupMatches = await runQueryWithToken(
        fbTarget,
        accessToken,
        "apiOrders",
        { field: "idempotencyKey", value: effectiveIdem },
        1
      );
      if (dupMatches.length > 0 && dupMatches[0].data.customerId === matchedCustomerId) {
        await writeGatewayRequestLog(fbTarget, accessToken, {
          customerId: matchedCustomerId,
          userId: matchedUserId || void 0,
          keyId: matchedKeyId,
          installationId: matchedInstallationId || void 0,
          action: "add_idempotent",
          httpStatus: 200,
          success: true,
          latencyMs: Date.now() - startedAt,
          ipAddress,
          idempotencyKey: effectiveIdem
        });
        res.json({
          order: dupMatches[0].id,
          status: String(dupMatches[0].data.status || "Pending"),
          duplicate: true
        });
        return;
      }
      const discountPct = Math.max(0, Math.min(90, Number(customerDoc.customDiscountPercent || 0)));
      const unitRate = Number(srv.sellingPrice ?? 0) * (1 - discountPct / 100);
      const isPkgService = /^package$/i.test(String(srv.serviceType || "").trim()) || /\bpackage\b/i.test(String(srv.deliverySpeed || "")) || /\(\s*package\s*\)/i.test(String(srv.description || "")) || minQty === 1 && maxQty === 1;
      const charge = isPkgService ? Number((quantity * unitRate).toFixed(2)) : Number((quantity / 1e3 * unitRate).toFixed(2));
      const latestCust = await getDocRawWithToken(
        fbTarget,
        accessToken,
        `apiCustomers/${matchedCustomerId}`
      );
      const balanceBefore = Number(latestCust.data.apiBalance ?? 0);
      if (balanceBefore < charge) {
        await failAndLog(402, "Insufficient API balance.");
        return;
      }
      const balanceAfter = Number((balanceBefore - charge).toFixed(2));
      const orderToken = `${Date.now().toString().slice(-6)}${crypto.randomInt(100, 999)}`;
      const internalOrderId = `ord-api-${orderToken}`;
      const apiOrderId = internalOrderId;
      const apiTxnId = `apitxn-${orderToken}`;
      const fullDbPrefix = `projects/${fbTarget.projectId}/databases/${fbTarget.databaseId}/documents`;
      const atomicCommitRes = await fetch(`${firestoreBaseUrl(fbTarget)}:commit`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json"
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
                  totalOrders: Number(latestCust.data.totalOrders ?? 0) + 1
                })
              },
              updateMask: { fieldPaths: ["apiBalance", "totalSpent", "totalOrders"] },
              currentDocument: latestCust.updateTime ? { updateTime: latestCust.updateTime } : { exists: true },
              updateTransforms: [{ fieldPath: "updatedAt", setToServerValue: "REQUEST_TIME" }]
            },
            {
              update: {
                name: `${fullDbPrefix}/orders/${internalOrderId}`,
                fields: encodeFsFields({
                  id: internalOrderId,
                  userId: matchedUserId || matchedCustomerId,
                  serviceId,
                  serviceName: String(srv.name || "").slice(0, 160),
                  categoryId: String(srv.categoryId || "general"),
                  providerId: "",
                  providerOrderId: "",
                  link,
                  quantity,
                  charge,
                  status: "Pending",
                  remains: quantity,
                  startCount: 0,
                  paymentStatus: "paid",
                  paymentTransactionId: apiTxnId,
                  refunded: false,
                  internalNote: `API Gateway Order \xB7 Customer ${matchedCustomerId}`
                })
              },
              currentDocument: { exists: false },
              updateTransforms: [
                { fieldPath: "createdAt", setToServerValue: "REQUEST_TIME" },
                { fieldPath: "updatedAt", setToServerValue: "REQUEST_TIME" }
              ]
            },
            {
              update: {
                name: `${fullDbPrefix}/apiOrders/${apiOrderId}`,
                fields: encodeFsFields({
                  id: apiOrderId,
                  internalOrderId,
                  customerId: matchedCustomerId,
                  userId: matchedUserId || "",
                  keyId: matchedKeyId,
                  installationId: matchedInstallationId,
                  idempotencyKey: effectiveIdem,
                  serviceId,
                  serviceName: String(srv.name || "").slice(0, 160),
                  link,
                  quantity,
                  charge,
                  status: "Pending",
                  startCount: 0,
                  remains: quantity,
                  refunded: false,
                  providerDispatched: false
                })
              },
              currentDocument: { exists: false },
              updateTransforms: [
                { fieldPath: "createdAt", setToServerValue: "REQUEST_TIME" },
                { fieldPath: "updatedAt", setToServerValue: "REQUEST_TIME" }
              ]
            },
            {
              update: {
                name: `${fullDbPrefix}/apiTransactions/${apiTxnId}`,
                fields: encodeFsFields({
                  id: apiTxnId,
                  customerId: matchedCustomerId,
                  userId: matchedUserId || "",
                  type: "order_charge",
                  amount: Number((-charge).toFixed(2)),
                  balanceBefore,
                  balanceAfter,
                  referenceId: apiOrderId,
                  description: `API Order #${apiOrderId} \xB7 ${String(srv.name || serviceId).slice(0, 80)}`,
                  createdBy: matchedCustomerId
                })
              },
              currentDocument: { exists: false },
              updateTransforms: [{ fieldPath: "createdAt", setToServerValue: "REQUEST_TIME" }]
            },
            {
              update: {
                name: `${fullDbPrefix}/apiKeys/${matchedKeyId}`,
                fields: encodeFsFields({
                  requestCount: Number(keyDoc.requestCount ?? 0) + 1
                })
              },
              updateMask: { fieldPaths: ["requestCount"] },
              updateTransforms: [
                { fieldPath: "lastUsedAt", setToServerValue: "REQUEST_TIME" },
                { fieldPath: "updatedAt", setToServerValue: "REQUEST_TIME" }
              ]
            }
          ]
        })
      });
      if (!atomicCommitRes.ok) {
        await failAndLog(409, "Concurrent balance update conflict. Please retry order.");
        return;
      }
      const mappedProviderId = String(srv.providerId || "").trim();
      const mappedProviderServiceId = String(srv.providerServiceId || "").trim();
      let finalStatus = "Pending";
      if (mappedProviderId && mappedProviderServiceId && gwSettings.autoDispatchEnabled !== false) {
        try {
          const provSnap = await getDocRawWithToken(
            fbTarget,
            accessToken,
            `apiProviders/${mappedProviderId}`
          );
          if (!provSnap.exists || provSnap.data.status !== "active") {
            throw new Error("Upstream fulfillment provider is currently unavailable.");
          }
          const provUrl = String(provSnap.data.apiUrl || "").trim();
          const provKey = String(provSnap.data.apiKey || "").trim();
          const addRes = await deps.callUpstreamSmmV2(provUrl, provKey, {
            action: "add",
            service: mappedProviderServiceId,
            link,
            quantity: String(quantity)
          });
          const upstreamOrderId = addRes.order !== void 0 ? String(addRes.order) : "";
          if (!upstreamOrderId) {
            throw new Error("Upstream provider did not return an order reference.");
          }
          finalStatus = "Processing";
          await fetch(`${firestoreBaseUrl(fbTarget)}:commit`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              writes: [
                {
                  update: {
                    name: `${fullDbPrefix}/orders/${internalOrderId}`,
                    fields: encodeFsFields({
                      providerId: mappedProviderId,
                      providerOrderId: upstreamOrderId,
                      status: "Processing"
                    })
                  },
                  updateMask: { fieldPaths: ["providerId", "providerOrderId", "status"] },
                  updateTransforms: [{ fieldPath: "updatedAt", setToServerValue: "REQUEST_TIME" }]
                },
                {
                  update: {
                    name: `${fullDbPrefix}/apiOrders/${apiOrderId}`,
                    fields: encodeFsFields({
                      status: "Processing",
                      providerDispatched: true
                    })
                  },
                  updateMask: { fieldPaths: ["status", "providerDispatched"] },
                  updateTransforms: [{ fieldPath: "updatedAt", setToServerValue: "REQUEST_TIME" }]
                }
              ]
            })
          });
        } catch (dispatchErr) {
          const errMsg = dispatchErr instanceof Error ? dispatchErr.message : "Upstream fulfillment failed.";
          const postDebitCust = await getDocRawWithToken(
            fbTarget,
            accessToken,
            `apiCustomers/${matchedCustomerId}`
          );
          const curBal = Number(postDebitCust.data.apiBalance ?? 0);
          const refundedBal = Number((curBal + charge).toFixed(2));
          const refundTxnId = `apiref-${orderToken}`;
          await fetch(`${firestoreBaseUrl(fbTarget)}:commit`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              writes: [
                {
                  update: {
                    name: `${fullDbPrefix}/apiCustomers/${matchedCustomerId}`,
                    fields: encodeFsFields({ apiBalance: refundedBal })
                  },
                  updateMask: { fieldPaths: ["apiBalance"] },
                  updateTransforms: [{ fieldPath: "updatedAt", setToServerValue: "REQUEST_TIME" }]
                },
                {
                  update: {
                    name: `${fullDbPrefix}/orders/${internalOrderId}`,
                    fields: encodeFsFields({
                      status: "Failed",
                      paymentStatus: "refunded",
                      refunded: true,
                      refundTransactionId: refundTxnId,
                      lastError: errMsg.slice(0, 300)
                    })
                  },
                  updateMask: {
                    fieldPaths: [
                      "status",
                      "paymentStatus",
                      "refunded",
                      "refundTransactionId",
                      "lastError"
                    ]
                  },
                  updateTransforms: [{ fieldPath: "updatedAt", setToServerValue: "REQUEST_TIME" }]
                },
                {
                  update: {
                    name: `${fullDbPrefix}/apiOrders/${apiOrderId}`,
                    fields: encodeFsFields({
                      status: "Failed",
                      refunded: true,
                      refundTransactionId: refundTxnId,
                      errorMessage: errMsg.slice(0, 300)
                    })
                  },
                  updateMask: {
                    fieldPaths: ["status", "refunded", "refundTransactionId", "errorMessage"]
                  },
                  updateTransforms: [{ fieldPath: "updatedAt", setToServerValue: "REQUEST_TIME" }]
                },
                {
                  update: {
                    name: `${fullDbPrefix}/apiTransactions/${refundTxnId}`,
                    fields: encodeFsFields({
                      id: refundTxnId,
                      customerId: matchedCustomerId,
                      userId: matchedUserId || "",
                      type: "refund",
                      amount: charge,
                      balanceBefore: curBal,
                      balanceAfter: refundedBal,
                      referenceId: apiOrderId,
                      description: `Auto-refund for failed API Order #${apiOrderId}`,
                      createdBy: "gateway_auto_refund"
                    })
                  },
                  currentDocument: { exists: false },
                  updateTransforms: [{ fieldPath: "createdAt", setToServerValue: "REQUEST_TIME" }]
                }
              ]
            })
          });
          await failAndLog(422, "Order fulfillment failed; balance has been refunded automatically.");
          return;
        }
      }
      await writeGatewayRequestLog(fbTarget, accessToken, {
        customerId: matchedCustomerId,
        userId: matchedUserId || void 0,
        keyId: matchedKeyId,
        installationId: matchedInstallationId || void 0,
        action: "add",
        httpStatus: 200,
        success: true,
        latencyMs: Date.now() - startedAt,
        ipAddress,
        idempotencyKey: effectiveIdem
      });
      res.json({
        order: apiOrderId,
        status: finalStatus
      });
    } catch (error) {
      await failAndLog(
        500,
        error instanceof Error ? error.message : "Internal API Gateway error."
      );
    }
  };
  app2.post("/api/v2", handlePublicApiV2);
  app2.get("/api/v2", (_req, res) => {
    res.status(405).json({
      error: "Use HTTP POST with form-urlencoded or JSON body (`key`, `action`, ...)."
    });
  });
}

// server/app.ts
var __filename = fileURLToPath(import.meta.url);
var __dirname = path.dirname(__filename);
var requireFromHere = createRequire(import.meta.url);
var UPSTREAM_TIMEOUT_MS = 45e3;
var RETRY_BACKOFF_MINUTES = [2, 5, 15, 30, 60];
var DESIGNATED_ADMIN_EMAIL = "mondalsupartha@gmail.com";
var ADMIN_BOOTSTRAP_PASSWORD = (process.env.ADMIN_BOOTSTRAP_PASSWORD || "QEwyQ8thcspn8Hr").trim();
function safeEqualSecret(candidate, expected) {
  const digestA = crypto2.createHash("sha256").update(candidate).digest();
  const digestB = crypto2.createHash("sha256").update(expected).digest();
  return crypto2.timingSafeEqual(digestA, digestB);
}
function loadFirebaseTargetConfig() {
  try {
    const bundled = requireFromHere("../firebase-applet-config.json");
    if (bundled?.projectId) {
      return {
        projectId: bundled.projectId,
        databaseId: bundled.firestoreDatabaseId || "(default)",
        apiKey: bundled.apiKey || process.env.VITE_FIREBASE_API_KEY || process.env.FIREBASE_API_KEY || ""
      };
    }
  } catch {
  }
  const candidatePaths = [
    path.resolve(__dirname, "..", "firebase-applet-config.json"),
    path.resolve(__dirname, "firebase-applet-config.json"),
    path.resolve(process.cwd(), "firebase-applet-config.json")
  ];
  for (const cfgPath of candidatePaths) {
    try {
      if (fs2.existsSync(cfgPath)) {
        const parsed = JSON.parse(fs2.readFileSync(cfgPath, "utf8"));
        if (parsed.projectId) {
          return {
            projectId: parsed.projectId,
            databaseId: parsed.firestoreDatabaseId || "(default)",
            apiKey: parsed.apiKey || process.env.VITE_FIREBASE_API_KEY || process.env.FIREBASE_API_KEY || ""
          };
        }
      }
    } catch {
    }
  }
  return {
    projectId: process.env.VITE_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID || "",
    databaseId: process.env.VITE_FIREBASE_DATABASE_ID || process.env.FIREBASE_DATABASE_ID || "(default)",
    apiKey: process.env.VITE_FIREBASE_API_KEY || process.env.FIREBASE_API_KEY || ""
  };
}
function resolveRequestFirebaseTarget(body) {
  const fallback = loadFirebaseTargetConfig();
  if (!body || typeof body !== "object") return fallback;
  const record = body;
  const rawProj = typeof record.firebaseProjectId === "string" ? record.firebaseProjectId.trim() : "";
  const rawDb = typeof record.firebaseDatabaseId === "string" ? record.firebaseDatabaseId.trim() : "";
  const rawApiKey = typeof record.firebaseApiKey === "string" ? record.firebaseApiKey.trim() : "";
  const validProject = /^[a-z0-9-]{4,80}$/.test(rawProj) ? rawProj : fallback.projectId;
  const validDb = rawDb === "(default)" || /^[a-z0-9-]{2,80}$/.test(rawDb) ? rawDb : fallback.databaseId;
  const validPayloadApiKey = /^AIza[0-9A-Za-z_-]{20,80}$/.test(rawApiKey) ? rawApiKey : "";
  const resolvedApiKey = (!fallback.apiKey || validProject !== fallback.projectId) && validPayloadApiKey ? validPayloadApiKey : fallback.apiKey;
  return {
    projectId: validProject,
    databaseId: validDb || "(default)",
    apiKey: resolvedApiKey
  };
}
function parseFirestoreValue(raw) {
  if (!raw || typeof raw !== "object") return void 0;
  if ("stringValue" in raw) return String(raw.stringValue);
  if ("integerValue" in raw) return Number(raw.integerValue);
  if ("doubleValue" in raw) return Number(raw.doubleValue);
  if ("booleanValue" in raw) return Boolean(raw.booleanValue);
  if ("timestampValue" in raw) return String(raw.timestampValue);
  if ("nullValue" in raw) return null;
  return void 0;
}
function parseFirestoreDocumentFields(docJson) {
  const result = {};
  const fields = docJson?.fields ?? {};
  for (const [key, val] of Object.entries(fields)) {
    result[key] = parseFirestoreValue(val);
  }
  return result;
}
async function fetchFirestoreDocWithToken(docPath, idToken, targetOverride) {
  const target = targetOverride ?? loadFirebaseTargetConfig();
  if (!target.projectId) {
    throw new Error("Firebase project configuration is not initialized on server.");
  }
  const url = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(
    target.projectId
  )}/databases/${encodeURIComponent(target.databaseId)}/documents/${docPath}`;
  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${idToken}`,
      Accept: "application/json"
    }
  });
  if (response.status === 401 || response.status === 403) {
    throw new Error("Unauthorized: Admin verification required for server-side operation.");
  }
  if (response.status === 404) {
    throw new Error(`Requested document (${docPath}) was not found.`);
  }
  if (!response.ok) {
    throw new Error(`Unable to read Firestore record (${response.status}).`);
  }
  const json = await response.json();
  return parseFirestoreDocumentFields(json);
}
async function lookupFirebaseAuthUser(idToken, apiKey) {
  const resolvedKey = (apiKey || loadFirebaseTargetConfig().apiKey || "").trim();
  if (!resolvedKey) {
    return null;
  }
  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(
      resolvedKey
    )}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken })
    }
  );
  if (!response.ok) {
    throw new Error("Unauthorized: Invalid or expired authentication session.");
  }
  const json = await response.json();
  const user = json.users?.[0];
  if (!user || !user.localId) {
    throw new Error("Unauthorized: User account not found.");
  }
  let customClaims;
  if (typeof user.customAttributes === "string" && user.customAttributes.trim()) {
    try {
      const parsed = JSON.parse(user.customAttributes);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        customClaims = parsed;
      }
    } catch {
    }
  }
  return {
    uid: user.localId,
    email: (user.email || "").trim().toLowerCase(),
    emailVerified: Boolean(user.emailVerified),
    disabled: Boolean(user.disabled),
    customClaims
  };
}
async function getIdentityToolkitAdminToken() {
  try {
    const rawInline = (process.env.FIREBASE_SERVICE_ACCOUNT_JSON || process.env.FIREBASE_SERVICE_ACCOUNT || "").trim();
    let creds = null;
    if (rawInline) {
      creds = JSON.parse(rawInline);
    } else {
      const credPath = (process.env.GOOGLE_APPLICATION_CREDENTIALS || "").trim();
      if (credPath && fs2.existsSync(credPath)) {
        creds = JSON.parse(fs2.readFileSync(credPath, "utf8"));
      }
    }
    if (creds?.client_email && creds?.private_key) {
      const nowSec = Math.floor(Date.now() / 1e3);
      const tokenUri = creds.token_uri || "https://oauth2.googleapis.com/token";
      const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString(
        "base64url"
      );
      const claimSet = Buffer.from(
        JSON.stringify({
          iss: creds.client_email,
          scope: "https://www.googleapis.com/auth/identitytoolkit",
          aud: tokenUri,
          iat: nowSec,
          exp: nowSec + 3600
        })
      ).toString("base64url");
      const signingInput = `${header}.${claimSet}`;
      const signer = crypto2.createSign("RSA-SHA256");
      signer.update(signingInput);
      signer.end();
      const signature = signer.sign(creds.private_key.replace(/\\n/g, "\n"), "base64url");
      const assertion = `${signingInput}.${signature}`;
      const tokenRes = await fetch(tokenUri, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
          assertion
        }).toString()
      });
      if (tokenRes.ok) {
        const json = await tokenRes.json();
        if (json.access_token) return json.access_token;
      }
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 1200);
    try {
      const metaRes = await fetch(
        "http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token",
        {
          method: "GET",
          headers: { "Metadata-Flavor": "Google" },
          signal: controller.signal
        }
      );
      if (metaRes.ok) {
        const metaJson = await metaRes.json();
        if (metaJson.access_token) return metaJson.access_token;
      }
    } finally {
      clearTimeout(timer);
    }
  } catch {
  }
  return null;
}
async function syncAdminCustomClaimsBestEffort(uid, existingClaims, target, currentEmailVerified = true) {
  const needsClaims = !(existingClaims?.admin === true && existingClaims?.role === "admin" && existingClaims?.staffRole === "super_admin");
  const needsEmailVerified = !currentEmailVerified;
  if (!needsClaims && !needsEmailVerified) {
    return false;
  }
  try {
    const adminToken = await getIdentityToolkitAdminToken();
    if (!adminToken || !target.projectId) return false;
    const mergedClaims = {
      ...existingClaims ?? {},
      role: "admin",
      admin: true,
      staffRole: "super_admin"
    };
    const res = await fetch(
      `https://identitytoolkit.googleapis.com/v1/projects/${encodeURIComponent(
        target.projectId
      )}/accounts:update`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${adminToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          localId: uid,
          ...needsEmailVerified ? { emailVerified: true } : {},
          ...needsClaims ? { customAttributes: JSON.stringify(mergedClaims) } : {}
        })
      }
    );
    return res.ok;
  } catch {
    return false;
  }
}
async function verifyAdminViaFirestoreRest(idToken, target) {
  if (!target.projectId) {
    throw new Error("Firebase project configuration is missing.");
  }
  const authUser = await lookupFirebaseAuthUser(idToken, target.apiKey);
  if (!authUser) {
    throw new Error("Unauthorized: Firebase API key configuration is missing.");
  }
  if (authUser.disabled || authUser.email !== DESIGNATED_ADMIN_EMAIL) {
    throw new Error("Unauthorized: Admin privileges required.");
  }
  const url = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(
    target.projectId
  )}/databases/${encodeURIComponent(target.databaseId)}/documents/settings/setup`;
  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${idToken}`,
      Accept: "application/json"
    }
  });
  if (response.status !== 200 && response.status !== 404) {
    throw new Error("Unauthorized: Admin privileges required.");
  }
}
function mapProviderStatusToInternal(rawStatus) {
  const lower = rawStatus.trim().toLowerCase();
  if (lower.includes("complete") || lower === "finish" || lower === "finished") {
    return "Completed";
  }
  if (lower.includes("partial")) {
    return "Partial";
  }
  if (lower.includes("in progress") || lower === "inprogress") {
    return "In Progress";
  }
  if (lower.includes("process")) {
    return "Processing";
  }
  if (lower.includes("cancel") || lower.includes("refund")) {
    return "Cancelled";
  }
  if (lower.includes("fail") || lower.includes("error")) {
    return "Failed";
  }
  return "Pending";
}
function computeNextRetrySchedule(currentRetryCount) {
  const nextCount = Math.min(20, Math.max(1, currentRetryCount + 1));
  const idx = Math.min(RETRY_BACKOFF_MINUTES.length - 1, nextCount - 1);
  const backoffMinutes = RETRY_BACKOFF_MINUTES[idx];
  return {
    retryCount: nextCount,
    backoffMinutes,
    nextRetryAtMs: Date.now() + backoffMinutes * 60 * 1e3
  };
}
function extractBearerToken(req) {
  const header = req.headers.authorization || "";
  if (header.startsWith("Bearer ")) {
    return header.slice("Bearer ".length).trim();
  }
  return "";
}
function isBlockedHostname(hostname) {
  const lower = hostname.trim().toLowerCase();
  if (!lower) return true;
  if (lower === "localhost" || lower === "0.0.0.0" || lower === "::1" || lower === "[::1]" || lower.endsWith(".local") || lower.endsWith(".internal")) {
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
function validateProviderUrl(rawUrl) {
  const trimmed = rawUrl.trim();
  let parsed;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error("Invalid API URL format. Please enter a valid https:// URL.");
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new Error("API URL must use https:// or http:// protocol.");
  }
  if (isBlockedHostname(parsed.hostname)) {
    throw new Error("Private or localhost provider URLs are not allowed.");
  }
  return parsed;
}
function normalizeServerErrorText(value, fallback = "Provider API request failed.") {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed || fallback;
  }
  if (value instanceof Error) {
    return value.message?.trim() || fallback;
  }
  if (Array.isArray(value)) {
    const parts = value.map((item) => normalizeServerErrorText(item, "")).filter(Boolean);
    return parts.length > 0 ? parts.join("; ") : fallback;
  }
  if (value && typeof value === "object") {
    const record = value;
    for (const field of ["message", "error", "detail", "reason", "statusText", "description"]) {
      if (record[field] !== void 0 && record[field] !== null) {
        const extracted = normalizeServerErrorText(record[field], "");
        if (extracted) {
          const codePrefix = typeof record.code === "number" || typeof record.code === "string" ? `[${record.code}] ` : "";
          return `${codePrefix}${extracted}`;
        }
      }
    }
    try {
      const serialized = JSON.stringify(value);
      if (serialized && serialized !== "{}") return serialized;
    } catch {
    }
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return fallback;
}
function sanitizeErrorMessage(message, secretKey) {
  let clean = normalizeServerErrorText(message, "Provider API request failed.");
  const trimmedKey = typeof secretKey === "string" ? secretKey.trim() : "";
  if (trimmedKey.length > 0) {
    clean = clean.split(trimmedKey).join("[REDACTED]");
  }
  return clean.slice(0, 260);
}
function parseUpstreamNumber(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : NaN;
  if (typeof value === "string") {
    const cleaned = value.replace(/[^0-9.-]/g, "").trim();
    if (!cleaned) return NaN;
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : NaN;
  }
  return NaN;
}
function extractServicesArray(raw) {
  if (Array.isArray(raw)) {
    return raw.filter(
      (row) => Boolean(row && typeof row === "object")
    );
  }
  if (raw && typeof raw === "object") {
    const record = raw;
    for (const key of ["services", "data", "result", "items"]) {
      const candidate = record[key];
      if (Array.isArray(candidate)) {
        return candidate.filter(
          (row) => Boolean(row && typeof row === "object")
        );
      }
    }
    const entries = Object.entries(record);
    if (entries.length > 0 && entries.every(([, v]) => v && typeof v === "object" && !Array.isArray(v))) {
      return entries.map(([keyId, v]) => {
        const obj = v;
        return obj.service !== void 0 || obj.id !== void 0 ? obj : { service: keyId, ...obj };
      });
    }
  }
  return null;
}
function describeNonJsonResponse(rawText, status, secretKey) {
  const trimmed = rawText.trim();
  const titleMatch = /<title[^>]*>([^<]+)<\/title>/i.exec(trimmed);
  const snippet = titleMatch?.[1] ? titleMatch[1].replace(/\s+/g, " ").trim() : trimmed.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 140);
  const base = snippet ? `Provider returned HTTP ${status} non-JSON response: ${snippet}` : `Provider returned HTTP ${status} empty or non-JSON response.`;
  return sanitizeErrorMessage(base, secretKey);
}
async function callUpstreamSmmV2(apiUrl, apiKey, params) {
  let currentUrl = validateProviderUrl(apiUrl);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
  try {
    const body = new URLSearchParams({
      key: apiKey,
      ...params
    });
    let response = null;
    for (let hop = 0; hop < 4; hop += 1) {
      response = await fetch(currentUrl.toString(), {
        method: "POST",
        redirect: "manual",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
          Accept: "application/json, text/plain, */*",
          "User-Agent": "Mozilla/5.0 (compatible; SuparthaPanel-SMM-Client/2.0)"
        },
        body: body.toString(),
        signal: controller.signal
      });
      if (response.status === 301 || response.status === 302 || response.status === 303 || response.status === 307 || response.status === 308) {
        const location = response.headers.get("location");
        if (!location) break;
        const resolved = new URL(location, currentUrl).toString();
        currentUrl = validateProviderUrl(resolved);
        continue;
      }
      break;
    }
    if (!response) {
      throw new Error("Unable to reach provider API endpoint.");
    }
    const rawText = (await response.text()).replace(/^\uFEFF/, "").trim();
    let parsed = null;
    if (rawText) {
      try {
        parsed = JSON.parse(rawText);
      } catch {
        parsed = null;
      }
    }
    if (!response.ok) {
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        const errObj = parsed;
        const upstreamMsg = errObj.error ?? errObj.message;
        if (upstreamMsg !== void 0 && upstreamMsg !== null && upstreamMsg !== "") {
          throw new Error(sanitizeErrorMessage(upstreamMsg, apiKey));
        }
      }
      throw new Error(describeNonJsonResponse(rawText, response.status, apiKey));
    }
    if (parsed === null) {
      throw new Error(describeNonJsonResponse(rawText, response.status, apiKey));
    }
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed) && "error" in parsed && parsed.error) {
      throw new Error(sanitizeErrorMessage(parsed.error, apiKey));
    }
    return parsed;
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error("Provider API request timed out after 45 seconds.");
    }
    if (err instanceof Error) {
      throw new Error(sanitizeErrorMessage(err.message, apiKey));
    }
    throw new Error("Unable to reach provider API endpoint.");
  } finally {
    clearTimeout(timer);
  }
}
function createApiApp() {
  const app2 = express();
  app2.set("trust proxy", 1);
  app2.use((req, _res, next) => {
    try {
      const parsed = new URL(req.url || "/", "http://localhost");
      const rewrittenPath = parsed.searchParams.get("__api_path");
      if (rewrittenPath !== null) {
        parsed.searchParams.delete("__api_path");
        if (req.query && typeof req.query === "object" && "__api_path" in req.query) {
          delete req.query.__api_path;
        }
        const cleanSubpath = rewrittenPath.replace(/^\/+/, "").replace(/^api\/+/, "");
        const qs = parsed.searchParams.toString();
        req.url = `/api${cleanSubpath ? `/${cleanSubpath}` : ""}${qs ? `?${qs}` : ""}`;
      }
    } catch {
    }
    next();
  });
  app2.use("/api", (req, res, next) => {
    const origin = req.headers.origin;
    if (origin) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Vary", "Origin");
    } else {
      res.setHeader("Access-Control-Allow-Origin", "*");
    }
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, Accept");
    res.setHeader("Access-Control-Max-Age", "86400");
    if (req.method === "OPTIONS") {
      res.status(204).end();
      return;
    }
    next();
  });
  app2.use(express.json({ limit: "2mb" }));
  app2.use(express.urlencoded({ extended: true, limit: "2mb" }));
  app2.get("/api/health", (_req, res) => {
    const target = loadFirebaseTargetConfig();
    res.json({
      ok: true,
      runtime: process.env.VERCEL ? "vercel-serverless" : "node-express",
      firebaseConfigured: Boolean(target.projectId && target.apiKey)
    });
  });
  app2.post("/api/auth/bootstrap-admin", async (req, res) => {
    const rawEmail = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
    const rawPassword = typeof req.body?.password === "string" ? req.body.password : "";
    if (!rawEmail || !rawPassword || rawEmail !== DESIGNATED_ADMIN_EMAIL || !safeEqualSecret(rawPassword, ADMIN_BOOTSTRAP_PASSWORD)) {
      res.status(401).json({ ok: false, error: "Incorrect email or password." });
      return;
    }
    const fbTarget = resolveRequestFirebaseTarget(req.body);
    const resolvedKey = (fbTarget.apiKey || "").trim();
    if (!resolvedKey) {
      res.status(500).json({ ok: false, error: "Firebase API key is not configured." });
      return;
    }
    try {
      const signUpRes = await fetch(
        `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${encodeURIComponent(
          resolvedKey
        )}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: DESIGNATED_ADMIN_EMAIL,
            password: ADMIN_BOOTSTRAP_PASSWORD,
            returnSecureToken: true
          })
        }
      );
      const signUpJson = await signUpRes.json().catch(() => ({}));
      if (!signUpRes.ok || !signUpJson.localId) {
        const msg = String(signUpJson.error?.message || "").toUpperCase();
        if (msg.includes("OPERATION_NOT_ALLOWED")) {
          res.status(400).json({
            ok: false,
            code: "EMAIL_PASSWORD_DISABLED",
            error: "Email/Password sign-in is not yet enabled in this Firebase project. Enable Authentication -> Sign-in method -> Email/Password in Firebase Console."
          });
          return;
        }
        res.status(401).json({
          ok: false,
          code: msg.includes("EMAIL_EXISTS") ? "EMAIL_EXISTS" : "BOOTSTRAP_FAILED",
          error: "Incorrect email or password."
        });
        return;
      }
      await syncAdminCustomClaimsBestEffort(signUpJson.localId, void 0, fbTarget, false);
      res.json({ ok: true, created: true });
    } catch {
      res.status(500).json({ ok: false, error: "Unable to initialize admin credentials." });
    }
  });
  app2.post("/api/auth/verify-admin", async (req, res) => {
    const idToken = extractBearerToken(req);
    if (!idToken) {
      res.status(401).json({ ok: false, isAdmin: false, error: "Authentication token required." });
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
          reason: authUser?.disabled ? "disabled" : "not_admin"
        });
        return;
      }
      let firestoreVerified = false;
      try {
        await verifyAdminViaFirestoreRest(idToken, fbTarget);
        firestoreVerified = true;
      } catch (fsErr) {
        console.warn(
          "[verify-admin] Firestore REST verification skipped/failed for designated admin:",
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
        staffRole: "super_admin",
        role: "admin",
        claimsSynced,
        firestoreVerified,
        reason: "verified"
      });
    } catch {
      res.json({
        ok: true,
        isAdmin: false,
        staffRole: null,
        reason: "not_admin"
      });
    }
  });
  registerGatewayRoutes(app2, {
    resolveRequestFirebaseTarget,
    extractBearerToken,
    verifyAdminViaFirestoreRest,
    fetchFirestoreDocWithToken,
    callUpstreamSmmV2,
    sanitizeErrorMessage,
    mapProviderStatusToInternal
  });
  app2.post("/api/orders/dispatch", async (req, res) => {
    const idToken = extractBearerToken(req);
    if (!idToken) {
      res.status(401).json({ ok: false, error: "Authentication token required." });
      return;
    }
    const orderId = typeof req.body?.orderId === "string" ? req.body.orderId.trim() : "";
    const providerIdOverride = typeof req.body?.providerIdOverride === "string" ? req.body.providerIdOverride.trim() : "";
    if (!orderId) {
      res.status(400).json({ ok: false, error: "orderId is required." });
      return;
    }
    const fbTarget = resolveRequestFirebaseTarget(req.body);
    let secretKey = "";
    try {
      await verifyAdminViaFirestoreRest(idToken, fbTarget);
      const orderDoc = await fetchFirestoreDocWithToken(`orders/${orderId}`, idToken, fbTarget);
      if (orderDoc.refunded) {
        res.status(400).json({ ok: false, error: "Order was already refunded." });
        return;
      }
      const serviceId = String(orderDoc.serviceId || "").trim();
      const serviceDoc = await fetchFirestoreDocWithToken(`services/${serviceId}`, idToken, fbTarget);
      const providerServiceId = String(serviceDoc.providerServiceId || serviceId || "").trim();
      const providerId = providerIdOverride || String(orderDoc.providerId || "").trim() || String(serviceDoc.providerId || "").trim();
      if (!providerId || !providerServiceId) {
        res.status(400).json({
          ok: false,
          error: "Service is not mapped to an API Provider and Provider Service ID."
        });
        return;
      }
      const providerDoc = await fetchFirestoreDocWithToken(
        `apiProviders/${providerId}`,
        idToken,
        fbTarget
      );
      if (providerDoc.status !== "active") {
        res.status(400).json({ ok: false, error: "Mapped API provider is currently inactive." });
        return;
      }
      const apiUrl = String(providerDoc.apiUrl || "").trim();
      secretKey = String(providerDoc.apiKey || "").trim();
      if (!apiUrl || !secretKey) {
        res.status(400).json({ ok: false, error: "Provider API credentials are incomplete." });
        return;
      }
      const addRes = await callUpstreamSmmV2(apiUrl, secretKey, {
        action: "add",
        service: providerServiceId,
        link: String(orderDoc.link || ""),
        quantity: String(Math.floor(Number(orderDoc.quantity || 0)))
      });
      const providerOrderId = addRes.order !== void 0 ? String(addRes.order) : "";
      if (!providerOrderId) {
        throw new Error("Provider did not return a valid order reference.");
      }
      res.json({
        ok: true,
        data: {
          providerId,
          providerOrderId
        }
      });
    } catch (error) {
      const msg = error instanceof Error ? sanitizeErrorMessage(error.message, secretKey) : "Unable to dispatch order to provider.";
      res.status(422).json({ ok: false, error: msg });
    }
  });
  app2.post("/api/orders/sync-status", async (req, res) => {
    const idToken = extractBearerToken(req);
    if (!idToken) {
      res.status(401).json({ ok: false, error: "Authentication token required." });
      return;
    }
    const orderId = typeof req.body?.orderId === "string" ? req.body.orderId.trim() : "";
    const forceRetry = Boolean(req.body?.forceRetry);
    if (!orderId) {
      res.status(400).json({ ok: false, error: "orderId is required." });
      return;
    }
    const fbTarget = resolveRequestFirebaseTarget(req.body);
    let secretKey = "";
    let currentRetryCount = 0;
    try {
      await verifyAdminViaFirestoreRest(idToken, fbTarget);
      const orderDoc = await fetchFirestoreDocWithToken(`orders/${orderId}`, idToken, fbTarget);
      const providerId = String(orderDoc.providerId || "").trim();
      const providerOrderId = String(orderDoc.providerOrderId || "").trim();
      currentRetryCount = Math.max(0, Number(orderDoc.retryCount || 0));
      if (!providerId || !providerOrderId) {
        res.status(400).json({
          ok: false,
          error: "Order has not been dispatched to an API provider yet."
        });
        return;
      }
      if (!forceRetry && typeof orderDoc.nextRetryAt === "string") {
        const nextMs = Date.parse(orderDoc.nextRetryAt);
        if (Number.isFinite(nextMs) && nextMs > Date.now()) {
          res.status(429).json({
            ok: false,
            retryScheduled: true,
            retryCount: currentRetryCount,
            nextRetryAtMs: nextMs,
            error: "Retry cooldown active to avoid overloading upstream provider."
          });
          return;
        }
      }
      const providerDoc = await fetchFirestoreDocWithToken(
        `apiProviders/${providerId}`,
        idToken,
        fbTarget
      );
      const apiUrl = String(providerDoc.apiUrl || "").trim();
      secretKey = String(providerDoc.apiKey || "").trim();
      if (!apiUrl || !secretKey) {
        throw new Error("Provider credentials are missing or incomplete.");
      }
      const remote = await callUpstreamSmmV2(apiUrl, secretKey, {
        action: "status",
        order: providerOrderId
      });
      const rawStatus = String(remote.status ?? "Pending");
      const mappedStatus = mapProviderStatusToInternal(rawStatus);
      const parsedStart = remote.start_count !== void 0 && Number.isFinite(Number(remote.start_count)) ? Math.max(0, Number(remote.start_count)) : void 0;
      const parsedRemains = remote.remains !== void 0 && Number.isFinite(Number(remote.remains)) ? Math.max(0, Number(remote.remains)) : mappedStatus === "Completed" ? 0 : void 0;
      const parsedCharge = remote.charge !== void 0 && Number.isFinite(Number(remote.charge)) ? Math.max(0, Number(remote.charge)) : void 0;
      res.json({
        ok: true,
        data: {
          rawStatus,
          mappedStatus,
          startCount: parsedStart,
          remains: parsedRemains,
          providerCharge: parsedCharge,
          refundEligible: mappedStatus === "Partial",
          autoRefundRecommended: mappedStatus === "Cancelled" || mappedStatus === "Failed",
          lastCheckedAtMs: Date.now()
        }
      });
    } catch (error) {
      const sanitized = error instanceof Error ? sanitizeErrorMessage(error.message, secretKey) : "Provider status check failed.";
      const schedule = computeNextRetrySchedule(currentRetryCount);
      res.status(422).json({
        ok: false,
        retryScheduled: true,
        retryCount: schedule.retryCount,
        backoffMinutes: schedule.backoffMinutes,
        nextRetryAtMs: schedule.nextRetryAtMs,
        error: sanitized
      });
    }
  });
  app2.post("/api/provider/execute", async (req, res) => {
    const idToken = extractBearerToken(req);
    if (!idToken) {
      res.status(401).json({ ok: false, error: "Admin authentication token required." });
      return;
    }
    const payload = req.body ?? {};
    const action = payload.action;
    const providerId = typeof payload.providerId === "string" ? payload.providerId.trim() : "";
    let apiUrl = typeof payload.apiUrl === "string" ? payload.apiUrl.trim() : "";
    let apiKey = typeof payload.apiKey === "string" ? payload.apiKey.trim() : "";
    if (!action) {
      res.status(400).json({ ok: false, error: "Missing provider action." });
      return;
    }
    const fbTarget = resolveRequestFirebaseTarget(payload);
    try {
      const authUser = await lookupFirebaseAuthUser(idToken, fbTarget.apiKey);
      if (!authUser || authUser.disabled || authUser.email !== DESIGNATED_ADMIN_EMAIL) {
        res.status(403).json({ ok: false, error: "Unauthorized: Admin privileges required." });
        return;
      }
      if (providerId) {
        try {
          const provDoc = await fetchFirestoreDocWithToken(
            `apiProviders/${providerId}`,
            idToken,
            fbTarget
          );
          const storedUrl = String(provDoc.apiUrl || "").trim();
          const storedKey = String(provDoc.apiKey || "").trim();
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
            "[provider/execute] Firestore RBAC probe warning:",
            fsErr instanceof Error ? fsErr.message : String(fsErr)
          );
        }
      }
      if (!apiUrl || !apiKey) {
        res.status(400).json({ ok: false, error: "Provider API URL and API Key are required." });
        return;
      }
      if (action === "balance" || action === "testConnection") {
        const balanceData = await callUpstreamSmmV2(apiUrl, apiKey, {
          action: "balance"
        });
        if (!balanceData || typeof balanceData !== "object" || Array.isArray(balanceData)) {
          throw new Error("Provider balance response did not return a valid JSON object.");
        }
        const rawBalance = parseUpstreamNumber(balanceData.balance);
        const currency = typeof balanceData.currency === "string" && balanceData.currency.trim() ? balanceData.currency.trim() : "USD";
        if (!("balance" in balanceData) || !Number.isFinite(rawBalance)) {
          throw new Error('Provider balance response did not include a valid "balance" field.');
        }
        if (action === "testConnection") {
          const rawServices = await callUpstreamSmmV2(apiUrl, apiKey, {
            action: "services"
          });
          const serviceRows = extractServicesArray(rawServices);
          if (!serviceRows) {
            throw new Error(
              "Balance check succeeded, but provider services endpoint did not return a valid service list."
            );
          }
          res.json({
            ok: true,
            data: {
              ok: true,
              message: `Connected (${serviceRows.length} services, Balance: ${rawBalance.toFixed(2)} ${currency})`,
              balance: rawBalance,
              currency,
              serviceCount: serviceRows.length
            }
          });
          return;
        }
        res.json({
          ok: true,
          data: {
            balance: rawBalance,
            currency
          }
        });
        return;
      }
      if (action === "services") {
        const rawServices = await callUpstreamSmmV2(apiUrl, apiKey, {
          action: "services"
        });
        const serviceRows = extractServicesArray(rawServices);
        if (!serviceRows) {
          throw new Error("Provider services endpoint did not return a valid service list array.");
        }
        res.json({
          ok: true,
          data: serviceRows
        });
        return;
      }
      if (action === "add") {
        const service = typeof payload.service === "string" ? payload.service.trim() : "";
        const link = typeof payload.link === "string" ? payload.link.trim() : "";
        const quantity = Math.floor(Number(payload.quantity ?? 0));
        if (!service || !link || !Number.isFinite(quantity) || quantity < 1) {
          res.status(400).json({
            ok: false,
            error: "Valid service ID, link, and positive quantity are required."
          });
          return;
        }
        const addRes = await callUpstreamSmmV2(apiUrl, apiKey, {
          action: "add",
          service,
          link,
          quantity: String(quantity)
        });
        res.json({
          ok: true,
          data: {
            order: addRes.order !== void 0 ? String(addRes.order) : ""
          }
        });
        return;
      }
      if (action === "status") {
        const order = typeof payload.order === "string" ? payload.order.trim() : "";
        if (!order) {
          res.status(400).json({ ok: false, error: "Provider order ID is required." });
          return;
        }
        const statusRes = await callUpstreamSmmV2(apiUrl, apiKey, {
          action: "status",
          order
        });
        res.json({
          ok: true,
          data: statusRes
        });
        return;
      }
      res.status(400).json({ ok: false, error: "Unsupported provider action." });
    } catch (error) {
      const msg = error instanceof Error ? sanitizeErrorMessage(error.message, apiKey) : "Provider request failed.";
      res.status(422).json({
        ok: false,
        error: msg
      });
    }
  });
  app2.use("/api", (_req, res) => {
    res.status(404).json({ ok: false, error: "API endpoint not found." });
  });
  app2.use("/api", (err, _req, res, _next) => {
    const message = normalizeServerErrorText(err, "Internal API server error.");
    res.status(500).json({ ok: false, error: message });
  });
  return app2;
}

// server/vercel.ts
var app = createApiApp();
var vercel_default = app;
export {
  vercel_default as default
};
