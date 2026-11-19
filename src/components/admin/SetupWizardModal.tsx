import React, { useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Database,
  KeyRound,
  Landmark,
  Palette,
  Plug,
  ShieldCheck,
  Sparkles,
  UserCheck,
  X,
} from 'lucide-react';
import {
  APP_CONFIG,
  resolveBrandFaviconUrl,
  resolveBrandLogoUrl,
  resolveBrandName,
} from '../../config/app.config';
import { PRODUCT_INFO } from '../../config/product.config';
import { useApp } from '../../context/AppContext';
import {
  reinitializeFirebaseClient,
  testCustomFirebaseConfigConnection,
} from '../../lib/firebase/client';
import {
  resolveActiveFirebaseConfig,
  saveAdminFirebaseConfig,
  validateFirebaseConfig,
  type FirebaseRuntimeConfig,
} from '../../lib/firebase/configManager';
import { adminService } from '../../services/admin.service';
import { adminPanelService } from '../../services/adminPanel.service';

const WIZARD_STEPS = [
  { id: 1, title: 'Welcome', icon: Sparkles },
  { id: 2, title: 'Firebase', icon: KeyRound },
  { id: 3, title: 'Database', icon: Database },
  { id: 4, title: 'Admin Account', icon: UserCheck },
  { id: 5, title: 'Branding', icon: Palette },
  { id: 6, title: 'SMM Provider', icon: Plug },
  { id: 7, title: 'Payments', icon: Landmark },
  { id: 8, title: 'Complete', icon: CheckCircle2 },
] as const;

export function SetupWizardModal() {
  const {
    setupWizardOpen,
    closeSetupWizard,
    setupState,
    firebaseUser,
    staffRole,
    systemSettings,
    signInAdminWithGoogle,
    runDatabaseInitialization,
    refreshSetupState,
    refreshSystemSettings,
    refreshCustomerData,
    showToast,
  } = useApp();

  const [step, setStep] = useState<number>(1);
  const [busy, setBusy] = useState(false);

  // Step 2: Firebase
  const [fbConfig, setFbConfig] = useState<FirebaseRuntimeConfig>(() => {
    return (
      resolveActiveFirebaseConfig() ?? {
        apiKey: '',
        authDomain: '',
        projectId: '',
        storageBucket: '',
        messagingSenderId: '',
        appId: '',
        firestoreDatabaseId: '',
      }
    );
  });
  const [fbProbeStatus, setFbProbeStatus] = useState<string | null>(null);

  // Step 3: DB Init
  const [seedDemoCatalog, setSeedDemoCatalog] = useState<boolean>(true);
  const [dbInitMessage, setDbInitMessage] = useState<string | null>(null);

  // Step 5: Branding
  const [websiteName, setWebsiteName] = useState(() =>
    resolveBrandName(systemSettings?.websiteName)
  );
  const [logoUrl, setLogoUrl] = useState(() => resolveBrandLogoUrl(systemSettings?.logo));
  const [faviconUrl, setFaviconUrl] = useState(() =>
    resolveBrandFaviconUrl(systemSettings?.favicon)
  );
  const [primaryColor, setPrimaryColor] = useState(systemSettings?.themeColor || '#6D28D9');
  const [secondaryColor, setSecondaryColor] = useState(
    systemSettings?.secondaryColor || '#4F46E5'
  );
  const [supportEmail, setSupportEmail] = useState(
    systemSettings?.supportEmail || APP_CONFIG.supportEmail
  );
  const [supportWhatsapp, setSupportWhatsapp] = useState(
    systemSettings?.supportWhatsapp || ''
  );

  // Step 6: Provider
  const [providerName, setProviderName] = useState('');
  const [providerApiUrl, setProviderApiUrl] = useState('');
  const [providerApiKey, setProviderApiKey] = useState('');

  // Step 7: Payments
  const [bkashNumber, setBkashNumber] = useState('');
  const [nagadNumber, setNagadNumber] = useState('');
  const [rocketNumber, setRocketNumber] = useState('');

  if (!setupWizardOpen) return null;

  const handleTestAndSaveFirebase = async () => {
    const check = validateFirebaseConfig(fbConfig);
    if (!check.valid) {
      setFbProbeStatus(check.errors[0]);
      showToast({ title: 'Validation Failed', description: check.errors[0], tone: 'error' });
      return;
    }
    setBusy(true);
    try {
      const probe = await testCustomFirebaseConfigConnection(fbConfig);
      if (!probe.connected) {
        setFbProbeStatus(probe.errorMessage || 'Could not reach Firebase project.');
        return;
      }
      saveAdminFirebaseConfig(fbConfig);
      await reinitializeFirebaseClient();
      await refreshSetupState();
      setFbProbeStatus(`Verified & connected to ${fbConfig.projectId}`);
      showToast({
        title: 'Firebase Connected',
        description: `Bound cleanly to project ${fbConfig.projectId}.`,
        tone: 'success',
      });
    } finally {
      setBusy(false);
    }
  };

  const handleRunDbInit = async () => {
    setBusy(true);
    try {
      const report = await runDatabaseInitialization({ seedDemo: seedDemoCatalog });
      setDbInitMessage(report.message);
      if (report.success) {
        await refreshSystemSettings();
      }
    } finally {
      setBusy(false);
    }
  };

  const handleSaveBranding = async () => {
    setBusy(true);
    try {
      await adminService.updateSystemSettings({
        websiteName: websiteName.trim() || APP_CONFIG.brandName,
        logo: logoUrl.trim(),
        favicon: faviconUrl.trim(),
        themeColor: primaryColor.trim() || '#6D28D9',
        secondaryColor: secondaryColor.trim() || '#4F46E5',
        supportEmail: supportEmail.trim(),
        supportWhatsapp: supportWhatsapp.trim(),
        brandingConfigured: true,
      });
      await Promise.all([refreshSystemSettings(), refreshSetupState()]);
      showToast({
        title: 'Branding Saved',
        description: 'White-label identity updated across storefront & dashboard.',
        tone: 'success',
      });
      setStep(6);
    } catch (err) {
      showToast({
        title: 'Save Failed',
        description: err instanceof Error ? err.message : 'Unable to save branding.',
        tone: 'error',
      });
    } finally {
      setBusy(false);
    }
  };

  const handleSaveProvider = async () => {
    if (!providerName.trim() || !providerApiUrl.trim() || !providerApiKey.trim()) {
      showToast({
        title: 'Provider Fields Required',
        description: 'Complete Provider Name, API URL, and API Key, or click Skip.',
        tone: 'warning',
      });
      return;
    }
    setBusy(true);
    try {
      await adminPanelService.saveApiProvider({
        name: providerName.trim(),
        apiUrl: providerApiUrl.trim(),
        apiKey: providerApiKey.trim(),
        providerFormat: 'standard_v2',
        status: 'active',
      });
      await adminService.updateSystemSettings({ providerConfigured: true });
      await refreshSetupState();
      showToast({
        title: 'Provider Saved',
        description: `${providerName.trim()} linked securely.`,
        tone: 'success',
      });
      setStep(7);
    } catch (err) {
      showToast({
        title: 'Provider Error',
        description: err instanceof Error ? err.message : 'Could not save provider.',
        tone: 'error',
      });
    } finally {
      setBusy(false);
    }
  };

  const handleSavePayments = async () => {
    if (!bkashNumber.trim() && !nagadNumber.trim() && !rocketNumber.trim()) {
      showToast({
        title: 'Account Number Required',
        description: 'Enter at least one receiving account number or click Next Step to configure later.',
        tone: 'warning',
      });
      return;
    }
    setBusy(true);
    try {
      if (bkashNumber.trim()) {
        await adminPanelService.savePaymentMethod({
          id: 'bkash',
          name: 'bKash Personal',
          type: 'Mobile Banking',
          accountNumber: bkashNumber.trim(),
          instructions: `Send Money to ${bkashNumber.trim()} and submit your TrxID.`,
          note: 'Send Money (Personal)',
          minAmount: 50,
          maxAmount: 50000,
          status: 'active',
          displayOrder: 1,
        });
      }
      if (nagadNumber.trim()) {
        await adminPanelService.savePaymentMethod({
          id: 'nagad',
          name: 'Nagad Merchant',
          type: 'Mobile Banking',
          accountNumber: nagadNumber.trim(),
          instructions: `Send Money / Payment to ${nagadNumber.trim()} and submit TrxID.`,
          note: 'Zero gateway fee',
          minAmount: 50,
          maxAmount: 50000,
          status: 'active',
          displayOrder: 2,
        });
      }
      if (rocketNumber.trim()) {
        await adminPanelService.savePaymentMethod({
          id: 'rocket',
          name: 'Rocket Mobile Banking',
          type: 'Mobile Banking',
          accountNumber: rocketNumber.trim(),
          instructions: `Send Money to ${rocketNumber.trim()} and submit TrxID.`,
          note: 'DBBL Rocket',
          minAmount: 100,
          maxAmount: 50000,
          status: 'active',
          displayOrder: 3,
        });
      }
      await adminService.updateSystemSettings({ paymentConfigured: true });
      await Promise.all([refreshSetupState(), refreshCustomerData()]);
      showToast({
        title: 'Payment Methods Updated',
        description: 'Mobile banking numbers saved for customer Add Funds.',
        tone: 'success',
      });
      setStep(8);
    } catch (err) {
      showToast({
        title: 'Payment Save Error',
        description: err instanceof Error ? err.message : 'Unable to update payment methods.',
        tone: 'error',
      });
    } finally {
      setBusy(false);
    }
  };

  const handleCompleteProductionSetup = async () => {
    setBusy(true);
    try {
      await adminService.updateSystemSettings({
        setupCompleted: true,
        productionMode: true,
      });
      await Promise.all([refreshSetupState(), refreshSystemSettings(), refreshCustomerData()]);
      showToast({
        title: 'Installation Complete',
        description: 'White-label SMM Panel is now in live Production Mode.',
        tone: 'success',
      });
      closeSetupWizard();
    } catch (err) {
      showToast({
        title: 'Completion Failed',
        description: err instanceof Error ? err.message : 'Unable to finalize setup flags.',
        tone: 'error',
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/65 p-3 sm:p-5 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-label="8-Step White-Label Setup Wizard"
    >
      <div className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
        {/* Wizard Header */}
        <div className="flex items-center justify-between border-b border-violet-100 bg-violet-50/60 px-5 py-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-violet-700">
              {PRODUCT_INFO.shortName} {PRODUCT_INFO.version} · Step {step} of 8
            </p>
            <h2 className="font-display text-lg font-extrabold text-slate-950">
              White-Label Installation Wizard
            </h2>
          </div>
          <button
            type="button"
            onClick={closeSetupWizard}
            aria-label="Close Setup Wizard"
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Step Indicator Strip */}
        <div className="grid grid-cols-4 sm:grid-cols-8 gap-1 border-b border-slate-100 bg-slate-50/70 px-4 py-2.5">
          {WIZARD_STEPS.map((item) => {
            const Icon = item.icon;
            const active = step === item.id;
            const done = step > item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setStep(item.id)}
                className={`flex flex-col items-center justify-center rounded-xl py-1.5 px-1 text-[10px] font-semibold transition-colors ${
                  active
                    ? 'bg-violet-700 text-white'
                    : done
                    ? 'bg-emerald-50 text-emerald-700'
                    : 'text-slate-500 hover:bg-white'
                }`}
              >
                <Icon className="h-3.5 w-3.5 mb-0.5" />
                <span className="truncate max-w-full">{item.title}</span>
              </button>
            );
          })}
        </div>

        {/* Step Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4">
          {step === 1 && (
            <div className="space-y-4">
              <h3 className="font-display text-xl font-extrabold text-slate-950">
                Welcome to {PRODUCT_INFO.name}
              </h3>
              <p className="text-sm leading-relaxed text-slate-600">
                This 8-step guided installer configures an isolated buyer deployment on its own Firebase project,
                initializes idempotent Firestore collections, applies custom white-label branding, connects upstream SMM APIs,
                and switches the panel into Production Mode.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-slate-200/80 bg-slate-50 p-4 text-xs">
                  <p className="font-bold text-slate-900">Zero Cross-Buyer Mixing</p>
                  <p className="mt-1 text-slate-600">
                    Each buyer installation runs independently against its own Firebase project credentials and Firestore database.
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-200/80 bg-slate-50 p-4 text-xs">
                  <p className="font-bold text-slate-900">Safe Non-Destructive Setup</p>
                  <p className="mt-1 text-slate-600">
                    Re-running database initialization preserves existing customers, wallets, orders, and payment histories.
                  </p>
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <h3 className="font-display text-lg font-extrabold text-slate-950">
                Step 2 · Firebase Project Configuration
              </h3>
              <p className="text-xs text-slate-600">
                Verify or bind the buyer&apos;s Firebase Web App credentials. Test reachability before proceeding.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">API Key</label>
                  <input
                    type="password"
                    value={fbConfig.apiKey}
                    onChange={(e) => setFbConfig((p) => ({ ...p, apiKey: e.target.value }))}
                    className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 font-mono text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Project ID</label>
                  <input
                    type="text"
                    value={fbConfig.projectId}
                    onChange={(e) => setFbConfig((p) => ({ ...p, projectId: e.target.value }))}
                    className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 font-mono text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Auth Domain</label>
                  <input
                    type="text"
                    value={fbConfig.authDomain}
                    onChange={(e) => setFbConfig((p) => ({ ...p, authDomain: e.target.value }))}
                    className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 font-mono text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">App ID</label>
                  <input
                    type="text"
                    value={fbConfig.appId}
                    onChange={(e) => setFbConfig((p) => ({ ...p, appId: e.target.value }))}
                    className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 font-mono text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Database ID (Optional)
                  </label>
                  <input
                    type="text"
                    value={fbConfig.firestoreDatabaseId ?? ''}
                    onChange={(e) =>
                      setFbConfig((p) => ({ ...p, firestoreDatabaseId: e.target.value }))
                    }
                    placeholder="(default)"
                    className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 font-mono text-xs"
                  />
                </div>
              </div>
              {fbProbeStatus && (
                <div className="rounded-xl border border-violet-200 bg-violet-50 px-3.5 py-2.5 text-xs font-medium text-violet-900">
                  {fbProbeStatus}
                </div>
              )}
              <button
                type="button"
                disabled={busy}
                onClick={handleTestAndSaveFirebase}
                className="inline-flex h-10 items-center gap-2 rounded-xl bg-violet-700 px-4 text-xs font-bold text-white hover:bg-violet-800 disabled:opacity-60"
              >
                <ShieldCheck className="h-4 w-4" />
                <span>{busy ? 'Testing Connection...' : 'Test & Connect Firebase'}</span>
              </button>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <h3 className="font-display text-lg font-extrabold text-slate-950">
                Step 3 · Database Initialization
              </h3>
              <p className="text-xs text-slate-600">
                Initialize core Firestore settings, categories, payment methods, and assign a unique{' '}
                <code className="font-mono">installationId</code>.
              </p>

              <label className="flex items-center gap-2.5 rounded-2xl border border-slate-200 bg-slate-50 p-3.5 text-xs font-semibold text-slate-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={seedDemoCatalog}
                  onChange={(e) => setSeedDemoCatalog(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-violet-700"
                />
                <span>Include starter demo services (can be cleared before launch)</span>
              </label>

              {dbInitMessage && (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3.5 text-xs font-medium text-emerald-900">
                  {dbInitMessage}
                </div>
              )}

              <button
                type="button"
                disabled={busy}
                onClick={handleRunDbInit}
                className="inline-flex h-10 items-center gap-2 rounded-xl bg-emerald-600 px-4 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-60"
              >
                <Database className="h-4 w-4" />
                <span>{busy ? 'Initializing...' : 'Initialize Firestore Collections'}</span>
              </button>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4">
              <h3 className="font-display text-lg font-extrabold text-slate-950">
                Step 4 · Verify Super Admin Account
              </h3>
              {firebaseUser && setupState.adminConfigured ? (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-xs text-emerald-950 space-y-1">
                  <p className="font-bold">Verified Operator Active</p>
                  <p>
                    Email: <strong>{firebaseUser.email}</strong> · Role:{' '}
                    <strong className="uppercase">{staffRole ?? 'super_admin'}</strong>
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-xs text-slate-600">
                    Sign in with the designated Super Admin account (<strong>mondalsupartha@gmail.com</strong>) to confirm administrator privileges.
                  </p>
                  <button
                    type="button"
                    onClick={signInAdminWithGoogle}
                    className="inline-flex h-10 items-center gap-2 rounded-xl bg-violet-700 px-4 text-xs font-bold text-white hover:bg-violet-800"
                  >
                    <UserCheck className="h-4 w-4" />
                    <span>Sign In with Google</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {step === 5 && (
            <div className="space-y-4">
              <h3 className="font-display text-lg font-extrabold text-slate-950">
                Step 5 · White-Label Website Branding
              </h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Website Name
                  </label>
                  <input
                    type="text"
                    value={websiteName}
                    onChange={(e) => setWebsiteName(e.target.value)}
                    className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Support Email
                  </label>
                  <input
                    type="email"
                    value={supportEmail}
                    onChange={(e) => setSupportEmail(e.target.value)}
                    className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Logo URL (Optional)
                  </label>
                  <input
                    type="text"
                    value={logoUrl}
                    onChange={(e) => setLogoUrl(e.target.value)}
                    placeholder="https://example.com/logo.png"
                    className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Favicon URL (Optional)
                  </label>
                  <input
                    type="text"
                    value={faviconUrl}
                    onChange={(e) => setFaviconUrl(e.target.value)}
                    placeholder="https://example.com/favicon.ico"
                    className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Primary Color
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={primaryColor}
                      onChange={(e) => setPrimaryColor(e.target.value)}
                      className="h-10 w-12 rounded-xl border border-slate-200 p-1"
                    />
                    <input
                      type="text"
                      value={primaryColor}
                      onChange={(e) => setPrimaryColor(e.target.value)}
                      className="h-10 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 font-mono text-xs"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Secondary Color
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={secondaryColor}
                      onChange={(e) => setSecondaryColor(e.target.value)}
                      className="h-10 w-12 rounded-xl border border-slate-200 p-1"
                    />
                    <input
                      type="text"
                      value={secondaryColor}
                      onChange={(e) => setSecondaryColor(e.target.value)}
                      className="h-10 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 font-mono text-xs"
                    />
                  </div>
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    WhatsApp Support Contact (Optional)
                  </label>
                  <input
                    type="text"
                    value={supportWhatsapp}
                    onChange={(e) => setSupportWhatsapp(e.target.value)}
                    placeholder="+8801XXXXXXXXX"
                    className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm"
                  />
                </div>
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={handleSaveBranding}
                className="inline-flex h-10 items-center gap-2 rounded-xl bg-violet-700 px-4 text-xs font-bold text-white hover:bg-violet-800 disabled:opacity-60"
              >
                <span>{busy ? 'Saving...' : 'Save Branding & Continue'}</span>
              </button>
            </div>
          )}

          {step === 6 && (
            <div className="space-y-4">
              <h3 className="font-display text-lg font-extrabold text-slate-950">
                Step 6 · SMM Provider API Setup
              </h3>
              <p className="text-xs text-slate-600">
                Add your primary upstream SMM provider. API keys remain hidden inside Admin-only Firestore rules &amp; server proxy routes.
              </p>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Provider Name
                      </label>
                      <input
                        type="text"
                        value={providerName}
                        onChange={(e) => setProviderName(e.target.value)}
                        placeholder="Primary Wholesale SMM API"
                        className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Provider API v2 Endpoint URL
                      </label>
                      <input
                        type="url"
                        value={providerApiUrl}
                        onChange={(e) => setProviderApiUrl(e.target.value)}
                        placeholder="https://provider-domain.com/api/v2"
                        className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 font-mono text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Provider API Key
                      </label>
                      <input
                        type="password"
                        value={providerApiKey}
                        onChange={(e) => setProviderApiKey(e.target.value)}
                        placeholder="Enter secret API key"
                        className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 font-mono text-xs"
                      />
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={handleSaveProvider}
                      className="inline-flex h-10 items-center gap-2 rounded-xl bg-violet-700 px-4 text-xs font-bold text-white hover:bg-violet-800 disabled:opacity-60"
                    >
                      <span>{busy ? 'Saving...' : 'Save Provider & Continue'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setStep(7)}
                      className="inline-flex h-10 items-center rounded-xl border border-slate-200 px-4 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      Skip for Now
                    </button>
                  </div>
            </div>
          )}

          {step === 7 && (
            <div className="space-y-4">
              <h3 className="font-display text-lg font-extrabold text-slate-950">
                Step 7 · Payment Receiving Numbers
              </h3>
              <p className="text-xs text-slate-600">
                Update your buyer-specific receiving account numbers for customer wallet deposits.
              </p>
              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    bKash Account
                  </label>
                  <input
                    type="text"
                    value={bkashNumber}
                    onChange={(e) => setBkashNumber(e.target.value)}
                    placeholder="e.g. 01XXXXXXXXX"
                    className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 font-mono text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Nagad Account
                  </label>
                  <input
                    type="text"
                    value={nagadNumber}
                    onChange={(e) => setNagadNumber(e.target.value)}
                    placeholder="e.g. 01XXXXXXXXX"
                    className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 font-mono text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Rocket Account
                  </label>
                  <input
                    type="text"
                    value={rocketNumber}
                    onChange={(e) => setRocketNumber(e.target.value)}
                    placeholder="e.g. 01XXXXXXXXX"
                    className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 font-mono text-xs"
                  />
                </div>
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={handleSavePayments}
                className="inline-flex h-10 items-center gap-2 rounded-xl bg-violet-700 px-4 text-xs font-bold text-white hover:bg-violet-800 disabled:opacity-60"
              >
                <span>{busy ? 'Saving...' : 'Save Payment Methods & Continue'}</span>
              </button>
            </div>
          )}

          {step === 8 && (
            <div className="space-y-4">
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 space-y-2">
                <div className="flex items-center gap-2 text-emerald-800">
                  <CheckCircle2 className="h-5 w-5" />
                  <h3 className="font-display text-lg font-extrabold">
                    Installation Ready for Production
                  </h3>
                </div>
                <p className="text-xs leading-relaxed text-emerald-900">
                  Installation ID:{' '}
                  <code className="font-mono font-bold">
                    {setupState.installationId || 'Assigned during DB Init'}
                  </code>{' '}
                  · Version <code className="font-mono font-bold">{PRODUCT_INFO.version}</code>
                </p>
              </div>

              <button
                type="button"
                disabled={busy}
                onClick={handleCompleteProductionSetup}
                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-5 text-sm font-bold text-white shadow-md hover:from-emerald-700 hover:to-teal-700 disabled:opacity-60"
              >
                <ShieldCheck className="h-4 w-4" />
                <span>
                  {busy ? 'Activating Production Mode...' : 'Complete Setup & Activate Production Mode'}
                </span>
              </button>
            </div>
          )}
        </div>

        {/* Footer Navigation */}
        <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/70 px-5 py-3">
          <button
            type="button"
            disabled={step === 1}
            onClick={() => setStep((s) => Math.max(1, s - 1))}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Previous</span>
          </button>

          <button
            type="button"
            disabled={step === 8}
            onClick={() => setStep((s) => Math.min(8, s + 1))}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-violet-700 px-4 text-xs font-bold text-white hover:bg-violet-800 disabled:opacity-40"
          >
            <span>Next Step</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
