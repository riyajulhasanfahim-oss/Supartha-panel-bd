import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Download,
  Edit3,
  Eye,
  EyeOff,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
  Wallet,
  Wifi,
  X,
} from 'lucide-react';
import { APP_CONFIG } from '../../config/app.config';
import { useApp } from '../../context/AppContext';
import { maskSecretValue } from '../../lib/firebase/configManager';
import {
  adminPanelService,
  type AdminApiProviderItem,
  type AdminCategoryItem,
  type AdminServiceItem,
  type ApplyExistingServicesUpdateResult,
  type ExistingServicesUpdatePlan,
} from '../../services/adminPanel.service';
import {
  getProviderAdapter,
  resolveCategoryForImportedService,
  type ProviderServiceDTO,
} from '../../services/providerAdapter';
import { SERVICE_TYPE_OPTIONS, type ServiceType } from '../../types/service.types';
import {
  DEFAULT_USD_TO_BDT_RATE,
  calculateProviderServicePricing,
  isPackageService,
  normalizeCurrencySymbol,
  type ProviderRateCurrency,
} from '../../utils/pricing';

interface ConnectionFeedback {
  ok: boolean;
  message: string;
  balance?: number;
  currency?: string;
  serviceCount?: number;
}

export function AdminProvidersView() {
  const { showToast, systemSettings, refreshCustomerData, refreshSystemSettings } = useApp();
  const currencyCode = systemSettings?.currency?.trim() || APP_CONFIG.currencyCode;
  const currencySymbol = normalizeCurrencySymbol(systemSettings?.currencySymbol, currencyCode);
  const [providers, setProviders] = useState<AdminApiProviderItem[]>([]);
  const [services, setServices] = useState<AdminServiceItem[]>([]);
  const [categories, setCategories] = useState<AdminCategoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [revealedIds, setRevealedIds] = useState<Record<string, boolean>>({});
  const [testingId, setTestingId] = useState<string | null>(null);
  const [balanceLoadingId, setBalanceLoadingId] = useState<string | null>(null);
  const [connectionResults, setConnectionResults] = useState<Record<string, ConnectionFeedback>>(
    {}
  );

  // Add/Edit Provider modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<AdminApiProviderItem | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<AdminApiProviderItem | null>(null);
  const [name, setName] = useState('');
  const [apiUrl, setApiUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [providerFormat, setProviderFormat] = useState('standard_v2');
  const [status, setStatus] = useState<'active' | 'inactive'>('inactive');
  const [saving, setSaving] = useState(false);
  const [modalTesting, setModalTesting] = useState(false);
  const [modalTestResult, setModalTestResult] = useState<ConnectionFeedback | null>(null);
  const [modalVerifiedSnapshot, setModalVerifiedSnapshot] = useState<{
    apiUrl: string;
    apiKey: string;
    providerFormat: string;
  } | null>(null);

  // Service Import & Review modal state
  const [importProvider, setImportProvider] = useState<AdminApiProviderItem | null>(null);
  const [importLoading, setImportLoading] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importedList, setImportedList] = useState<ProviderServiceDTO[]>([]);
  const [importSearch, setImportSearch] = useState('');
  const [importCategoryFilter, setImportCategoryFilter] = useState('all');
  const [profitPerThousandInput, setProfitPerThousandInput] = useState('');
  const [importProviderCurrency, setImportProviderCurrency] = useState<ProviderRateCurrency>('USD');
  const [usdToBdtRateInput, setUsdToBdtRateInput] = useState(String(DEFAULT_USD_TO_BDT_RATE));
  const [bulkImporting, setBulkImporting] = useState(false);
  const [preparingUpdatePlan, setPreparingUpdatePlan] = useState(false);
  const [bulkUpdating, setBulkUpdating] = useState(false);
  const [updatePlanModal, setUpdatePlanModal] = useState<ExistingServicesUpdatePlan | null>(null);
  const [lastUpdateSummary, setLastUpdateSummary] =
    useState<ApplyExistingServicesUpdateResult | null>(null);

  // Review-before-publish form for a single selected imported service
  const [reviewItem, setReviewItem] = useState<ProviderServiceDTO | null>(null);
  const [rvCategoryId, setRvCategoryId] = useState('instagram');
  const [rvServiceType, setRvServiceType] = useState<ServiceType>('Followers');
  const [rvName, setRvName] = useState('');
  const [rvDescription, setRvDescription] = useState('');
  const [rvCostPrice, setRvCostPrice] = useState('0');
  const [rvSellingPrice, setRvSellingPrice] = useState('0');
  const [rvMinQty, setRvMinQty] = useState('100');
  const [rvMaxQty, setRvMaxQty] = useState('10000');
  const [rvAvgTime, setRvAvgTime] = useState('15 minutes');
  const [rvDeliverySpeed, setRvDeliverySpeed] = useState('Instant Delivery');
  const [rvRefill, setRvRefill] = useState(false);
  const [rvStatus, setRvStatus] = useState<'active' | 'inactive'>('inactive');
  const [rvSaving, setRvSaving] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [provList, srvList, catList] = await Promise.all([
        adminPanelService.listApiProviders(),
        adminPanelService.listServicesAdmin(),
        adminPanelService.listCategories(),
      ]);
      setProviders(provList);
      setServices(srvList);
      setCategories(catList);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const mappedCountsByProvider = useMemo(() => {
    const counts = new Map<string, number>();
    for (const s of services) {
      if (s.providerId) {
        counts.set(s.providerId, (counts.get(s.providerId) ?? 0) + 1);
      }
    }
    return counts;
  }, [services]);

  const mappedServiceByRemoteIdForImport = useMemo(() => {
    const map = new Map<string, AdminServiceItem>();
    if (!importProvider) return map;
    for (const s of services) {
      if (s.providerId === importProvider.id && s.providerServiceId) {
        map.set(s.providerServiceId, s);
      }
    }
    return map;
  }, [importProvider, services]);

  const mappedServiceKeysForImport = useMemo(
    () => new Set(mappedServiceByRemoteIdForImport.keys()),
    [mappedServiceByRemoteIdForImport]
  );

  const importCategories = useMemo(() => {
    const set = new Set<string>();
    for (const item of importedList) {
      if (item.category) set.add(item.category);
    }
    return Array.from(set).sort();
  }, [importedList]);

  const filteredImported = useMemo(() => {
    const q = importSearch.trim().toLowerCase();
    return importedList.filter((item) => {
      if (importCategoryFilter !== 'all' && item.category !== importCategoryFilter) return false;
      if (!q) return true;
      return (
        item.providerServiceId.toLowerCase().includes(q) ||
        item.name.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q)
      );
    });
  }, [importedList, importSearch, importCategoryFilter]);

  const openCreate = () => {
    setEditing(null);
    setName('');
    setApiUrl('https://');
    setApiKey('');
    setProviderFormat('standard_v2');
    setStatus('inactive');
    setModalTestResult(null);
    setModalVerifiedSnapshot(null);
    setModalOpen(true);
  };

  const openEdit = (prov: AdminApiProviderItem) => {
    setEditing(prov);
    setName(prov.name);
    setApiUrl(prov.apiUrl);
    setApiKey(prov.apiKey);
    setProviderFormat(prov.providerFormat || 'standard_v2');
    setStatus(prov.status);
    setModalTestResult(null);
    setModalVerifiedSnapshot(null);
    setModalOpen(true);
  };

  const handleTestInModal = async () => {
    setModalTesting(true);
    setModalTestResult(null);
    const cleanUrl = apiUrl.trim();
    const cleanKey = apiKey.trim();
    try {
      const adapter = getProviderAdapter(providerFormat);
      const res = await adapter.testConnection({
        apiUrl: cleanUrl,
        apiKey: cleanKey,
        format: providerFormat,
      });
      setModalTestResult({
        ok: true,
        message: res.message,
        balance: res.balance,
        currency: res.currency,
        serviceCount: res.serviceCount,
      });
      setModalVerifiedSnapshot({
        apiUrl: cleanUrl,
        apiKey: cleanKey,
        providerFormat,
      });
    } catch (err) {
      setModalVerifiedSnapshot(null);
      setModalTestResult({
        ok: false,
        message: err instanceof Error ? err.message : 'Connection test failed.',
      });
    } finally {
      setModalTesting(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const cleanUrl = apiUrl.trim();
    const cleanKey = apiKey.trim();
    let verifiedResult: ConnectionFeedback | null =
      modalTestResult?.ok &&
      modalVerifiedSnapshot?.apiUrl === cleanUrl &&
      modalVerifiedSnapshot?.apiKey === cleanKey &&
      modalVerifiedSnapshot?.providerFormat === providerFormat
        ? modalTestResult
        : null;

    try {
      if (status === 'active' && !verifiedResult) {
        try {
          const adapter = getProviderAdapter(providerFormat);
          const res = await adapter.testConnection({
            apiUrl: cleanUrl,
            apiKey: cleanKey,
            format: providerFormat,
          });
          verifiedResult = {
            ok: true,
            message: res.message,
            balance: res.balance,
            currency: res.currency,
            serviceCount: res.serviceCount,
          };
          setModalTestResult(verifiedResult);
          setModalVerifiedSnapshot({
            apiUrl: cleanUrl,
            apiKey: cleanKey,
            providerFormat,
          });
        } catch (connErr) {
          const msg =
            connErr instanceof Error
              ? connErr.message
              : 'Provider connection could not be verified.';
          setModalVerifiedSnapshot(null);
          setModalTestResult({ ok: false, message: msg });
          showToast({
            title: 'Connection Verification Required',
            description: `${msg} Fix credentials or set Status to Inactive before saving.`,
            tone: 'error',
          });
          return;
        }
      }

      const savedProvId = await adminPanelService.saveApiProvider({
        id: editing?.id,
        name,
        apiUrl: cleanUrl,
        apiKey: cleanKey,
        providerFormat,
        ...(verifiedResult?.ok && typeof verifiedResult.balance === 'number'
          ? {
              lastBalance: verifiedResult.balance,
              lastBalanceCurrency: verifiedResult.currency ?? 'USD',
            }
          : {}),
        status,
      });
      const confirmedFeedback = verifiedResult;
      if (confirmedFeedback?.ok) {
        setConnectionResults((prev) => ({
          ...prev,
          [savedProvId]: confirmedFeedback,
        }));
      }
      showToast({
        title: editing ? 'Provider Updated' : 'Provider Added',
        description: `${name} configuration stored securely in Firestore.`,
        tone: 'success',
      });
      setModalOpen(false);
      await loadData();
    } catch (err) {
      showToast({
        title: 'Save Failed',
        description: err instanceof Error ? err.message : 'Unable to save provider.',
        tone: 'error',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (prov: AdminApiProviderItem) => {
    const nextStatus = prov.status === 'active' ? 'inactive' : 'active';
    try {
      let verifiedBalance: { balance?: number; currency?: string; message: string; serviceCount?: number } | null = null;
      if (nextStatus === 'active') {
        setTestingId(prov.id);
        try {
          const adapter = getProviderAdapter(prov.providerFormat);
          const res = await adapter.testConnection({
            providerId: prov.id,
            apiUrl: prov.apiUrl,
            apiKey: prov.apiKey,
            format: prov.providerFormat,
          });
          verifiedBalance = {
            balance: res.balance,
            currency: res.currency,
            message: res.message,
            serviceCount: res.serviceCount,
          };
          setConnectionResults((prev) => ({
            ...prev,
            [prov.id]: {
              ok: true,
              message: res.message,
              balance: res.balance,
              currency: res.currency,
              serviceCount: res.serviceCount,
            },
          }));
        } catch (connErr) {
          const msg = connErr instanceof Error ? connErr.message : 'Provider connection failed.';
          setConnectionResults((prev) => ({
            ...prev,
            [prov.id]: {
              ok: false,
              message: msg,
            },
          }));
          showToast({
            title: 'Cannot Activate Provider',
            description: `${msg} Verify the API URL and API Key first.`,
            tone: 'error',
          });
          return;
        } finally {
          setTestingId(null);
        }
      }

      await adminPanelService.saveApiProvider({
        ...prov,
        ...(typeof verifiedBalance?.balance === 'number'
          ? {
              lastBalance: verifiedBalance.balance,
              lastBalanceCurrency: verifiedBalance.currency ?? 'USD',
            }
          : {}),
        status: nextStatus,
      });
      setProviders((prev) =>
        prev.map((p) =>
          p.id === prov.id
            ? {
                ...p,
                status: nextStatus,
                ...(typeof verifiedBalance?.balance === 'number'
                  ? {
                      lastBalance: verifiedBalance.balance,
                      lastBalanceCurrency: verifiedBalance.currency ?? 'USD',
                    }
                  : {}),
              }
            : p
        )
      );
      showToast({
        title: 'Provider Status Updated',
        description:
          nextStatus === 'active' && verifiedBalance
            ? `${prov.name} verified & activated (${verifiedBalance.message}).`
            : `${prov.name} is now ${nextStatus}.`,
        tone: 'success',
      });
    } catch (err) {
      showToast({
        title: 'Update Failed',
        description: err instanceof Error ? err.message : 'Unable to update status.',
        tone: 'error',
      });
    }
  };

  const handleTestCardConnection = async (prov: AdminApiProviderItem) => {
    setTestingId(prov.id);
    try {
      const adapter = getProviderAdapter(prov.providerFormat);
      const res = await adapter.testConnection({
        providerId: prov.id,
        apiUrl: prov.apiUrl,
        apiKey: prov.apiKey,
        format: prov.providerFormat,
      });
      setConnectionResults((prev) => ({
        ...prev,
        [prov.id]: {
          ok: true,
          message: res.message,
          balance: res.balance,
          currency: res.currency,
          serviceCount: res.serviceCount,
        },
      }));
      if (typeof res.balance === 'number') {
        await adminPanelService.saveProviderBalance(prov.id, res.balance, res.currency ?? 'USD');
        setProviders((prev) =>
          prev.map((p) =>
            p.id === prov.id
              ? {
                  ...p,
                  lastBalance: res.balance,
                  lastBalanceCurrency: res.currency ?? 'USD',
                }
              : p
          )
        );
      }
      showToast({
        title: 'API Connection Successful',
        description: res.message
          ? `${prov.name}: ${res.message}`
          : typeof res.balance === 'number'
            ? `${prov.name} responded cleanly (Balance: ${res.balance.toFixed(2)} ${res.currency ?? 'USD'}).`
            : `${prov.name} responded cleanly.`,
        tone: 'success',
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unable to reach provider endpoint.';
      setConnectionResults((prev) => ({
        ...prev,
        [prov.id]: {
          ok: false,
          message: msg,
        },
      }));
      if (prov.status === 'active') {
        try {
          await adminPanelService.saveApiProvider({
            ...prov,
            status: 'inactive',
          });
          setProviders((prev) =>
            prev.map((p) => (p.id === prov.id ? { ...p, status: 'inactive' } : p))
          );
        } catch {
          // ignore status downgrade error if write fails
        }
      }
      showToast({
        title: 'Connection Failed',
        description: msg,
        tone: 'error',
      });
    } finally {
      setTestingId(null);
    }
  };

  const handleRefreshBalance = async (prov: AdminApiProviderItem) => {
    setBalanceLoadingId(prov.id);
    try {
      const adapter = getProviderAdapter(prov.providerFormat);
      const bal = await adapter.getBalance({
        providerId: prov.id,
        apiUrl: prov.apiUrl,
        apiKey: prov.apiKey,
        format: prov.providerFormat,
      });
      await adminPanelService.saveProviderBalance(prov.id, bal.balance, bal.currency);
      setProviders((prev) =>
        prev.map((p) =>
          p.id === prov.id
            ? { ...p, lastBalance: bal.balance, lastBalanceCurrency: bal.currency }
            : p
        )
      );
      showToast({
        title: 'Balance Synced',
        description: `${prov.name} balance: ${bal.balance.toFixed(2)} ${bal.currency}.`,
        tone: 'success',
      });
    } catch (err) {
      showToast({
        title: 'Balance Check Failed',
        description: err instanceof Error ? err.message : 'Could not fetch provider balance.',
        tone: 'error',
      });
    } finally {
      setBalanceLoadingId(null);
    }
  };

  const openImportDrawer = async (prov: AdminApiProviderItem) => {
    setImportProvider(prov);
    setImportLoading(true);
    setImportError(null);
    setImportedList([]);
    setImportSearch('');
    setImportCategoryFilter('all');
    setProfitPerThousandInput('');
    setBulkImporting(false);
    setPreparingUpdatePlan(false);
    setBulkUpdating(false);
    setUpdatePlanModal(null);
    setLastUpdateSummary(null);
    setReviewItem(null);

    let savedCurrency: ProviderRateCurrency | null = null;
    let savedUsdRate = String(DEFAULT_USD_TO_BDT_RATE);
    try {
      const storedCurr = localStorage.getItem(`rj_provider_currency_${prov.id}`);
      if (storedCurr === 'USD' || storedCurr === 'BDT') {
        savedCurrency = storedCurr;
      }
      const storedRate = localStorage.getItem(`rj_provider_usd_rate_${prov.id}`);
      if (storedRate && Number(storedRate) > 0) {
        savedUsdRate = storedRate;
      }
    } catch {
      // ignore storage read issues
    }
    const detectedCurrency: ProviderRateCurrency =
      savedCurrency ??
      (prov.lastBalanceCurrency?.trim().toUpperCase() === 'BDT' ? 'BDT' : 'USD');
    setImportProviderCurrency(detectedCurrency);
    setUsdToBdtRateInput(savedUsdRate);

    try {
      const adapter = getProviderAdapter(prov.providerFormat);
      const list = await adapter.getServices({
        providerId: prov.id,
        apiUrl: prov.apiUrl,
        apiKey: prov.apiKey,
        format: prov.providerFormat,
      });
      setImportedList(list);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to fetch provider services.';
      setImportError(msg);
      setConnectionResults((prev) => ({
        ...prev,
        [prov.id]: {
          ok: false,
          message: msg,
        },
      }));
    } finally {
      setImportLoading(false);
    }
  };

  const handleProviderCurrencyChange = (nextCurrency: ProviderRateCurrency) => {
    setImportProviderCurrency(nextCurrency);
    if (!importProvider) return;
    try {
      localStorage.setItem(`rj_provider_currency_${importProvider.id}`, nextCurrency);
    } catch {
      // ignore storage errors
    }
  };

  const handleUsdToBdtRateChange = (nextValue: string) => {
    setUsdToBdtRateInput(nextValue);
    if (!importProvider) return;
    const numeric = Number(nextValue);
    if (Number.isFinite(numeric) && numeric > 0) {
      try {
        localStorage.setItem(`rj_provider_usd_rate_${importProvider.id}`, String(numeric));
      } catch {
        // ignore storage errors
      }
    }
  };

  const parsedExchangeRate = useMemo(() => {
    if (importProviderCurrency !== 'USD') return 1;
    const val = Number(usdToBdtRateInput.trim());
    if (!Number.isFinite(val) || val <= 0) return null;
    return val;
  }, [importProviderCurrency, usdToBdtRateInput]);

  const parsedProfitInput = useMemo(() => {
    const trimmed = profitPerThousandInput.trim();
    if (!trimmed) return null;
    const val = Number(trimmed);
    if (!Number.isFinite(val) || val < 0) return null;
    return val;
  }, [profitPerThousandInput]);

  const newImportableCount = useMemo(
    () =>
      importedList.filter((item) => !mappedServiceKeysForImport.has(item.providerServiceId)).length,
    [importedList, mappedServiceKeysForImport]
  );

  const existingMappedCount = useMemo(
    () => mappedServiceKeysForImport.size,
    [mappedServiceKeysForImport]
  );

  const handleImportAllServices = async () => {
    if (!importProvider || importedList.length === 0 || bulkImporting) return;

    const trimmedProfit = profitPerThousandInput.trim();
    if (!trimmedProfit) {
      showToast({
        title: 'Enter Profit Amount',
        description:
          'Please enter your desired profit amount in BDT per 1,000 units before importing.',
        tone: 'warning',
      });
      return;
    }

    const profit = Number(trimmedProfit);
    if (!Number.isFinite(profit) || profit < 0) {
      showToast({
        title: 'Invalid Profit Amount',
        description: 'Profit per 1,000 units must be 0 or a positive BDT amount.',
        tone: 'warning',
      });
      return;
    }

    if (importProviderCurrency === 'USD' && parsedExchangeRate === null) {
      showToast({
        title: 'Invalid Exchange Rate',
        description: 'Enter a valid positive USD to BDT exchange rate (e.g. 122).',
        tone: 'warning',
      });
      return;
    }

    if (categories.length === 0) {
      showToast({
        title: 'No Categories Found',
        description: 'Please make sure at least one category exists before importing services.',
        tone: 'error',
      });
      return;
    }

    setBulkImporting(true);
    try {
      const result = await adminPanelService.bulkImportProviderServices({
        providerId: importProvider.id,
        items: importedList,
        profitPerThousand: profit,
        providerCurrency: importProviderCurrency,
        exchangeRateUsdToBdt: parsedExchangeRate ?? DEFAULT_USD_TO_BDT_RATE,
        categories,
        status: 'active',
      });

      const catSummary = Object.entries(result.categoryCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 4)
        .map(([cat, count]) => `${cat} (${count})`)
        .join(', ');

      if (result.importedCount > 0) {
        showToast({
          title: `Imported ${result.importedCount} Services`,
          description: `Profit +${currencySymbol}${profit.toFixed(2)}/1K applied.${
            catSummary ? ` Categorized into: ${catSummary}.` : ''
          }${
            result.skippedDuplicateCount > 0
              ? ` Skipped ${result.skippedDuplicateCount} duplicate(s).`
              : ''
          }`,
          tone: 'success',
        });
      } else {
        showToast({
          title: 'No New Services Imported',
          description:
            result.skippedDuplicateCount > 0
              ? `All ${result.skippedDuplicateCount} service(s) from ${importProvider.name} are already imported.`
              : 'No importable services were returned by this provider.',
          tone: 'info',
        });
      }

      await Promise.all([loadData(), refreshCustomerData().catch(() => undefined)]);
    } catch (err) {
      showToast({
        title: 'Bulk Import Failed',
        description: err instanceof Error ? err.message : 'Unable to import provider services.',
        tone: 'error',
      });
    } finally {
      setBulkImporting(false);
    }
  };

  const handlePrepareExistingUpdate = async () => {
    if (!importProvider || preparingUpdatePlan || bulkUpdating) return;

    const trimmedProfit = profitPerThousandInput.trim();
    if (!trimmedProfit) {
      showToast({
        title: 'Enter Profit Amount',
        description:
          'Enter your desired BDT profit per 1,000 units before previewing existing service updates.',
        tone: 'warning',
      });
      return;
    }

    const profit = Number(trimmedProfit);
    if (!Number.isFinite(profit) || profit < 0) {
      showToast({
        title: 'Invalid Profit Amount',
        description: 'Profit must be 0 or a positive BDT amount.',
        tone: 'warning',
      });
      return;
    }

    if (importProviderCurrency === 'USD' && parsedExchangeRate === null) {
      showToast({
        title: 'Invalid Exchange Rate',
        description: 'Enter a valid positive USD to BDT exchange rate (e.g. 122).',
        tone: 'warning',
      });
      return;
    }

    setPreparingUpdatePlan(true);
    try {
      const adapter = getProviderAdapter(importProvider.providerFormat);
      const latestItems = await adapter.getServices({
        providerId: importProvider.id,
        apiUrl: importProvider.apiUrl,
        apiKey: importProvider.apiKey,
        format: importProvider.providerFormat,
      });
      setImportedList(latestItems);

      const plan = await adminPanelService.buildExistingServicesUpdatePlan({
        providerId: importProvider.id,
        items: latestItems,
        profitPerThousand: profit,
        providerCurrency: importProviderCurrency,
        exchangeRateUsdToBdt: parsedExchangeRate ?? DEFAULT_USD_TO_BDT_RATE,
      });
      setUpdatePlanModal(plan);
    } catch (err) {
      showToast({
        title: 'Update Preview Failed',
        description:
          err instanceof Error
            ? err.message
            : 'Unable to fetch latest provider rates for existing services.',
        tone: 'error',
      });
    } finally {
      setPreparingUpdatePlan(false);
    }
  };

  const handleConfirmExistingUpdate = async () => {
    if (!updatePlanModal || bulkUpdating) return;

    setBulkUpdating(true);
    try {
      const summary = await adminPanelService.applyExistingServicesUpdatePlan(updatePlanModal);
      setLastUpdateSummary(summary);
      setUpdatePlanModal(null);

      await Promise.all([
        loadData(),
        refreshCustomerData().catch(() => undefined),
        ...(summary.repairedCurrencySymbol
          ? [refreshSystemSettings().catch(() => undefined)]
          : []),
      ]);

      showToast({
        title: `Updated ${summary.updatedCount} Existing Service${summary.updatedCount === 1 ? '' : 's'}`,
        description: `Unchanged: ${summary.unchangedCount} · New Available: ${summary.newAvailableCount} · Unavailable: ${summary.unavailableCount}${
          summary.repairedCurrencySymbol
            ? ` · Currency symbol repaired to "${summary.repairedCurrencySymbol}"`
            : ''
        }`,
        tone: 'success',
      });
    } catch (err) {
      showToast({
        title: 'Update Failed',
        description:
          err instanceof Error ? err.message : 'Unable to apply existing service price updates.',
        tone: 'error',
      });
    } finally {
      setBulkUpdating(false);
    }
  };

  const openReviewForImported = (item: ProviderServiceDTO) => {
    const resolved = resolveCategoryForImportedService(item.name, item.category, categories);
    const matchingCategory = resolved.categoryId || (categories[0]?.id ?? 'instagram');

    const { costPriceBdt, sellingPriceBdt } = calculateProviderServicePricing({
      rawProviderRate: Number(item.rate || 0),
      providerCurrency: importProviderCurrency,
      exchangeRateUsdToBdt: parsedExchangeRate ?? DEFAULT_USD_TO_BDT_RATE,
      profitAmount: parsedProfitInput ?? 0,
    });
    const itemIsPackage = isPackageService({
      providerType: item.type,
      description: item.description,
      minQuantity: item.min,
      maxQuantity: item.max,
    });

    setReviewItem(item);
    setRvCategoryId(matchingCategory);
    setRvServiceType(resolved.serviceType);
    setRvName(item.name.slice(0, 155));
    setRvDescription(item.description || `${item.category} (${item.type})`);
    setRvCostPrice(costPriceBdt.toFixed(2));
    setRvSellingPrice(sellingPriceBdt.toFixed(2));
    setRvMinQty(String(item.min));
    setRvMaxQty(String(item.max));
    setRvAvgTime('15 minutes');
    setRvDeliverySpeed(
      itemIsPackage ? 'Package Delivery' : item.dripfeed ? 'Drip-feed Enabled' : 'Instant Delivery'
    );
    setRvRefill(item.refill);
    setRvStatus('inactive'); // Safe default: Admin explicitly chooses Active vs Draft before publishing
  };

  const handlePublishReviewedService = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!importProvider || !reviewItem) return;

    setRvSaving(true);
    try {
      await adminPanelService.saveService({
        categoryId: rvCategoryId,
        name: rvName,
        serviceType: rvServiceType,
        description: rvDescription,
        providerId: importProvider.id,
        providerServiceId: reviewItem.providerServiceId,
        costPrice: Number(rvCostPrice),
        sellingPrice: Number(rvSellingPrice),
        minQuantity: Number(rvMinQty),
        maxQuantity: Number(rvMaxQty),
        averageTime: rvAvgTime,
        deliverySpeed: rvDeliverySpeed,
        refillGuaranteed: rvRefill,
        status: rvStatus,
      });

      showToast({
        title: rvStatus === 'active' ? 'Service Published' : 'Service Saved as Draft',
        description: `${rvName} mapped to ${importProvider.name} (#${reviewItem.providerServiceId}).`,
        tone: 'success',
      });
      setReviewItem(null);
      await Promise.all([loadData(), refreshCustomerData().catch(() => undefined)]);
    } catch (err) {
      showToast({
        title: 'Import Save Failed',
        description: err instanceof Error ? err.message : 'Unable to save imported service.',
        tone: 'error',
      });
    } finally {
      setRvSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    try {
      await adminPanelService.deleteApiProvider(confirmDelete.id);
      setProviders((prev) => prev.filter((p) => p.id !== confirmDelete.id));
      showToast({
        title: 'Provider Removed',
        description: `${confirmDelete.name} deleted.`,
        tone: 'info',
      });
      setConfirmDelete(null);
    } catch (err) {
      showToast({
        title: 'Delete Failed',
        description: err instanceof Error ? err.message : 'Unable to delete provider.',
        tone: 'error',
      });
    }
  };

  const reviewGrossMargin = Number(rvSellingPrice || 0) - Number(rvCostPrice || 0);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-xl sm:text-2xl font-extrabold text-slate-950">
            API Providers Management
          </h1>
          <p className="text-xs sm:text-sm text-slate-500">
            Connect multiple upstream SMM panels, test connections, monitor balances, and review services before publishing.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={loadData}
            className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-violet-700 px-4 text-xs font-bold text-white hover:bg-violet-800"
          >
            <Plus className="h-4 w-4" />
            <span>Add Provider</span>
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-3.5 text-xs text-emerald-900 flex items-center gap-2">
        <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-700" />
        <span>
          API Keys stay masked in Admin UI, execute strictly via backend proxy routes, and are blocked by{' '}
          <code className="font-mono">isAdmin()</code> rules so customers never see provider endpoints or secrets.
        </span>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {providers.map((prov) => {
          const revealed = Boolean(revealedIds[prov.id]);
          const connResult = connectionResults[prov.id];
          const mappedCount = mappedCountsByProvider.get(prov.id) ?? 0;
          const isVerified = connResult ? connResult.ok : typeof prov.lastBalance === 'number';
          const isEffectivelyActive = prov.status === 'active' && isVerified;

          return (
            <div
              key={prov.id}
              className="rounded-3xl border border-slate-200/80 bg-white p-5 shadow-xs space-y-3.5"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="font-mono text-[10px] text-slate-400">ID: {prov.id}</span>
                    <span className="rounded-md bg-violet-50 px-1.5 py-0.5 text-[10px] font-semibold text-violet-700">
                      Standard v2
                    </span>
                    <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600">
                      {mappedCount} mapped
                    </span>
                  </div>
                  <h2 className="mt-0.5 font-display text-base font-bold text-slate-900 truncate">
                    {prov.name}
                  </h2>
                </div>
                <button
                  type="button"
                  disabled={testingId === prov.id}
                  onClick={() => handleToggle(prov)}
                  className={`rounded-lg px-2.5 py-1 text-[11px] font-bold shrink-0 disabled:opacity-60 ${
                    isEffectivelyActive
                      ? 'bg-emerald-50 text-emerald-700'
                      : prov.status === 'active' && !isVerified
                        ? 'bg-amber-50 text-amber-700'
                        : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {isEffectivelyActive
                    ? 'active'
                    : prov.status === 'active' && !isVerified
                      ? 'unverified'
                      : 'inactive'}
                </button>
              </div>

              {/* Balance + API Credentials */}
              <div className="space-y-2 rounded-2xl bg-slate-50 p-3.5 text-xs">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/70 pb-2">
                  <div className="flex items-center gap-1.5 text-slate-700">
                    <Wallet className="h-3.5 w-3.5 text-violet-700" />
                    <span className="font-semibold">Provider Balance:</span>
                    <span className="font-mono font-bold text-slate-900">
                      {typeof prov.lastBalance === 'number'
                        ? `${prov.lastBalance.toFixed(2)} ${prov.lastBalanceCurrency ?? 'USD'}`
                        : 'Not synced'}
                    </span>
                  </div>
                  <button
                    type="button"
                    disabled={balanceLoadingId === prov.id}
                    onClick={() => handleRefreshBalance(prov)}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-60"
                  >
                    <RefreshCw
                      className={`h-3 w-3 ${balanceLoadingId === prov.id ? 'animate-spin' : ''}`}
                    />
                    <span>Check Balance</span>
                  </button>
                </div>

                <p className="truncate">
                  <span className="font-semibold text-slate-600">API URL:</span>{' '}
                  <span className="font-mono text-slate-800">{prov.apiUrl}</span>
                </p>

                <div className="flex items-center justify-between gap-2">
                  <p className="truncate font-mono text-slate-700">
                    <span className="font-sans font-semibold text-slate-600">API Key: </span>
                    {revealed ? prov.apiKey : maskSecretValue(prov.apiKey || '••••••••')}
                  </p>
                  <button
                    type="button"
                    onClick={() =>
                      setRevealedIds((prev) => ({ ...prev, [prov.id]: !prev[prov.id] }))
                    }
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 shrink-0"
                  >
                    {revealed ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                    <span>{revealed ? 'Mask' : 'Reveal'}</span>
                  </button>
                </div>
              </div>

              {connResult && (
                <div
                  className={`flex items-start gap-2 rounded-xl border px-3 py-2 text-xs ${
                    connResult.ok
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                      : 'border-rose-200 bg-rose-50 text-rose-900'
                  }`}
                >
                  {connResult.ok ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
                  )}
                  <div className="min-w-0">
                    <p className="font-semibold">{connResult.message}</p>
                    {connResult.ok && typeof connResult.balance === 'number' && (
                      <p className="text-[11px] opacity-85">
                        Available provider credit: {connResult.balance.toFixed(2)}{' '}
                        {connResult.currency ?? 'USD'}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                <span className="text-[11px] text-slate-400">Updated {prov.updatedAtLabel}</span>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    disabled={testingId === prov.id}
                    onClick={() => handleTestCardConnection(prov)}
                    className="inline-flex h-8 items-center gap-1 rounded-lg border border-violet-200 bg-violet-50 px-2.5 text-xs font-semibold text-violet-800 hover:bg-violet-100 disabled:opacity-60"
                  >
                    {testingId === prov.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Wifi className="h-3.5 w-3.5" />
                    )}
                    <span>Test Connection</span>
                  </button>
                  {(connResult ? connResult.ok : typeof prov.lastBalance === 'number' || mappedCount > 0) && (
                    <button
                      type="button"
                      onClick={() => openImportDrawer(prov)}
                      className="inline-flex h-8 items-center gap-1 rounded-lg bg-violet-700 px-2.5 text-xs font-semibold text-white hover:bg-violet-800"
                    >
                      <Download className="h-3.5 w-3.5" />
                      <span>Import Services</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => openEdit(prov)}
                    className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-200 px-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    <Edit3 className="h-3.5 w-3.5" />
                    <span>Edit</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(prov)}
                    className="inline-flex h-8 items-center rounded-lg border border-rose-200 bg-rose-50 px-2.5 text-xs font-semibold text-rose-700 hover:bg-rose-100"
                    aria-label={`Delete ${prov.name}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}

        {!loading && providers.length === 0 && (
          <div className="lg:col-span-2 rounded-3xl border border-dashed border-slate-200 bg-white p-10 text-center text-xs text-slate-400">
            No API providers configured yet. Click &ldquo;Add Provider&rdquo; to store your first supplier endpoint.
          </div>
        )}
      </div>

      {/* Add/Edit Provider Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-3xl bg-white p-5 sm:p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="font-display text-lg font-bold text-slate-900">
                {editing ? 'Edit API Provider' : 'Add API Provider'}
              </h2>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSave} className="mt-4 space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Provider Name
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="PrimeSMM Hub"
                  className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  API Adapter Format
                </label>
                <select
                  value={providerFormat}
                  onChange={(e) => {
                    setProviderFormat(e.target.value);
                    setModalTestResult(null);
                    setModalVerifiedSnapshot(null);
                  }}
                  className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm"
                >
                  <option value="standard_v2">Standard SMM Panel API v2</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">API URL</label>
                <input
                  type="url"
                  required
                  value={apiUrl}
                  onChange={(e) => {
                    setApiUrl(e.target.value);
                    setModalTestResult(null);
                    setModalVerifiedSnapshot(null);
                  }}
                  placeholder="https://provider.example/api/v2"
                  className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 font-mono text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">API Key</label>
                <input
                  type="password"
                  required
                  value={apiKey}
                  onChange={(e) => {
                    setApiKey(e.target.value);
                    setModalTestResult(null);
                    setModalVerifiedSnapshot(null);
                  }}
                  placeholder="Enter secret API key"
                  className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 font-mono text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Status</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as 'active' | 'inactive')}
                  className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>

              {modalTestResult && (
                <div
                  className={`rounded-xl border px-3 py-2 text-xs ${
                    modalTestResult.ok
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                      : 'border-rose-200 bg-rose-50 text-rose-900'
                  }`}
                >
                  <p className="font-semibold">{modalTestResult.message}</p>
                  {modalTestResult.ok && typeof modalTestResult.balance === 'number' && (
                    <p className="text-[11px]">
                      Provider Balance: {modalTestResult.balance.toFixed(2)}{' '}
                      {modalTestResult.currency ?? 'USD'}
                    </p>
                  )}
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
                <button
                  type="button"
                  disabled={modalTesting || !apiUrl || !apiKey}
                  onClick={handleTestInModal}
                  className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-violet-200 bg-violet-50 px-3 text-xs font-semibold text-violet-800 hover:bg-violet-100 disabled:opacity-60"
                >
                  {modalTesting ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Wifi className="h-3.5 w-3.5" />
                  )}
                  <span>Test Connection</span>
                </button>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setModalOpen(false)}
                    className="h-10 rounded-xl border border-slate-200 px-4 text-xs font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="h-10 rounded-xl bg-violet-700 px-5 text-xs font-bold text-white hover:bg-violet-800 disabled:opacity-60"
                  >
                    {saving ? 'Saving...' : 'Save Provider'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Import Services & Mandatory Review Modal */}
      {importProvider && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-3 sm:p-4 backdrop-blur-xs">
          <div className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div className="min-w-0">
                <h2 className="font-display text-base sm:text-lg font-bold text-slate-900 truncate">
                  Import Services from {importProvider.name}
                </h2>
                <p className="text-[11px] sm:text-xs text-slate-500">
                  Set your BDT profit per 1,000 units to auto-calculate customer prices and auto-categorize services, or review individually.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setImportProvider(null);
                  setReviewItem(null);
                }}
                className="flex h-8 w-8 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 shrink-0"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {reviewItem ? (
              <form
                onSubmit={handlePublishReviewedService}
                className="flex-1 overflow-y-auto p-5 space-y-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-violet-200 bg-violet-50/70 px-4 py-3 text-xs">
                  <div>
                    <p className="font-bold text-violet-950">
                      Reviewing Provider Service #{reviewItem.providerServiceId}
                    </p>
                    <p className="text-[11px] text-violet-800">
                      Original: {reviewItem.name} · Raw Rate:{' '}
                      {importProviderCurrency === 'USD' ? '$' : currencySymbol}
                      {Number(reviewItem.rate || 0).toFixed(4)}
                      {isPackageService({
                        providerType: reviewItem.type,
                        description: reviewItem.description,
                        minQuantity: reviewItem.min,
                        maxQuantity: reviewItem.max,
                      })
                        ? ' / Pkg'
                        : ' / 1K'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setReviewItem(null)}
                    className="rounded-lg border border-violet-200 bg-white px-3 py-1.5 text-xs font-semibold text-violet-800 hover:bg-violet-100"
                  >
                    Back to Imported List
                  </button>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Local Category
                    </label>
                    <select
                      required
                      value={rvCategoryId}
                      onChange={(e) => setRvCategoryId(e.target.value)}
                      className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm"
                    >
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Service Type
                    </label>
                    <select
                      value={rvServiceType}
                      onChange={(e) => setRvServiceType(e.target.value as ServiceType)}
                      className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm"
                    >
                      {SERVICE_TYPE_OPTIONS.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Publish Status
                    </label>
                    <select
                      value={rvStatus}
                      onChange={(e) => setRvStatus(e.target.value as 'active' | 'inactive')}
                      className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold"
                    >
                      <option value="inactive">Inactive (Draft Review)</option>
                      <option value="active">Active (Live to Customers)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Customer Service Name
                  </label>
                  <input
                    type="text"
                    required
                    value={rvName}
                    onChange={(e) => setRvName(e.target.value)}
                    className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Customer Description
                  </label>
                  <textarea
                    rows={2}
                    value={rvDescription}
                    onChange={(e) => setRvDescription(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm"
                  />
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Cost Price ({currencyCode})
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      required
                      value={rvCostPrice}
                      onChange={(e) => setRvCostPrice(e.target.value)}
                      className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Customer Selling Price ({currencyCode})
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      required
                      value={rvSellingPrice}
                      onChange={(e) => setRvSellingPrice(e.target.value)}
                      className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm"
                    />
                  </div>
                </div>

                <div className="rounded-xl bg-violet-50 px-3.5 py-2 text-xs font-semibold text-violet-900">
                  Gross Margin Preview:{' '}
                  <span className={reviewGrossMargin >= 0 ? 'text-emerald-700' : 'text-rose-700'}>
                    {currencySymbol}
                    {reviewGrossMargin.toFixed(2)}
                  </span>{' '}
                  <span className="font-normal text-slate-500">
                    (Before payment fees or refunds)
                  </span>
                </div>

                <div className="grid gap-3 sm:grid-cols-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Min Qty</label>
                    <input
                      type="number"
                      min="1"
                      required
                      value={rvMinQty}
                      onChange={(e) => setRvMinQty(e.target.value)}
                      className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Max Qty</label>
                    <input
                      type="number"
                      min="1"
                      required
                      value={rvMaxQty}
                      onChange={(e) => setRvMaxQty(e.target.value)}
                      className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Average Time
                    </label>
                    <input
                      type="text"
                      value={rvAvgTime}
                      onChange={(e) => setRvAvgTime(e.target.value)}
                      className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Speed Label
                    </label>
                    <input
                      type="text"
                      value={rvDeliverySpeed}
                      onChange={(e) => setRvDeliverySpeed(e.target.value)}
                      className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm"
                    />
                  </div>
                </div>

                <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700">
                  <input
                    type="checkbox"
                    checked={rvRefill}
                    onChange={(e) => setRvRefill(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-violet-700"
                  />
                  <span>Refill Guarantee Enabled</span>
                </label>

                <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
                  <button
                    type="button"
                    onClick={() => setReviewItem(null)}
                    className="h-10 rounded-xl border border-slate-200 px-4 text-xs font-semibold"
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    disabled={rvSaving}
                    className="h-10 rounded-xl bg-violet-700 px-5 text-xs font-bold text-white hover:bg-violet-800 disabled:opacity-60"
                  >
                    {rvSaving ? 'Saving...' : 'Confirm & Save Service'}
                  </button>
                </div>
              </form>
            ) : (
              <div className="flex flex-1 flex-col overflow-hidden p-5 space-y-3">
                {!importLoading && !importError && importedList.length > 0 && (
                  <div className="rounded-2xl border border-violet-200 bg-violet-50/70 p-3.5 space-y-2.5">
                    <div className="grid gap-2.5 sm:grid-cols-12 sm:items-end">
                      <div className="sm:col-span-5">
                        <label
                          htmlFor="import-profit-input"
                          className="block text-xs font-bold text-violet-950 mb-1"
                        >
                          Desired Profit ({currencyCode} per 1,000 units)
                        </label>
                        <div className="flex h-10 w-full items-center overflow-hidden rounded-xl border border-violet-200 bg-white focus-within:border-violet-500 focus-within:ring-2 focus-within:ring-violet-500/20">
                          <span className="flex h-full items-center border-r border-violet-100 bg-violet-50/70 px-3 text-xs font-bold text-slate-600 select-none shrink-0">
                            {currencySymbol}
                          </span>
                          <input
                            id="import-profit-input"
                            type="number"
                            step="0.01"
                            min="0"
                            value={profitPerThousandInput}
                            onChange={(e) => setProfitPerThousandInput(e.target.value)}
                            placeholder="Enter profit per 1,000 (e.g. 10)"
                            className="h-full w-full bg-transparent px-3 text-xs sm:text-sm font-semibold text-slate-900 placeholder:font-normal placeholder:text-slate-400 focus:outline-none"
                          />
                        </div>
                      </div>

                      <div className="sm:col-span-3">
                        <label
                          htmlFor="provider-rate-currency"
                          className="block text-xs font-bold text-violet-950 mb-1"
                        >
                          Provider API Rate
                        </label>
                        <select
                          id="provider-rate-currency"
                          value={importProviderCurrency}
                          onChange={(e) =>
                            handleProviderCurrencyChange(e.target.value as ProviderRateCurrency)
                          }
                          className="h-10 w-full rounded-xl border border-violet-200 bg-white px-2.5 text-xs font-semibold text-slate-900 focus:border-violet-500 focus:outline-none"
                        >
                          <option value="USD">USD ($ → {currencyCode})</option>
                          <option value="BDT">BDT ({currencySymbol} Direct)</option>
                        </select>
                      </div>

                      {importProviderCurrency === 'USD' && (
                        <div className="sm:col-span-4">
                          <label
                            htmlFor="usd-bdt-rate-input"
                            className="block text-xs font-bold text-violet-950 mb-1"
                          >
                            1 USD Rate ({currencyCode})
                          </label>
                          <div className="flex h-10 w-full items-center overflow-hidden rounded-xl border border-violet-200 bg-white focus-within:border-violet-500 focus-within:ring-2 focus-within:ring-violet-500/20">
                            <span className="flex h-full items-center border-r border-violet-100 bg-violet-50/70 px-3 text-xs font-bold text-slate-600 select-none shrink-0">
                              {currencySymbol}
                            </span>
                            <input
                              id="usd-bdt-rate-input"
                              type="number"
                              step="0.01"
                              min="0.01"
                              value={usdToBdtRateInput}
                              onChange={(e) => handleUsdToBdtRateChange(e.target.value)}
                              placeholder="122"
                              className="h-full w-full bg-transparent px-3 text-xs sm:text-sm font-semibold text-slate-900 tabular-nums focus:outline-none"
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                      <button
                        type="button"
                        disabled={bulkImporting || newImportableCount === 0}
                        onClick={handleImportAllServices}
                        className="inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl bg-violet-700 px-4 text-xs font-bold text-white hover:bg-violet-800 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {bulkImporting ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Download className="h-3.5 w-3.5" />
                        )}
                        <span>
                          {bulkImporting
                            ? 'Importing Services...'
                            : `Import All Services${
                                newImportableCount > 0 ? ` (${newImportableCount})` : ''
                              }`}
                        </span>
                      </button>

                      <button
                        type="button"
                        disabled={
                          preparingUpdatePlan ||
                          bulkUpdating ||
                          bulkImporting ||
                          existingMappedCount === 0
                        }
                        onClick={handlePrepareExistingUpdate}
                        className="inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl border border-violet-300 bg-white px-4 text-xs font-bold text-violet-900 hover:bg-violet-100 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {preparingUpdatePlan ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <RefreshCw className="h-3.5 w-3.5" />
                        )}
                        <span>
                          {preparingUpdatePlan
                            ? 'Checking Latest Rates...'
                            : `Update Existing Services${
                                existingMappedCount > 0 ? ` (${existingMappedCount})` : ''
                              }`}
                        </span>
                      </button>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-violet-900">
                      <span>
                        Formula:{' '}
                        <span className="font-semibold">
                          {importProviderCurrency === 'USD'
                            ? `Customer Price = (Provider USD × ${parsedExchangeRate ?? DEFAULT_USD_TO_BDT_RATE}) + Profit`
                            : 'Customer Price = Provider Cost + Profit'}
                        </span>
                        {parsedProfitInput !== null && (
                          <span className="ml-1.5 text-emerald-700 font-semibold">
                            {importProviderCurrency === 'USD'
                              ? `(e.g. $0.50 × ${parsedExchangeRate ?? DEFAULT_USD_TO_BDT_RATE} + ${currencySymbol}${parsedProfitInput.toFixed(2)} = ${currencySymbol}${(
                                  0.5 * (parsedExchangeRate ?? DEFAULT_USD_TO_BDT_RATE) +
                                  parsedProfitInput
                                ).toFixed(2)})`
                              : `(e.g. ${currencySymbol}50 + ${currencySymbol}${parsedProfitInput.toFixed(2)} = ${currencySymbol}${(50 + parsedProfitInput).toFixed(2)})`}
                          </span>
                        )}
                      </span>
                      <span className="text-slate-600 font-medium">
                        {newImportableCount} new · {existingMappedCount} already imported
                      </span>
                    </div>

                    {lastUpdateSummary && (
                      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-[11px] text-emerald-950">
                        <span className="font-semibold">
                          Last Update: {lastUpdateSummary.updatedCount} updated ·{' '}
                          {lastUpdateSummary.unchangedCount} unchanged ·{' '}
                          {lastUpdateSummary.newAvailableCount} new ·{' '}
                          {lastUpdateSummary.unavailableCount} unavailable
                          {lastUpdateSummary.repairedCurrencySymbol
                            ? ` · Symbol cleaned to "${lastUpdateSummary.repairedCurrencySymbol}"`
                            : ''}
                        </span>
                        <button
                          type="button"
                          onClick={() => setLastUpdateSummary(null)}
                          className="font-semibold text-emerald-800 underline underline-offset-2"
                        >
                          Dismiss
                        </button>
                      </div>
                    )}
                  </div>
                )}

                <div className="grid gap-2.5 sm:grid-cols-12">
                  <div className="relative sm:col-span-7">
                    <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" />
                    <input
                      type="text"
                      value={importSearch}
                      onChange={(e) => setImportSearch(e.target.value)}
                      placeholder="Search Provider Service ID, Name, or Category..."
                      className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-xs sm:text-sm"
                    />
                  </div>
                  <div className="sm:col-span-5">
                    <select
                      value={importCategoryFilter}
                      onChange={(e) => setImportCategoryFilter(e.target.value)}
                      className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs sm:text-sm"
                    >
                      <option value="all">
                        All Provider Categories ({importedList.length})
                      </option>
                      {importCategories.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {importLoading ? (
                  <div className="flex flex-1 flex-col items-center justify-center py-12 text-xs text-slate-500 gap-2">
                    <Loader2 className="h-6 w-6 animate-spin text-violet-700" />
                    <span>Fetching live service catalog from {importProvider.name}...</span>
                  </div>
                ) : importError ? (
                  <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-center text-xs text-rose-800 space-y-2">
                    <p className="font-bold">Could not load services from {importProvider.name}</p>
                    <p>{importError}</p>
                    <button
                      type="button"
                      onClick={() => openImportDrawer(importProvider)}
                      className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-rose-700 px-4 text-xs font-bold text-white"
                    >
                      Retry Fetch
                    </button>
                  </div>
                ) : (
                  <div className="flex-1 overflow-y-auto rounded-2xl border border-slate-200/80 divide-y divide-slate-100">
                    {filteredImported.slice(0, 150).map((item) => {
                      const existingSaved = mappedServiceByRemoteIdForImport.get(
                        item.providerServiceId
                      );
                      const alreadyMapped = Boolean(existingSaved);
                      const autoMatch = resolveCategoryForImportedService(
                        item.name,
                        item.category,
                        categories
                      );
                      const itemIsPackage = isPackageService({
                        providerType: item.type,
                        description: item.description,
                        minQuantity: item.min,
                        maxQuantity: item.max,
                      });
                      const unitSuffix = itemIsPackage ? '/Pkg' : '/1K';
                      const { costPriceBdt, sellingPriceBdt } = calculateProviderServicePricing({
                        rawProviderRate: Number(item.rate || 0),
                        providerCurrency: importProviderCurrency,
                        exchangeRateUsdToBdt: parsedExchangeRate ?? DEFAULT_USD_TO_BDT_RATE,
                        profitAmount: parsedProfitInput ?? 0,
                      });
                      const customerRate = parsedProfitInput !== null ? sellingPriceBdt : null;
                      return (
                        <div
                          key={item.providerServiceId}
                          className="flex flex-col gap-2.5 p-3.5 sm:flex-row sm:items-center sm:justify-between hover:bg-slate-50/80"
                        >
                          <div className="min-w-0 space-y-1">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="rounded-md bg-slate-100 px-2 py-0.5 font-mono text-[10px] font-bold text-slate-700">
                                #{item.providerServiceId}
                              </span>
                              <span className="text-[11px] font-semibold text-violet-700">
                                {item.category}
                              </span>
                              <span className="rounded-md bg-indigo-50 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-700">
                                Auto: {autoMatch.categoryName}
                              </span>
                              {itemIsPackage && (
                                <span className="rounded-md bg-violet-100 px-1.5 py-0.5 text-[10px] font-semibold text-violet-800">
                                  Package
                                </span>
                              )}
                              {item.refill && (
                                <span className="rounded-md bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">
                                  Refill
                                </span>
                              )}
                              {alreadyMapped && (
                                <span className="rounded-md bg-amber-50 px-1.5 py-0.5 text-[10px] font-bold text-amber-800">
                                  Already Imported
                                </span>
                              )}
                            </div>
                            <p className="text-xs sm:text-sm font-bold text-slate-900">
                              {item.name}
                            </p>
                            <p className="text-[11px] text-slate-500 tabular-nums">
                              Provider Cost:{' '}
                              <span className="font-semibold">
                                {importProviderCurrency === 'USD'
                                  ? `$${Number(item.rate || 0).toFixed(4)} (${currencySymbol}${costPriceBdt.toFixed(2)}${unitSuffix})`
                                  : `${currencySymbol}${costPriceBdt.toFixed(2)}${unitSuffix}`}
                              </span>
                              {customerRate !== null && (
                                <>
                                  {' · '}Customer Price:{' '}
                                  <span className="font-bold text-emerald-700">
                                    {currencySymbol}
                                    {customerRate.toFixed(2)}
                                    {unitSuffix}
                                  </span>
                                </>
                              )}
                              {existingSaved && (
                                <>
                                  {' · '}Saved:{' '}
                                  <span className="font-semibold text-slate-700">
                                    {currencySymbol}
                                    {existingSaved.sellingPrice.toFixed(2)}
                                    {unitSuffix}
                                  </span>
                                </>
                              )}
                              {' · '}Min {item.min.toLocaleString()} – Max{' '}
                              {item.max.toLocaleString()}
                            </p>
                          </div>

                          <button
                            type="button"
                            disabled={alreadyMapped}
                            onClick={() => openReviewForImported(item)}
                            className={`inline-flex h-9 items-center justify-center rounded-xl px-3.5 text-xs font-bold shrink-0 ${
                              alreadyMapped
                                ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                                : 'bg-violet-700 text-white hover:bg-violet-800'
                            }`}
                          >
                            {alreadyMapped ? 'Imported' : 'Review & Configure'}
                          </button>
                        </div>
                      );
                    })}

                    {filteredImported.length === 0 && (
                      <div className="p-10 text-center text-xs text-slate-400">
                        No imported provider services match your search filters.
                      </div>
                    )}
                    {filteredImported.length > 150 && (
                      <div className="bg-slate-50 px-4 py-2 text-center text-[11px] text-slate-500">
                        Showing first 150 of {filteredImported.length} services. Refine search or category filter to narrow results.
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Mandatory Preview & Confirmation Modal for Updating Existing Services */}
      {updatePlanModal && importProvider && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/70 p-3 sm:p-4 backdrop-blur-xs">
          <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div className="min-w-0">
                <h3 className="font-display text-base sm:text-lg font-bold text-slate-950 truncate">
                  Confirm Existing Service Price Update
                </h3>
                <p className="text-[11px] sm:text-xs text-slate-500">
                  {importProvider.name} ·{' '}
                  {updatePlanModal.providerCurrency === 'USD'
                    ? `(${updatePlanModal.providerCurrency} × ${updatePlanModal.exchangeRateUsdToBdt}) + ${currencySymbol}${updatePlanModal.profitPerThousand.toFixed(2)}`
                    : `BDT Cost + ${currencySymbol}${updatePlanModal.profitPerThousand.toFixed(2)}`}
                </p>
              </div>
              <button
                type="button"
                disabled={bulkUpdating}
                onClick={() => setUpdatePlanModal(null)}
                className="flex h-8 w-8 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 disabled:opacity-50"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                <div className="rounded-2xl border border-violet-200 bg-violet-50/70 p-3">
                  <p className="text-[11px] font-medium text-violet-700">To Update</p>
                  <p className="mt-0.5 font-display text-lg font-extrabold text-violet-950 tabular-nums">
                    {updatePlanModal.updates.length}
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-[11px] font-medium text-slate-500">Unchanged</p>
                  <p className="mt-0.5 font-display text-lg font-extrabold text-slate-800 tabular-nums">
                    {updatePlanModal.unchangedCount}
                  </p>
                </div>
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-3">
                  <p className="text-[11px] font-medium text-emerald-700">New (Not Modified)</p>
                  <p className="mt-0.5 font-display text-lg font-extrabold text-emerald-900 tabular-nums">
                    {updatePlanModal.newAvailableCount}
                  </p>
                </div>
                <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-3">
                  <p className="text-[11px] font-medium text-amber-800">Unavailable</p>
                  <p className="mt-0.5 font-display text-lg font-extrabold text-amber-950 tabular-nums">
                    {updatePlanModal.unavailableServices.length}
                  </p>
                </div>
              </div>

              {updatePlanModal.corruptedSymbolToRepair && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-xs text-amber-950">
                  <span className="font-bold">Display Symbol Repair:</span> Stored system currency symbol{' '}
                  <code className="font-mono font-bold">
                    &ldquo;{updatePlanModal.corruptedSymbolToRepair.from}&rdquo;
                  </code>{' '}
                  will also be cleaned to{' '}
                  <code className="font-mono font-bold">
                    &ldquo;{updatePlanModal.corruptedSymbolToRepair.to}&rdquo;
                  </code>{' '}
                  so customer prices display accurately.
                </div>
              )}

              {updatePlanModal.updates.length > 0 ? (
                <div className="overflow-hidden rounded-2xl border border-slate-200/80 divide-y divide-slate-100">
                  <div className="bg-slate-50 px-3.5 py-2 text-[11px] font-bold text-slate-600 flex items-center justify-between">
                    <span>Old Price vs New Price Preview</span>
                    <span>
                      Showing {Math.min(120, updatePlanModal.updates.length)} of{' '}
                      {updatePlanModal.updates.length}
                    </span>
                  </div>
                  <div className="max-h-72 overflow-y-auto divide-y divide-slate-100">
                    {updatePlanModal.updates.slice(0, 120).map((row) => {
                      const suffix = row.isPackage ? '/Pkg' : '/1K';
                      return (
                        <div
                          key={row.serviceId}
                          className="flex flex-col gap-1.5 px-3.5 py-2.5 text-xs sm:flex-row sm:items-center sm:justify-between"
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] font-bold text-slate-700">
                                #{row.providerServiceId}
                              </span>
                              {row.isPackage && (
                                <span className="rounded bg-violet-100 px-1.5 py-0.5 text-[10px] font-semibold text-violet-800">
                                  Package
                                </span>
                              )}
                              <p className="font-semibold text-slate-900 truncate">{row.name}</p>
                            </div>
                            <p className="mt-0.5 text-[11px] text-slate-500 tabular-nums">
                              Cost: {currencySymbol}
                              {row.oldCostPrice.toFixed(2)} →{' '}
                              <span className="font-semibold text-slate-800">
                                {currencySymbol}
                                {row.newCostPrice.toFixed(2)}
                                {suffix}
                              </span>
                            </p>
                          </div>

                          <div className="text-left sm:text-right tabular-nums shrink-0">
                            <p className="text-[11px] text-slate-400 line-through">
                              {currencySymbol}
                              {row.oldSellingPrice.toFixed(2)}
                              {suffix}
                            </p>
                            <p className="font-bold text-violet-800">
                              {currencySymbol}
                              {row.newSellingPrice.toFixed(2)}
                              {suffix}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-center text-xs text-slate-600">
                  All {updatePlanModal.unchangedCount} matched services already match the latest provider rates and profit settings. No service changes are needed.
                </div>
              )}

              {updatePlanModal.unavailableServices.length > 0 && (
                <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3 text-[11px] text-slate-600 space-y-1">
                  <p className="font-bold text-slate-800">
                    Unavailable on Provider ({updatePlanModal.unavailableServices.length}):
                  </p>
                  <p>
                    {updatePlanModal.unavailableServices
                      .slice(0, 8)
                      .map((u) => `#${u.providerServiceId} ${u.name}`)
                      .join(', ')}
                    {updatePlanModal.unavailableServices.length > 8
                      ? ` ...and ${updatePlanModal.unavailableServices.length - 8} more`
                      : ''}
                  </p>
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 px-5 py-3.5">
              <span className="text-[11px] text-slate-500">
                Matches strictly by provider service ID. Existing orders stay unchanged.
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={bulkUpdating}
                  onClick={() => setUpdatePlanModal(null)}
                  className="h-9 rounded-xl border border-slate-200 px-4 text-xs font-semibold text-slate-700 disabled:opacity-50"
                >
                  Cancel
                </button>
                {(updatePlanModal.updates.length > 0 || updatePlanModal.corruptedSymbolToRepair) && (
                  <button
                    type="button"
                    disabled={bulkUpdating}
                    onClick={handleConfirmExistingUpdate}
                    className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-violet-700 px-4 text-xs font-bold text-white hover:bg-violet-800 disabled:opacity-60"
                  >
                    {bulkUpdating && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    <span>
                      {bulkUpdating
                        ? 'Applying Updates...'
                        : updatePlanModal.updates.length > 0
                          ? `Confirm & Update ${updatePlanModal.updates.length} Services`
                          : 'Repair Currency Symbol'}
                    </span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-3xl bg-white p-5 shadow-2xl">
            <h3 className="font-display text-base font-bold text-slate-900">Delete Provider?</h3>
            <p className="mt-1.5 text-xs text-slate-600">
              Remove <span className="font-semibold">{confirmDelete.name}</span>?
              {(mappedCountsByProvider.get(confirmDelete.id) ?? 0) > 0 && (
                <span className="mt-1.5 block font-semibold text-amber-700">
                  Warning: {mappedCountsByProvider.get(confirmDelete.id)} service(s) are currently mapped to this provider.
                </span>
              )}
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmDelete(null)}
                className="h-9 rounded-xl border border-slate-200 px-3 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                className="h-9 rounded-xl bg-rose-600 px-4 text-xs font-bold text-white"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
