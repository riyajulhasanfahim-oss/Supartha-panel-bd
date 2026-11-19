import React from 'react';
import { ShieldCheck, Mail, MessageCircle, ExternalLink } from 'lucide-react';
import { APP_CONFIG, resolveBrandName } from '../../config/app.config';
import { PUBLIC_NAV_LINKS } from '../../config/navigation.config';
import { useApp } from '../../context/AppContext';
import { BrandLogo } from '../common/BrandLogo';

export function PublicFooter() {
  const { openAuthModal, navigateProtected, systemSettings } = useApp();

  const brandName = resolveBrandName(systemSettings?.websiteName);
  const brandDesc =
    systemSettings?.websiteDescription?.trim() ||
    `${brandName} is a structured social media marketing panel built for creators, digital agencies, and independent resellers seeking transparent pricing and reliable order delivery.`;
  const supportEmail = systemSettings?.supportEmail?.trim() || APP_CONFIG.supportEmail;
  const supportWhatsapp = systemSettings?.supportWhatsapp?.trim() || '';
  const supportHours = systemSettings?.supportHours?.trim() || APP_CONFIG.supportHours;
  const currencyCode = systemSettings?.currency?.trim() || APP_CONFIG.currencyCode;
  const footerText = systemSettings?.footerText?.trim() || 'All rights reserved.';
  const socialLinks = systemSettings?.socialLinks;

  const activeSocials = [
    { label: 'Facebook', url: socialLinks?.facebook?.trim() },
    { label: 'Telegram', url: socialLinks?.telegram?.trim() },
    { label: 'YouTube', url: socialLinks?.youtube?.trim() },
    { label: 'Instagram', url: socialLinks?.instagram?.trim() },
  ].filter((item): item is { label: string; url: string } =>
    Boolean(item.url && /^https?:\/\//i.test(item.url))
  );

  return (
    <footer className="border-t border-violet-100 bg-white">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-10 md:grid-cols-4">
          <div className="md:col-span-2">
            <BrandLogo showTagline />
            <p className="mt-4 max-w-md text-sm leading-relaxed text-slate-600">{brandDesc}</p>
            <div className="mt-5 inline-flex items-center gap-2 text-xs font-medium text-emerald-700">
              <ShieldCheck className="h-4 w-4 text-emerald-600" aria-hidden="true" />
              <span>100% Encrypted Checkout &amp; Account Protection</span>
            </div>

            {activeSocials.length > 0 && (
              <div className="mt-4 flex flex-wrap items-center gap-3">
                {activeSocials.map((social) => (
                  <a
                    key={social.label}
                    href={social.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-semibold text-violet-700 hover:underline"
                  >
                    <span>{social.label}</span>
                    <ExternalLink className="h-3 w-3" aria-hidden="true" />
                  </a>
                ))}
              </div>
            )}
          </div>

          <div>
            <h3 className="font-display text-sm font-bold text-slate-900">Navigation</h3>
            <ul className="mt-4 space-y-2.5 text-sm text-slate-600">
              {PUBLIC_NAV_LINKS.map((link) => (
                <li key={link.href}>
                  <a href={link.href} className="transition-colors hover:text-violet-700">
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="font-display text-sm font-bold text-slate-900">Customer Access</h3>
            <ul className="mt-4 space-y-2.5 text-sm text-slate-600">
              <li>
                <button
                  type="button"
                  onClick={() => openAuthModal('register')}
                  className="transition-colors hover:text-violet-700"
                >
                  Create Account
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => openAuthModal('login')}
                  className="transition-colors hover:text-violet-700"
                >
                  Customer Sign In
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => navigateProtected('home')}
                  className="transition-colors hover:text-violet-700"
                >
                  Customer Dashboard
                </button>
              </li>
              <li className="flex items-center gap-1.5 pt-1 text-slate-500">
                <Mail className="h-4 w-4 shrink-0 text-violet-600" aria-hidden="true" />
                <span className="truncate">{supportEmail}</span>
              </li>
              {supportWhatsapp && (
                <li className="flex items-center gap-1.5 text-slate-500">
                  <MessageCircle className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
                  <span className="truncate">{supportWhatsapp}</span>
                </li>
              )}
            </ul>
          </div>
        </div>

        <div className="mt-10 flex flex-col items-start justify-between gap-4 border-t border-slate-100 pt-6 text-xs text-slate-500 sm:flex-row sm:items-center">
          <p>
            &copy; {new Date().getFullYear()} {brandName}. {footerText}
          </p>
          <div className="flex items-center gap-4">
            <span>
              {supportHours} · Currency: {currencyCode}
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
