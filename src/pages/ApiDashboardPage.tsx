import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertCircle,
  Ban,
  Check,
  Code2,
  Copy,
  KeyRound,
  Layers,
  Loader2,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Terminal,
  Wallet,
  X,
} from 'lucide-react';
import { APP_CONFIG, resolveBrandName } from '../config/app.config';
import { useApp } from '../context/AppContext';
import type { ApiKeyPermission, ApiKeyStatus } from '../lib/firestore/collections';
import {
  apiGatewayService,
  type ApiCustomerItem,
  type ApiGatewaySettingsItem,
  type ApiKeyItem,
  type ApiOrderItem,
  type ApiRequestLogItem,
  type ApiTransactionItem,
  type GeneratedApiKeyResponse,
  DEFAULT_GATEWAY_SETTINGS,
} from '../services/apiGateway.service';
import { normalizeCurrencySymbol } from '../utils/pricing';

type ApiSubTab = 'overview' | 'keys' | 'docs' | 'balance' | 'orders' | 'logs';
type CodeLang = 'curl' | 'javascript' | 'php';

const PERMISSION_OPTIONS: Array<{ id: ApiKeyPermission; label: string }> = [
  { id: 'balance', label: 'Balance' },
  { id: 'services', label: 'Services' },
  { id: 'add', label: 'Create Order' },
  { id: 'status', label: 'Order Status' },
];

export function ApiDashboardPage() {
  const { firebaseUser, profile, systemSettings, showToast } = useApp();
  const currencyCode = systemSettings?.currency?.trim() || APP_CONFIG.currencyCode;
  const currencySymbol = normalizeCurrencySymbol(systemSettings?.currencySymbol, currencyCode);
  const brandName = resolveBrandName(systemSettings?.websiteName);

  const [subTab, setSubTab] = useState<ApiSubTab>('overview');
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [customer, setCustomer] = useState<ApiCustomerItem | null>(null);
  const [keys, setKeys] = useState<ApiKeyItem[]>([]);
  const [orders, setOrders] = useState<ApiOrderItem[]>([]);
  const [transactions, setTransactions] = useState<ApiTransactionItem[]>([]);
  const [logs, setLogs] = useState<ApiRequestLogItem[]>([]);
  const [gatewaySettings, setGatewaySettings] =
    useState<ApiGatewaySettingsItem>(DEFAULT_GATEWAY_SETTINGS);

  // Filters & UI states
  const [orderSearch, setOrderSearch] = useState('');
  const [txnFilter, setTxnFilter] = useState<'all' | ApiTransactionItem['type']>('all');
  const [logFilter, setLogFilter] = useState<'all' | 'success' | 'error'>('all');
  const [codeLang, setCodeLang] = useState<CodeLang>('curl');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Generate Key form
  const [createOpen, setCreateOpen] = useState(false);
  const [newKeyLabel, setNewKeyLabel] = useState('Production Panel Key');
  const [newKeyPerms, setNewKeyPerms] = useState<ApiKeyPermission[]>([
    'balance',
    'services',
    'add',
    'status',
  ]);
  const [keyBusy, setKeyBusy] = useState(false);

  // One-time Plaintext Key Reveal Modal
  const [revealedKeyModal, setRevealedKeyModal] = useState<GeneratedApiKeyResponse | null>(null);

  const endpointUrl = useMemo(() => {
    if (gatewaySettings.defaultBaseUrl?.trim()) {
      return gatewaySettings.defaultBaseUrl.trim();
    }
    if (typeof window !== 'undefined') {
      return `${window.location.origin}/api/v2`;
    }
    return '/api/v2';
  }, [gatewaySettings.defaultBaseUrl]);

  const loadWorkspace = useCallback(async () => {
    if (!firebaseUser?.uid) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setErrorMsg(null);
    try {
      const uid = firebaseUser.uid;
      const ensured = await apiGatewayService.ensureMyResellerAccess({
        uid,
        name: profile?.fullName || firebaseUser.displayName || 'Reseller',
        email: profile?.email || firebaseUser.email || `${uid}@panel.local`,
      });
      const [orderList, txnList, logList, gwSettings] = await Promise.all([
        apiGatewayService.listMyApiOrders(uid).catch(() => []),
        apiGatewayService.listMyApiTransactions(uid).catch(() => []),
        apiGatewayService.listMyApiRequestLogs(uid).catch(() => []),
        apiGatewayService.getApiGatewaySettings(),
      ]);
      setCustomer(ensured.customer);
      setKeys(ensured.keys);
      if (ensured.initialGeneratedKey) {
        setRevealedKeyModal(ensured.initialGeneratedKey);
      }
      setOrders(orderList);
      setTransactions(txnList);
      setLogs(logList);
      setGatewaySettings(gwSettings);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to load Reseller API workspace.');
    } finally {
      setLoading(false);
    }
  }, [firebaseUser?.displayName, firebaseUser?.email, firebaseUser?.uid, profile?.email, profile?.fullName]);

  useEffect(() => {
    loadWorkspace();
  }, [loadWorkspace]);

  const copyText = useCallback(
    async (text: string, id: string, label = 'Copied') => {
      try {
        await navigator.clipboard.writeText(text);
        setCopiedId(id);
        window.setTimeout(() => setCopiedId((p) => (p === id ? null : p)), 1800);
        showToast({ title: label, description: 'Copied to clipboard.', tone: 'success' });
      } catch {
        showToast({ title: 'Copy Failed', description: 'Please copy manually.', tone: 'warning' });
      }
    },
    [showToast]
  );

  const usageStats = useMemo(() => {
    const total = logs.length;
    const succeeded = logs.filter((l) => l.success).length;
    const failed = total - succeeded;
    const successRate = total > 0 ? Math.round((succeeded / total) * 100) : 100;
    const avgLatency =
      total > 0 ? Math.round(logs.reduce((sum, l) => sum + l.latencyMs, 0) / total) : 0;

    const actionCounts = new Map<string, number>();
    for (const l of logs) {
      actionCounts.set(l.action, (actionCounts.get(l.action) ?? 0) + 1);
    }
    const breakdown = Array.from(actionCounts.entries()).sort((a, b) => b[1] - a[1]);

    return { total, succeeded, failed, successRate, avgLatency, breakdown };
  }, [logs]);

  const filteredOrders = useMemo(() => {
    const q = orderSearch.trim().toLowerCase();
    if (!q) return orders;
    return orders.filter(
      (o) =>
        o.id.toLowerCase().includes(q) ||
        o.serviceName.toLowerCase().includes(q) ||
        o.link.toLowerCase().includes(q) ||
        o.status.toLowerCase().includes(q)
    );
  }, [orders, orderSearch]);

  const filteredTxns = useMemo(() => {
    if (txnFilter === 'all') return transactions;
    return transactions.filter((t) => t.type === txnFilter);
  }, [transactions, txnFilter]);

  const filteredLogs = useMemo(() => {
    if (logFilter === 'success') return logs.filter((l) => l.success);
    if (logFilter === 'error') return logs.filter((l) => !l.success);
    return logs;
  }, [logs, logFilter]);

  const handleGenerateKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customer) return;
    if (newKeyPerms.length === 0) {
      showToast({
        title: 'Permission Required',
        description: 'Select at least one API scope permission.',
        tone: 'warning',
      });
      return;
    }
    setKeyBusy(true);
    try {
      const created = await apiGatewayService.generateApiKey({
        customerId: customer.id,
        label: newKeyLabel.trim() || 'Production API Key',
        permissions: newKeyPerms,
        rateLimitPerMinute: customer.rateLimitPerMinute || 60,
      });
      setCreateOpen(false);
      setNewKeyLabel('Production Panel Key');
      setRevealedKeyModal(created);
      await loadWorkspace();
    } catch (err) {
      showToast({
        title: 'Key Generation Failed',
        description: err instanceof Error ? err.message : 'Unable to generate key.',
        tone: 'error',
      });
    } finally {
      setKeyBusy(false);
    }
  };

  const handleRegenerateKey = async (keyItem: ApiKeyItem) => {
    setKeyBusy(true);
    try {
      const regenerated = await apiGatewayService.regenerateApiKey(keyItem.id);
      setRevealedKeyModal(regenerated);
      showToast({
        title: 'API Key Regenerated',
        description: 'Previous key has been revoked immediately.',
        tone: 'success',
      });
      await loadWorkspace();
    } catch (err) {
      showToast({
        title: 'Regeneration Failed',
        description: err instanceof Error ? err.message : 'Unable to regenerate API key.',
        tone: 'error',
      });
    } finally {
      setKeyBusy(false);
    }
  };

  const handleSetKeyStatus = async (keyItem: ApiKeyItem, nextStatus: ApiKeyStatus) => {
    try {
      await apiGatewayService.updateOwnApiKey({ keyId: keyItem.id, status: nextStatus });
      setKeys((prev) =>
        prev.map((k) => (k.id === keyItem.id ? { ...k, status: nextStatus } : k))
      );
      showToast({
        title: 'API Key Updated',
        description: `${keyItem.label} is now ${nextStatus}.`,
        tone: 'success',
      });
    } catch (err) {
      showToast({
        title: 'Update Failed',
        description: err instanceof Error ? err.message : 'Could not update key status.',
        tone: 'error',
      });
    }
  };

  const togglePermission = (perm: ApiKeyPermission) => {
    setNewKeyPerms((prev) =>
      prev.includes(perm) ? prev.filter((p) => p !== perm) : [...prev, perm]
    );
  };

  const docSnippet = useMemo(() => {
    if (codeLang === 'curl') {
      return `# 1. Check API Balance
curl -X POST "${endpointUrl}" \\
  -d "key=YOUR_RJW_API_KEY" \\
  -d "action=balance"

# 2. List Active Services
curl -X POST "${endpointUrl}" \\
  -d "key=YOUR_RJW_API_KEY" \\
  -d "action=services"

# 3. Place Order (with Idempotency Key)
curl -X POST "${endpointUrl}" \\
  -H "Idempotency-Key: order-ref-1001" \\
  -d "key=YOUR_RJW_API_KEY" \\
  -d "action=add" \\
  -d "service=SERVICE_ID" \\
  -d "link=https://instagram.com/username" \\
  -d "quantity=1000"

# 4. Single / Multiple Order Status
curl -X POST "${endpointUrl}" \\
  -d "key=YOUR_RJW_API_KEY" \\
  -d "action=status" \\
  -d "orders=ORDER_ID_1,ORDER_ID_2"`;
    }

    if (codeLang === 'javascript') {
      return `const endpoint = "${endpointUrl}";

async function callRjwApi(payload, idempotencyKey) {
  const body = new URLSearchParams({
    key: process.env.RJW_API_KEY,
    ...payload,
  });

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
    },
    body: body.toString(),
  });
  return res.json();
}

// Example: Place an order
const order = await callRjwApi(
  {
    action: "add",
    service: "SERVICE_ID",
    link: "https://instagram.com/username",
    quantity: "1000",
  },
  "req-1001"
);`;
    }

    return `<?php
$endpoint = "${endpointUrl}";
$postData = [
  "key" => getenv("RJW_API_KEY"),
  "action" => "add",
  "service" => "SERVICE_ID",
  "link" => "https://instagram.com/username",
  "quantity" => 1000,
  "idempotency_key" => "php-order-1001"
];

$ch = curl_init($endpoint);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query($postData));
$response = curl_exec($ch);
curl_close($ch);
echo $response;
?>`;
  }, [codeLang, endpointUrl]);

  const navTabs: Array<{ id: ApiSubTab; label: string }> = [
    { id: 'overview', label: 'API Overview' },
    { id: 'keys', label: 'API Keys' },
    { id: 'docs', label: 'API Documentation' },
    { id: 'balance', label: 'API Balance & Ledger' },
    { id: 'orders', label: 'API Orders' },
    { id: 'logs', label: 'Usage & Request Logs' },
  ];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-xl sm:text-2xl font-extrabold text-slate-950">
            {brandName} API Gateway
          </h1>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
            <span className="font-mono text-slate-700">POST {endpointUrl}</span>
            <span>·</span>
            <span>Standard SMM v2 Protocol</span>
            {customer && (
              <>
                <span>·</span>
                <span className="font-mono">Install: {customer.installationId}</span>
                <span>·</span>
                <span
                  className={
                    customer.status === 'active'
                      ? 'font-semibold text-emerald-700'
                      : 'font-semibold text-rose-700'
                  }
                >
                  {customer.status === 'active' ? 'API Active' : `Status: ${customer.status}`}
                </span>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => copyText(endpointUrl, 'endpoint-url', 'Endpoint Copied')}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap"
          >
            {copiedId === 'endpoint-url' ? (
              <Check className="h-3.5 w-3.5 text-emerald-600" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
            <span>Copy Endpoint</span>
          </button>
          <button
            type="button"
            onClick={loadWorkspace}
            disabled={loading}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Segmented Navigation Strip */}
      <div className="flex items-center gap-1.5 overflow-x-auto border-b border-slate-200 pb-2">
        {navTabs.map((tab) => {
          const active = subTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setSubTab(tab.id)}
              className={`h-9 rounded-lg px-3.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                active
                  ? 'bg-violet-700 text-white'
                  : 'text-slate-600 hover:bg-white hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {errorMsg && (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-900"
        >
          <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
          <span>{errorMsg}</span>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center rounded-3xl border border-slate-200/80 bg-white py-16 text-xs text-slate-500">
          <Loader2 className="mr-2 h-4 w-4 animate-spin text-violet-700" />
          <span>Loading API Gateway workspace...</span>
        </div>
      ) : (
        <>
          {/* Retry fallback only if transient provisioning error occurred */}
          {!customer && subTab !== 'docs' && (
            <div className="rounded-3xl border border-amber-200 bg-white p-6 space-y-4">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
                  <Terminal className="h-5 w-5" />
                </div>
                <div className="space-y-1">
                  <h2 className="font-display text-base font-bold text-slate-950">
                    Reseller API Workspace Unavailable
                  </h2>
                  <p className="text-xs leading-relaxed text-slate-600">
                    We could not finish initializing your Reseller API profile right now. Click
                    Retry below or review the API Documentation while your session is active.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={loadWorkspace}
                  className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-violet-700 px-4 text-xs font-bold text-white hover:bg-violet-800"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  <span>Retry Initialization</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSubTab('docs')}
                  className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 text-xs font-bold text-slate-700 hover:bg-slate-50"
                >
                  <Code2 className="h-3.5 w-3.5" />
                  <span>Read API Documentation</span>
                </button>
              </div>
            </div>
          )}

          {/* TAB 1: API OVERVIEW */}
          {subTab === 'overview' && customer && (
            <div className="space-y-5">
              {/* Suspended / Revoked Warning */}
              {customer.status !== 'active' && (
                <div className="flex items-start gap-2.5 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs text-rose-900">
                  <ShieldAlert className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
                  <div>
                    <p className="font-bold">API Access {customer.status.toUpperCase()}</p>
                    <p className="mt-0.5">
                      External API requests are currently blocked until Master Administration restores
                      your API Customer account to active status.
                    </p>
                  </div>
                </div>
              )}

              {/* 4-Column Metric Strip */}
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-2xl border border-slate-200/80 bg-white p-4">
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span>API Balance</span>
                    <Wallet className="h-4 w-4 text-violet-700" />
                  </div>
                  <p className="mt-2 font-display text-2xl font-extrabold text-slate-950 tabular-nums">
                    {currencySymbol}
                    {customer.apiBalance.toFixed(2)}
                  </p>
                  <p className="mt-1 text-[11px] text-slate-500 tabular-nums">
                    Total API Spent: {currencySymbol}
                    {customer.totalSpent.toFixed(2)}
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-200/80 bg-white p-4">
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span>API Orders</span>
                    <Layers className="h-4 w-4 text-emerald-600" />
                  </div>
                  <p className="mt-2 font-display text-2xl font-extrabold text-slate-950 tabular-nums">
                    {customer.totalOrders || orders.length}
                  </p>
                  <p className="mt-1 text-[11px] text-slate-500 tabular-nums">
                    {orders.filter((o) => o.status === 'Completed').length} completed ·{' '}
                    {orders.filter((o) => o.refunded).length} refunded
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-200/80 bg-white p-4">
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span>Active API Keys</span>
                    <KeyRound className="h-4 w-4 text-indigo-600" />
                  </div>
                  <p className="mt-2 font-display text-2xl font-extrabold text-slate-950 tabular-nums">
                    {keys.filter((k) => k.status === 'active').length}
                  </p>
                  <p className="mt-1 text-[11px] text-slate-500 tabular-nums">
                    {keys.length} total keys issued
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-200/80 bg-white p-4">
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span>Rate Limit & Latency</span>
                    <Activity className="h-4 w-4 text-amber-600" />
                  </div>
                  <p className="mt-2 font-display text-2xl font-extrabold text-slate-950 tabular-nums">
                    {customer.rateLimitPerMinute}/min
                  </p>
                  <p className="mt-1 text-[11px] text-slate-500 tabular-nums">
                    {usageStats.total} calls · {usageStats.avgLatency}ms avg
                  </p>
                </div>
              </div>

              {/* Endpoint & Account Metadata */}
              <div className="rounded-2xl border border-slate-200/80 bg-white p-5 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="font-display text-sm font-bold text-slate-900">
                    Gateway Connection Summary
                  </h2>
                  <button
                    type="button"
                    onClick={() => setSubTab('keys')}
                    className="text-xs font-semibold text-violet-700 hover:underline"
                  >
                    Manage API Keys &rarr;
                  </button>
                </div>
                <div className="grid gap-3 sm:grid-cols-3 text-xs">
                  <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                    <p className="text-slate-500">Customer ID</p>
                    <p className="mt-0.5 font-mono font-semibold text-slate-900">{customer.id}</p>
                  </div>
                  <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                    <p className="text-slate-500">Installation Binding</p>
                    <p className="mt-0.5 font-mono font-semibold text-slate-900">
                      {customer.installationId}
                    </p>
                  </div>
                  <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                    <p className="text-slate-500">Reseller Discount Tier</p>
                    <p className="mt-0.5 font-semibold text-slate-900 tabular-nums">
                      {customer.customDiscountPercent > 0
                        ? `${customer.customDiscountPercent}% off base selling rates`
                        : 'Standard Gateway Pricing'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Recent API Orders */}
              <div className="rounded-2xl border border-slate-200/80 bg-white overflow-hidden">
                <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5">
                  <h2 className="font-display text-sm font-bold text-slate-900">
                    Recent API Orders
                  </h2>
                  <button
                    type="button"
                    onClick={() => setSubTab('orders')}
                    className="text-xs font-semibold text-violet-700 hover:underline"
                  >
                    View All ({orders.length})
                  </button>
                </div>
                {orders.length === 0 ? (
                  <p className="p-6 text-center text-xs text-slate-400">
                    No API orders submitted yet. Use POST {endpointUrl} with action=add.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="border-b border-slate-100 bg-slate-50 text-[11px] font-semibold text-slate-500">
                        <tr>
                          <th className="px-4 py-2.5">API Order</th>
                          <th className="px-4 py-2.5">Service</th>
                          <th className="px-4 py-2.5">Qty</th>
                          <th className="px-4 py-2.5">Charge</th>
                          <th className="px-4 py-2.5">Status</th>
                          <th className="px-4 py-2.5">Created</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {orders.slice(0, 6).map((ord) => (
                          <tr key={ord.id} className="hover:bg-slate-50/60">
                            <td className="px-4 py-2.5 font-mono font-semibold text-slate-900">
                              {ord.id}
                            </td>
                            <td className="px-4 py-2.5 max-w-[220px] truncate text-slate-700">
                              {ord.serviceName}
                            </td>
                            <td className="px-4 py-2.5 tabular-nums">
                              {ord.quantity.toLocaleString()}
                            </td>
                            <td className="px-4 py-2.5 font-semibold tabular-nums">
                              {currencySymbol}
                              {ord.charge.toFixed(2)}
                            </td>
                            <td className="px-4 py-2.5 font-semibold text-slate-800">
                              {ord.status}
                            </td>
                            <td className="px-4 py-2.5 text-slate-500">{ord.createdAtLabel}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: API KEY MANAGEMENT */}
          {subTab === 'keys' && customer && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200/80 bg-white p-4">
                <div className="flex items-start gap-2.5 text-xs text-slate-600">
                  <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-600 mt-0.5" />
                  <span>
                    API keys are stored exclusively as one-way SHA-256 hashes on the server. Plaintext
                    secrets are displayed <strong>once</strong> at creation and cannot be recovered later.
                  </span>
                </div>
                {gatewaySettings.allowCustomerSelfKeyGen && customer.status === 'active' && (
                  <button
                    type="button"
                    onClick={() => setCreateOpen(true)}
                    className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-violet-700 px-3.5 text-xs font-bold text-white hover:bg-violet-800 whitespace-nowrap"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Generate API Key</span>
                  </button>
                )}
              </div>

              {createOpen && (
                <form
                  onSubmit={handleGenerateKey}
                  className="rounded-2xl border border-violet-200 bg-white p-5 space-y-4"
                >
                  <div className="flex items-center justify-between">
                    <h3 className="font-display text-sm font-bold text-slate-900">
                      Generate New API Key
                    </h3>
                    <button
                      type="button"
                      onClick={() => setCreateOpen(false)}
                      className="text-slate-400 hover:text-slate-600"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Key Label
                      </label>
                      <input
                        type="text"
                        required
                        maxLength={80}
                        value={newKeyLabel}
                        onChange={(e) => setNewKeyLabel(e.target.value)}
                        placeholder="e.g. Storefront Production Key"
                        className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs sm:text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Allowed API Scopes
                      </label>
                      <div className="flex flex-wrap gap-2 pt-1.5">
                        {PERMISSION_OPTIONS.map((opt) => (
                          <label
                            key={opt.id}
                            className="inline-flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              checked={newKeyPerms.includes(opt.id)}
                              onChange={() => togglePermission(opt.id)}
                              className="h-3.5 w-3.5 rounded border-slate-300 text-violet-700"
                            />
                            <span>{opt.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setCreateOpen(false)}
                      className="h-9 rounded-xl border border-slate-200 px-3.5 text-xs font-semibold text-slate-700"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={keyBusy}
                      className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-violet-700 px-4 text-xs font-bold text-white hover:bg-violet-800 disabled:opacity-60"
                    >
                      {keyBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                      <span>Create Key</span>
                    </button>
                  </div>
                </form>
              )}

              <div className="space-y-3">
                {keys.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-10 text-center text-xs text-slate-400">
                    No API keys generated yet. Click &ldquo;Generate API Key&rdquo; to issue your
                    first credential.
                  </div>
                ) : (
                  keys.map((k) => (
                    <div
                      key={k.id}
                      className="rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4"
                    >
                      <div className="min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-2 text-xs">
                          <span className="font-display text-sm font-bold text-slate-900">
                            {k.label}
                          </span>
                          <span className="text-slate-300">·</span>
                          <span
                            className={`font-semibold uppercase text-[11px] ${
                              k.status === 'active'
                                ? 'text-emerald-700'
                                : k.status === 'disabled'
                                ? 'text-amber-700'
                                : 'text-rose-700'
                            }`}
                          >
                            {k.status}
                          </span>
                          <span className="text-slate-300">·</span>
                          <span className="text-slate-500 tabular-nums">
                            {k.rateLimitPerMinute} req/min
                          </span>
                        </div>
                        <p className="font-mono text-xs text-slate-700">{k.maskedKey}</p>
                        <p className="text-[11px] text-slate-500">
                          Scopes: {k.permissions.join(', ')} · Calls:{' '}
                          <span className="tabular-nums font-medium">{k.requestCount}</span> · Last
                          used: {k.lastUsedAtLabel}
                        </p>
                      </div>

                      {k.status !== 'revoked' && (
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            disabled={keyBusy}
                            onClick={() => handleRegenerateKey(k)}
                            className="inline-flex h-8 items-center gap-1 rounded-lg border border-violet-200 bg-violet-50 px-2.5 text-xs font-semibold text-violet-800 hover:bg-violet-100 disabled:opacity-50"
                          >
                            <RotateCcw className="h-3 w-3" />
                            <span>Regenerate</span>
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              handleSetKeyStatus(k, k.status === 'active' ? 'disabled' : 'active')
                            }
                            className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                          >
                            <span>{k.status === 'active' ? 'Disable' : 'Enable'}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleSetKeyStatus(k, 'revoked')}
                            className="inline-flex h-8 items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2.5 text-xs font-semibold text-rose-700 hover:bg-rose-100"
                          >
                            <Ban className="h-3 w-3" />
                            <span>Revoke</span>
                          </button>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* TAB 3: API DOCUMENTATION */}
          {subTab === 'docs' && (
            <div className="space-y-5">
              <div className="rounded-2xl border border-slate-200/80 bg-white p-5 space-y-3">
                <h2 className="font-display text-base font-bold text-slate-900">
                  Standard SMM Panel API v2 Specification
                </h2>
                <p className="text-xs leading-relaxed text-slate-600">
                  Send <code className="font-mono font-semibold">POST</code> requests to{' '}
                  <code className="font-mono font-semibold text-violet-800">{endpointUrl}</code>{' '}
                  using <code className="font-mono">application/x-www-form-urlencoded</code> or{' '}
                  <code className="font-mono">application/json</code>. Authenticate with your secret{' '}
                  <code className="font-mono">key</code> parameter (or{' '}
                  <code className="font-mono">X-API-Key</code> header).
                </p>

                <div className="overflow-x-auto border border-slate-200 rounded-xl">
                  <table className="w-full text-left text-xs">
                    <thead className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-600">
                      <tr>
                        <th className="px-4 py-2.5">Action</th>
                        <th className="px-4 py-2.5">Parameters</th>
                        <th className="px-4 py-2.5">Response</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      <tr>
                        <td className="px-4 py-2.5 font-mono font-bold text-violet-800">balance</td>
                        <td className="px-4 py-2.5 font-mono">key, action=balance</td>
                        <td className="px-4 py-2.5 font-mono text-slate-700">
                          {`{"balance":"1250.00","currency":"${currencyCode}"}`}
                        </td>
                      </tr>
                      <tr>
                        <td className="px-4 py-2.5 font-mono font-bold text-violet-800">
                          services
                        </td>
                        <td className="px-4 py-2.5 font-mono">key, action=services</td>
                        <td className="px-4 py-2.5 text-slate-700">
                          Array of active services (service ID, name, category, rate, min, max)
                        </td>
                      </tr>
                      <tr>
                        <td className="px-4 py-2.5 font-mono font-bold text-violet-800">add</td>
                        <td className="px-4 py-2.5 font-mono">
                          key, action=add, service, link, quantity, [idempotency_key]
                        </td>
                        <td className="px-4 py-2.5 font-mono text-slate-700">
                          {`{"order":"apiord-...","status":"Processing"}`}
                        </td>
                      </tr>
                      <tr>
                        <td className="px-4 py-2.5 font-mono font-bold text-violet-800">
                          status (single)
                        </td>
                        <td className="px-4 py-2.5 font-mono">key, action=status, order</td>
                        <td className="px-4 py-2.5 font-mono text-slate-700">
                          {`{"charge":"35.00","start_count":"0","status":"Processing","remains":"1000"}`}
                        </td>
                      </tr>
                      <tr>
                        <td className="px-4 py-2.5 font-mono font-bold text-violet-800">
                          status (bulk)
                        </td>
                        <td className="px-4 py-2.5 font-mono">
                          key, action=status, orders=id1,id2
                        </td>
                        <td className="px-4 py-2.5 text-slate-700">
                          JSON object keyed by API Order ID (up to {gatewaySettings.maxBulkStatusIds}{' '}
                          IDs)
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Code Examples */}
              <div className="rounded-2xl border border-slate-200/80 bg-white p-5 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    {(['curl', 'javascript', 'php'] as CodeLang[]).map((lang) => (
                      <button
                        key={lang}
                        type="button"
                        onClick={() => setCodeLang(lang)}
                        className={`h-8 rounded-lg px-3 text-xs font-semibold uppercase ${
                          codeLang === lang
                            ? 'bg-slate-900 text-white'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        {lang}
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => copyText(docSnippet, 'doc-code', 'Snippet Copied')}
                    className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    <Copy className="h-3.5 w-3.5" />
                    <span>Copy Example</span>
                  </button>
                </div>

                <pre className="overflow-x-auto rounded-xl bg-slate-950 p-4 font-mono text-xs leading-relaxed text-slate-100">
                  <code>{docSnippet}</code>
                </pre>
              </div>
            </div>
          )}

          {/* TAB 4: API BALANCE & TRANSACTIONS */}
          {subTab === 'balance' && customer && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200/80 bg-white p-5">
                <div>
                  <p className="text-xs text-slate-500">Current Gateway Wallet Balance</p>
                  <p className="mt-1 font-display text-3xl font-extrabold text-slate-950 tabular-nums">
                    {currencySymbol}
                    {customer.apiBalance.toFixed(2)}
                  </p>
                </div>
                <select
                  value={txnFilter}
                  onChange={(e) => setTxnFilter(e.target.value as typeof txnFilter)}
                  className="h-9 rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-semibold text-slate-700"
                >
                  <option value="all">All Transactions ({transactions.length})</option>
                  <option value="credit">Admin Credits</option>
                  <option value="order_charge">Order Charges</option>
                  <option value="refund">Automatic Refunds</option>
                  <option value="debit">Debits</option>
                  <option value="adjustment">Adjustments</option>
                </select>
              </div>

              <div className="rounded-2xl border border-slate-200/80 bg-white overflow-hidden">
                {filteredTxns.length === 0 ? (
                  <p className="p-8 text-center text-xs text-slate-400">
                    No API ledger transactions recorded yet.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="border-b border-slate-100 bg-slate-50 text-[11px] font-semibold text-slate-500">
                        <tr>
                          <th className="px-4 py-2.5">Txn ID</th>
                          <th className="px-4 py-2.5">Type</th>
                          <th className="px-4 py-2.5">Amount</th>
                          <th className="px-4 py-2.5">Before</th>
                          <th className="px-4 py-2.5">After</th>
                          <th className="px-4 py-2.5">Description</th>
                          <th className="px-4 py-2.5">Time</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredTxns.map((txn) => (
                          <tr key={txn.id}>
                            <td className="px-4 py-2.5 font-mono text-slate-700">{txn.id}</td>
                            <td className="px-4 py-2.5 font-semibold uppercase text-[11px]">
                              {txn.type}
                            </td>
                            <td
                              className={`px-4 py-2.5 font-bold tabular-nums ${
                                txn.amount >= 0 ? 'text-emerald-700' : 'text-rose-700'
                              }`}
                            >
                              {txn.amount >= 0 ? '+' : ''}
                              {currencySymbol}
                              {txn.amount.toFixed(2)}
                            </td>
                            <td className="px-4 py-2.5 tabular-nums text-slate-500">
                              {currencySymbol}
                              {txn.balanceBefore.toFixed(2)}
                            </td>
                            <td className="px-4 py-2.5 tabular-nums font-semibold text-slate-900">
                              {currencySymbol}
                              {txn.balanceAfter.toFixed(2)}
                            </td>
                            <td className="px-4 py-2.5 max-w-[240px] truncate text-slate-600">
                              {txn.description || txn.referenceId}
                            </td>
                            <td className="px-4 py-2.5 text-slate-500">{txn.createdAtLabel}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 5: API ORDERS */}
          {subTab === 'orders' && customer && (
            <div className="space-y-4">
              <div className="relative max-w-md">
                <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  value={orderSearch}
                  onChange={(e) => setOrderSearch(e.target.value)}
                  placeholder="Search by API Order ID, service, link, or status..."
                  className="h-9 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-xs"
                />
              </div>

              <div className="rounded-2xl border border-slate-200/80 bg-white overflow-hidden">
                {filteredOrders.length === 0 ? (
                  <p className="p-8 text-center text-xs text-slate-400">
                    No matching API orders found.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="border-b border-slate-100 bg-slate-50 text-[11px] font-semibold text-slate-500">
                        <tr>
                          <th className="px-4 py-2.5">API Order ID</th>
                          <th className="px-4 py-2.5">Service</th>
                          <th className="px-4 py-2.5">Target Link</th>
                          <th className="px-4 py-2.5">Qty</th>
                          <th className="px-4 py-2.5">Charge</th>
                          <th className="px-4 py-2.5">Start / Remains</th>
                          <th className="px-4 py-2.5">Status</th>
                          <th className="px-4 py-2.5">Date</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredOrders.map((ord) => (
                          <tr key={ord.id} className="hover:bg-slate-50/50">
                            <td className="px-4 py-2.5 font-mono font-semibold text-slate-900">
                              {ord.id}
                            </td>
                            <td className="px-4 py-2.5 max-w-[200px] truncate text-slate-800">
                              {ord.serviceName}
                            </td>
                            <td className="px-4 py-2.5 max-w-[180px] truncate font-mono text-[11px] text-slate-500">
                              {ord.link}
                            </td>
                            <td className="px-4 py-2.5 tabular-nums">
                              {ord.quantity.toLocaleString()}
                            </td>
                            <td className="px-4 py-2.5 font-semibold tabular-nums">
                              {currencySymbol}
                              {ord.charge.toFixed(2)}
                            </td>
                            <td className="px-4 py-2.5 tabular-nums text-slate-600">
                              {ord.startCount} / {ord.remains}
                            </td>
                            <td className="px-4 py-2.5 font-semibold text-slate-900">
                              {ord.status}
                              {ord.refunded && (
                                <span className="ml-1 text-[10px] font-bold text-emerald-700">
                                  (Refunded)
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-2.5 text-slate-500">{ord.createdAtLabel}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 6: USAGE STATISTICS & REQUEST LOGS */}
          {subTab === 'logs' && customer && (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-4">
                <div className="rounded-2xl border border-slate-200/80 bg-white p-4">
                  <p className="text-xs text-slate-500">Total Requests</p>
                  <p className="mt-1 font-display text-2xl font-extrabold text-slate-950 tabular-nums">
                    {usageStats.total}
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-200/80 bg-white p-4">
                  <p className="text-xs text-slate-500">Success Rate</p>
                  <p className="mt-1 font-display text-2xl font-extrabold text-emerald-700 tabular-nums">
                    {usageStats.successRate}%
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-200/80 bg-white p-4">
                  <p className="text-xs text-slate-500">Failed Calls</p>
                  <p className="mt-1 font-display text-2xl font-extrabold text-rose-700 tabular-nums">
                    {usageStats.failed}
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-200/80 bg-white p-4">
                  <p className="text-xs text-slate-500">Avg Latency</p>
                  <p className="mt-1 font-display text-2xl font-extrabold text-slate-950 tabular-nums">
                    {usageStats.avgLatency}ms
                  </p>
                </div>
              </div>

              {usageStats.breakdown.length > 0 && (
                <div className="rounded-2xl border border-slate-200/80 bg-white p-4">
                  <h3 className="font-display text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                    Action Distribution
                  </h3>
                  <div className="flex flex-wrap gap-4 text-xs">
                    {usageStats.breakdown.map(([act, count]) => (
                      <div key={act} className="flex items-center gap-1.5">
                        <span className="font-mono font-bold text-violet-800">{act}</span>
                        <span className="text-slate-500 tabular-nums">{count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between gap-2">
                <h2 className="font-display text-sm font-bold text-slate-900">
                  Recent Gateway Requests
                </h2>
                <select
                  value={logFilter}
                  onChange={(e) => setLogFilter(e.target.value as typeof logFilter)}
                  className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700"
                >
                  <option value="all">All Statuses ({logs.length})</option>
                  <option value="success">Succeeded ({usageStats.succeeded})</option>
                  <option value="error">Errors ({usageStats.failed})</option>
                </select>
              </div>

              <div className="rounded-2xl border border-slate-200/80 bg-white overflow-hidden">
                {filteredLogs.length === 0 ? (
                  <p className="p-8 text-center text-xs text-slate-400">
                    No API request logs recorded yet.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="border-b border-slate-100 bg-slate-50 text-[11px] font-semibold text-slate-500">
                        <tr>
                          <th className="px-4 py-2.5">Action</th>
                          <th className="px-4 py-2.5">HTTP</th>
                          <th className="px-4 py-2.5">Outcome</th>
                          <th className="px-4 py-2.5">Latency</th>
                          <th className="px-4 py-2.5">Note / Error</th>
                          <th className="px-4 py-2.5">Timestamp</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredLogs.map((log) => (
                          <tr key={log.id}>
                            <td className="px-4 py-2.5 font-mono font-semibold text-slate-900">
                              {log.action}
                            </td>
                            <td className="px-4 py-2.5 font-mono tabular-nums">
                              {log.httpStatus}
                            </td>
                            <td className="px-4 py-2.5 font-semibold">
                              <span
                                className={log.success ? 'text-emerald-700' : 'text-rose-700'}
                              >
                                {log.success ? 'OK' : 'Error'}
                              </span>
                            </td>
                            <td className="px-4 py-2.5 tabular-nums text-slate-600">
                              {log.latencyMs}ms
                            </td>
                            <td className="px-4 py-2.5 max-w-[260px] truncate text-slate-500">
                              {log.errorMessage || (log.idempotencyKey ? `Idem: ${log.idempotencyKey}` : '—')}
                            </td>
                            <td className="px-4 py-2.5 text-slate-500">{log.createdAtLabel}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {/* One-Time Plaintext API Key Reveal Modal */}
      {revealedKeyModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/65 p-4 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
          aria-label="Save Your API Key"
        >
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-amber-700">
                  Shown Once Only
                </p>
                <h2 className="font-display text-lg font-extrabold text-slate-950">
                  Save Your New API Key
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setRevealedKeyModal(null)}
                className="flex h-8 w-8 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="text-xs leading-relaxed text-slate-600">
              For security, {brandName} only stores a SHA-256 hash of your API key. Copy and store{' '}
              <strong>{revealedKeyModal.label}</strong> securely right now—you will not be able to
              reveal this plaintext key again after closing this window.
            </p>

            <div className="rounded-2xl border border-violet-200 bg-violet-50/70 p-3.5 space-y-2">
              <p className="text-[11px] font-semibold text-violet-900">Plaintext API Key</p>
              <div className="flex items-center justify-between gap-2">
                <code className="break-all font-mono text-xs font-bold text-slate-950">
                  {revealedKeyModal.plaintextKeyOnce}
                </code>
                <button
                  type="button"
                  onClick={() =>
                    copyText(revealedKeyModal.plaintextKeyOnce, 'modal-key', 'API Key Copied')
                  }
                  className="inline-flex h-8 shrink-0 items-center gap-1 rounded-lg bg-violet-700 px-3 text-xs font-bold text-white hover:bg-violet-800"
                >
                  <Copy className="h-3.5 w-3.5" />
                  <span>Copy</span>
                </button>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setRevealedKeyModal(null)}
                className="h-10 rounded-xl bg-slate-900 px-5 text-xs font-bold text-white hover:bg-slate-800"
              >
                I Have Stored This Key Securely
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
