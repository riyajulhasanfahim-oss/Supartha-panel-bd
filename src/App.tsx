/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useLayoutEffect, useState } from 'react';
import { Ban, AlertTriangle, LogOut } from 'lucide-react';
import { AppProvider, useApp } from './context/AppContext';
import { Toast } from './components/common/Toast';
import { InstallAppBanner } from './components/common/InstallAppBanner';
import { StartupPaymentNoticeModal } from './components/common/StartupPaymentNoticeModal';
import { DashboardHeader } from './components/layout/DashboardHeader';
import { DashboardSidebar } from './components/layout/DashboardSidebar';
import { MobileBottomNav } from './components/layout/MobileBottomNav';
import { MobileDrawer } from './components/layout/MobileDrawer';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage';
import { DashboardHome } from './pages/DashboardHome';
import { OrdersPage } from './pages/OrdersPage';
import { ServicesPage } from './pages/ServicesPage';
import { FundsPage } from './pages/FundsPage';
import { SupportPage } from './pages/SupportPage';
import { NotificationsPage } from './pages/NotificationsPage';
import { ProfilePage } from './pages/ProfilePage';
import { ApiDashboardPage } from './pages/ApiDashboardPage';
import { AdminPanelPage } from './pages/AdminPanelPage';

function resetScrollToTop() {
  if (typeof window === 'undefined') return;
  try {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' as ScrollBehavior });
  } catch {
    window.scrollTo(0, 0);
  }
  document.documentElement.scrollTop = 0;
  document.body.scrollTop = 0;
}

function AccountStatusRestrictedView() {
  const { accountStatus, profile, logoutUser, goToHome } = useApp();
  const isBlocked = accountStatus === 'blocked';

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#F6F5FB] px-4 py-10">
      <div className="w-full max-w-md rounded-3xl border border-rose-200 bg-white p-6 sm:p-8 text-center shadow-xl shadow-slate-900/5">
        <div
          className={`mx-auto flex h-14 w-14 items-center justify-center rounded-2xl ${
            isBlocked ? 'bg-rose-50 text-rose-600' : 'bg-amber-50 text-amber-600'
          }`}
        >
          {isBlocked ? <Ban className="h-7 w-7" /> : <AlertTriangle className="h-7 w-7" />}
        </div>

        <h1 className="mt-4 font-display text-2xl font-extrabold text-slate-950">
          {isBlocked ? 'Account Blocked' : 'Account Suspended'}
        </h1>
        <p className="mt-2 text-sm text-slate-600 leading-relaxed">
          {profile?.email ? (
            <>
              The account <span className="font-semibold text-slate-900">{profile.email}</span> is currently{' '}
              <span className="font-semibold">{accountStatus}</span>. Protected dashboard actions, orders, and
              support submissions are disabled.
            </>
          ) : (
            <>Your account is currently {accountStatus}. Please contact our support team for assistance.</>
          )}
        </p>

        <div className="mt-6 flex flex-col gap-2.5">
          <button
            type="button"
            onClick={logoutUser}
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-rose-600 px-5 text-sm font-bold text-white hover:bg-rose-700"
          >
            <LogOut className="h-4 w-4" aria-hidden="true" />
            <span>Sign Out</span>
          </button>
          <button
            type="button"
            onClick={goToHome}
            className="inline-flex h-11 w-full items-center justify-center rounded-xl border border-slate-200 px-5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Back to Home Page
          </button>
        </div>
      </div>
    </div>
  );
}

function DashboardShell() {
  const { activeTab, firebaseUser, authReady, accountStatus, dataError, refreshCustomerData } =
    useApp();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useLayoutEffect(() => {
    resetScrollToTop();
  }, [activeTab]);

  if (firebaseUser && accountStatus !== 'active') {
    return <AccountStatusRestrictedView />;
  }

  if (authReady && !firebaseUser && activeTab !== 'home' && activeTab !== 'services') {
    return <LoginPage />;
  }

  const renderTabContent = () => {
    switch (activeTab) {
      case 'home':
        return <DashboardHome />;
      case 'order':
        return <OrdersPage />;
      case 'services':
        return <ServicesPage />;
      case 'funds':
        return <FundsPage />;
      case 'support':
        return <SupportPage />;
      case 'notifications':
        return <NotificationsPage />;
      case 'profile':
        return <ProfilePage />;
      case 'api':
        return <ApiDashboardPage />;
      default:
        return <DashboardHome />;
    }
  };

  return (
    <div className="min-h-screen bg-[#F6F5FB] text-slate-900 lg:flex">
      <DashboardSidebar />

      <div className="flex min-w-0 flex-1 flex-col">
        <DashboardHeader onOpenMobileMenu={() => setMobileMenuOpen(true)} />

        <main className="mx-auto w-full max-w-5xl flex-1 px-3.5 pt-4 pb-24 sm:px-6 sm:pt-6 lg:px-8 lg:pb-10">
          {dataError && (
            <div
              role="alert"
              className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-900"
            >
              <span>{dataError}</span>
              <button
                type="button"
                onClick={refreshCustomerData}
                className="font-bold text-violet-800 underline underline-offset-2"
              >
                Try Again
              </button>
            </div>
          )}
          {renderTabContent()}
          <footer className="mt-8 text-center text-[11px] text-slate-400">
            Alright, Developed by (
            <a
              href="https://wa.me/8801884267928"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-blue-600 underline-offset-2 transition-colors hover:text-blue-700 hover:underline"
            >
              Apps Bazar BD
            </a>
            )
          </footer>
        </main>
      </div>

      <MobileBottomNav />
      <MobileDrawer open={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)} />
    </div>
  );
}

function AppContent() {
  const { viewMode, firebaseUser, userRole, accountStatus } = useApp();

  useLayoutEffect(() => {
    resetScrollToTop();
  }, [viewMode]);

  const canRenderAdmin =
    viewMode === 'admin' &&
    Boolean(firebaseUser) &&
    userRole === 'admin' &&
    accountStatus === 'active';

  return (
    <>
      <StartupPaymentNoticeModal />
      <Toast />
    </>
  );
}

export default function App() {
  return (
    <AppProvider>
      <AppContent />
    </AppProvider>
  );
}
