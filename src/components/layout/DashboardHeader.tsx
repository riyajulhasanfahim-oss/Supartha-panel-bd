import React, { useState, useRef, useEffect } from 'react';
import { Bell, ChevronDown, LogOut, Menu, ShieldCheck, User, Globe } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { BrandLogo } from '../common/BrandLogo';

interface DashboardHeaderProps {
  onOpenMobileMenu: () => void;
}

function getNotifPillLabel(category: string): string {
  const norm = category.toLowerCase();
  if (norm.startsWith('order')) return 'Order';
  if (norm === 'refund') return 'Refund';
  if (norm.startsWith('payment') || norm === 'wallet') return 'Payment';
  if (norm.startsWith('support')) return 'Support';
  return 'System';
}

export function DashboardHeader({ onOpenMobileMenu }: DashboardHeaderProps) {
  const {
    firebaseUser,
    userRole,
    accountStatus,
    profile,
    notifications,
    handleNotificationClick,
    markAllNotificationsRead,
    setActiveTab,
    setViewMode,
    openAuthModal,
    logoutUser,
  } = useApp();

  const [notifOpen, setNotifOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  const notifRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter((n) => !n.read).length;

  useEffect(() => {
    function handleOutsideClick(e: Event) {
      const target = e.target as Node | null;
      if (notifRef.current && target && !notifRef.current.contains(target)) {
        setNotifOpen(false);
      }
      if (profileRef.current && target && !profileRef.current.contains(target)) {
        setProfileOpen(false);
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setNotifOpen(false);
        setProfileOpen(false);
      }
    }
    document.addEventListener('pointerdown', handleOutsideClick);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handleOutsideClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  return (
    <header className="sticky top-0 z-30 h-14 border-b border-violet-100/80 bg-white/95 backdrop-blur-md">
      <div className="mx-auto flex h-full max-w-7xl items-center justify-between gap-3 px-3 sm:px-6 lg:px-8">
        <div className="flex items-center gap-2 min-w-0">
          <button
            type="button"
            onClick={onOpenMobileMenu}
            aria-label="Open navigation menu"
            className="inline-flex h-11 w-11 items-center justify-center rounded-xl text-slate-700 hover:bg-violet-50 lg:hidden"
          >
            <Menu className="h-5 w-5" />
          </button>

          <div className="lg:hidden">
            <BrandLogo showTagline size="sm" onClick={() => setActiveTab('home')} />
          </div>

          <div className="hidden lg:flex items-center gap-2 text-sm text-slate-500">
            <span className="font-semibold text-slate-900">
              {firebaseUser ? 'Customer Workspace' : 'Home'}
            </span>
            <span aria-hidden="true">·</span>
            <span>
              {firebaseUser ? 'Customer Account' : 'Browse Services'}
            </span>
          </div>
        </div>

        {!firebaseUser ? (
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => openAuthModal('login')}
              className="inline-flex h-9 items-center justify-center rounded-xl border border-slate-200 bg-white px-3.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 whitespace-nowrap"
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => openAuthModal('register')}
              className="inline-flex h-9 items-center justify-center rounded-xl bg-gradient-to-r from-violet-700 to-purple-600 px-3.5 text-xs font-bold text-white shadow-xs transition-colors hover:from-violet-800 hover:to-purple-700 whitespace-nowrap"
            >
              Register
            </button>
          </div>
        ) : (
        <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
          {userRole === 'admin' && accountStatus === 'active' && (
            <button
              type="button"
              onClick={() => setViewMode('admin')}
              className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-violet-700 px-3 text-xs font-bold text-white shadow-xs transition-colors hover:bg-violet-800 whitespace-nowrap"
            >
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Admin Panel</span>
            </button>
          )}
          {/* Notification Menu */}
          <div className="relative" ref={notifRef}>
            <button
              type="button"
              onClick={() => {
                setNotifOpen((v) => !v);
                setProfileOpen(false);
              }}
              aria-label="Notifications"
              aria-expanded={notifOpen}
              className="relative inline-flex h-11 w-11 items-center justify-center rounded-xl text-slate-700 transition-colors hover:bg-violet-50"
            >
              <Bell className="h-5 w-5" />
              {unreadCount > 0 && (
                <span className="absolute top-1.5 right-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-bold text-white tabular-nums">
                  {unreadCount}
                </span>
              )}
            </button>

            {notifOpen && (
              <div
                role="dialog"
                aria-label="Notifications panel"
                className="fixed inset-x-3 top-[3.85rem] z-50 mx-auto flex max-h-[min(28rem,calc(100dvh-5.5rem))] max-w-md flex-col overflow-hidden rounded-2xl border border-violet-100 bg-white p-3.5 shadow-2xl shadow-violet-950/15 ring-1 ring-slate-900/5 sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mx-0 sm:mt-2 sm:w-96 sm:max-w-[calc(100vw-2rem)]"
              >
                <div className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-display text-sm font-bold text-slate-900">
                      Notifications
                    </span>
                    {unreadCount > 0 && (
                      <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-violet-100 px-1.5 text-[11px] font-bold text-violet-700 tabular-nums">
                        {unreadCount}
                      </span>
                    )}
                  </div>
                  {unreadCount > 0 && (
                    <button
                      type="button"
                      onClick={markAllNotificationsRead}
                      className="shrink-0 text-xs font-semibold text-violet-700 hover:text-violet-800"
                    >
                      Mark all read
                    </button>
                  )}
                </div>

                <div className="mt-2 min-h-0 flex-1 space-y-1.5 overflow-y-auto overscroll-contain pr-0.5">
                  {notifications.length === 0 ? (
                    <p className="py-6 text-center text-xs text-slate-500">
                      You have no notifications yet.
                    </p>
                  ) : (
                    notifications.slice(0, 8).map((item) => {
                      const catLabel = getNotifPillLabel(item.category);
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => {
                            setNotifOpen(false);
                            handleNotificationClick(item).catch(() => undefined);
                          }}
                          className={`w-full rounded-xl p-2.5 text-left transition-colors ${
                            item.read
                              ? 'bg-white hover:bg-slate-50'
                              : 'bg-violet-50/80 hover:bg-violet-100/60'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5 min-w-0">
                              {!item.read && (
                                <span
                                  className="h-2 w-2 rounded-full bg-violet-600 shrink-0"
                                  aria-hidden="true"
                                />
                              )}
                              <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-slate-600 shrink-0">
                                {catLabel}
                              </span>
                              <p className="text-xs font-semibold text-slate-900 truncate">
                                {item.title}
                              </p>
                            </div>
                            <span className="text-[11px] text-slate-400 whitespace-nowrap shrink-0">
                              {item.timeLabel}
                            </span>
                          </div>
                          <p className="mt-1 text-xs text-slate-600 leading-relaxed line-clamp-2 break-words">
                            {item.message}
                          </p>
                        </button>
                      );
                    })
                  )}
                </div>

                <div className="mt-2.5 shrink-0 border-t border-slate-100 pt-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      setNotifOpen(false);
                      setActiveTab('notifications');
                    }}
                    className="w-full rounded-xl bg-violet-50 py-2 text-center text-xs font-bold text-violet-700 hover:bg-violet-100 transition-colors"
                  >
                    View All Notifications
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Profile Menu */}
          <div className="relative" ref={profileRef}>
            <button
              type="button"
              onClick={() => {
                setProfileOpen((v) => !v);
                setNotifOpen(false);
              }}
              aria-expanded={profileOpen}
              className="inline-flex h-11 items-center gap-2 rounded-full border border-violet-100 bg-violet-50/60 pl-1.5 pr-2.5 transition-colors hover:bg-violet-100/70"
            >
              {profile?.photoUrl ? (
                <img
                  src={profile.photoUrl}
                  alt={profile.fullName}
                  referrerPolicy="no-referrer"
                  className="h-8 w-8 rounded-full object-cover"
                />
              ) : (
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-violet-700 to-indigo-600 text-xs font-bold text-white">
                  {profile?.avatarInitials ?? 'US'}
                </span>
              )}
              <span className="hidden sm:inline text-xs font-semibold text-slate-800 max-w-28 truncate">
                {profile?.fullName ?? 'Account'}
              </span>
              <ChevronDown className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />
            </button>

            {profileOpen && (
              <div className="absolute right-0 mt-2 w-56 rounded-2xl border border-violet-100 bg-white p-2 shadow-xl shadow-violet-950/10">
                <div className="px-3 py-2 border-b border-slate-100">
                  <p className="text-sm font-semibold text-slate-900 truncate">
                    {profile?.fullName}
                  </p>
                  <p className="text-xs text-slate-500 truncate">{profile?.email}</p>
                </div>
                <div className="mt-1 space-y-0.5">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('profile');
                      setProfileOpen(false);
                    }}
                    className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-xs font-medium text-slate-700 hover:bg-violet-50 hover:text-violet-800"
                  >
                    <User className="h-4 w-4" />
                    Account Profile
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setProfileOpen(false);
                      setActiveTab('home');
                    }}
                    className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-xs font-medium text-slate-700 hover:bg-violet-50 hover:text-violet-800"
                  >
                    <Globe className="h-4 w-4" />
                    Home Page
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      setProfileOpen(false);
                      await logoutUser();
                    }}
                    className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-xs font-medium text-rose-600 hover:bg-rose-50"
                  >
                    <LogOut className="h-4 w-4" />
                    Sign Out
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
        )}
      </div>
    </header>
  );
}
