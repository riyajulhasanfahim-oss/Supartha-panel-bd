import React, { useState } from 'react';
import { Menu, X } from 'lucide-react';
import { PUBLIC_NAV_LINKS } from '../../config/navigation.config';
import { useApp } from '../../context/AppContext';
import { BrandLogo } from '../common/BrandLogo';

export function PublicNavbar() {
  const { firebaseUser, setViewMode, navigateProtected } = useApp();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handlePrimaryAction = () => {
    if (firebaseUser) {
      navigateProtected('home');
      return;
    }
    setViewMode('login');
  };

  return (
    <header className="sticky top-0 z-40 border-b border-violet-100/80 bg-white/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-8 px-4 sm:px-6 lg:px-8">
        <BrandLogo onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} />

        <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-600" aria-label="Primary">
          {PUBLIC_NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="whitespace-nowrap shrink-0 transition-colors hover:text-violet-700"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={handlePrimaryAction}
            className="hidden sm:inline-flex h-10 items-center justify-center rounded-xl bg-violet-700 px-4 text-sm font-semibold text-white shadow-sm shadow-violet-700/20 transition-colors hover:bg-violet-800 whitespace-nowrap shrink-0"
          >
            {firebaseUser ? 'Open Dashboard' : 'Customer Login'}
          </button>
          <button
            type="button"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
            className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 text-slate-700 hover:bg-violet-50 md:hidden"
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {mobileMenuOpen && (
        <div className="border-t border-violet-100 bg-white px-4 py-4 md:hidden">
          <nav className="flex flex-col gap-1" aria-label="Mobile navigation">
            {PUBLIC_NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setMobileMenuOpen(false)}
                className="flex h-11 items-center rounded-xl px-3 text-sm font-medium text-slate-700 hover:bg-violet-50 hover:text-violet-700"
              >
                {link.label}
              </a>
            ))}
            <div className="mt-3 grid grid-cols-2 gap-2 pt-2 border-t border-slate-100">
              {firebaseUser ? (
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    handlePrimaryAction();
                  }}
                  className="col-span-2 flex h-11 items-center justify-center rounded-xl bg-violet-700 text-sm font-semibold text-white"
                >
                  Open Dashboard
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setMobileMenuOpen(false);
                      setViewMode('login');
                    }}
                    className="flex h-11 items-center justify-center rounded-xl border border-violet-200 bg-violet-50 text-sm font-semibold text-violet-800"
                  >
                    Login
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMobileMenuOpen(false);
                      setViewMode('register');
                    }}
                    className="flex h-11 items-center justify-center rounded-xl bg-violet-700 text-sm font-semibold text-white"
                  >
                    Get Started
                  </button>
                </>
              )}
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
