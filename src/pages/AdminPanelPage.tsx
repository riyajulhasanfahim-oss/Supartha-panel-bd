import React, { useCallback, useEffect, useState } from 'react';
import { sendEmailVerification } from 'firebase/auth';
import {
  AlertTriangle,
  ArrowLeft,
  Bell,
  Lock,
  LogOut,
  MailCheck,
  Menu,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { canAccessAdminSection, getAdminRoleLabel } from '../lib/permissions';
import { adminPanelService } from '../services/adminPanel.service';
import { ADMIN_NAV_ITEMS, AdminSidebar } from '../components/admin/AdminSidebar';
import type { AdminSectionId } from '../components/admin/AdminNavTypes';
import { AdminDashboardView } from '../components/admin/AdminDashboardView';
import { AdminUsersView } from '../components/admin/AdminUsersView';
import { AdminServicesView } from '../components/admin/AdminServicesView';
import { AdminCategoriesView } from '../components/admin/AdminCategoriesView';
import { AdminOrdersView } from '../components/admin/AdminOrdersView';
import { AdminPaymentsView } from '../components/admin/AdminPaymentsView';
import { AdminPaymentMethodsView } from '../components/admin/AdminPaymentMethodsView';
import { AdminTransactionsView } from '../components/admin/AdminTransactionsView';
import { AdminProvidersView } from '../components/admin/AdminProvidersView';
import { AdminApiGatewayView } from '../components/admin/AdminApiGatewayView';
import { AdminSupportView } from '../components/admin/AdminSupportView';
import { AdminNotificationsView } from '../components/admin/AdminNotificationsView';
import { AdminAuditLogsView } from '../components/admin/AdminAuditLogsView';
import { AdminSettingsView } from '../components/admin/AdminSettingsView';
import { AdminFirebaseView } from '../components/admin/AdminFirebaseView';
import { AdminStaffView } from '../components/admin/AdminStaffView';
import { AdminSystemInfoView } from '../components/admin/AdminSystemInfoView';
import { AdminProfileView } from '../components/admin/AdminProfileView';
import { SetupWizardModal } from '../components/admin/SetupWizardModal';

export function AdminPanelPage() {
  const {
    setViewMode,
    goToHome,
    firebaseUser,
    userRole,
    staffRole,
    accountStatus,
    adminPermissions,
    setupState,
    openSetupWizard,
    signOutAdmin,
    refreshCustomerData,
    showToast,
  } = useApp();

  const [activeSection, setActiveSection] = useState<AdminSectionId>('dashboard');
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [unreadAlertsCount, setUnreadAlertsCount] = useState(0);
  const [firestoreAuthVerified, setFirestoreAuthVerified] = useState<boolean>(true);
  const [sendingVerification, setSendingVerification] = useState<boolean>(false);
  const [refreshingSession, setRefreshingSession] = useState<boolean>(false);

  const effectiveStaffRole = staffRole ?? (userRole === 'admin' ? 'admin' : null);
  const isAuthorizedStaff = Boolean(
    firebaseUser && effectiveStaffRole !== null && accountStatus === 'active'
  );
  const activeNavMeta =
    ADMIN_NAV_ITEMS.find((item) => item.id === activeSection) ?? ADMIN_NAV_ITEMS[0];

  const sectionAllowed = effectiveStaffRole
    ? canAccessAdminSection(effectiveStaffRole, activeSection)
    : false;

  const refreshUnreadAlerts = useCallback(async () => {
    if (!isAuthorizedStaff) {
      setUnreadAlertsCount(0);
      return;
    }
    try {
      const list = await adminPanelService.listAdminNotifications(50);
      setUnreadAlertsCount(list.filter((a) => !a.read).length);
    } catch {
      // ignore non-critical badge refresh failures
    }
  }, [isAuthorizedStaff]);

  useEffect(() => {
    refreshUnreadAlerts();
  }, [refreshUnreadAlerts, activeSection]);

  const handleSelectSection = (next: AdminSectionId) => {
    if (effectiveStaffRole && !canAccessAdminSection(effectiveStaffRole, next)) {
      return;
    }
    setActiveSection(next);
  };

  useEffect(() => {
    if (!isAuthorizedStaff) {
      goToHome();
    }
  }, [goToHome, isAuthorizedStaff]);

  useEffect(() => {
    if (!firebaseUser) {
      setFirestoreAuthVerified(true);
      return;
    }
    let active = true;
    firebaseUser
      .getIdTokenResult()
      .then((res) => {
        if (!active) return;
        const hasAdminClaim = res.claims.admin === true && res.claims.role === 'admin';
        setFirestoreAuthVerified(Boolean(firebaseUser.emailVerified || hasAdminClaim));
      })
      .catch(() => {
        if (active) setFirestoreAuthVerified(Boolean(firebaseUser.emailVerified));
      });
    return () => {
      active = false;
    };
  }, [firebaseUser]);

  const handleSendVerificationEmail = async () => {
    if (!firebaseUser) return;
    setSendingVerification(true);
    try {
      await sendEmailVerification(firebaseUser);
      showToast({
        title: 'Verification Email Sent',
        description: `Check ${firebaseUser.email ?? 'your inbox'} and click the verification link, then click Refresh Session.`,
        tone: 'success',
      });
    } catch (error) {
      showToast({
        title: 'Could Not Send Email',
        description: error instanceof Error ? error.message : 'Please try again shortly.',
        tone: 'error',
      });
    } finally {
      setSendingVerification(false);
    }
  };

  const handleRefreshAdminSession = async () => {
    if (!firebaseUser) return;
    setRefreshingSession(true);
    try {
      await firebaseUser.reload();
      const tokenRes = await firebaseUser.getIdTokenResult(true);
      const hasAdminClaim = tokenRes.claims.admin === true && tokenRes.claims.role === 'admin';
      const verified = Boolean(firebaseUser.emailVerified || hasAdminClaim);
      setFirestoreAuthVerified(verified);
      if (verified) {
        await refreshCustomerData();
        showToast({
          title: 'Admin Session Verified',
          description: 'Firestore admin permissions are now active.',
          tone: 'success',
        });
      } else {
        showToast({
          title: 'Still Unverified',
          description: 'Please click the link in your verification email first, then refresh.',
          tone: 'warning',
        });
      }
    } finally {
      setRefreshingSession(false);
    }
  };

  if (!isAuthorizedStaff) {
    return null;
  }

  return (
    <div className="min-h-screen bg-[#F6F5FB] text-slate-900">
      <AdminSidebar
        activeSection={activeSection}
        onSelectSection={handleSelectSection}
        onLogout={signOutAdmin}
        mobileOpen={mobileDrawerOpen}
        onCloseMobile={() => setMobileDrawerOpen(false)}
        adminEmail={firebaseUser?.email}
        staffRole={effectiveStaffRole}
      />

      <div className="lg:pl-64 flex min-h-screen flex-col">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-3 border-b border-violet-100 bg-white/95 px-4 sm:px-6 backdrop-blur-md">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileDrawerOpen(true)}
              aria-label="Open admin navigation"
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-violet-100 bg-violet-50/60 text-violet-700 lg:hidden"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-wider text-violet-600">
                {getAdminRoleLabel(effectiveStaffRole)} Panel
              </p>
              <h2 className="truncate font-display text-sm sm:text-base font-extrabold text-slate-900">
                {activeNavMeta.label}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {canAccessAdminSection(effectiveStaffRole, 'notifications') && (
              <button
                type="button"
                onClick={() => handleSelectSection('notifications')}
                aria-label="Admin Operational Alerts"
                className="relative inline-flex h-9 w-9 items-center justify-center rounded-xl border border-violet-100 bg-violet-50/60 text-violet-700 hover:bg-violet-100"
              >
                <Bell className="h-4 w-4" />
                {unreadAlertsCount > 0 && (
                  <span className="absolute -top-1 -right-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-bold text-white tabular-nums">
                    {unreadAlertsCount}
                  </span>
                )}
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                refreshCustomerData().catch(() => undefined);
                goToHome();
              }}
              className="hidden sm:inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>Public Site</span>
            </button>
            <button
              type="button"
              onClick={() => {
                refreshCustomerData().catch(() => undefined);
                setViewMode('dashboard');
              }}
              className="inline-flex h-9 items-center rounded-xl bg-violet-700 px-3 text-xs font-semibold text-white hover:bg-violet-800 whitespace-nowrap"
            >
              Customer Panel
            </button>
            <button
              type="button"
              onClick={signOutAdmin}
              aria-label="Sign out admin"
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto space-y-5">
          {!firestoreAuthVerified && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3.5 text-xs text-amber-950">
              <div className="flex items-start gap-2.5 max-w-2xl">
                <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" aria-hidden="true" />
                <div>
                  <p className="font-bold">Email Verification Required for Firestore Writes</p>
                  <p className="text-amber-900/90 mt-0.5">
                    Security rules require <strong>{firebaseUser?.email}</strong> to verify its email once before modifying database records. Send a verification link and click Refresh Session after confirming.
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <button
                  type="button"
                  disabled={sendingVerification}
                  onClick={handleSendVerificationEmail}
                  className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-amber-600 px-3.5 text-xs font-bold text-white hover:bg-amber-700 disabled:opacity-60"
                >
                  <MailCheck className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>{sendingVerification ? 'Sending...' : 'Send Verification Email'}</span>
                </button>
                <button
                  type="button"
                  disabled={refreshingSession}
                  onClick={handleRefreshAdminSession}
                  className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-amber-300 bg-white px-3.5 text-xs font-bold text-amber-900 hover:bg-amber-100 disabled:opacity-60"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${refreshingSession ? 'animate-spin' : ''}`} aria-hidden="true" />
                  <span>Refresh Session</span>
                </button>
              </div>
            </div>
          )}

          {adminPermissions.canManageSystemLifecycle && !setupState.setupCompleted && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-violet-200 bg-gradient-to-r from-violet-50 via-white to-indigo-50 px-4 py-3">
              <div className="text-xs">
                <p className="font-bold text-violet-950">
                  White-Label Setup Incomplete
                </p>
                <p className="text-slate-600">
                  Complete the 8-step installation wizard to verify branding, provider APIs, payment accounts, and activate Production Mode.
                </p>
              </div>
              <button
                type="button"
                onClick={openSetupWizard}
                className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-violet-700 px-4 text-xs font-bold text-white hover:bg-violet-800 whitespace-nowrap"
              >
                <Sparkles className="h-3.5 w-3.5" />
                <span>Resume Setup Wizard</span>
              </button>
            </div>
          )}

          {!sectionAllowed ? (
            <div className="rounded-3xl border border-amber-200 bg-white p-8 text-center shadow-xs">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
                <Lock className="h-6 w-6" />
              </div>
              <h2 className="mt-3 font-display text-lg font-bold text-slate-950">
                Section Restricted for {getAdminRoleLabel(effectiveStaffRole)}
              </h2>
              <p className="mt-1 text-xs text-slate-600 max-w-md mx-auto">
                Your current RBAC role does not include access to <strong>{activeNavMeta.label}</strong>.
              </p>
              <button
                type="button"
                onClick={() => setActiveSection('dashboard')}
                className="mt-4 inline-flex h-9 items-center rounded-xl bg-violet-700 px-4 text-xs font-bold text-white hover:bg-violet-800"
              >
                Return to Dashboard
              </button>
            </div>
          ) : (
            <>
              {activeSection === 'dashboard' && (
                <AdminDashboardView onNavigate={handleSelectSection} />
              )}
              {activeSection === 'users' && <AdminUsersView />}
              {activeSection === 'services' && <AdminServicesView />}
              {activeSection === 'categories' && <AdminCategoriesView />}
              {activeSection === 'orders' && <AdminOrdersView />}
              {activeSection === 'payments' && <AdminPaymentsView />}
              {activeSection === 'payment-methods' && <AdminPaymentMethodsView />}
              {activeSection === 'transactions' && <AdminTransactionsView />}
              {activeSection === 'providers' && <AdminProvidersView />}
              {activeSection === 'api-gateway' && <AdminApiGatewayView />}
              {activeSection === 'tickets' && <AdminSupportView />}
              {activeSection === 'notifications' && (
                <AdminNotificationsView
                  onNavigate={handleSelectSection}
                  onAlertsChanged={refreshUnreadAlerts}
                />
              )}
              {activeSection === 'audit-logs' && <AdminAuditLogsView />}
              {activeSection === 'settings' && <AdminSettingsView />}
              {activeSection === 'firebase' && <AdminFirebaseView />}
              {activeSection === 'staff' && <AdminStaffView />}
              {activeSection === 'system-info' && <AdminSystemInfoView />}
              {activeSection === 'profile' && <AdminProfileView />}
            </>
          )}
        </main>
      </div>

      <SetupWizardModal />
    </div>
  );
}
