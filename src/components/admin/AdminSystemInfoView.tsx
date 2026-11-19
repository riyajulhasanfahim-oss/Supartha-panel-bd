import React, { useCallback, useEffect, useState } from 'react';
import {
  Activity,
  CheckCircle2,
  Copy,
  Database,
  Download,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Trash2,
  Wrench,
  XCircle,
} from 'lucide-react';
import { PRODUCT_INFO } from '../../config/product.config';
import { useApp } from '../../context/AppContext';
import { clearDemoCatalog, repairDatabase } from '../../lib/firestore/initializer';
import { adminService } from '../../services/admin.service';
import { adminPanelService, type SystemHealthReport } from '../../services/adminPanel.service';

export function AdminSystemInfoView() {
  const {
    setupState,
    refreshSetupState,
    refreshSystemSettings,
    refreshCustomerData,
    openSetupWizard,
    showToast,
  } = useApp();

  const [health, setHealth] = useState<SystemHealthReport | null>(null);
  const [checkingHealth, setCheckingHealth] = useState(true);
  const [repairing, setRepairing] = useState(false);
  const [clearingDemo, setClearingDemo] = useState(false);
  const [confirmClearDemoOpen, setConfirmClearDemoOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [togglingProd, setTogglingProd] = useState(false);

  const loadHealth = useCallback(async () => {
    setCheckingHealth(true);
    try {
      const report = await adminPanelService.runSystemHealthCheck();
      setHealth(report);
    } finally {
      setCheckingHealth(false);
    }
  }, []);

  useEffect(() => {
    loadHealth();
  }, [loadHealth]);

  const handleCopyInstallId = () => {
    if (!setupState.installationId) return;
    navigator.clipboard?.writeText(setupState.installationId);
    showToast({
      title: 'Installation ID Copied',
      description: `${setupState.installationId} copied to clipboard.`,
      tone: 'info',
    });
  };

  const handleRepairDatabase = async () => {
    setRepairing(true);
    try {
      const res = await repairDatabase();
      await Promise.all([refreshSetupState(), refreshSystemSettings(), loadHealth()]);
      showToast({
        title: 'Database Repair Complete',
        description: res.message,
        tone: 'success',
      });
    } catch (err) {
      showToast({
        title: 'Repair Failed',
        description: err instanceof Error ? err.message : 'Unable to repair Firestore structure.',
        tone: 'error',
      });
    } finally {
      setRepairing(false);
    }
  };

  const handleClearDemoData = async () => {
    setConfirmClearDemoOpen(false);
    setClearingDemo(true);
    try {
      const res = await clearDemoCatalog();
      await Promise.all([
        refreshSetupState(),
        refreshSystemSettings(),
        refreshCustomerData(),
        loadHealth(),
      ]);
      showToast({
        title: 'Demo Catalog Cleared',
        description: `Removed ${res.removedServices} demo service(s) and archived ${res.archivedServices} referenced service(s).`,
        tone: 'success',
      });
    } catch (err) {
      showToast({
        title: 'Cleanup Failed',
        description: err instanceof Error ? err.message : 'Could not clear demo catalog.',
        tone: 'error',
      });
    } finally {
      setClearingDemo(false);
    }
  };

  const handleToggleProductionMode = async () => {
    setTogglingProd(true);
    try {
      const nextProd = !setupState.productionMode;
      await adminService.updateSystemSettings({
        productionMode: nextProd,
        ...(nextProd ? { setupCompleted: true } : {}),
      });
      await Promise.all([refreshSetupState(), refreshSystemSettings(), refreshCustomerData()]);
      showToast({
        title: nextProd ? 'Production Mode Active' : 'Staging Mode Enabled',
        description: nextProd
          ? 'Demo data suppression active when demoDataEnabled is disabled.'
          : 'Switched back to non-production staging mode.',
        tone: 'success',
      });
    } catch (err) {
      showToast({
        title: 'Update Failed',
        description: err instanceof Error ? err.message : 'Unable to update production mode flag.',
        tone: 'error',
      });
    } finally {
      setTogglingProd(false);
    }
  };

  const handleExportBackup = async () => {
    setExporting(true);
    try {
      const backup = await adminPanelService.exportSafeConfigurationBackup();
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `${(setupState.installationId || 'rj-smm').toLowerCase()}-config-backup.json`;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);
      showToast({
        title: 'Safe Configuration Exported',
        description: 'Settings, catalog, and payment methods exported with secrets redacted.',
        tone: 'success',
      });
    } catch (err) {
      showToast({
        title: 'Export Failed',
        description: err instanceof Error ? err.message : 'Unable to export backup JSON.',
        tone: 'error',
      });
    } finally {
      setExporting(false);
    }
  };

  const lifecycleFlags = [
    { label: 'Firebase Connected', ok: setupState.firebaseConnected },
    { label: 'Database Initialized', ok: setupState.databaseInitialized },
    { label: 'Admin Verified', ok: setupState.adminConfigured },
    { label: 'Branding Configured', ok: setupState.brandingConfigured },
    { label: 'Provider Configured', ok: setupState.providerConfigured },
    { label: 'Payment Configured', ok: setupState.paymentConfigured },
    { label: 'Setup Completed', ok: setupState.setupCompleted },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-xl sm:text-2xl font-extrabold text-slate-950">
            System Information, Setup &amp; Health
          </h1>
          <p className="text-xs sm:text-sm text-slate-500">
            Commercial installation metadata, live connection diagnostics, database repair &amp; safe white-label backup.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={openSetupWizard}
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-gradient-to-r from-violet-700 to-purple-600 px-4 text-xs font-bold text-white shadow-sm hover:from-violet-800 hover:to-purple-700 whitespace-nowrap"
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span>Launch 8-Step Setup Wizard</span>
          </button>

          <button
            type="button"
            onClick={loadHealth}
            disabled={checkingHealth}
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-violet-200 bg-white px-4 text-xs font-bold text-violet-800 hover:bg-violet-50 disabled:opacity-60 whitespace-nowrap"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${checkingHealth ? 'animate-spin' : ''}`} />
            <span>{checkingHealth ? 'Probing...' : 'Run Health Check'}</span>
          </button>
        </div>
      </div>

      {/* Product Identity & Installation Metadata */}
      <section className="grid gap-4 lg:grid-cols-12">
        <div className="lg:col-span-7 rounded-3xl border border-violet-100 bg-white p-5 sm:p-6 shadow-xs space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-violet-700">
                {PRODUCT_INFO.edition}
              </p>
              <h2 className="mt-0.5 font-display text-lg font-extrabold text-slate-950">
                {PRODUCT_INFO.name}
              </h2>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-xl bg-emerald-50 border border-emerald-200 px-3 py-1 text-xs font-extrabold text-emerald-800">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                <span>{PRODUCT_INFO.releaseStatus}</span>
              </span>
              <span className="font-mono text-sm font-bold text-violet-800 bg-violet-50 border border-violet-200 rounded-xl px-3 py-1 tabular-nums">
                {PRODUCT_INFO.version}
              </span>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-slate-200/80 bg-slate-50 p-3.5">
              <p className="text-[11px] font-semibold text-slate-500">Installation ID</p>
              <div className="mt-1 flex items-center justify-between gap-2">
                <code className="font-mono text-sm font-bold text-slate-900 tabular-nums">
                  {setupState.installationId || 'UNASSIGNED'}
                </code>
                {setupState.installationId && (
                  <button
                    type="button"
                    onClick={handleCopyInstallId}
                    className="inline-flex h-7 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 text-[11px] font-semibold text-slate-700 hover:bg-slate-100"
                  >
                    <Copy className="h-3 w-3" />
                    <span>Copy</span>
                  </button>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200/80 bg-slate-50 p-3.5">
              <p className="text-[11px] font-semibold text-slate-500">Semver &amp; Schema</p>
              <p className="mt-1 font-mono text-sm font-bold text-slate-900 tabular-nums">
                {PRODUCT_INFO.major}.{PRODUCT_INFO.minor}.{PRODUCT_INFO.patch} · Schema v
                {PRODUCT_INFO.schemaVersion}
              </p>
            </div>
          </div>

          {/* 7 Setup Completion Checklist */}
          <div>
            <p className="text-xs font-bold text-slate-700 mb-2">Installation Readiness Checklist</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {lifecycleFlags.map((flag) => (
                <div
                  key={flag.label}
                  className="flex items-center gap-2 rounded-xl border border-slate-200/80 bg-white px-3 py-2 text-xs"
                >
                  {flag.ok ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                  ) : (
                    <XCircle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                  )}
                  <span className="truncate font-medium text-slate-700">{flag.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Maintenance, Production Mode & Backup Actions */}
        <div className="lg:col-span-5 rounded-3xl border border-violet-100 bg-white p-5 sm:p-6 shadow-xs flex flex-col justify-between space-y-4">
          <div className="space-y-3">
            <h2 className="font-display text-base font-bold text-slate-900">
              Lifecycle &amp; Recovery Tools
            </h2>

            <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200/80 bg-slate-50 p-3.5">
              <div>
                <p className="text-xs font-bold text-slate-900">Production Mode</p>
                <p className="text-[11px] text-slate-500">
                  {setupState.productionMode
                    ? 'Live buyer storefront active.'
                    : 'Setup/staging mode active.'}
                </p>
              </div>
              <button
                type="button"
                disabled={togglingProd}
                onClick={handleToggleProductionMode}
                className={`h-9 rounded-xl px-3.5 text-xs font-bold whitespace-nowrap transition-colors ${
                  setupState.productionMode
                    ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                    : 'border border-violet-200 bg-white text-violet-800 hover:bg-violet-50'
                }`}
              >
                {setupState.productionMode ? 'Production Active' : 'Switch to Production'}
              </button>
            </div>

            <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200/80 bg-slate-50 p-3.5">
              <div>
                <p className="text-xs font-bold text-slate-900">Demo Starter Catalog</p>
                <p className="text-[11px] text-slate-500">
                  {setupState.demoDataEnabled
                    ? 'Starter demo services visible in catalog.'
                    : 'Demo catalog cleared for clean launch.'}
                </p>
              </div>
              <button
                type="button"
                disabled={clearingDemo}
                onClick={() => setConfirmClearDemoOpen(true)}
                className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3 text-xs font-bold text-rose-700 hover:bg-rose-100 whitespace-nowrap"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>{clearingDemo ? 'Clearing...' : 'Clear Demo'}</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2">
            <button
              type="button"
              disabled={repairing}
              onClick={handleRepairDatabase}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-violet-200 bg-violet-50 px-4 text-xs font-bold text-violet-800 hover:bg-violet-100 disabled:opacity-60 whitespace-nowrap"
            >
              <Wrench className="h-3.5 w-3.5" />
              <span>{repairing ? 'Repairing...' : 'Repair Database'}</span>
            </button>

            <button
              type="button"
              disabled={exporting}
              onClick={handleExportBackup}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 text-xs font-bold text-white hover:bg-slate-800 disabled:opacity-60 whitespace-nowrap"
            >
              <Download className="h-3.5 w-3.5" />
              <span>{exporting ? 'Exporting...' : 'Safe Config JSON'}</span>
            </button>
          </div>
        </div>
      </section>

      {/* Live System Health Diagnostics */}
      <section className="rounded-3xl border border-violet-100 bg-white p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-violet-700" />
            <div>
              <h2 className="font-display text-base font-bold text-slate-900">
                Live Connection &amp; System Health
              </h2>
              <p className="text-xs text-slate-500">
                Last verified {health?.checkedAtLabel ?? 'just now'}
              </p>
            </div>
          </div>
          {health && (
            <span
              className={`text-xs font-bold ${
                health.overallOk ? 'text-emerald-700' : 'text-amber-700'
              }`}
            >
              {health.overallOk ? 'All Subsystems Operational' : 'Attention Required on Some Checks'}
            </span>
          )}
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {(health?.checks ?? []).map((item) => (
            <div
              key={item.id}
              className={`rounded-2xl border p-4 ${
                item.ok
                  ? 'border-emerald-200/80 bg-emerald-50/40'
                  : 'border-amber-200/80 bg-amber-50/50'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="font-display text-sm font-bold text-slate-900">{item.label}</p>
                <span
                  className={`inline-flex items-center gap-1 text-xs font-bold ${
                    item.ok ? 'text-emerald-700' : 'text-amber-700'
                  }`}
                >
                  {item.ok ? (
                    <ShieldCheck className="h-4 w-4" />
                  ) : (
                    <Database className="h-4 w-4" />
                  )}
                  <span>{item.statusLabel}</span>
                </span>
              </div>
              <p className="mt-1.5 text-xs leading-relaxed text-slate-600">{item.detail}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Release Notes */}
      <section className="rounded-3xl border border-violet-100 bg-white p-5 sm:p-6 shadow-xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div>
            <h2 className="font-display text-base font-bold text-slate-900">
              Release Notes · {PRODUCT_INFO.version}
            </h2>
            <p className="text-xs text-slate-500">
              Verified commercial white-label build capabilities &amp; security posture.
            </p>
          </div>
          <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-800">
            {PRODUCT_INFO.releaseStatus}
          </span>
        </div>
        <ul className="space-y-2 text-xs text-slate-700">
          {PRODUCT_INFO.releaseNotes.map((note) => (
            <li key={note} className="flex items-start gap-2">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0 mt-0.5" />
              <span>{note}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* Clear Demo Confirmation Dialog */}
      {confirmClearDemoOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-3xl bg-white p-5 shadow-2xl">
            <h3 className="font-display text-base font-bold text-slate-900">
              Clear Demo Starter Services?
            </h3>
            <p className="mt-1.5 text-xs leading-relaxed text-slate-600">
              This removes only demo-tagged starter services (<code className="font-mono">isDemo: true</code>).
              Services you created manually or linked to customer orders will stay safely preserved.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmClearDemoOpen(false)}
                className="h-9 rounded-xl border border-slate-200 px-3 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleClearDemoData}
                className="h-9 rounded-xl bg-rose-600 px-4 text-xs font-bold text-white hover:bg-rose-700"
              >
                Clear Demo Catalog
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
