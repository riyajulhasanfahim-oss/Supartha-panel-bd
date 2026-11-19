import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertCircle,
  Ban,
  Check,
  CheckCircle2,
  Copy,
  Edit3,
  Globe,
  KeyRound,
  Layers,
  Loader2,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Server,
  ShieldAlert,
  ShieldCheck,
  Wallet,
  X,
} from 'lucide-react';
import { APP_CONFIG } from '../../config/app.config';
import { useApp } from '../../context/AppContext';
import type {
  ApiCustomerStatus,
  ApiKeyPermission,
  ApiKeyStatus,
  WebsiteInstallationStatus,
} from '../../lib/firestore/collections';
import {
  apiGatewayService,
  DEFAULT_GATEWAY_SETTINGS,
  type ApiCustomerItem,
  type ApiGatewaySettingsItem,
  type ApiKeyItem,
  type ApiOrderItem,
  type ApiRequestLogItem,
  type ApiTransactionItem,
  type GatewayServerStatus,
  type GeneratedApiKeyResponse,
  type WebsiteInstallationItem,
} from '../../services/apiGateway.service';
import { normalizeCurrencySymbol } from '../../utils/pricing';

type GatewayAdminTab =
  | 'overview'
  | 'customers'
  | 'keys'
  | 'orders'
  | 'balance'
  | 'installations'
  | 'logs'
  | 'settings';

const PERM_OPTIONS: Array<{ id: ApiKeyPermission; label: string }> = [
  { id: 'balance', label: 'Balance' },
  { id: 'services', label: 'Services' },
  { id: 'add', label: 'Create Order' },
  { id: 'status', label: 'Order Status' },
];

export function AdminApiGatewayView() {
  const { systemSettings, showToast } = useApp();
  const currencySymbol = normalizeCurrencySymbol(
    systemSettings?.currencySymbol,
    systemSettings?.currency
  );

  const [tab, setTab] = useState<GatewayAdminTab>('overview');
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [serverStatus, setServerStatus] = useState<GatewayServerStatus | null>(null);
  const [customers, setCustomers] = useState<ApiCustomerItem[]>([]);
  const [keys, setKeys] = useState<ApiKeyItem[]>([]);
  const [orders, setOrders] = useState<ApiOrderItem[]>([]);
  const [transactions, setTransactions] = useState<ApiTransactionItem[]>([]);
  const [logs, setLogs] = useState<ApiRequestLogItem[]>([]);
  const [installations, setInstallations] = useState<WebsiteInstallationItem[]>([]);
  const [gwSettings, setGwSettings] = useState<ApiGatewaySettingsItem>(DEFAULT_GATEWAY_SETTINGS);

  // Filters
  const [customerSearch, setCustomerSearch] = useState('');
  const [orderSearch, setOrderSearch] = useState('');
  const [logStatusFilter, setLogStatusFilter] = useState<'all' | 'success' | 'error'>('all');
  const [logActionFilter, setLogActionFilter] = useState('all');

  // One-time revealed key modal
  const [revealedKeyModal, setRevealedKeyModal] = useState<GeneratedApiKeyResponse | null>(null);

  // Create/Edit Customer Modal
  const [customerModalOpen, setCustomerModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<ApiCustomerItem | null>(null);
  const [cusUserId, setCusUserId] = useState('');
  const [cusName, setCusName] = useState('');
  const [cusEmail, setCusEmail] = useState('');
  const [cusCompany, setCusCompany] = useState('');
  const [cusDomain, setCusDomain] = useState('');
  const [cusInstallId, setCusInstallId] = useState('');
  const [cusRateLimit, setCusRateLimit] = useState('60');
  const [cusDiscount, setCusDiscount] = useState('0');
  const [cusStatus, setCusStatus] = useState<ApiCustomerStatus>('active');
  const [cusNote, setCusNote] = useState('');
  const [cusSaving, setCusSaving] = useState(false);

  // Generate Key Modal
  const [keyModalOpen, setKeyModalOpen] = useState(false);
  const [keyCustomerId, setKeyCustomerId] = useState('');
  const [keyLabel, setKeyLabel] = useState('Primary Gateway Key');
  const [keyRateLimit, setKeyRateLimit] = useState('60');
  const [keyPerms, setKeyPerms] = useState<ApiKeyPermission[]>([
    'balance',
    'services',
    'add',
    'status',
  ]);
  const [keyBusy, setKeyBusy] = useState(false);

  // Balance Adjustment Form
  const [balCustomerId, setBalCustomerId] = useState('');
  const [balOperation, setBalOperation] = useState<'credit' | 'debit' | 'adjustment'>('credit');
  const [balAmount, setBalAmount] = useState('');
  const [balDesc, setBalDesc] = useState('');
  const [balBusy, setBalBusy] = useState(false);

  // Website Installation Modal
  const [instModalOpen, setInstModalOpen] = useState(false);
  const [editingInst, setEditingInst] = useState<WebsiteInstallationItem | null>(null);
  const [instId, setInstId] = useState('');
  const [instCustomerId, setInstCustomerId] = useState('');
  const [instUserId, setInstUserId] = useState('');
  const [instBuyerName, setInstBuyerName] = useState('');
  const [instDomain, setInstDomain] = useState('');
  const [instVersion, setInstVersion] = useState('1.0.0');
  const [instLocked, setInstLocked] = useState(true);
  const [instStatus, setInstStatus] = useState<WebsiteInstallationStatus>('active');
  const [instNote, setInstNote] = useState('');
  const [instSaving, setInstSaving] = useState(false);

  const [syncingOrderId, setSyncingOrderId] = useState<string | null>(null);
  const [settingsSaving, setSettingsSaving] = useState(false);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const [srvStat, cusList, keyList, ordList, txnList, logList, instList, settingsDoc] =
        await Promise.all([
          apiGatewayService.getGatewayServerStatus().catch(() => null),
          apiGatewayService.listAllApiCustomers(),
          apiGatewayService.listAllApiKeys(),
          apiGatewayService.listAllApiOrders(),
          apiGatewayService.listAllApiTransactions(),
          apiGatewayService.listAllApiRequestLogs(),
          apiGatewayService.listWebsiteInstallations(),
          apiGatewayService.getApiGatewaySettings(),
        ]);
      setServerStatus(srvStat);
      setCustomers(cusList);
      setKeys(keyList);
      setOrders(ordList);
      setTransactions(txnList);
      setLogs(logList);
      setInstallations(instList);
      setGwSettings(settingsDoc);
      if (cusList.length > 0 && !balCustomerId) {
        setBalCustomerId(cusList[0].id);
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to load API Gateway data.');
    } finally {
      setLoading(false);
    }
  }, [balCustomerId]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const customerMap = useMemo(() => new Map(customers.map((c) => [c.id, c])), [customers]);

  const copyText = useCallback(
    async (text: string, label = 'Copied') => {
      try {
        await navigator.clipboard.writeText(text);
        showToast({ title: label, description: 'Copied to clipboard.', tone: 'success' });
      } catch {
        showToast({ title: 'Copy Failed', description: 'Copy manually from text box.', tone: 'warning' });
      }
    },
    [showToast]
  );

  const metrics = useMemo(() => {
    const activeCustomers = customers.filter((c) => c.status === 'active').length;
    const activeKeys = keys.filter((k) => k.status === 'active').length;
    const totalApiRevenue = orders
      .filter((o) => !o.refunded && o.status !== 'Failed' && o.status !== 'Cancelled')
      .reduce((s, o) => s + Number(o.charge || 0), 0);
    const totalHoldBalance = customers.reduce((s, c) => s + Number(c.apiBalance || 0), 0);
    const totalCalls = logs.length;
    const okCalls = logs.filter((l) => l.success).length;
    const avgLatency =
      totalCalls > 0 ? Math.round(logs.reduce((s, l) => s + l.latencyMs, 0) / totalCalls) : 0;

    return {
      activeCustomers,
      activeKeys,
      totalApiRevenue,
      totalHoldBalance,
      totalCalls,
      successRate: totalCalls > 0 ? Math.round((okCalls / totalCalls) * 100) : 100,
      avgLatency,
    };
  }, [customers, keys, orders, logs]);

  const filteredCustomers = useMemo(() => {
    const q = customerSearch.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter(
      (c) =>
        c.id.toLowerCase().includes(q) ||
        c.name.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        c.installationId.toLowerCase().includes(q) ||
        c.websiteDomain.toLowerCase().includes(q)
    );
  }, [customers, customerSearch]);

  const filteredOrders = useMemo(() => {
    const q = orderSearch.trim().toLowerCase();
    if (!q) return orders;
    return orders.filter(
      (o) =>
        o.id.toLowerCase().includes(q) ||
        o.internalOrderId.toLowerCase().includes(q) ||
        o.customerId.toLowerCase().includes(q) ||
        o.serviceName.toLowerCase().includes(q) ||
        o.link.toLowerCase().includes(q)
    );
  }, [orders, orderSearch]);

  const filteredLogs = useMemo(() => {
    return logs.filter((l) => {
      if (logStatusFilter === 'success' && !l.success) return false;
      if (logStatusFilter === 'error' && l.success) return false;
      if (logActionFilter !== 'all' && l.action !== logActionFilter) return false;
      return true;
    });
  }, [logs, logStatusFilter, logActionFilter]);

  const openCreateCustomer = () => {
    setEditingCustomer(null);
    setCusUserId('');
    setCusName('');
    setCusEmail('');
    setCusCompany('');
    setCusDomain('');
    setCusInstallId(`inst-${Math.random().toString(36).slice(2, 6).toUpperCase()}`);
    setCusRateLimit(String(gwSettings.defaultRateLimitPerMinute || 60));
    setCusDiscount('0');
    setCusStatus('active');
    setCusNote('');
    setCustomerModalOpen(true);
  };

  const openEditCustomer = (c: ApiCustomerItem) => {
    setEditingCustomer(c);
    setCusUserId(c.userId);
    setCusName(c.name);
    setCusEmail(c.email);
    setCusCompany(c.companyName);
    setCusDomain(c.websiteDomain);
    setCusInstallId(c.installationId);
    setCusRateLimit(String(c.rateLimitPerMinute));
    setCusDiscount(String(c.customDiscountPercent));
    setCusStatus(c.status);
    setCusNote(c.note);
    setCustomerModalOpen(true);
  };

  const handleSaveCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    setCusSaving(true);
    try {
      await apiGatewayService.saveApiCustomer({
        id: editingCustomer?.id,
        userId: cusUserId,
        name: cusName,
        email: cusEmail,
        companyName: cusCompany,
        websiteDomain: cusDomain,
        installationId: cusInstallId,
        rateLimitPerMinute: Number(cusRateLimit),
        customDiscountPercent: Number(cusDiscount),
        status: cusStatus,
        note: cusNote,
      });
      setCustomerModalOpen(false);
      showToast({
        title: editingCustomer ? 'API Customer Updated' : 'API Customer Enrolled',
        description: `${cusName} (${cusInstallId}) saved.`,
        tone: 'success',
      });
      await loadAll();
    } catch (err) {
      showToast({
        title: 'Save Failed',
        description: err instanceof Error ? err.message : 'Unable to save API Customer.',
        tone: 'error',
      });
    } finally {
      setCusSaving(false);
    }
  };

  const handleCustomerStatus = async (c: ApiCustomerItem, nextStatus: ApiCustomerStatus) => {
    try {
      await apiGatewayService.setApiCustomerStatus(c.id, nextStatus);
      setCustomers((prev) =>
        prev.map((item) => (item.id === c.id ? { ...item, status: nextStatus } : item))
      );
      showToast({
        title: 'Customer Access Updated',
        description: `${c.name} is now ${nextStatus}.`,
        tone: 'success',
      });
    } catch (err) {
      showToast({
        title: 'Update Failed',
        description: err instanceof Error ? err.message : 'Could not update status.',
        tone: 'error',
      });
    }
  };

  const openGenerateKeyModal = (preselectCustomerId?: string) => {
    const targetCus = preselectCustomerId || customers[0]?.id || '';
    const cusObj = customerMap.get(targetCus);
    setKeyCustomerId(targetCus);
    setKeyLabel('Primary Gateway Key');
    setKeyRateLimit(String(cusObj?.rateLimitPerMinute ?? gwSettings.defaultRateLimitPerMinute ?? 60));
    setKeyPerms(['balance', 'services', 'add', 'status']);
    setKeyModalOpen(true);
  };

  const handleGenerateKeySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!keyCustomerId) {
      showToast({
        title: 'Customer Required',
        description: 'Select an active API Customer first.',
        tone: 'warning',
      });
      return;
    }
    setKeyBusy(true);
    try {
      const created = await apiGatewayService.generateApiKey({
        customerId: keyCustomerId,
        label: keyLabel,
        permissions: keyPerms,
        rateLimitPerMinute: Number(keyRateLimit),
      });
      setKeyModalOpen(false);
      setRevealedKeyModal(created);
      await loadAll();
    } catch (err) {
      showToast({
        title: 'Key Generation Failed',
        description: err instanceof Error ? err.message : 'Unable to issue API key.',
        tone: 'error',
      });
    } finally {
      setKeyBusy(false);
    }
  };

  const handleRegenerateKey = async (k: ApiKeyItem) => {
    setKeyBusy(true);
    try {
      const created = await apiGatewayService.regenerateApiKey(k.id);
      setRevealedKeyModal(created);
      showToast({
        title: 'Key Regenerated',
        description: 'Previous key has been revoked immediately.',
        tone: 'success',
      });
      await loadAll();
    } catch (err) {
      showToast({
        title: 'Regeneration Failed',
        description: err instanceof Error ? err.message : 'Unable to regenerate key.',
        tone: 'error',
      });
    } finally {
      setKeyBusy(false);
    }
  };

  const handleSetKeyStatus = async (k: ApiKeyItem, nextStatus: ApiKeyStatus) => {
    try {
      await apiGatewayService.updateApiKeyAdmin({ keyId: k.id, status: nextStatus });
      setKeys((prev) => prev.map((x) => (x.id === k.id ? { ...x, status: nextStatus } : x)));
      showToast({
        title: 'Key Status Updated',
        description: `${k.label} set to ${nextStatus}.`,
        tone: 'success',
      });
    } catch (err) {
      showToast({
        title: 'Update Failed',
        description: err instanceof Error ? err.message : 'Unable to update key.',
        tone: 'error',
      });
    }
  };

  const handleAdjustBalance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!balCustomerId) return;
    setBalBusy(true);
    try {
      const res = await apiGatewayService.adjustApiCustomerBalance({
        customerId: balCustomerId,
        operation: balOperation,
        amount: Number(balAmount),
        description: balDesc || `Master Admin ${balOperation}`,
      });
      setBalAmount('');
      setBalDesc('');
      showToast({
        title: 'API Balance Updated',
        description: `Balance changed from ${currencySymbol}${res.balanceBefore.toFixed(
          2
        )} to ${currencySymbol}${res.balanceAfter.toFixed(2)}.`,
        tone: 'success',
      });
      await loadAll();
    } catch (err) {
      showToast({
        title: 'Adjustment Failed',
        description: err instanceof Error ? err.message : 'Could not adjust API balance.',
        tone: 'error',
      });
    } finally {
      setBalBusy(false);
    }
  };

  const handleSyncApiOrder = async (ord: ApiOrderItem) => {
    setSyncingOrderId(ord.id);
    try {
      const updated = await apiGatewayService.syncApiOrderStatusFromInternal(ord);
      setOrders((prev) => prev.map((o) => (o.id === ord.id ? updated : o)));
      showToast({
        title: 'Order Synced',
        description: `${ord.id} is now ${updated.status}.`,
        tone: 'success',
      });
    } catch (err) {
      showToast({
        title: 'Sync Failed',
        description: err instanceof Error ? err.message : 'Unable to sync order status.',
        tone: 'error',
      });
    } finally {
      setSyncingOrderId(null);
    }
  };

  const openCreateInstallation = () => {
    setEditingInst(null);
    const firstCus = customers[0];
    setInstId(
      firstCus?.installationId || `inst-${Math.random().toString(36).slice(2, 7).toUpperCase()}`
    );
    setInstCustomerId(firstCus?.id || '');
    setInstUserId(firstCus?.userId || '');
    setInstBuyerName(firstCus?.name || '');
    setInstDomain(firstCus?.websiteDomain || '');
    setInstVersion('1.0.0');
    setInstLocked(false);
    setInstStatus('active');
    setInstNote('');
    setInstModalOpen(true);
  };

  const openEditInstallation = (inst: WebsiteInstallationItem) => {
    setEditingInst(inst);
    setInstId(inst.installationId);
    setInstCustomerId(inst.customerId);
    setInstUserId(inst.userId);
    setInstBuyerName(inst.buyerName);
    setInstDomain(inst.domain);
    setInstVersion(inst.appVersion);
    setInstLocked(inst.apiLocked);
    setInstStatus(inst.status);
    setInstNote(inst.note);
    setInstModalOpen(true);
  };

  const handleSaveInstallation = async (e: React.FormEvent) => {
    e.preventDefault();
    setInstSaving(true);
    try {
      await apiGatewayService.saveWebsiteInstallation({
        id: editingInst?.id,
        installationId: instId,
        customerId: instCustomerId,
        userId: instUserId,
        buyerName: instBuyerName,
        domain: instDomain,
        appVersion: instVersion,
        apiLocked: instLocked,
        status: instStatus,
        note: instNote,
      });
      setInstModalOpen(false);
      showToast({
        title: editingInst ? 'Installation Updated' : 'Website Installation Registered',
        description: `${instDomain} (${instId}) saved.`,
        tone: 'success',
      });
      await loadAll();
    } catch (err) {
      showToast({
        title: 'Save Failed',
        description: err instanceof Error ? err.message : 'Could not save installation.',
        tone: 'error',
      });
    } finally {
      setInstSaving(false);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSettingsSaving(true);
    try {
      await apiGatewayService.saveApiGatewaySettings({
        gatewayEnabled: gwSettings.gatewayEnabled,
        defaultBaseUrl: gwSettings.defaultBaseUrl,
        defaultRateLimitPerMinute: gwSettings.defaultRateLimitPerMinute,
        maxBulkStatusIds: gwSettings.maxBulkStatusIds,
        requireIdempotencyKey: gwSettings.requireIdempotencyKey,
        autoDispatchEnabled: gwSettings.autoDispatchEnabled,
        allowCustomerSelfKeyGen: gwSettings.allowCustomerSelfKeyGen,
        defaultLockMode: false,
      });
      showToast({
        title: 'Gateway Settings Saved',
        description: 'Global API Gateway policies updated in Firestore.',
        tone: 'success',
      });
      await loadAll();
    } catch (err) {
      showToast({
        title: 'Save Failed',
        description: err instanceof Error ? err.message : 'Unable to save gateway settings.',
        tone: 'error',
      });
    } finally {
      setSettingsSaving(false);
    }
  };

  const navTabs: Array<{ id: GatewayAdminTab; label: string }> = [
    { id: 'overview', label: 'Overview & Monitoring' },
    { id: 'customers', label: 'API Customers & Access' },
    { id: 'keys', label: 'API Keys' },
    { id: 'orders', label: 'API Orders' },
    { id: 'balance', label: 'Balance & Ledger' },
    { id: 'installations', label: 'Website Installations' },
    { id: 'logs', label: 'Logs & Rate Limits' },
    { id: 'settings', label: 'API Settings' },
  ];

  const baseGatewayUrl =
    gwSettings.defaultBaseUrl?.trim() ||
    (typeof window !== 'undefined' ? `${window.location.origin}/api/v2` : 'https://your-gateway-domain/api/v2');

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-xl sm:text-2xl font-extrabold text-slate-950">
            Supartha Panel API Gateway Control
          </h1>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
            <span className="font-mono text-slate-700">POST /api/v2</span>
            <span>·</span>
            <span>Hashed Key Auth</span>
            <span>·</span>
            <span>{customers.length} API Customers</span>
            <span>·</span>
            <span>{installations.length} Buyer Installations</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={loadAll}
            disabled={loading}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
          <button
            type="button"
            onClick={openCreateCustomer}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-violet-700 px-3.5 text-xs font-bold text-white hover:bg-violet-800 whitespace-nowrap"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Enroll API Customer</span>
          </button>
        </div>
      </div>

      {/* Segmented Navigation */}
      <div className="flex items-center gap-1.5 overflow-x-auto border-b border-slate-200 pb-2">
        {navTabs.map((item) => {
          const active = tab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={`h-9 rounded-lg px-3.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                active
                  ? 'bg-violet-700 text-white'
                  : 'text-slate-600 hover:bg-white hover:text-slate-900'
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </div>

      {errorMsg && (
        <div className="flex items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-900">
          <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
          <span>{errorMsg}</span>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center rounded-3xl border border-slate-200/80 bg-white py-16 text-xs text-slate-500">
          <Loader2 className="mr-2 h-4 w-4 animate-spin text-violet-700" />
          <span>Loading Master API Gateway telemetry...</span>
        </div>
      ) : (
        <>
          {/* TAB 1: OVERVIEW & MONITORING */}
          {tab === 'overview' && (
            <div className="space-y-5">
              {/* Server Readiness Strip */}
              <div className="rounded-2xl border border-slate-200/80 bg-white p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Server className="h-4 w-4 text-violet-700" />
                    <h2 className="font-display text-sm font-bold text-slate-900">
                      Gateway Runtime Readiness
                    </h2>
                  </div>
                  <span className="font-mono text-xs text-slate-500">POST {baseGatewayUrl}</span>
                </div>

                <div className="grid gap-3 sm:grid-cols-3 text-xs">
                  <div className="rounded-xl border border-slate-100 bg-slate-50 p-3 flex items-start gap-2">
                    {serverStatus?.backendAuthConfigured ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                    ) : (
                      <ShieldAlert className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                    )}
                    <div>
                      <p className="font-semibold text-slate-900">External /api/v2 Auth</p>
                      <p className="text-slate-600 mt-0.5">
                        {serverStatus?.backendAuthConfigured
                          ? serverStatus.authMode === 'adc_metadata'
                            ? 'Cloud host ADC metadata token active.'
                            : 'Firebase service account configured cleanly.'
                          : 'Configure host ADC or FIREBASE_SERVICE_ACCOUNT_JSON to serve reseller POST /api/v2 calls.'}
                      </p>
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-100 bg-slate-50 p-3 flex items-start gap-2">
                    <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-slate-900">Key Hashing Security</p>
                      <p className="text-slate-600 mt-0.5">
                        Standard SHA-256 hashed verification (zero-config, plaintext never persisted).
                      </p>
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-100 bg-slate-50 p-3 flex items-start gap-2">
                    <Activity className="h-4 w-4 text-violet-700 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-slate-900">Gateway Policy</p>
                      <p className="text-slate-600 mt-0.5">
                        {gwSettings.gatewayEnabled ? 'Enabled' : 'Paused'} · Auto-Dispatch{' '}
                        {gwSettings.autoDispatchEnabled ? 'ON' : 'OFF'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* 4 KPI Cards */}
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-2xl border border-slate-200/80 bg-white p-4">
                  <p className="text-xs text-slate-500">Active API Customers</p>
                  <p className="mt-1.5 font-display text-2xl font-extrabold text-slate-950 tabular-nums">
                    {metrics.activeCustomers}
                  </p>
                  <p className="mt-1 text-[11px] text-slate-500 tabular-nums">
                    Total API Balance held: {currencySymbol}
                    {metrics.totalHoldBalance.toFixed(2)}
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-200/80 bg-white p-4">
                  <p className="text-xs text-slate-500">Active API Keys</p>
                  <p className="mt-1.5 font-display text-2xl font-extrabold text-slate-950 tabular-nums">
                    {metrics.activeKeys}
                  </p>
                  <p className="mt-1 text-[11px] text-slate-500 tabular-nums">
                    {keys.length} total keys in registry
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-200/80 bg-white p-4">
                  <p className="text-xs text-slate-500">API Orders Revenue</p>
                  <p className="mt-1.5 font-display text-2xl font-extrabold text-slate-950 tabular-nums">
                    {currencySymbol}
                    {metrics.totalApiRevenue.toFixed(2)}
                  </p>
                  <p className="mt-1 text-[11px] text-slate-500 tabular-nums">
                    {orders.length} gateway orders processed
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-200/80 bg-white p-4">
                  <p className="text-xs text-slate-500">Traffic Health</p>
                  <p className="mt-1.5 font-display text-2xl font-extrabold text-emerald-700 tabular-nums">
                    {metrics.successRate}%
                  </p>
                  <p className="mt-1 text-[11px] text-slate-500 tabular-nums">
                    {metrics.totalCalls} logged calls · {metrics.avgLatency}ms avg
                  </p>
                </div>
              </div>

              {/* Quick Preview of Recent Gateway Orders */}
              <div className="rounded-2xl border border-slate-200/80 bg-white overflow-hidden">
                <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5">
                  <h2 className="font-display text-sm font-bold text-slate-900">
                    Latest API Gateway Orders
                  </h2>
                  <button
                    type="button"
                    onClick={() => setTab('orders')}
                    className="text-xs font-semibold text-violet-700 hover:underline"
                  >
                    Manage All ({orders.length})
                  </button>
                </div>
                {orders.length === 0 ? (
                  <p className="p-6 text-center text-xs text-slate-400">
                    No API orders have passed through the gateway yet.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="border-b border-slate-100 bg-slate-50 text-[11px] font-semibold text-slate-500">
                        <tr>
                          <th className="px-4 py-2.5">API Order</th>
                          <th className="px-4 py-2.5">Customer</th>
                          <th className="px-4 py-2.5">Service</th>
                          <th className="px-4 py-2.5">Charge</th>
                          <th className="px-4 py-2.5">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {orders.slice(0, 6).map((ord) => (
                          <tr key={ord.id}>
                            <td className="px-4 py-2.5 font-mono font-semibold text-slate-900">
                              {ord.id}
                            </td>
                            <td className="px-4 py-2.5 text-slate-700">
                              {customerMap.get(ord.customerId)?.name || ord.customerId}
                            </td>
                            <td className="px-4 py-2.5 max-w-[200px] truncate text-slate-600">
                              {ord.serviceName}
                            </td>
                            <td className="px-4 py-2.5 font-semibold tabular-nums">
                              {currencySymbol}
                              {ord.charge.toFixed(2)}
                            </td>
                            <td className="px-4 py-2.5 font-semibold text-slate-900">
                              {ord.status}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 2: API CUSTOMERS & ACCESS */}
          {tab === 'customers' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="relative flex-1 min-w-[220px] max-w-md">
                  <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    value={customerSearch}
                    onChange={(e) => setCustomerSearch(e.target.value)}
                    placeholder="Search name, email, domain, installation ID..."
                    className="h-9 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-xs"
                  />
                </div>
                <button
                  type="button"
                  onClick={openCreateCustomer}
                  className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-violet-700 px-3.5 text-xs font-bold text-white hover:bg-violet-800"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>New API Customer</span>
                </button>
              </div>

              <div className="rounded-2xl border border-slate-200/80 bg-white overflow-hidden">
                {filteredCustomers.length === 0 ? (
                  <p className="p-8 text-center text-xs text-slate-400">
                    No API customers found. Click &ldquo;New API Customer&rdquo; to enroll a buyer
                    or reseller.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="border-b border-slate-100 bg-slate-50 text-[11px] font-semibold text-slate-500">
                        <tr>
                          <th className="px-4 py-2.5">Customer</th>
                          <th className="px-4 py-2.5">Installation & Domain</th>
                          <th className="px-4 py-2.5">API Balance</th>
                          <th className="px-4 py-2.5">Limit / Disc</th>
                          <th className="px-4 py-2.5">Status</th>
                          <th className="px-4 py-2.5 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredCustomers.map((c) => (
                          <tr key={c.id} className="hover:bg-slate-50/60">
                            <td className="px-4 py-3">
                              <p className="font-semibold text-slate-900">{c.name}</p>
                              <p className="text-[11px] text-slate-500">{c.email}</p>
                              <p className="font-mono text-[10px] text-slate-400">{c.id}</p>
                            </td>
                            <td className="px-4 py-3">
                              <p className="font-mono font-semibold text-slate-800">
                                {c.installationId}
                              </p>
                              <p className="text-[11px] text-slate-500">
                                {c.websiteDomain || 'No domain set'}
                              </p>
                            </td>
                            <td className="px-4 py-3 font-bold text-slate-950 tabular-nums">
                              {currencySymbol}
                              {c.apiBalance.toFixed(2)}
                            </td>
                            <td className="px-4 py-3 tabular-nums text-slate-700">
                              {c.rateLimitPerMinute}/min · {c.customDiscountPercent}%
                            </td>
                            <td className="px-4 py-3">
                              <span
                                className={`font-bold uppercase text-[11px] ${
                                  c.status === 'active'
                                    ? 'text-emerald-700'
                                    : c.status === 'suspended'
                                    ? 'text-amber-700'
                                    : 'text-rose-700'
                                }`}
                              >
                                {c.status}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => openGenerateKeyModal(c.id)}
                                  className="rounded-lg border border-violet-200 bg-violet-50 px-2 py-1 text-[11px] font-semibold text-violet-800 hover:bg-violet-100"
                                >
                                  Issue Key
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setBalCustomerId(c.id);
                                    setTab('balance');
                                  }}
                                  className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
                                >
                                  Balance
                                </button>
                                <button
                                  type="button"
                                  onClick={() => openEditCustomer(c)}
                                  className="rounded-lg border border-slate-200 bg-white p-1 text-slate-600 hover:bg-slate-50"
                                  aria-label={`Edit ${c.name}`}
                                >
                                  <Edit3 className="h-3.5 w-3.5" />
                                </button>
                                {c.status === 'active' ? (
                                  <button
                                    type="button"
                                    onClick={() => handleCustomerStatus(c, 'suspended')}
                                    className="rounded-lg border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-800"
                                  >
                                    Suspend
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => handleCustomerStatus(c, 'active')}
                                    className="rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-800"
                                  >
                                    Activate
                                  </button>
                                )}
                                {c.status !== 'revoked' && (
                                  <button
                                    type="button"
                                    onClick={() => handleCustomerStatus(c, 'revoked')}
                                    className="rounded-lg border border-rose-200 bg-rose-50 px-2 py-1 text-[11px] font-semibold text-rose-700"
                                  >
                                    Revoke
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: API KEYS */}
          {tab === 'keys' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200/80 bg-white p-4">
                <p className="text-xs text-slate-600">
                  Manage masked API credentials across all enrolled customers. Plaintext keys are
                  only shown once at generation/regeneration.
                </p>
                <button
                  type="button"
                  disabled={customers.length === 0}
                  onClick={() => openGenerateKeyModal()}
                  className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-violet-700 px-3.5 text-xs font-bold text-white hover:bg-violet-800 disabled:opacity-50"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Generate API Key</span>
                </button>
              </div>

              <div className="rounded-2xl border border-slate-200/80 bg-white overflow-hidden">
                {keys.length === 0 ? (
                  <p className="p-8 text-center text-xs text-slate-400">
                    No API keys issued yet.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="border-b border-slate-100 bg-slate-50 text-[11px] font-semibold text-slate-500">
                        <tr>
                          <th className="px-4 py-2.5">Label & Masked Key</th>
                          <th className="px-4 py-2.5">Customer</th>
                          <th className="px-4 py-2.5">Scopes & Limit</th>
                          <th className="px-4 py-2.5">Usage</th>
                          <th className="px-4 py-2.5">Status</th>
                          <th className="px-4 py-2.5 text-right">Controls</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {keys.map((k) => {
                          const cus = customerMap.get(k.customerId);
                          return (
                            <tr key={k.id}>
                              <td className="px-4 py-3">
                                <p className="font-semibold text-slate-900">{k.label}</p>
                                <p className="font-mono text-[11px] text-slate-600">{k.maskedKey}</p>
                              </td>
                              <td className="px-4 py-3">
                                <p className="font-medium text-slate-800">
                                  {cus?.name || k.customerId}
                                </p>
                                <p className="font-mono text-[10px] text-slate-400">
                                  {k.installationId || cus?.installationId || '—'}
                                </p>
                              </td>
                              <td className="px-4 py-3 text-slate-600">
                                <p>{k.permissions.join(', ')}</p>
                                <p className="text-[11px] tabular-nums">{k.rateLimitPerMinute}/min</p>
                              </td>
                              <td className="px-4 py-3 tabular-nums text-slate-600">
                                <p>{k.requestCount} calls</p>
                                <p className="text-[11px]">{k.lastUsedAtLabel}</p>
                              </td>
                              <td className="px-4 py-3 font-bold uppercase text-[11px]">
                                <span
                                  className={
                                    k.status === 'active'
                                      ? 'text-emerald-700'
                                      : k.status === 'disabled'
                                      ? 'text-amber-700'
                                      : 'text-rose-700'
                                  }
                                >
                                  {k.status}
                                </span>
                              </td>
                              <td className="px-4 py-3">
                                {k.status !== 'revoked' ? (
                                  <div className="flex items-center justify-end gap-1.5">
                                    <button
                                      type="button"
                                      disabled={keyBusy}
                                      onClick={() => handleRegenerateKey(k)}
                                      className="inline-flex items-center gap-1 rounded-lg border border-violet-200 bg-violet-50 px-2 py-1 text-[11px] font-semibold text-violet-800"
                                    >
                                      <RotateCcw className="h-3 w-3" />
                                      <span>Regenerate</span>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleSetKeyStatus(
                                          k,
                                          k.status === 'active' ? 'disabled' : 'active'
                                        )
                                      }
                                      className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700"
                                    >
                                      {k.status === 'active' ? 'Disable' : 'Enable'}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleSetKeyStatus(k, 'revoked')}
                                      className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2 py-1 text-[11px] font-semibold text-rose-700"
                                    >
                                      <Ban className="h-3 w-3" />
                                      <span>Revoke</span>
                                    </button>
                                  </div>
                                ) : (
                                  <span className="block text-right text-[11px] text-slate-400">
                                    Revoked permanently
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 4: API ORDERS */}
          {tab === 'orders' && (
            <div className="space-y-4">
              <div className="relative max-w-md">
                <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  value={orderSearch}
                  onChange={(e) => setOrderSearch(e.target.value)}
                  placeholder="Search API Order ID, Internal Order ID, Customer, or Link..."
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
                          <th className="px-4 py-2.5">API Order / Internal</th>
                          <th className="px-4 py-2.5">Customer</th>
                          <th className="px-4 py-2.5">Service</th>
                          <th className="px-4 py-2.5">Qty / Charge</th>
                          <th className="px-4 py-2.5">Status</th>
                          <th className="px-4 py-2.5 text-right">Sync</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredOrders.map((ord) => (
                          <tr key={ord.id}>
                            <td className="px-4 py-3">
                              <p className="font-mono font-semibold text-slate-900">{ord.id}</p>
                              <p className="font-mono text-[10px] text-slate-500">
                                Int: {ord.internalOrderId}
                              </p>
                            </td>
                            <td className="px-4 py-3 text-slate-700">
                              <p className="font-medium">
                                {customerMap.get(ord.customerId)?.name || ord.customerId}
                              </p>
                              <p className="font-mono text-[10px] text-slate-400">
                                {ord.installationId || '—'}
                              </p>
                            </td>
                            <td className="px-4 py-3 max-w-[220px]">
                              <p className="truncate text-slate-800">{ord.serviceName}</p>
                              <p className="truncate font-mono text-[10px] text-slate-500">
                                {ord.link}
                              </p>
                            </td>
                            <td className="px-4 py-3 tabular-nums">
                              <p className="font-semibold text-slate-900">
                                {ord.quantity.toLocaleString()} units
                              </p>
                              <p className="text-slate-600">
                                {currencySymbol}
                                {ord.charge.toFixed(2)}
                              </p>
                            </td>
                            <td className="px-4 py-3">
                              <p className="font-semibold text-slate-900">{ord.status}</p>
                              <p className="text-[10px] text-slate-500">
                                Dispatched: {ord.providerDispatched ? 'Yes' : 'No'}
                                {ord.refunded ? ' · Refunded' : ''}
                              </p>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <button
                                type="button"
                                disabled={syncingOrderId === ord.id}
                                onClick={() => handleSyncApiOrder(ord)}
                                className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                              >
                                <RefreshCw
                                  className={`h-3 w-3 ${
                                    syncingOrderId === ord.id ? 'animate-spin' : ''
                                  }`}
                                />
                                <span>Sync</span>
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 5: API BALANCE MANAGEMENT & TRANSACTIONS */}
          {tab === 'balance' && (
            <div className="space-y-5">
              <form
                onSubmit={handleAdjustBalance}
                className="rounded-2xl border border-slate-200/80 bg-white p-5 space-y-4"
              >
                <div className="flex items-center gap-2">
                  <Wallet className="h-4 w-4 text-violet-700" />
                  <h2 className="font-display text-sm font-bold text-slate-900">
                    Atomic API Balance Credit / Debit
                  </h2>
                </div>

                <div className="grid gap-3 sm:grid-cols-4">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      API Customer
                    </label>
                    <select
                      required
                      value={balCustomerId}
                      onChange={(e) => setBalCustomerId(e.target.value)}
                      className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs"
                    >
                      <option value="">Select API Customer...</option>
                      {customers.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} ({c.email}) — {currencySymbol}
                          {c.apiBalance.toFixed(2)}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Operation
                    </label>
                    <select
                      value={balOperation}
                      onChange={(e) => setBalOperation(e.target.value as typeof balOperation)}
                      className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs"
                    >
                      <option value="credit">Credit (+ Add Balance)</option>
                      <option value="debit">Debit (- Deduct Balance)</option>
                      <option value="adjustment">Adjustment (+ Add)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Amount ({currencySymbol})
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      required
                      value={balAmount}
                      onChange={(e) => setBalAmount(e.target.value)}
                      placeholder="500.00"
                      className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs tabular-nums"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-end gap-3">
                  <div className="flex-1 min-w-[220px]">
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Ledger Note / Reference
                    </label>
                    <input
                      type="text"
                      required
                      maxLength={280}
                      value={balDesc}
                      onChange={(e) => setBalDesc(e.target.value)}
                      placeholder="e.g. Wholesale deposit verified via bKash TrxID..."
                      className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={balBusy || !balCustomerId}
                    className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-violet-700 px-5 text-xs font-bold text-white hover:bg-violet-800 disabled:opacity-50"
                  >
                    {balBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                    <span>Apply Transaction</span>
                  </button>
                </div>
              </form>

              <div className="rounded-2xl border border-slate-200/80 bg-white overflow-hidden">
                <div className="border-b border-slate-100 px-5 py-3.5">
                  <h2 className="font-display text-sm font-bold text-slate-900">
                    Gateway Financial Ledger ({transactions.length})
                  </h2>
                </div>
                {transactions.length === 0 ? (
                  <p className="p-8 text-center text-xs text-slate-400">
                    No API financial transactions yet.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="border-b border-slate-100 bg-slate-50 text-[11px] font-semibold text-slate-500">
                        <tr>
                          <th className="px-4 py-2.5">Txn ID</th>
                          <th className="px-4 py-2.5">Customer</th>
                          <th className="px-4 py-2.5">Type</th>
                          <th className="px-4 py-2.5">Amount</th>
                          <th className="px-4 py-2.5">After</th>
                          <th className="px-4 py-2.5">Description</th>
                          <th className="px-4 py-2.5">Created</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {transactions.map((txn) => (
                          <tr key={txn.id}>
                            <td className="px-4 py-2.5 font-mono text-slate-700">{txn.id}</td>
                            <td className="px-4 py-2.5 text-slate-800">
                              {customerMap.get(txn.customerId)?.name || txn.customerId}
                            </td>
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
                            <td className="px-4 py-2.5 font-semibold tabular-nums">
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

          {/* TAB 6: WEBSITE INSTALLATIONS */}
          {tab === 'installations' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200/80 bg-white p-4">
                <div className="text-xs text-slate-600">
                  Register sold white-label buyer websites, enforce API lock configuration, and
                  generate buyer server <code className="font-mono">.env</code> deployment blocks.
                </div>
                <button
                  type="button"
                  disabled={customers.length === 0}
                  onClick={openCreateInstallation}
                  className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-violet-700 px-3.5 text-xs font-bold text-white hover:bg-violet-800 disabled:opacity-50"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Register Installation</span>
                </button>
              </div>

              <div className="rounded-2xl border border-slate-200/80 bg-white overflow-hidden">
                {installations.length === 0 ? (
                  <p className="p-8 text-center text-xs text-slate-400">
                    No sold website installations registered yet.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="border-b border-slate-100 bg-slate-50 text-[11px] font-semibold text-slate-500">
                        <tr>
                          <th className="px-4 py-2.5">Installation ID</th>
                          <th className="px-4 py-2.5">Buyer & Domain</th>
                          <th className="px-4 py-2.5">Linked Customer</th>
                          <th className="px-4 py-2.5">API Lock Mode</th>
                          <th className="px-4 py-2.5">Status</th>
                          <th className="px-4 py-2.5 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {installations.map((inst) => (
                          <tr key={inst.id}>
                            <td className="px-4 py-3 font-mono font-bold text-slate-900">
                              {inst.installationId}
                            </td>
                            <td className="px-4 py-3">
                              <p className="font-semibold text-slate-900">{inst.buyerName}</p>
                              <p className="font-mono text-[11px] text-slate-500">{inst.domain}</p>
                            </td>
                            <td className="px-4 py-3">
                              <p className="text-slate-800">
                                {customerMap.get(inst.customerId)?.name || inst.customerId}
                              </p>
                              <p className="font-mono text-[10px] text-slate-400">
                                {inst.customerId}
                              </p>
                            </td>
                            <td className="px-4 py-3 font-semibold">
                              {inst.apiLocked ? (
                                <span className="text-emerald-700">Locked to Supartha Panel</span>
                              ) : (
                                <span className="text-slate-600">Unlocked</span>
                              )}
                            </td>
                            <td className="px-4 py-3 font-bold uppercase text-[11px]">
                              <span
                                className={
                                  inst.status === 'active'
                                    ? 'text-emerald-700'
                                    : inst.status === 'suspended'
                                    ? 'text-amber-700'
                                    : 'text-rose-700'
                                }
                              >
                                {inst.status}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => openEditInstallation(inst)}
                                  className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700"
                                >
                                  Edit
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 7: LOGS & RATE LIMITS */}
          {tab === 'logs' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <select
                  value={logStatusFilter}
                  onChange={(e) => setLogStatusFilter(e.target.value as typeof logStatusFilter)}
                  className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700"
                >
                  <option value="all">All Outcomes ({logs.length})</option>
                  <option value="success">Succeeded</option>
                  <option value="error">Failed / Blocked</option>
                </select>
                <select
                  value={logActionFilter}
                  onChange={(e) => setLogActionFilter(e.target.value)}
                  className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700"
                >
                  <option value="all">All Actions</option>
                  <option value="balance">balance</option>
                  <option value="services">services</option>
                  <option value="add">add</option>
                  <option value="status">status</option>
                </select>
              </div>

              <div className="rounded-2xl border border-slate-200/80 bg-white overflow-hidden">
                {filteredLogs.length === 0 ? (
                  <p className="p-8 text-center text-xs text-slate-400">
                    No matching API request logs found.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="border-b border-slate-100 bg-slate-50 text-[11px] font-semibold text-slate-500">
                        <tr>
                          <th className="px-4 py-2.5">Customer / Install</th>
                          <th className="px-4 py-2.5">Action</th>
                          <th className="px-4 py-2.5">HTTP</th>
                          <th className="px-4 py-2.5">Latency</th>
                          <th className="px-4 py-2.5">IP</th>
                          <th className="px-4 py-2.5">Detail</th>
                          <th className="px-4 py-2.5">Time</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredLogs.map((log) => (
                          <tr key={log.id}>
                            <td className="px-4 py-2.5">
                              <p className="font-medium text-slate-800">
                                {customerMap.get(log.customerId)?.name || log.customerId || 'Unauthenticated'}
                              </p>
                              <p className="font-mono text-[10px] text-slate-400">
                                {log.installationId || '—'}
                              </p>
                            </td>
                            <td className="px-4 py-2.5 font-mono font-semibold text-slate-900">
                              {log.action}
                            </td>
                            <td
                              className={`px-4 py-2.5 font-mono font-bold tabular-nums ${
                                log.success ? 'text-emerald-700' : 'text-rose-700'
                              }`}
                            >
                              {log.httpStatus}
                            </td>
                            <td className="px-4 py-2.5 tabular-nums text-slate-600">
                              {log.latencyMs}ms
                            </td>
                            <td className="px-4 py-2.5 font-mono text-[11px] text-slate-500">
                              {log.ipAddress || '—'}
                            </td>
                            <td className="px-4 py-2.5 max-w-[220px] truncate text-slate-600">
                              {log.errorMessage || log.idempotencyKey || 'OK'}
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

          {/* TAB 8: API SETTINGS */}
          {tab === 'settings' && (
            <form
              onSubmit={handleSaveSettings}
              className="rounded-2xl border border-slate-200/80 bg-white p-5 sm:p-6 space-y-5"
            >
              <div>
                <h2 className="font-display text-base font-bold text-slate-900">
                  Global API Gateway Settings
                </h2>
                <p className="text-xs text-slate-500">
                  Stored in <code className="font-mono">settings/apiGateway</code> and enforced on
                  every <code className="font-mono">POST /api/v2</code> request.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div className="sm:col-span-3">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Canonical Public API v2 Base URL
                  </label>
                  <input
                    type="text"
                    value={gwSettings.defaultBaseUrl}
                    onChange={(e) =>
                      setGwSettings((p) => ({ ...p, defaultBaseUrl: e.target.value }))
                    }
                    placeholder="https://api.suparthapanel.com/api/v2"
                    className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 font-mono text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Default Rate Limit (req/min)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="10000"
                    value={gwSettings.defaultRateLimitPerMinute}
                    onChange={(e) =>
                      setGwSettings((p) => ({
                        ...p,
                        defaultRateLimitPerMinute: Number(e.target.value),
                      }))
                    }
                    className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs tabular-nums"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Max Bulk Status Order IDs
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="500"
                    value={gwSettings.maxBulkStatusIds}
                    onChange={(e) =>
                      setGwSettings((p) => ({ ...p, maxBulkStatusIds: Number(e.target.value) }))
                    }
                    className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs tabular-nums"
                  />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 text-xs">
                {[
                  {
                    key: 'gatewayEnabled' as const,
                    label: 'Public API Gateway Enabled',
                    desc: 'When unchecked, /api/v2 rejects incoming reseller requests cleanly.',
                  },
                  {
                    key: 'autoDispatchEnabled' as const,
                    label: 'Auto-Dispatch to Upstream Providers',
                    desc: 'Automatically forwards API orders to mapped upstream providers with refund on failure.',
                  },
                  {
                    key: 'requireIdempotencyKey' as const,
                    label: 'Require Idempotency-Key on Add Order',
                    desc: 'Mandate Idempotency-Key header/parameter for every action=add request.',
                  },
                  {
                    key: 'allowCustomerSelfKeyGen' as const,
                    label: 'Allow Customers to Generate Own Keys',
                    desc: 'Lets active resellers issue/rotate keys inside their API dashboard.',
                  },
                ].map((opt) => (
                  <label
                    key={opt.key}
                    className="flex items-start gap-2.5 rounded-xl border border-slate-200 bg-slate-50 p-3 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={gwSettings[opt.key]}
                      onChange={(e) =>
                        setGwSettings((p) => ({ ...p, [opt.key]: e.target.checked }))
                      }
                      className="mt-0.5 h-4 w-4 rounded border-slate-300 text-violet-700"
                    />
                    <div>
                      <p className="font-semibold text-slate-900">{opt.label}</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">{opt.desc}</p>
                    </div>
                  </label>
                ))}
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={settingsSaving}
                  className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-violet-700 px-5 text-xs font-bold text-white hover:bg-violet-800 disabled:opacity-60"
                >
                  {settingsSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                  <span>Save Gateway Settings</span>
                </button>
              </div>
            </form>
          )}
        </>
      )}

      {/* Customer Modal */}
      {customerModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
        >
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="font-display text-lg font-bold text-slate-900">
                {editingCustomer ? 'Edit API Customer' : 'Enroll API Customer'}
              </h2>
              <button
                type="button"
                onClick={() => setCustomerModalOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveCustomer} className="mt-4 space-y-3 text-xs">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Customer Name</label>
                  <input
                    type="text"
                    required
                    value={cusName}
                    onChange={(e) => setCusName(e.target.value)}
                    placeholder="Dhaka SMM Buyer"
                    className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Email</label>
                  <input
                    type="email"
                    required
                    value={cusEmail}
                    onChange={(e) => setCusEmail(e.target.value)}
                    placeholder="buyer@example.com"
                    className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3"
                  />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Linked Firebase UID (Optional)
                  </label>
                  <input
                    type="text"
                    value={cusUserId}
                    onChange={(e) => setCusUserId(e.target.value)}
                    placeholder="Allows customer to open API tab"
                    className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Installation ID</label>
                  <input
                    type="text"
                    required
                    value={cusInstallId}
                    onChange={(e) => setCusInstallId(e.target.value)}
                    className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 font-mono"
                  />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Company / Brand</label>
                  <input
                    type="text"
                    value={cusCompany}
                    onChange={(e) => setCusCompany(e.target.value)}
                    className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Website Domain</label>
                  <input
                    type="text"
                    value={cusDomain}
                    onChange={(e) => setCusDomain(e.target.value)}
                    placeholder="buyer-smm.com"
                    className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 font-mono"
                  />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Rate Limit / min</label>
                  <input
                    type="number"
                    min="1"
                    max="10000"
                    required
                    value={cusRateLimit}
                    onChange={(e) => setCusRateLimit(e.target.value)}
                    className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 tabular-nums"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Discount %</label>
                  <input
                    type="number"
                    min="0"
                    max="90"
                    step="0.5"
                    value={cusDiscount}
                    onChange={(e) => setCusDiscount(e.target.value)}
                    className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 tabular-nums"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Status</label>
                  <select
                    value={cusStatus}
                    onChange={(e) => setCusStatus(e.target.value as ApiCustomerStatus)}
                    className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3"
                  >
                    <option value="active">Active</option>
                    <option value="suspended">Suspended</option>
                    <option value="revoked">Revoked</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Internal Note</label>
                <input
                  type="text"
                  value={cusNote}
                  onChange={(e) => setCusNote(e.target.value)}
                  className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setCustomerModalOpen(false)}
                  className="h-10 rounded-xl border border-slate-200 px-4 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={cusSaving}
                  className="h-10 rounded-xl bg-violet-700 px-5 font-bold text-white hover:bg-violet-800 disabled:opacity-60"
                >
                  {cusSaving ? 'Saving...' : 'Save Customer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Generate Key Modal */}
      {keyModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="font-display text-lg font-bold text-slate-900">
                Issue Customer API Key
              </h2>
              <button
                type="button"
                onClick={() => setKeyModalOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleGenerateKeySubmit} className="mt-4 space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">API Customer</label>
                <select
                  required
                  value={keyCustomerId}
                  onChange={(e) => setKeyCustomerId(e.target.value)}
                  className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3"
                >
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.status})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Key Label</label>
                  <input
                    type="text"
                    required
                    value={keyLabel}
                    onChange={(e) => setKeyLabel(e.target.value)}
                    className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Rate Limit / min</label>
                  <input
                    type="number"
                    min="1"
                    max="10000"
                    required
                    value={keyRateLimit}
                    onChange={(e) => setKeyRateLimit(e.target.value)}
                    className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 tabular-nums"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Permissions</label>
                <div className="flex flex-wrap gap-3 pt-1">
                  {PERM_OPTIONS.map((p) => (
                    <label key={p.id} className="inline-flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={keyPerms.includes(p.id)}
                        onChange={() =>
                          setKeyPerms((prev) =>
                            prev.includes(p.id) ? prev.filter((x) => x !== p.id) : [...prev, p.id]
                          )
                        }
                        className="h-3.5 w-3.5 rounded border-slate-300 text-violet-700"
                      />
                      <span>{p.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setKeyModalOpen(false)}
                  className="h-10 rounded-xl border border-slate-200 px-4 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={keyBusy}
                  className="h-10 rounded-xl bg-violet-700 px-5 font-bold text-white hover:bg-violet-800 disabled:opacity-60"
                >
                  {keyBusy ? 'Issuing...' : 'Generate Key'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Website Installation Modal */}
      {instModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
        >
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="font-display text-lg font-bold text-slate-900">
                {editingInst ? 'Edit Website Installation' : 'Register Sold Website'}
              </h2>
              <button
                type="button"
                onClick={() => setInstModalOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveInstallation} className="mt-4 space-y-3 text-xs">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Installation ID
                  </label>
                  <input
                    type="text"
                    required
                    disabled={Boolean(editingInst)}
                    value={instId}
                    onChange={(e) => setInstId(e.target.value)}
                    className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 font-mono disabled:opacity-60"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Linked API Customer
                  </label>
                  <select
                    required
                    value={instCustomerId}
                    onChange={(e) => {
                      const c = customerMap.get(e.target.value);
                      setInstCustomerId(e.target.value);
                      if (c) {
                        setInstUserId(c.userId);
                        if (!instBuyerName) setInstBuyerName(c.name);
                        if (!instDomain) setInstDomain(c.websiteDomain);
                      }
                    }}
                    className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3"
                  >
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.id})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Buyer Name</label>
                  <input
                    type="text"
                    required
                    value={instBuyerName}
                    onChange={(e) => setInstBuyerName(e.target.value)}
                    className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Buyer Domain</label>
                  <input
                    type="text"
                    required
                    value={instDomain}
                    onChange={(e) => setInstDomain(e.target.value)}
                    placeholder="panel.buyerdomain.com"
                    className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 font-mono"
                  />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">App Version</label>
                  <input
                    type="text"
                    value={instVersion}
                    onChange={(e) => setInstVersion(e.target.value)}
                    className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Status</label>
                  <select
                    value={instStatus}
                    onChange={(e) => setInstStatus(e.target.value as WebsiteInstallationStatus)}
                    className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3"
                  >
                    <option value="active">Active</option>
                    <option value="suspended">Suspended</option>
                    <option value="revoked">Revoked</option>
                  </select>
                </div>
              </div>

              <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={instLocked}
                  onChange={(e) => setInstLocked(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-violet-700"
                />
                <span>Lock upstream provider configuration strictly to Supartha Panel API</span>
              </label>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setInstModalOpen(false)}
                  className="h-10 rounded-xl border border-slate-200 px-4 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={instSaving}
                  className="h-10 rounded-xl bg-violet-700 px-5 font-bold text-white hover:bg-violet-800 disabled:opacity-60"
                >
                  {instSaving ? 'Saving...' : 'Save Installation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* One-Time Key Reveal Modal */}
      {revealedKeyModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/65 p-4 backdrop-blur-xs"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-amber-700">
                  Shown Once Only
                </p>
                <h2 className="font-display text-lg font-extrabold text-slate-950">
                  Plaintext API Key Issued
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

            <p className="text-xs text-slate-600 leading-relaxed">
              Copy and deliver this plaintext key for <strong>{revealedKeyModal.label}</strong>{' '}
              securely. Only the SHA-256 hash is stored in Firestore.
            </p>

            <div className="rounded-2xl border border-violet-200 bg-violet-50/70 p-3.5 flex items-center justify-between gap-2">
              <code className="break-all font-mono text-xs font-bold text-slate-950">
                {revealedKeyModal.plaintextKeyOnce}
              </code>
              <button
                type="button"
                onClick={() => copyText(revealedKeyModal.plaintextKeyOnce, 'API Key Copied')}
                className="inline-flex h-8 shrink-0 items-center gap-1 rounded-lg bg-violet-700 px-3 text-xs font-bold text-white"
              >
                <Check className="h-3.5 w-3.5" />
                <span>Copy</span>
              </button>
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setRevealedKeyModal(null)}
                className="h-10 rounded-xl bg-slate-900 px-5 text-xs font-bold text-white"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
