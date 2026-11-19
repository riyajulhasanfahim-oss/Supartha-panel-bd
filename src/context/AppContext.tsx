import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { User as FirebaseAuthUser } from 'firebase/auth';
import { collection, doc, limit, onSnapshot, query, where } from 'firebase/firestore';
import type { DashboardTab } from '../config/navigation.config';
import { catalogService } from '../services/services.service';
import { ordersService } from '../services/orders.service';
import { walletService } from '../services/wallet.service';
import { supportService } from '../services/support.service';
import { adminService } from '../services/admin.service';
import {
  fetchPublicCatalogBundle,
  formatFirestoreTimestamp,
  getLocalReadBroadcastIds,
  invalidatePublicCatalogCache,
  mapCustomerOrderDoc,
} from '../services/firebaseDataClient';
import {
  authService,
  type AuthenticatedUserProfile,
  type LoginInput,
  type RegisterInput,
  type UpdateProfileInput,
} from '../services/auth.service';
import {
  getFirebaseServices,
  probeFirestoreConnectionOnce,
  signInWithGooglePopup,
  signOutFirebase,
  subscribeFirebaseAuth,
} from '../lib/firebase/client';
import {
  clearUserStartupCache,
  readLastActiveUid,
  readPublicStartupCache,
  readUserStartupCache,
  warmBrandAndBannerAssets,
  writeLastActiveUid,
  writePublicStartupCache,
  writeUserStartupCache,
} from '../lib/cache/startupCache';
import {
  initializeDatabase,
  inspectSetupState,
  type DatabaseInitReport,
  type SetupState,
} from '../lib/firestore/initializer';
import { toUserFriendlyFirebaseError } from '../lib/firestore/errors';
import {
  APP_CONFIG,
  resolveBrandFaviconUrl,
  resolveBrandName,
} from '../config/app.config';
import {
  calculateOrderCharge,
  isPackageService,
  normalizeCurrencySymbol,
} from '../utils/pricing';
import {
  getAdminPermissions,
  getAdminRoleLabel,
  type AdminPermissions,
} from '../lib/permissions';
import {
  FIRESTORE_COLLECTIONS,
  type AdminStaffRole,
  type FirestoreNotificationDoc,
  type FirestoreOrderDoc,
  type FirestorePaymentDoc,
  type FirestoreSettingsDoc,
  type FirestoreSupportTicketDoc,
  type FirestoreUserDoc,
  type UserAccountRole,
  type UserAccountStatus,
} from '../lib/firestore/collections';
import type {
  CreateOrderInput,
  CreateTicketInput,
  CustomerPaymentRequest,
  CustomerProfile,
  NotificationItem,
  OrderRecord,
  OrderStatsSummary,
  PaymentMethodItem,
  PlatformCategory,
  PlatformId,
  SmmService,
  SupportTicket,
  TicketPriority,
  TicketSubject,
  WalletSummary,
  WalletTransaction,
} from '../types';

export type AppViewMode =
  | 'login'
  | 'register'
  | 'forgot-password'
  | 'dashboard'
  | 'admin';

export type AuthModalMode = 'login' | 'register' | null;
export type UserRole = UserAccountRole;

export interface PendingOrderDraft {
  categoryId: PlatformId;
  serviceId: string;
  link: string;
  quantity: string;
}

export interface PendingRedirectTarget {
  type: 'tab' | 'place-order';
  tab?: DashboardTab;
  orderId?: string;
  ticketId?: string;
  draftOrderRef?: string;
  orderDraft?: PendingOrderDraft;
}

export interface ToastMessage {
  id: string;
  title: string;
  description?: string;
  tone: 'success' | 'warning' | 'error' | 'info';
}

export interface AuthActionResult {
  success: boolean;
  error?: string;
}

interface AppContextValue {
  viewMode: AppViewMode;
  setViewMode: (mode: AppViewMode) => void;
  goToHome: () => void;
  navigateProtected: (tab?: DashboardTab) => void;
  requireAuthForOrder: (draft: PendingOrderDraft) => void;
  orderDraft: PendingOrderDraft | null;
  consumeOrderDraft: () => void;
  activeTab: DashboardTab;
  setActiveTab: (tab: DashboardTab) => void;
  authModalMode: AuthModalMode;
  openAuthModal: (mode: 'login' | 'register') => void;
  closeAuthModal: () => void;
  selectedPlatform: PlatformId;
  setSelectedPlatform: (id: PlatformId) => void;
  selectPlatformForOrder: (id: PlatformId, serviceId?: string) => void;
  selectedOrderId: string | null;
  setSelectedOrderId: (id: string | null) => void;
  openOrderDetails: (orderId: string) => void;
  selectedTicketId: string | null;
  setSelectedTicketId: (id: string | null) => void;
  openTicketDetails: (ticketId: string) => void;
  ticketDraftOrderRef: string;
  setTicketDraftOrderRef: (ref: string) => void;
  openSupportForOrder: (orderNumber: string) => void;
  handleNotificationClick: (item: NotificationItem) => Promise<void>;
  platforms: PlatformCategory[];
  services: SmmService[];
  orders: OrderRecord[];
  orderStats: OrderStatsSummary;
  profile: CustomerProfile | null;
  accountStatus: UserAccountStatus;
  wallet: WalletSummary;
  paymentMethods: PaymentMethodItem[];
  paymentRequests: CustomerPaymentRequest[];
  transactions: WalletTransaction[];
  notifications: NotificationItem[];
  tickets: SupportTicket[];
  systemSettings: Partial<FirestoreSettingsDoc> | null;
  refreshSystemSettings: () => Promise<void>;
  refreshCustomerData: () => Promise<void>;
  refreshWalletLedger: () => Promise<void>;
  dataError: string | null;
  isLoading: boolean;
  toast: ToastMessage | null;
  dismissToast: () => void;
  showToast: (toast: Omit<ToastMessage, 'id'>) => void;
  placeDemoOrder: (input: CreateOrderInput) => Promise<boolean>;
  addDemoFunds: (amount: number, method: string) => void;
  submitPaymentRequest: (input: {
    paymentMethodId: string;
    amount: number;
    transactionId: string;
  }) => Promise<boolean>;
  cancelPaymentRequest: (paymentId: string) => Promise<void>;
  submitDemoTicket: (input: CreateTicketInput) => Promise<void>;
  markNotificationRead: (item: NotificationItem) => Promise<void>;
  markAllNotificationsRead: () => Promise<void>;
  // Phase 2 & 3: Auth, User Profile, RBAC, and Setup State
  firebaseUser: FirebaseAuthUser | null;
  userRole: UserRole;
  staffRole: AdminStaffRole | null;
  adminPermissions: AdminPermissions;
  authReady: boolean;
  setupState: SetupState;
  setupWizardOpen: boolean;
  openSetupWizard: () => void;
  closeSetupWizard: () => void;
  lastInitReport: DatabaseInitReport | null;
  refreshSetupState: () => Promise<SetupState>;
  runDatabaseInitialization: (options?: { seedDemo?: boolean }) => Promise<DatabaseInitReport>;
  signInAdminWithGoogle: () => Promise<boolean>;
  signOutAdmin: () => Promise<void>;
  registerWithEmail: (input: RegisterInput) => Promise<AuthActionResult>;
  loginWithEmail: (input: LoginInput) => Promise<AuthActionResult>;
  loginWithGoogle: () => Promise<AuthActionResult>;
  sendPasswordReset: (email: string) => Promise<AuthActionResult>;
  updateUserProfile: (input: UpdateProfileInput) => Promise<AuthActionResult>;
  logoutUser: () => Promise<void>;
}

const AppContext = createContext<AppContextValue | null>(null);

function toCustomerProfile(
  authProfile: AuthenticatedUserProfile,
  staffRole?: AdminStaffRole | null
): CustomerProfile {
  const initials = authProfile.name
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return {
    id: authProfile.uid,
    fullName: authProfile.name,
    username: authProfile.email.split('@')[0] || 'member',
    email: authProfile.email,
    phone: authProfile.phone,
    photoUrl: authProfile.photoUrl,
    role: authProfile.role,
    status: authProfile.status,
    tierLabel: staffRole
      ? getAdminRoleLabel(staffRole)
      : authProfile.role === 'admin'
      ? 'Administrator'
      : 'Customer Account',
    joinedDate: authProfile.memberSince,
    avatarInitials: initials || 'US',
  };
}

function isAdminRouteUrl(): boolean {
  if (typeof window === 'undefined') return false;
  const path = window.location.pathname.toLowerCase();
  const hash = window.location.hash.toLowerCase();
  return (
    path === '/admin' ||
    path.startsWith('/admin/') ||
    path.startsWith('/admin-') ||
    hash === '#admin' ||
    hash.startsWith('#/admin')
  );
}

function clearAdminUrlFromBrowser(): void {
  if (typeof window === 'undefined') return;
  if (isAdminRouteUrl()) {
    window.history.replaceState(null, '', '/');
  }
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const initialBootRef = useRef<{
    publicCache: ReturnType<typeof readPublicStartupCache>;
    lastUid: string | null;
    userCache: ReturnType<typeof readUserStartupCache>;
  } | null>(null);

  if (initialBootRef.current === null) {
    const publicCache = readPublicStartupCache();
    const lastUid = readLastActiveUid();
    const userCache = lastUid ? readUserStartupCache(lastUid) : null;
    initialBootRef.current = { publicCache, lastUid, userCache };
    if (publicCache?.systemSettings) {
      warmBrandAndBannerAssets(publicCache.systemSettings);
    }
  }

  const bootPublic = initialBootRef.current.publicCache;
  const bootUser = initialBootRef.current.userCache;
  const hasWarmPublicCache = Boolean(
    bootPublic && (bootPublic.platforms.length > 0 || bootPublic.systemSettings)
  );

  const [viewMode, setViewModeState] = useState<AppViewMode>('dashboard');
  const [activeTab, setActiveTab] = useState<DashboardTab>('home');
  const [authModalMode, setAuthModalMode] = useState<AuthModalMode>(null);
  const [selectedPlatform, setSelectedPlatform] = useState<PlatformId>(
    bootPublic?.selectedPlatform ?? bootPublic?.platforms[0]?.id ?? 'instagram'
  );
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [ticketDraftOrderRef, setTicketDraftOrderRef] = useState<string>('');
  const [orderDraft, setOrderDraft] = useState<PendingOrderDraft | null>(null);

  const [platforms, setPlatforms] = useState<PlatformCategory[]>(bootPublic?.platforms ?? []);
  const [services, setServices] = useState<SmmService[]>(bootPublic?.services ?? []);
  const [orders, setOrders] = useState<OrderRecord[]>(bootUser?.orders ?? []);
  const [orderStats, setOrderStats] = useState<OrderStatsSummary>(
    bootUser?.orderStats ?? {
      totalOrders: 0,
      completedOrders: 0,
      pendingOrders: 0,
    }
  );
  const [profile, setProfile] = useState<CustomerProfile | null>(bootUser?.profile ?? null);
  const [accountStatus, setAccountStatus] = useState<UserAccountStatus>(
    bootUser?.accountStatus ?? 'active'
  );
  const [wallet, setWallet] = useState<WalletSummary>(
    bootUser?.wallet ?? {
      balance: 0,
      totalSpent: 0,
      totalDeposited: 0,
    }
  );
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodItem[]>(
    bootPublic?.paymentMethods ?? []
  );
  const [paymentRequests, setPaymentRequests] = useState<CustomerPaymentRequest[]>(
    bootUser?.paymentRequests ?? []
  );
  const [transactions, setTransactions] = useState<WalletTransaction[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>(
    bootUser?.notifications ?? []
  );
  const [tickets, setTickets] = useState<SupportTicket[]>(bootUser?.tickets ?? []);
  const [systemSettings, setSystemSettings] = useState<Partial<FirestoreSettingsDoc> | null>(() => {
    const raw = bootPublic?.systemSettings ?? null;
    if (!raw) return null;
    return {
      ...raw,
      currencySymbol: normalizeCurrencySymbol(raw.currencySymbol, raw.currency),
    };
  });
  const [dataError, setDataError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(!hasWarmPublicCache);
  const [toast, setToast] = useState<ToastMessage | null>(null);

  const [firebaseUser, setFirebaseUser] = useState<FirebaseAuthUser | null>(null);
  const [userRole, setUserRole] = useState<UserRole>(bootUser?.userRole ?? 'user');
  const [staffRole, setStaffRole] = useState<AdminStaffRole | null>(bootUser?.staffRole ?? null);
  const [authReady, setAuthReady] = useState<boolean>(false);
  const [setupWizardOpen, setSetupWizardOpen] = useState<boolean>(false);
  const [setupState, setSetupState] = useState<SetupState>({
    setupRequired: true,
    firebaseConnected: false,
    databaseInitialized: false,
    adminConfigured: false,
    brandingConfigured: false,
    providerConfigured: false,
    paymentConfigured: false,
    setupCompleted: false,
    productionMode: false,
    demoDataEnabled: true,
    installationId: '',
    lastError: null,
  });
  const [lastInitReport, setLastInitReport] = useState<DatabaseInitReport | null>(null);

  const orderInFlightRef = useRef<boolean>(false);
  const lastOrderSigRef = useRef<{ sig: string; at: number } | null>(null);
  const pendingRedirectRef = useRef<PendingRedirectTarget | null>(null);
  const requestedAdminRouteRef = useRef<boolean>(isAdminRouteUrl());
  const interactiveAuthInFlightRef = useRef<boolean>(false);
  const autoInitializedAdminUidRef = useRef<string | null>(null);

  const adminPermissions = getAdminPermissions(staffRole);
  const openSetupWizard = useCallback(() => setSetupWizardOpen(true), []);
  const closeSetupWizard = useCallback(() => setSetupWizardOpen(false), []);

  const showToast = useCallback((next: Omit<ToastMessage, 'id'>) => {
    const id = String(Date.now());
    setToast({ ...next, id });
    window.setTimeout(() => {
      setToast((prev) => (prev?.id === id ? null : prev));
    }, 3800);
  }, []);

  const dismissToast = useCallback(() => setToast(null), []);

  const consumeOrderDraft = useCallback(() => {
    setOrderDraft(null);
  }, []);

  const setViewMode = useCallback(
    (mode: AppViewMode) => {
      if (mode === 'admin') {
        if (!firebaseUser || userRole !== 'admin' || accountStatus !== 'active') {
          clearAdminUrlFromBrowser();
          setActiveTab('home');
          setViewModeState('dashboard');
          return;
        }
      } else {
        clearAdminUrlFromBrowser();
      }
      setViewModeState(mode);
    },
    [accountStatus, firebaseUser, userRole]
  );

  const goToHome = useCallback(() => {
    pendingRedirectRef.current = null;
    clearAdminUrlFromBrowser();
    setActiveTab('home');
    setViewModeState('dashboard');
  }, []);

  const navigateProtected = useCallback(
    (tab: DashboardTab = 'home') => {
      if (tab === 'home' || tab === 'services') {
        setActiveTab(tab);
        setViewModeState('dashboard');
        return;
      }
      if (!firebaseUser) {
        pendingRedirectRef.current = { type: 'tab', tab };
        setViewModeState('login');
        showToast({
          title: 'Sign in required',
          description: 'Please sign in or register to access this feature.',
          tone: 'info',
        });
        return;
      }
      setActiveTab(tab);
      setViewModeState('dashboard');
    },
    [firebaseUser, showToast]
  );

  const requireAuthForOrder = useCallback(
    (draft: PendingOrderDraft) => {
      pendingRedirectRef.current = {
        type: 'place-order',
        tab: 'home',
        orderDraft: draft,
      };
      setOrderDraft(draft);
      setViewModeState('login');
      showToast({
        title: 'Sign in to place order',
        description: 'Log in or create an account to submit your order.',
        tone: 'info',
      });
    },
    [showToast]
  );

  const applyPostAuthRedirect = useCallback((effectiveRole: UserRole) => {
    const pending = pendingRedirectRef.current;
    pendingRedirectRef.current = null;

    if (effectiveRole === 'admin') {
      setActiveTab('home');
      setViewModeState('admin');
      return;
    }

    clearAdminUrlFromBrowser();

    if (!pending) {
      setActiveTab('home');
      setViewModeState('dashboard');
      return;
    }

    if (pending.type === 'place-order') {
      if (pending.orderDraft) {
        setSelectedPlatform(pending.orderDraft.categoryId);
        setOrderDraft(pending.orderDraft);
      }
      setActiveTab('home');
      setViewModeState('dashboard');
      window.setTimeout(() => {
        const el = document.getElementById('new-order-card');
        el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 90);
      return;
    }

    if (pending.orderId) {
      setSelectedOrderId(pending.orderId);
    }
    if (pending.ticketId) {
      setSelectedTicketId(pending.ticketId);
    }
    if (pending.draftOrderRef) {
      setTicketDraftOrderRef(pending.draftOrderRef);
    }
    setActiveTab(pending.tab ?? 'home');
    setViewModeState('dashboard');
  }, []);

  const refreshSetupState = useCallback(async (): Promise<SetupState> => {
    const state = await inspectSetupState();
    setSetupState(state);
    return state;
  }, []);

  const refreshSystemSettings = useCallback(async () => {
    invalidatePublicCatalogCache();
    const rawSys = await adminService.getSystemSettings(true);
    const sys = rawSys
      ? {
          ...rawSys,
          currencySymbol: normalizeCurrencySymbol(rawSys.currencySymbol, rawSys.currency),
        }
      : null;
    setSystemSettings(sys);
    warmBrandAndBannerAssets(sys);
    const currentCache = readPublicStartupCache();
    writePublicStartupCache({
      systemSettings: sys,
      platforms: currentCache?.platforms ?? platforms,
      services: currentCache?.services ?? services,
      paymentMethods: currentCache?.paymentMethods ?? paymentMethods,
      selectedPlatform: currentCache?.selectedPlatform,
    });
  }, [paymentMethods, platforms, services]);

  // Synchronize white-label document title, favicon & CSS accent theme variables
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const siteName = resolveBrandName(systemSettings?.websiteName);
    const tagline = systemSettings?.brandTagline?.trim() || APP_CONFIG.brandTagline;
    document.title = `${siteName} — ${tagline}`;

    const primary = systemSettings?.themeColor?.trim() || '#6D28D9';
    const secondary = systemSettings?.secondaryColor?.trim() || '#4F46E5';
    document.documentElement.style.setProperty('--brand-primary', primary);
    document.documentElement.style.setProperty('--brand-secondary', secondary);

    const favUrl = resolveBrandFaviconUrl(systemSettings?.favicon);
    if (favUrl && (/^https?:\/\//i.test(favUrl) || favUrl.startsWith('/'))) {
      let linkEl = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
      if (!linkEl) {
        linkEl = document.createElement('link');
        linkEl.rel = 'icon';
        document.head.appendChild(linkEl);
      }
      linkEl.href = favUrl;
    }
  }, [systemSettings]);

  const applyPublicCatalogBundle = useCallback(
    (bundle: {
      platforms: PlatformCategory[];
      services: SmmService[];
      systemSettings: Partial<FirestoreSettingsDoc> | null;
      paymentMethods: PaymentMethodItem[];
    }) => {
      const normalizedSettings = bundle.systemSettings
        ? {
            ...bundle.systemSettings,
            currencySymbol: normalizeCurrencySymbol(
              bundle.systemSettings.currencySymbol,
              bundle.systemSettings.currency
            ),
          }
        : null;
      setPlatforms(bundle.platforms);
      setServices(bundle.services);
      setSystemSettings(normalizedSettings);
      setPaymentMethods(bundle.paymentMethods);
      warmBrandAndBannerAssets(normalizedSettings);

      let resolvedPlatform: PlatformId | undefined;
      if (bundle.platforms.length > 0) {
        setSelectedPlatform((prev) => {
          resolvedPlatform = bundle.platforms.some((p) => p.id === prev)
            ? prev
            : bundle.platforms[0].id;
          return resolvedPlatform;
        });
      }

      writePublicStartupCache({
        systemSettings: normalizedSettings,
        platforms: bundle.platforms,
        services: bundle.services,
        paymentMethods: bundle.paymentMethods,
        selectedPlatform: resolvedPlatform,
      });
    },
    []
  );

  const resetSignedOutUserState = useCallback(() => {
    setProfile(null);
    setAccountStatus('active');
    setUserRole('user');
    setStaffRole(null);
    setOrders([]);
    setOrderStats({ totalOrders: 0, completedOrders: 0, pendingOrders: 0 });
    setWallet({ balance: 0, totalSpent: 0, totalDeposited: 0 });
    setPaymentRequests([]);
    setTransactions([]);
    setNotifications([]);
    setTickets([]);
  }, []);

  const hydrateAuthenticatedAccount = useCallback(
    async (authUser: FirebaseAuthUser): Promise<UserRole> => {
      setDataError(null);
      try {
        const [authProfile, staffAccess] = await Promise.all([
          authService.ensureAndFetchUserProfile(authUser),
          adminService.verifyStaffAccess(authUser.uid, authUser.email, authUser.emailVerified),
        ]);

        const resolvedStaffRole: AdminStaffRole | null = staffAccess.isStaff
          ? staffAccess.staffRole
          : null;
        const effectiveRole: UserRole = staffAccess.isStaff ? 'admin' : 'user';
        const effectiveStatus: UserAccountStatus =
          effectiveRole === 'admin' ? 'active' : authProfile.status;

        const mappedProfile = toCustomerProfile(
          {
            ...authProfile,
            role: effectiveRole,
            status: effectiveStatus,
          },
          resolvedStaffRole
        );

        setProfile(mappedProfile);
        setAccountStatus(effectiveStatus);
        setUserRole(effectiveRole);
        setStaffRole(resolvedStaffRole);
        setWallet((prev) => ({
          ...prev,
          balance: Number(authProfile.balance ?? 0),
        }));

        return effectiveRole;
      } catch (error) {
        setDataError(toUserFriendlyFirebaseError(error));
        return 'user';
      }
    },
    []
  );

  const refreshWalletLedger = useCallback(async () => {
    if (!firebaseUser) return;
    const [loadedMethods, loadedTxns, loadedPayReqs, loadedNotifs] = await Promise.all([
      walletService.getActivePaymentMethods().catch(() => []),
      walletService.getTransactions().catch(() => []),
      walletService.getMyPaymentRequests().catch(() => []),
      walletService.getNotifications().catch(() => []),
    ]);
    setPaymentMethods(loadedMethods);
    setTransactions(loadedTxns);
    setPaymentRequests(loadedPayReqs);
    setNotifications(loadedNotifs);
    const totalDepositedFromLedger = loadedTxns
      .filter(
        (t) =>
          t.type === 'deposit' ||
          t.type === 'admin_credit' ||
          (t.type === 'adjustment' && t.amount > 0)
      )
      .reduce((sum, t) => sum + Number(t.amount || 0), 0);
    setWallet((prev) => ({
      ...prev,
      totalDeposited: Number(totalDepositedFromLedger.toFixed(2)),
    }));
  }, [firebaseUser]);

  const refreshCustomerData = useCallback(async () => {
    setDataError(null);
    invalidatePublicCatalogCache();
    try {
      const bundle = await fetchPublicCatalogBundle({ forceRefresh: true });
      applyPublicCatalogBundle(bundle);
      if (firebaseUser) {
        await Promise.all([
          hydrateAuthenticatedAccount(firebaseUser),
          refreshWalletLedger(),
        ]);
      }
    } catch (error) {
      setDataError(toUserFriendlyFirebaseError(error));
    } finally {
      setIsLoading(false);
    }
  }, [applyPublicCatalogBundle, firebaseUser, hydrateAuthenticatedAccount, refreshWalletLedger]);

  useEffect(() => {
    let active = true;

    // 1. Single deduplicated parallel public catalog & settings fetch (never re-fetched on auth state updates)
    fetchPublicCatalogBundle()
      .then((bundle) => {
        if (!active) return;
        applyPublicCatalogBundle(bundle);
        setIsLoading(false);
      })
      .catch(() => {
        if (!active) return;
        setIsLoading(false);
      });

    // 2. Non-blocking single server connectivity check on boot
    probeFirestoreConnectionOnce();

    // 3. Silent background Auth listener (relies on live onSnapshot listeners for orders/wallet/tickets/notifs)
    const unsubscribe = subscribeFirebaseAuth(async (user) => {
      if (!active) return;
      setFirebaseUser(user);

      if (!user) {
        writeLastActiveUid(null);
        resetSignedOutUserState();
        setAuthReady(true);
        if (requestedAdminRouteRef.current) {
          requestedAdminRouteRef.current = false;
          clearAdminUrlFromBrowser();
          setActiveTab('home');
          setViewModeState('dashboard');
        }
        return;
      }

      writeLastActiveUid(user.uid);
      if (initialBootRef.current?.lastUid !== user.uid) {
        const switchedCache = readUserStartupCache(user.uid);
        if (switchedCache) {
          setProfile(switchedCache.profile);
          setAccountStatus(switchedCache.accountStatus);
          if (
            !interactiveAuthInFlightRef.current &&
            !adminService.isDesignatedAdminEmail(user.email)
          ) {
            setUserRole(switchedCache.userRole);
            setStaffRole(switchedCache.staffRole);
          }
          setWallet(switchedCache.wallet);
          setOrderStats(switchedCache.orderStats);
          setOrders(switchedCache.orders);
          setNotifications(switchedCache.notifications);
          setTickets(switchedCache.tickets);
          setPaymentRequests(switchedCache.paymentRequests);
        }
      }

      if (!interactiveAuthInFlightRef.current) {
        const effectiveRole = await hydrateAuthenticatedAccount(user);
        if (!active) return;
        setAuthReady(true);

        if (requestedAdminRouteRef.current) {
          requestedAdminRouteRef.current = false;
          if (effectiveRole === 'admin') {
            setViewModeState('admin');
          } else {
            clearAdminUrlFromBrowser();
            setActiveTab('home');
            setViewModeState('dashboard');
          }
        }
      } else {
        setAuthReady(true);
      }

      // Lazy non-blocking background fetch for wallet ledger transactions
      walletService
        .getTransactions()
        .then((loadedTxns) => {
          if (!active) return;
          setTransactions(loadedTxns);
          const totalDepositedFromLedger = loadedTxns
            .filter(
              (t) =>
                t.type === 'deposit' ||
                t.type === 'admin_credit' ||
                (t.type === 'adjustment' && t.amount > 0)
            )
            .reduce((sum, t) => sum + Number(t.amount || 0), 0);
          setWallet((prev) => ({
            ...prev,
            totalDeposited: Number(totalDepositedFromLedger.toFixed(2)),
          }));
        })
        .catch(() => undefined);
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [applyPublicCatalogBundle, hydrateAuthenticatedAccount, resetSignedOutUserState]);

  // Only inspect setup diagnostics when actually entering Admin Panel
  useEffect(() => {
    if (viewMode === 'admin' && firebaseUser && userRole === 'admin') {
      void refreshSetupState();
    }
  }, [firebaseUser, refreshSetupState, userRole, viewMode]);

  // Automatically bootstrap Firestore & seed missing categories/services once per admin session
  useEffect(() => {
    if (!authReady || !firebaseUser || userRole !== 'admin' || accountStatus !== 'active') {
      return;
    }
    if (autoInitializedAdminUidRef.current === firebaseUser.uid) {
      return;
    }
    autoInitializedAdminUidRef.current = firebaseUser.uid;

    let active = true;
    (async () => {
      try {
        const state = await inspectSetupState();
        if (!active) return;
        const shouldSeedCatalog = state.demoDataEnabled !== false;
        if (!state.databaseInitialized || shouldSeedCatalog) {
          const report = await initializeDatabase({ seedDemo: shouldSeedCatalog });
          if (!active) return;
          setLastInitReport(report);
          setSetupState(report.setupState);
          if (report.success && (report.createdDocsCount > 0 || !state.databaseInitialized)) {
            await refreshCustomerData();
          } else {
            await refreshSystemSettings().catch(() => undefined);
          }
        } else {
          setSetupState(state);
        }
      } catch {
        // Non-blocking background initialization
      }
    })();

    return () => {
      active = false;
    };
  }, [
    accountStatus,
    authReady,
    firebaseUser,
    refreshCustomerData,
    refreshSystemSettings,
    userRole,
  ]);

  // Refresh wallet transactions when navigating to Funds tab
  useEffect(() => {
    if (activeTab === 'funds' && firebaseUser) {
      void refreshWalletLedger();
    }
  }, [activeTab, firebaseUser, refreshWalletLedger]);

  // Persist signed-in user's snapshot for instant zero-skeleton reload hydration
  useEffect(() => {
    if (!firebaseUser?.uid || !profile) return;
    writeUserStartupCache(firebaseUser.uid, {
      profile,
      accountStatus,
      userRole,
      staffRole,
      wallet,
      orderStats,
      orders,
      notifications,
      tickets,
      paymentRequests,
    });
  }, [
    accountStatus,
    firebaseUser?.uid,
    notifications,
    orderStats,
    orders,
    paymentRequests,
    profile,
    staffRole,
    tickets,
    userRole,
    wallet,
  ]);

  // Protect admin URL route against manual navigation by unauthorized or signed-out users
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const enforceRouteGuard = () => {
      if (isAdminRouteUrl()) {
        if (firebaseUser && userRole === 'admin' && accountStatus === 'active') {
          setViewModeState('admin');
        } else {
          clearAdminUrlFromBrowser();
          setActiveTab('home');
          setViewModeState('dashboard');
        }
      }
    };
    window.addEventListener('popstate', enforceRouteGuard);
    window.addEventListener('hashchange', enforceRouteGuard);
    return () => {
      window.removeEventListener('popstate', enforceRouteGuard);
      window.removeEventListener('hashchange', enforceRouteGuard);
    };
  }, [accountStatus, firebaseUser, userRole]);

  // Real-time balance, orders, notifications, tickets & payment status listeners
  useEffect(() => {
    if (!firebaseUser) return;
    const firebaseServices = getFirebaseServices();
    if (!firebaseServices) return;
    const uid = firebaseUser.uid;

    const userRef = doc(firebaseServices.db, FIRESTORE_COLLECTIONS.users, uid);
    const unsubUser = onSnapshot(
      userRef,
      (snap) => {
        if (!snap.exists()) return;
        const data = snap.data() as FirestoreUserDoc;
        setWallet((prev) => ({
          ...prev,
          balance: Number(data.balance ?? 0),
        }));
        const effectiveStatus: UserAccountStatus = adminService.isDesignatedAdminEmail(
          firebaseUser.email
        )
          ? 'active'
          : (data.status ?? 'active');
        setAccountStatus(effectiveStatus);
        setProfile((prev) =>
          prev
            ? {
                ...prev,
                fullName: data.name || prev.fullName,
                phone: data.phone ?? prev.phone,
                photoUrl: data.photoUrl ?? prev.photoUrl,
                status: effectiveStatus,
              }
            : prev
        );
      },
      () => undefined
    );

    const ordersQuery = query(
      collection(firebaseServices.db, FIRESTORE_COLLECTIONS.orders),
      where('userId', '==', uid),
      limit(60)
    );
    const unsubOrders = onSnapshot(
      ordersQuery,
      (snap) => {
        const mapped = snap.docs
          .map((d) => mapCustomerOrderDoc(d.data() as FirestoreOrderDoc))
          .sort((a, b) => b.createdAtIso.localeCompare(a.createdAtIso));

        const spent = mapped
          .filter(
            (o) =>
              !o.refunded &&
              o.status !== 'Canceled' &&
              o.status !== 'Cancelled' &&
              o.status !== 'Failed'
          )
          .reduce((sum, o) => sum + Number(o.charge ?? 0), 0);

        setOrders(mapped);
        setOrderStats({
          totalOrders: mapped.length,
          completedOrders: mapped.filter((o) => o.status === 'Completed').length,
          pendingOrders: mapped.filter(
            (o) => o.status === 'Pending' || o.status === 'Processing' || o.status === 'In Progress'
          ).length,
        });
        setWallet((prev) => ({
          ...prev,
          totalSpent: Number(spent.toFixed(2)),
        }));
      },
      () => undefined
    );

    const notifsQuery = query(
      collection(firebaseServices.db, FIRESTORE_COLLECTIONS.notifications),
      where('userId', 'in', [uid, 'all']),
      limit(60)
    );
    const unsubNotifs = onSnapshot(
      notifsQuery,
      (snap) => {
        const localReadBroadcasts = getLocalReadBroadcastIds(uid);
        const mapped = snap.docs
          .map((d) => {
            const data = d.data() as FirestoreNotificationDoc;
            const created = formatFirestoreTimestamp(data.createdAt, 'Recent');
            const isBroadcast = data.userId === 'all';
            const effectiveRead = isBroadcast
              ? Boolean(data.isRead ?? data.read) || localReadBroadcasts.has(data.id)
              : Boolean(data.isRead ?? data.read);
            return {
              id: data.id,
              notificationId: data.notificationId ?? data.id,
              targetUserId: data.userId,
              title: data.title,
              message: data.message,
              timeLabel: created.label,
              read: effectiveRead,
              isRead: effectiveRead,
              category: data.type,
              referenceId: data.referenceId,
              _iso: created.iso,
            };
          })
          .sort((a, b) => b._iso.localeCompare(a._iso))
          .map(({ _iso: _unused, ...rest }) => rest);
        setNotifications(mapped);
      },
      () => undefined
    );

    const ticketsQuery = query(
      collection(firebaseServices.db, FIRESTORE_COLLECTIONS.supportTickets),
      where('userId', '==', uid),
      limit(50)
    );
    const unsubTickets = onSnapshot(
      ticketsQuery,
      (snap) => {
        const mapped = snap.docs
          .map((d) => {
            const data = d.data() as FirestoreSupportTicketDoc;
            const created = formatFirestoreTimestamp(data.createdAt, 'Synced');
            const updated = formatFirestoreTimestamp(data.updatedAt, created.label);
            return {
              id: data.id,
              ticketNumber: data.id.toUpperCase(),
              category: data.category,
              subject: data.subject as TicketSubject,
              orderReference: data.orderReference,
              attachmentUrl: data.attachmentUrl,
              message: data.message,
              adminReply: data.adminReply,
              priority: data.priority as TicketPriority,
              status: data.status,
              createdAtLabel: created.label,
              updatedAtLabel: updated.label,
              _iso: updated.iso,
            };
          })
          .sort((a, b) => b._iso.localeCompare(a._iso))
          .map(({ _iso: _unused, ...rest }) => rest);
        setTickets(mapped);
      },
      () => undefined
    );

    const paymentsQuery = query(
      collection(firebaseServices.db, FIRESTORE_COLLECTIONS.payments),
      where('userId', '==', uid),
      limit(50)
    );
    const unsubPayments = onSnapshot(
      paymentsQuery,
      (snap) => {
        const mapped = snap.docs
          .map((d) => {
            const data = d.data() as FirestorePaymentDoc;
            const created = formatFirestoreTimestamp(data.createdAt, 'Pending');
            const reviewed = data.reviewedAt
              ? formatFirestoreTimestamp(data.reviewedAt, '')
              : null;
            return {
              id: data.id,
              paymentId: data.paymentId ?? data.id,
              userId: data.userId,
              userName: data.userName ?? '',
              method: data.paymentMethod ?? data.method,
              amount: Number(data.amount ?? 0),
              transactionId: data.transactionId,
              status: data.status,
              adminNote: data.adminNote,
              reviewedBy: data.reviewedBy,
              reviewedAtLabel: reviewed?.label || undefined,
              createdAtLabel: created.label,
              _iso: created.iso,
            };
          })
          .sort((a, b) => b._iso.localeCompare(a._iso))
          .map(({ _iso: _unused, ...rest }) => rest);
        setPaymentRequests(mapped);
      },
      () => undefined
    );

    return () => {
      unsubUser();
      unsubOrders();
      unsubNotifs();
      unsubTickets();
      unsubPayments();
    };
  }, [firebaseUser]);

  const registerWithEmail = useCallback(
    async (input: RegisterInput): Promise<AuthActionResult> => {
      interactiveAuthInFlightRef.current = true;
      try {
        const created = await authService.registerWithEmail(input);
        const currentUser = getFirebaseServices()?.auth.currentUser ?? null;
        if (currentUser) {
          setFirebaseUser(currentUser);
        }
        const brand = resolveBrandName(systemSettings?.websiteName);
        setProfile(toCustomerProfile(created));
        setAccountStatus(created.status);
        setUserRole(created.role);
        setStaffRole(null);
        setWallet({ balance: created.balance, totalSpent: 0, totalDeposited: 0 });
        applyPostAuthRedirect(created.role);
        showToast({
          title: 'Account Created',
          description: `Welcome to ${brand}, ${created.name}!`,
          tone: 'success',
        });
        return { success: true };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Registration failed.',
        };
      } finally {
        interactiveAuthInFlightRef.current = false;
      }
    },
    [applyPostAuthRedirect, showToast, systemSettings?.websiteName]
  );

  const loginWithEmail = useCallback(
    async (input: LoginInput): Promise<AuthActionResult> => {
      interactiveAuthInFlightRef.current = true;
      try {
        const signedInProfile = await authService.loginWithEmail(input);
        const currentUser = getFirebaseServices()?.auth.currentUser ?? null;
        if (currentUser) {
          setFirebaseUser(currentUser);
        }

        const staffAccess = await adminService.verifyStaffAccess(
          signedInProfile.uid,
          signedInProfile.email,
          Boolean(currentUser?.emailVerified)
        );
        const resolvedStaffRole: AdminStaffRole | null = staffAccess.isStaff
          ? staffAccess.staffRole
          : null;
        const effectiveRole: UserRole = staffAccess.isStaff ? 'admin' : 'user';
        const effectiveStatus: UserAccountStatus =
          effectiveRole === 'admin' ? 'active' : signedInProfile.status;

        setProfile(
          toCustomerProfile(
            { ...signedInProfile, role: effectiveRole, status: effectiveStatus },
            resolvedStaffRole
          )
        );
        setAccountStatus(effectiveStatus);
        setUserRole(effectiveRole);
        setStaffRole(resolvedStaffRole);
        setWallet((prev) => ({
          ...prev,
          balance: Number(signedInProfile.balance ?? prev.balance ?? 0),
        }));

        if (effectiveStatus !== 'active') {
          pendingRedirectRef.current = null;
          clearAdminUrlFromBrowser();
          setActiveTab('home');
          setViewModeState('dashboard');
          return { success: true };
        }

        applyPostAuthRedirect(effectiveRole);
        showToast({
          title: 'Signed In',
          description:
            effectiveRole === 'admin'
              ? 'Administrator access verified.'
              : `Welcome back, ${signedInProfile.name}.`,
          tone: 'success',
        });
        return { success: true };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Login failed.',
        };
      } finally {
        interactiveAuthInFlightRef.current = false;
      }
    },
    [applyPostAuthRedirect, showToast]
  );

  const loginWithGoogle = useCallback(async (): Promise<AuthActionResult> => {
    interactiveAuthInFlightRef.current = true;
    try {
      const signedInProfile = await authService.loginWithGoogle();
      const currentUser = getFirebaseServices()?.auth.currentUser ?? null;
      if (currentUser) {
        setFirebaseUser(currentUser);
      }

      const staffAccess = await adminService.verifyStaffAccess(
        signedInProfile.uid,
        signedInProfile.email,
        Boolean(currentUser?.emailVerified)
      );
      const resolvedStaffRole: AdminStaffRole | null = staffAccess.isStaff
        ? staffAccess.staffRole
        : null;
      const effectiveRole: UserRole = staffAccess.isStaff ? 'admin' : 'user';
      const effectiveStatus: UserAccountStatus =
        effectiveRole === 'admin' ? 'active' : signedInProfile.status;

      setProfile(
        toCustomerProfile(
          { ...signedInProfile, role: effectiveRole, status: effectiveStatus },
          resolvedStaffRole
        )
      );
      setAccountStatus(effectiveStatus);
      setUserRole(effectiveRole);
      setStaffRole(resolvedStaffRole);
      setWallet((prev) => ({
        ...prev,
        balance: Number(signedInProfile.balance ?? prev.balance ?? 0),
      }));

      if (effectiveStatus !== 'active') {
        pendingRedirectRef.current = null;
        clearAdminUrlFromBrowser();
        setActiveTab('home');
        setViewModeState('dashboard');
        return { success: true };
      }

      applyPostAuthRedirect(effectiveRole);
      showToast({
        title: 'Signed In with Google',
        description:
          effectiveRole === 'admin'
            ? 'Administrator access verified.'
            : `Welcome, ${signedInProfile.name}.`,
        tone: 'success',
      });
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Google sign-in failed.',
      };
    } finally {
      interactiveAuthInFlightRef.current = false;
    }
  }, [applyPostAuthRedirect, showToast]);

  const sendPasswordReset = useCallback(async (email: string): Promise<AuthActionResult> => {
    try {
      await authService.sendPasswordReset(email);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Could not send password reset link.',
      };
    }
  }, []);

  const updateUserProfile = useCallback(
    async (input: UpdateProfileInput): Promise<AuthActionResult> => {
      if (!firebaseUser) {
        return { success: false, error: 'You must be signed in.' };
      }
      try {
        const updated = await authService.updateOwnProfile(firebaseUser.uid, input);
        setProfile(toCustomerProfile(updated));
        showToast({
          title: 'Profile Updated',
          description: 'Your personal details have been saved.',
          tone: 'success',
        });
        return { success: true };
      } catch (error) {
        const message = toUserFriendlyFirebaseError(error);
        showToast({
          title: 'Update Failed',
          description: message,
          tone: 'error',
        });
        return { success: false, error: message };
      }
    },
    [firebaseUser, showToast]
  );

  const logoutUser = useCallback(async () => {
    const prevUid = firebaseUser?.uid;
    await authService.logout();
    writeLastActiveUid(null);
    if (prevUid) clearUserStartupCache(prevUid);
    pendingRedirectRef.current = null;
    clearAdminUrlFromBrowser();
    setOrderDraft(null);
    setFirebaseUser(null);
    resetSignedOutUserState();
    setActiveTab('home');
    setViewModeState('dashboard');
    showToast({
      title: 'Signed Out',
      description: 'Your session has been closed securely.',
      tone: 'info',
    });
  }, [firebaseUser?.uid, resetSignedOutUserState, showToast]);

  const runDatabaseInitialization = useCallback(
    async (options?: { seedDemo?: boolean }): Promise<DatabaseInitReport> => {
      const report = await initializeDatabase(options);
      setLastInitReport(report);
      setSetupState(report.setupState);
      if (report.success) {
        showToast({
          title: 'Database Initialized',
          description: report.message,
          tone: 'success',
        });
      } else {
        showToast({
          title: 'Initialization Failed',
          description: report.message,
          tone: 'error',
        });
      }
      return report;
    },
    [showToast]
  );

  const signInAdminWithGoogle = useCallback(async (): Promise<boolean> => {
    try {
      const user = await signInWithGooglePopup();
      setFirebaseUser(user);
      const staffAccess = await adminService.verifyStaffAccess(
        user.uid,
        user.email,
        user.emailVerified
      );
      setUserRole(staffAccess.isStaff ? 'admin' : 'user');
      setStaffRole(staffAccess.staffRole);
      await refreshSetupState();

      if (!staffAccess.isStaff) {
        showToast({
          title: 'Access Restricted',
          description: 'Signed-in account does not hold Administrator privileges.',
          tone: 'warning',
        });
        return false;
      }

      showToast({
        title: `${getAdminRoleLabel(staffAccess.staffRole)} Verified`,
        description: `Signed in as ${user.email ?? 'Administrator'}.`,
        tone: 'success',
      });
      return true;
    } catch (error) {
      showToast({
        title: 'Sign-In Failed',
        description: toUserFriendlyFirebaseError(error),
        tone: 'error',
      });
      return false;
    }
  }, [refreshSetupState, showToast]);

  const signOutAdmin = useCallback(async () => {
    const prevUid = firebaseUser?.uid;
    await signOutFirebase();
    writeLastActiveUid(null);
    if (prevUid) clearUserStartupCache(prevUid);
    pendingRedirectRef.current = null;
    clearAdminUrlFromBrowser();
    setFirebaseUser(null);
    resetSignedOutUserState();
    setActiveTab('home');
    setViewModeState('dashboard');
    showToast({
      title: 'Signed Out',
      description: 'Admin session closed securely.',
      tone: 'info',
    });
  }, [firebaseUser?.uid, resetSignedOutUserState, showToast]);

  const openAuthModal = useCallback((mode: 'login' | 'register') => {
    setViewModeState(mode === 'register' ? 'register' : 'login');
  }, []);

  const closeAuthModal = useCallback(() => {
    setAuthModalMode(null);
  }, []);

  const selectPlatformForOrder = useCallback(
    (id: PlatformId, serviceId?: string) => {
      if (id === 'more') {
        setActiveTab('services');
        setViewModeState('dashboard');
        return;
      }
      setSelectedPlatform(id);
      if (serviceId) {
        setOrderDraft({
          categoryId: id,
          serviceId,
          link: '',
          quantity: '',
        });
      }
      setActiveTab('home');
      setViewModeState('dashboard');
      window.setTimeout(() => {
        const el = document.getElementById('new-order-card');
        el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 60);
    },
    []
  );

  const openOrderDetails = useCallback(
    (orderId: string) => {
      if (!firebaseUser) {
        pendingRedirectRef.current = { type: 'tab', tab: 'order', orderId };
        setViewModeState('login');
        showToast({
          title: 'Sign in required',
          description: 'Please sign in to view your order history.',
          tone: 'info',
        });
        return;
      }
      setSelectedOrderId(orderId);
      setActiveTab('order');
      setViewModeState('dashboard');
    },
    [firebaseUser, showToast]
  );

  const placeDemoOrder = useCallback(
    async (input: CreateOrderInput): Promise<boolean> => {
      if (orderInFlightRef.current) {
        return false;
      }

      if (!firebaseUser || accountStatus !== 'active') {
        showToast({
          title: 'Action unavailable',
          description: 'Only active signed-in accounts can submit orders.',
          tone: 'warning',
        });
        return false;
      }

      const targetService = services.find((s) => s.id === input.serviceId);
      if (!targetService) {
        showToast({
          title: 'Service unavailable',
          description: 'Please pick a valid service from the dropdown.',
          tone: 'error',
        });
        return false;
      }

      if (!input.link.trim()) {
        showToast({
          title: 'Target link required',
          description: 'Enter a valid profile or post URL before placing the order.',
          tone: 'warning',
        });
        return false;
      }

      if (input.quantity < targetService.minQuantity || input.quantity > targetService.maxQuantity) {
        showToast({
          title: 'Invalid quantity range',
          description: `Quantity must be between ${targetService.minQuantity.toLocaleString()} and ${targetService.maxQuantity.toLocaleString()}.`,
          tone: 'warning',
        });
        return false;
      }

      const sig = `${input.serviceId}::${input.link.trim().toLowerCase()}::${Math.floor(input.quantity)}`;
      const now = Date.now();
      if (lastOrderSigRef.current && lastOrderSigRef.current.sig === sig && now - lastOrderSigRef.current.at < 4000) {
        showToast({
          title: 'Duplicate Order Prevented',
          description: 'Identical order was just submitted. Please wait a few seconds before repeating.',
          tone: 'warning',
        });
        return false;
      }

      const cost = calculateOrderCharge(
        input.quantity,
        targetService.ratePerThousand,
        isPackageService(targetService)
      );
      if (cost > wallet.balance) {
        showToast({
          title: 'Insufficient Balance',
          description: 'আপনার পর্যাপ্ত ব্যালেন্স নেই। অনুগ্রহ করে Add Funds করে আবার চেষ্টা করুন।',
          tone: 'warning',
        });
        return false;
      }

      const currencySymbol = normalizeCurrencySymbol(
        systemSettings?.currencySymbol,
        systemSettings?.currency
      );
      const idempotencyKey =
        input.idempotencyKey?.trim() ||
        `${10258 + Math.floor(Math.random() * 89000)}-${now.toString().slice(-4)}`;

      orderInFlightRef.current = true;
      try {
        const newOrder = await ordersService.placeDemoOrder(
          { ...input, idempotencyKey },
          targetService
        );
        lastOrderSigRef.current = { sig, at: Date.now() };
        setOrders((prev) => [newOrder, ...prev.filter((o) => o.id !== newOrder.id)]);
        setOrderStats((prev) => ({
          ...prev,
          totalOrders: prev.totalOrders + 1,
          pendingOrders: prev.pendingOrders + 1,
        }));
        setWallet((prev) => ({
          ...prev,
          balance: Math.max(0, Number((prev.balance - newOrder.charge).toFixed(2))),
          totalSpent: Number((prev.totalSpent + newOrder.charge).toFixed(2)),
        }));
        refreshWalletLedger().catch(() => undefined);
        showToast({
          title: `Order #${newOrder.orderNumber} Placed`,
          description: `${currencySymbol}${newOrder.charge.toFixed(2)} deducted atomically for ${input.quantity.toLocaleString()} units.`,
          tone: 'success',
        });
        return true;
      } catch (error) {
        const msg = error instanceof Error ? error.message : toUserFriendlyFirebaseError(error);
        showToast({
          title: 'Order Failed',
          description: msg,
          tone: 'error',
        });
        return false;
      } finally {
        orderInFlightRef.current = false;
      }
    },
    [
      accountStatus,
      firebaseUser,
      refreshWalletLedger,
      services,
      showToast,
      systemSettings?.currencySymbol,
      wallet.balance,
    ]
  );

  const addDemoFunds = useCallback(
    (_amount: number, _method: string) => {
      navigateProtected('funds');
    },
    [navigateProtected]
  );

  const submitPaymentRequest = useCallback(
    async (input: {
      paymentMethodId: string;
      amount: number;
      transactionId: string;
    }): Promise<boolean> => {
      if (!firebaseUser || accountStatus !== 'active') {
        showToast({
          title: 'Account Restricted',
          description: 'Only active signed-in users can submit payment requests.',
          tone: 'warning',
        });
        return false;
      }
      const currencySymbol = normalizeCurrencySymbol(
        systemSettings?.currencySymbol,
        systemSettings?.currency
      );
      try {
        const created = await walletService.submitPaymentRequest({
          ...input,
          userName: profile?.fullName || firebaseUser.displayName || 'Customer',
        });
        setPaymentRequests((prev) => [created, ...prev]);
        showToast({
          title: 'Payment Request Submitted',
          description: `Request ${created.paymentId} (${currencySymbol}${created.amount.toFixed(
            2
          )}) is now pending admin verification.`,
          tone: 'success',
        });
        return true;
      } catch (error) {
        showToast({
          title: 'Submission Failed',
          description: error instanceof Error ? error.message : toUserFriendlyFirebaseError(error),
          tone: 'error',
        });
        return false;
      }
    },
    [accountStatus, firebaseUser, profile?.fullName, showToast, systemSettings?.currencySymbol]
  );

  const cancelPaymentRequest = useCallback(
    async (paymentId: string) => {
      try {
        await walletService.cancelMyPaymentRequest(paymentId);
        setPaymentRequests((prev) =>
          prev.map((p) => (p.id === paymentId ? { ...p, status: 'cancelled' } : p))
        );
        showToast({
          title: 'Request Cancelled',
          description: 'Your pending deposit request has been cancelled.',
          tone: 'info',
        });
      } catch (error) {
        showToast({
          title: 'Cancel Failed',
          description: error instanceof Error ? error.message : toUserFriendlyFirebaseError(error),
          tone: 'error',
        });
      }
    },
    [showToast]
  );

  const submitDemoTicket = useCallback(
    async (input: CreateTicketInput) => {
      try {
        const created = await supportService.createTicket(input);
        setTickets((prev) => [created, ...prev.filter((t) => t.id !== created.id)]);
        setSelectedTicketId(created.id);
        showToast({
          title: `Ticket ${created.ticketNumber} opened`,
          description: 'Saved to your support queue.',
          tone: 'success',
        });
      } catch (error) {
        showToast({
          title: 'Ticket Submission Failed',
          description: toUserFriendlyFirebaseError(error),
          tone: 'error',
        });
      }
    },
    [showToast]
  );

  const openTicketDetails = useCallback(
    (ticketId: string) => {
      if (!firebaseUser) {
        pendingRedirectRef.current = { type: 'tab', tab: 'support', ticketId };
        setViewModeState('login');
        showToast({
          title: 'Sign in required',
          description: 'Please sign in to view your support tickets.',
          tone: 'info',
        });
        return;
      }
      setSelectedTicketId(ticketId);
      setActiveTab('support');
      setViewModeState('dashboard');
    },
    [firebaseUser, showToast]
  );

  const openSupportForOrder = useCallback(
    (orderNumber: string) => {
      if (!firebaseUser) {
        pendingRedirectRef.current = {
          type: 'tab',
          tab: 'support',
          draftOrderRef: orderNumber,
        };
        setViewModeState('login');
        showToast({
          title: 'Sign in required',
          description: 'Please sign in to open a support ticket.',
          tone: 'info',
        });
        return;
      }
      setSelectedTicketId(null);
      setTicketDraftOrderRef(orderNumber);
      setActiveTab('support');
      setViewModeState('dashboard');
    },
    [firebaseUser, showToast]
  );

  const markNotificationRead = useCallback(async (item: NotificationItem) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === item.id ? { ...n, read: true, isRead: true } : n))
    );
    await walletService.markNotificationRead(item);
  }, []);

  const markAllNotificationsRead = useCallback(async () => {
    setNotifications((prev) => {
      walletService.markAllNotificationsRead(prev).catch(() => undefined);
      return prev.map((n) => ({ ...n, read: true, isRead: true }));
    });
  }, []);

  const handleNotificationClick = useCallback(
    async (item: NotificationItem) => {
      if (!item.read) {
        await markNotificationRead(item);
      }

      const cat = String(item.category || '').toLowerCase();
      if (cat.startsWith('order') || (cat === 'refund' && item.referenceId)) {
        if (item.referenceId) {
          setSelectedOrderId(item.referenceId);
        }
        setActiveTab('order');
        setViewModeState('dashboard');
        return;
      }
      if (cat.startsWith('payment') || cat === 'wallet') {
        setActiveTab('funds');
        setViewModeState('dashboard');
        return;
      }
      if (cat.startsWith('support')) {
        if (item.referenceId) {
          setSelectedTicketId(item.referenceId);
        }
        setActiveTab('support');
        setViewModeState('dashboard');
        return;
      }

      setActiveTab('notifications');
      setViewModeState('dashboard');
    },
    [markNotificationRead]
  );

  return (
    <AppContext.Provider
      value={{
        viewMode,
        setViewMode,
        goToHome,
        navigateProtected,
        requireAuthForOrder,
        orderDraft,
        consumeOrderDraft,
        activeTab,
        setActiveTab,
        authModalMode,
        openAuthModal,
        closeAuthModal,
        selectedPlatform,
        setSelectedPlatform,
        selectPlatformForOrder,
        selectedOrderId,
        setSelectedOrderId,
        openOrderDetails,
        selectedTicketId,
        setSelectedTicketId,
        openTicketDetails,
        ticketDraftOrderRef,
        setTicketDraftOrderRef,
        openSupportForOrder,
        handleNotificationClick,
        platforms,
        services,
        orders,
        orderStats,
        profile,
        accountStatus,
        wallet,
        paymentMethods,
        paymentRequests,
        transactions,
        notifications,
        tickets,
        systemSettings,
        refreshSystemSettings,
        refreshCustomerData,
        refreshWalletLedger,
        dataError,
        isLoading,
        toast,
        dismissToast,
        showToast,
        placeDemoOrder,
        addDemoFunds,
        submitPaymentRequest,
        cancelPaymentRequest,
        submitDemoTicket,
        markNotificationRead,
        markAllNotificationsRead,
        firebaseUser,
        userRole,
        staffRole,
        adminPermissions,
        authReady,
        setupState,
        setupWizardOpen,
        openSetupWizard,
        closeSetupWizard,
        lastInitReport,
        refreshSetupState,
        runDatabaseInitialization,
        signInAdminWithGoogle,
        signOutAdmin,
        registerWithEmail,
        loginWithEmail,
        loginWithGoogle,
        sendPasswordReset,
        updateUserProfile,
        logoutUser,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) {
    throw new Error('useApp must be used inside AppProvider');
  }
  return ctx;
}
