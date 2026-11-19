import React, { useState } from 'react';
import {
  CheckCircle2,
  Database,
  Eye,
  EyeOff,
  KeyRound,
  PlugZap,
  RefreshCw,
  RotateCcw,
  Save,
  Server,
  ShieldCheck,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import {
  reinitializeFirebaseClient,
  testCustomFirebaseConfigConnection,
  testFirestoreConnection,
} from '../../lib/firebase/client';
import {
  isUsingCustomAdminConfig,
  maskSecretValue,
  resetAdminFirebaseConfig,
  resolveActiveFirebaseConfig,
  saveAdminFirebaseConfig,
  validateFirebaseConfig,
  type FirebaseRuntimeConfig,
} from '../../lib/firebase/configManager';
import { FIRESTORE_COLLECTIONS } from '../../lib/firestore/collections';

export function AdminFirebaseView() {
  const {
    firebaseUser,
    setupState,
    lastInitReport,
    refreshSetupState,
    runDatabaseInitialization,
    showToast,
  } = useApp();

  const [showApiKey, setShowApiKey] = useState(false);
  const [testingConn, setTestingConn] = useState(false);
  const [probingCandidate, setProbingCandidate] = useState(false);
  const [probeResult, setProbeResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [initializingDb, setInitializingDb] = useState(false);
  const [confirmSaveOpen, setConfirmSaveOpen] = useState(false);

  const [configForm, setConfigForm] = useState<FirebaseRuntimeConfig>(() => {
    const existing = resolveActiveFirebaseConfig();
    return (
      existing ?? {
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

  const customOverrideActive = isUsingCustomAdminConfig();
  const collectionList = Object.values(FIRESTORE_COLLECTIONS);

  const handleRequestSave = (e: React.FormEvent) => {
    e.preventDefault();
    const check = validateFirebaseConfig(configForm);
    if (!check.valid) {
      showToast({
        title: 'Invalid Firebase Credentials',
        description: check.errors[0],
        tone: 'error',
      });
      return;
    }
    setConfirmSaveOpen(true);
  };

  const handleProbeCandidate = async () => {
    const check = validateFirebaseConfig(configForm);
    if (!check.valid) {
      setProbeResult({ ok: false, message: check.errors[0] });
      showToast({
        title: 'Validation Failed',
        description: check.errors[0],
        tone: 'error',
      });
      return;
    }

    setProbingCandidate(true);
    setProbeResult(null);
    try {
      const res = await testCustomFirebaseConfigConnection(configForm);
      setProbeResult({
        ok: res.connected,
        message: res.connected
          ? `Successfully reached Firestore project "${configForm.projectId}".`
          : res.errorMessage || 'Unable to reach Firestore project.',
      });
      showToast({
        title: res.connected ? 'Firebase Probe Passed' : 'Probe Failed',
        description: res.connected
          ? `Connected to ${configForm.projectId} safely in isolated probe.`
          : res.errorMessage || 'Check credentials and try again.',
        tone: res.connected ? 'success' : 'error',
      });
    } finally {
      setProbingCandidate(false);
    }
  };

  const executeSaveFirebaseConfig = async () => {
    setConfirmSaveOpen(false);
    try {
      saveAdminFirebaseConfig(configForm);
      await reinitializeFirebaseClient();
      const nextState = await refreshSetupState();
      showToast({
        title: 'Firebase Configuration Saved',
        description: nextState.firebaseConnected
          ? 'Connected to the configured Firebase project.'
          : nextState.lastError ?? 'Saved configuration. Verify connection and initialize database.',
        tone: nextState.firebaseConnected ? 'success' : 'warning',
      });
    } catch (err) {
      showToast({
        title: 'Invalid Configuration',
        description: err instanceof Error ? err.message : 'Please complete required fields.',
        tone: 'error',
      });
    }
  };

  const handleResetConfig = async () => {
    resetAdminFirebaseConfig();
    const fallback = resolveActiveFirebaseConfig();
    if (fallback) setConfigForm(fallback);
    setProbeResult(null);
    await reinitializeFirebaseClient();
    await refreshSetupState();
    showToast({
      title: 'Configuration Restored',
      description: 'Reverted to default provisioned Firebase project.',
      tone: 'info',
    });
  };

  const handleTestConnection = async () => {
    setTestingConn(true);
    try {
      const result = await testFirestoreConnection();
      await refreshSetupState();
      showToast({
        title: result.connected ? 'Firestore Connected' : 'Connection Failed',
        description: result.connected
          ? 'Server reachability verified successfully.'
          : result.errorMessage ?? 'Unable to reach Firestore.',
        tone: result.connected ? 'success' : 'error',
      });
    } finally {
      setTestingConn(false);
    }
  };

  const handleInitializeDb = async () => {
    setInitializingDb(true);
    try {
      await runDatabaseInitialization();
    } finally {
      setInitializingDb(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Setup State Overview */}
      <section aria-labelledby="setup-state-heading" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 id="setup-state-heading" className="font-display text-xl sm:text-2xl font-extrabold text-slate-950">
              Firebase Configuration &amp; Database Setup
            </h1>
            <p className="text-xs sm:text-sm text-slate-500">
              Admin-only project credentials &amp; idempotent Firestore initializer ({firebaseUser?.email})
            </p>
          </div>
          <button
            type="button"
            onClick={handleTestConnection}
            disabled={testingConn}
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-violet-200 bg-white px-4 text-xs font-bold text-violet-800 hover:bg-violet-50 disabled:opacity-60"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${testingConn ? 'animate-spin' : ''}`} />
            <span>{testingConn ? 'Checking...' : 'Verify Connection'}</span>
          </button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              label: 'setupRequired',
              value: setupState.setupRequired ? 'Required' : 'Complete',
              ok: !setupState.setupRequired,
            },
            {
              label: 'firebaseConnected',
              value: setupState.firebaseConnected ? 'Connected' : 'Disconnected',
              ok: setupState.firebaseConnected,
            },
            {
              label: 'databaseInitialized',
              value: setupState.databaseInitialized ? 'Initialized' : 'Pending',
              ok: setupState.databaseInitialized,
            },
            {
              label: 'adminConfigured',
              value: setupState.adminConfigured ? 'Verified' : 'Needs Init',
              ok: setupState.adminConfigured,
            },
          ].map((item) => (
            <div
              key={item.label}
              className="flex items-center justify-between rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs"
            >
              <div>
                <p className="font-mono text-[11px] text-slate-500">{item.label}</p>
                <p className="mt-1 font-display text-base font-bold text-slate-900">{item.value}</p>
              </div>
              <span
                className={`flex h-9 w-9 items-center justify-center rounded-xl ${
                  item.ok ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'
                }`}
              >
                {item.ok ? <CheckCircle2 className="h-5 w-5" /> : <Server className="h-5 w-5" />}
              </span>
            </div>
          ))}
        </div>

        {setupState.lastError && (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-medium text-rose-800">
            {setupState.lastError}
          </div>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-12">
        {/* Firebase Credentials Form */}
        <section className="lg:col-span-7 rounded-3xl border border-violet-100 bg-white p-5 sm:p-6 shadow-xs">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div className="flex items-center gap-2.5">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-100 text-violet-700">
                <KeyRound className="h-5 w-5" />
              </span>
              <div>
                <h2 className="font-display text-base sm:text-lg font-bold text-slate-900">
                  Firebase Project Credentials
                </h2>
                <p className="text-xs text-slate-500">
                  {customOverrideActive
                    ? 'Using custom buyer Firebase project override'
                    : 'Using default provisioned Firebase project'}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowApiKey((v) => !v)}
              className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              {showApiKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              <span>{showApiKey ? 'Mask Key' : 'Reveal Key'}</span>
            </button>
          </div>

          <form onSubmit={handleRequestSave} className="mt-4 space-y-3.5">
            <div className="grid gap-3.5 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">API Key</label>
                <input
                  type={showApiKey ? 'text' : 'password'}
                  required
                  value={configForm.apiKey}
                  onChange={(e) => setConfigForm((p) => ({ ...p, apiKey: e.target.value }))}
                  className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 font-mono text-xs"
                />
                {!showApiKey && configForm.apiKey && (
                  <p className="mt-1 font-mono text-[11px] text-slate-400">
                    Active: {maskSecretValue(configForm.apiKey)}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Auth Domain</label>
                <input
                  type="text"
                  required
                  value={configForm.authDomain}
                  onChange={(e) => setConfigForm((p) => ({ ...p, authDomain: e.target.value }))}
                  className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 font-mono text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Project ID</label>
                <input
                  type="text"
                  required
                  value={configForm.projectId}
                  onChange={(e) => setConfigForm((p) => ({ ...p, projectId: e.target.value }))}
                  className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 font-mono text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Storage Bucket</label>
                <input
                  type="text"
                  value={configForm.storageBucket}
                  onChange={(e) => setConfigForm((p) => ({ ...p, storageBucket: e.target.value }))}
                  className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 font-mono text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Messaging Sender ID
                </label>
                <input
                  type="text"
                  value={configForm.messagingSenderId}
                  onChange={(e) =>
                    setConfigForm((p) => ({ ...p, messagingSenderId: e.target.value }))
                  }
                  className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 font-mono text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">App ID</label>
                <input
                  type="text"
                  required
                  value={configForm.appId}
                  onChange={(e) => setConfigForm((p) => ({ ...p, appId: e.target.value }))}
                  className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 font-mono text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Firestore Database ID (Optional)
                </label>
                <input
                  type="text"
                  value={configForm.firestoreDatabaseId ?? ''}
                  onChange={(e) =>
                    setConfigForm((p) => ({ ...p, firestoreDatabaseId: e.target.value }))
                  }
                  placeholder="(default)"
                  className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 font-mono text-xs"
                />
              </div>
            </div>

            {probeResult && (
              <div
                className={`rounded-2xl border px-3.5 py-2.5 text-xs font-medium ${
                  probeResult.ok
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                    : 'border-rose-200 bg-rose-50 text-rose-900'
                }`}
              >
                {probeResult.message}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2.5 pt-2">
              <button
                type="button"
                onClick={handleProbeCandidate}
                disabled={probingCandidate}
                className="inline-flex h-10 items-center gap-2 rounded-xl border border-violet-200 bg-violet-50 px-4 text-xs font-bold text-violet-800 hover:bg-violet-100 disabled:opacity-60"
              >
                <PlugZap className="h-4 w-4" />
                <span>{probingCandidate ? 'Probing...' : 'Test Config Probe'}</span>
              </button>
              <button
                type="submit"
                className="inline-flex h-10 items-center gap-2 rounded-xl bg-violet-700 px-4 text-xs font-bold text-white hover:bg-violet-800"
              >
                <Save className="h-4 w-4" />
                <span>Save &amp; Connect Project</span>
              </button>
              {customOverrideActive && (
                <button
                  type="button"
                  onClick={handleResetConfig}
                  className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 px-4 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span>Revert to Default</span>
                </button>
              )}
            </div>
          </form>
        </section>

        {/* Automatic Database Setup */}
        <section className="lg:col-span-5 flex flex-col justify-between rounded-3xl border border-violet-100 bg-white p-5 sm:p-6 shadow-xs space-y-5">
          <div>
            <div className="flex items-center gap-2.5 border-b border-slate-100 pb-4">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
                <Database className="h-5 w-5" />
              </span>
              <div>
                <h2 className="font-display text-base sm:text-lg font-bold text-slate-900">
                  Automatic Database Setup
                </h2>
                <p className="text-xs text-slate-500">Idempotent one-click Firestore bootstrapper</p>
              </div>
            </div>

            <p className="mt-4 text-xs sm:text-sm leading-relaxed text-slate-600">
              Runs <code className="font-mono text-violet-800">initializeDatabase()</code> to create missing
              system settings, categories, starter services, and admin records without duplicating or overwriting
              existing data.
            </p>

            <div className="mt-4 rounded-2xl border border-slate-100 bg-slate-50 p-3.5">
              <p className="text-[11px] font-semibold text-slate-600 mb-2">
                Managed Collections ({collectionList.length})
              </p>
              <div className="grid grid-cols-2 gap-1.5 text-xs font-mono text-slate-700">
                {collectionList.map((col) => (
                  <span key={col} className="truncate">
                    · {col}
                  </span>
                ))}
              </div>
            </div>

            {lastInitReport && (
              <div
                className={`mt-4 rounded-2xl border p-3.5 text-xs ${
                  lastInitReport.success
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                    : 'border-rose-200 bg-rose-50 text-rose-900'
                }`}
              >
                <p className="font-bold">{lastInitReport.message}</p>
                <p className="mt-1 tabular-nums">
                  Created: {lastInitReport.createdDocsCount} · Preserved existing:{' '}
                  {lastInitReport.skippedExistingCount}
                </p>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={handleInitializeDb}
            disabled={initializingDb}
            className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-5 text-sm font-bold text-white shadow-md shadow-emerald-600/20 hover:from-emerald-700 hover:to-teal-700 disabled:opacity-60"
          >
            <ShieldCheck className="h-4 w-4" />
            <span>{initializingDb ? 'Initializing Firestore...' : 'Initialize Database'}</span>
          </button>
        </section>
      </div>

      {/* Confirmation Dialog before saving Firebase Config */}
      {confirmSaveOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-3xl bg-white p-5 shadow-2xl">
            <h3 className="font-display text-base font-bold text-slate-900">
              Update Firebase Configuration?
            </h3>
            <p className="mt-1.5 text-xs leading-relaxed text-slate-600">
              Re-binding to project <code className="font-mono font-bold">{configForm.projectId}</code> will
              reinitialize the active Firebase client. Make sure credentials belong to your target Firestore database.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmSaveOpen(false)}
                className="h-9 rounded-xl border border-slate-200 px-3 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={executeSaveFirebaseConfig}
                className="h-9 rounded-xl bg-violet-700 px-4 text-xs font-bold text-white hover:bg-violet-800"
              >
                Confirm &amp; Connect
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
