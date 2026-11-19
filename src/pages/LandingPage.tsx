import React, { useState } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  Clock,
  ShieldCheck,
  TrendingUp,
  Zap,
  Layers,
} from 'lucide-react';
import {
  APP_CONFIG,
  resolveBrandLogoUrl,
  resolveBrandName,
} from '../config/app.config';
import {
  HOW_IT_WORKS_STEPS,
  LANDING_FEATURES,
  WHY_CHOOSE_US_ITEMS,
} from '../data/mockLanding';
import { useApp } from '../context/AppContext';
import { PublicNavbar } from '../components/layout/PublicNavbar';
import { PublicFooter } from '../components/layout/PublicFooter';
import { LandingShowcaseSlider } from '../components/landing/LandingShowcaseSlider';
import { PlatformIcon } from '../components/common/PlatformIcon';
import { normalizeCurrencySymbol } from '../utils/pricing';

const DEFAULT_LANDING_FAQS = [
  {
    id: 'faq-1',
    question: 'How fast do orders begin processing?',
    answer:
      'Most active services start within seconds after placement, with real-time progress counters tracked inside your dashboard.',
  },
  {
    id: 'faq-2',
    question: 'What happens if an order is cancelled or fails?',
    answer:
      'Failed or cancelled orders are automatically eligible for atomic wallet refund back to your account balance.',
  },
  {
    id: 'faq-3',
    question: 'How can I add balance to my wallet?',
    answer:
      'Open Add Funds in your customer dashboard, choose your preferred local payment method, and submit your TrxID for verification.',
  },
];

export function LandingPage() {
  const { platforms, openAuthModal, navigateProtected, selectPlatformForOrder, systemSettings } =
    useApp();
  const [openFaqId, setOpenFaqId] = useState<string | null>(DEFAULT_LANDING_FAQS[0].id);

  const brandName = resolveBrandName(systemSettings?.websiteName);
  const logoUrl = resolveBrandLogoUrl(systemSettings?.logo);
  const currencyCode = systemSettings?.currency?.trim() || APP_CONFIG.currencyCode;
  const currencySymbol = normalizeCurrencySymbol(systemSettings?.currencySymbol, currencyCode);

  const heroSubtitle =
    systemSettings?.heroSubtitle?.trim() || 'All-in-One Social Media Growth Platform';
  const heroTitleRaw =
    systemSettings?.heroTitle?.trim() || 'Grow Your Social Presence Faster & Smarter';
  const heroWords = heroTitleRaw.split(' ');
  const heroLead =
    heroWords.length > 3 ? heroWords.slice(0, -2).join(' ') : 'Grow Your Social Presence';
  const heroAccent =
    heroWords.length > 3 ? heroWords.slice(-2).join(' ') : 'Faster & Smarter';
  const heroDescription =
    systemSettings?.heroDescription?.trim() ||
    `${brandName} gives creators, brands, and resellers direct access to reliable Instagram, YouTube, Facebook, TikTok, Telegram, and X growth services in one mobile-first panel.`;
  const heroCtaLabel = systemSettings?.heroCtaLabel?.trim() || 'Get Started';

  const featuresList =
    systemSettings?.landingFeatures && systemSettings.landingFeatures.length > 0
      ? systemSettings.landingFeatures
      : LANDING_FEATURES;
  const howItWorksList =
    systemSettings?.howItWorks && systemSettings.howItWorks.length > 0
      ? systemSettings.howItWorks
      : HOW_IT_WORKS_STEPS;
  const faqList =
    systemSettings?.landingFaqs && systemSettings.landingFaqs.length > 0
      ? systemSettings.landingFaqs
      : DEFAULT_LANDING_FAQS;

  const aboutTitle = systemSettings?.aboutTitle?.trim();
  const aboutDescription = systemSettings?.aboutDescription?.trim();

  const handleServicePreview = (platformId: (typeof platforms)[number]['id']) => {
    selectPlatformForOrder(platformId);
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#F6F5FB] text-slate-900">
      <PublicNavbar />

      <main className="flex-1">
        {/* Hero Section */}
        <section className="relative overflow-hidden bg-gradient-to-b from-white via-violet-50/40 to-[#F6F5FB] pt-10 pb-16 sm:pt-16 sm:pb-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid items-stretch gap-10 lg:grid-cols-12 lg:gap-12">
              <div className="flex flex-col justify-center lg:col-span-7">
                <p className="text-xs sm:text-sm font-semibold tracking-wide text-violet-700">
                  {heroSubtitle}
                </p>
                <h1 className="mt-3 font-display text-4xl sm:text-5xl lg:text-[54px] font-extrabold tracking-tight text-slate-950 leading-[1.1] text-balance">
                  {heroLead} <span className="text-violet-700">{heroAccent}</span>
                </h1>
                <p className="mt-5 max-w-xl text-base sm:text-lg leading-relaxed text-slate-600">
                  {heroDescription}
                </p>

                <div className="mt-8 flex flex-wrap items-center gap-3.5">
                  <button
                    type="button"
                    onClick={() => openAuthModal('register')}
                    className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-700 to-purple-600 px-6 text-sm font-bold text-white shadow-lg shadow-violet-700/25 transition-transform duration-150 hover:from-violet-800 hover:to-purple-700 active:scale-[0.98] whitespace-nowrap"
                  >
                    <span>{heroCtaLabel}</span>
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() => openAuthModal('login')}
                    className="inline-flex h-12 items-center justify-center rounded-xl border border-violet-200 bg-white px-6 text-sm font-bold text-violet-900 transition-colors hover:bg-violet-50 whitespace-nowrap"
                  >
                    Login
                  </button>
                </div>

                {/* Claim-to-Proof Metrics */}
                <div className="mt-10 grid grid-cols-3 gap-4 border-t border-violet-200/70 pt-6 sm:max-w-lg">
                  <div>
                    <p className="font-display text-xl sm:text-2xl font-extrabold text-slate-950 tabular-nums">
                      180+
                    </p>
                    <p className="mt-0.5 text-xs text-slate-600">Curated Services</p>
                  </div>
                  <div>
                    <p className="font-display text-xl sm:text-2xl font-extrabold text-slate-950 tabular-nums">
                      &lt; 30s
                    </p>
                    <p className="mt-0.5 text-xs text-slate-600">Average Order Start</p>
                  </div>
                  <div>
                    <p className="font-display text-xl sm:text-2xl font-extrabold text-slate-950 tabular-nums">
                      24/7
                    </p>
                    <p className="mt-0.5 text-xs text-slate-600">Support Coverage</p>
                  </div>
                </div>
              </div>

              {/* Interactive Product Preview Card */}
              <div className="lg:col-span-5 flex items-center">
                <div className="w-full rounded-3xl border border-violet-100 bg-white p-5 sm:p-6 shadow-xl shadow-violet-950/10">
                  <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <img
                        src={logoUrl}
                        alt={brandName}
                        className="h-11 w-11 shrink-0 rounded-full object-cover bg-slate-950 ring-1 ring-sky-400/50 shadow-sm shadow-sky-500/20"
                      />
                      <div className="min-w-0">
                        <p className="truncate text-xs font-semibold text-violet-700">
                          {brandName}
                        </p>
                        <p className="truncate font-display text-lg font-bold text-slate-900">
                          Customer Dashboard
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => navigateProtected('home')}
                      className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-violet-50 px-3.5 text-xs font-bold text-violet-800 hover:bg-violet-100 whitespace-nowrap"
                    >
                      <span>Open Dashboard</span>
                      <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  </div>

                  <div className="mt-4 rounded-2xl bg-gradient-to-br from-[#230C5E] to-[#6D28D9] p-4 text-white">
                    <p className="text-xs text-violet-200">Wallet Overview</p>
                    <div className="mt-1 flex items-baseline justify-between">
                      <span className="font-display text-2xl font-extrabold tabular-nums">
                        {currencySymbol} 1,250
                      </span>
                      <span className="text-xs font-medium text-amber-300">
                        Instant {currencyCode} Top-Up
                      </span>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-3 gap-2.5">
                    <div className="rounded-xl bg-[#EEF2FF] p-3 text-center">
                      <p className="text-[11px] font-medium text-slate-600">Orders</p>
                      <p className="mt-0.5 font-display text-lg font-bold text-slate-900 tabular-nums">
                        128
                      </p>
                    </div>
                    <div className="rounded-xl bg-[#ECFDF5] p-3 text-center">
                      <p className="text-[11px] font-medium text-slate-600">Done</p>
                      <p className="mt-0.5 font-display text-lg font-bold text-emerald-700 tabular-nums">
                        112
                      </p>
                    </div>
                    <div className="rounded-xl bg-[#FFF7ED] p-3 text-center">
                      <p className="text-[11px] font-medium text-slate-600">Pending</p>
                      <p className="mt-0.5 font-display text-lg font-bold text-amber-800 tabular-nums">
                        16
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 space-y-2 border-t border-slate-100 pt-4">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-slate-700">Instagram Followers HQ</span>
                      <span className="font-mono font-semibold text-violet-700 tabular-nums">
                        {currencySymbol}35.00 / 1K
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-slate-700">TikTok Video Views</span>
                      <span className="font-mono font-semibold text-violet-700 tabular-nums">
                        {currencySymbol}8.00 / 1K
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-slate-700">YouTube High-Retention</span>
                      <span className="font-mono font-semibold text-violet-700 tabular-nums">
                        {currencySymbol}145.00 / 1K
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Interactive Widescreen Showcase Slider */}
        <LandingShowcaseSlider />

        {/* Popular Services Section */}
        <section id="services" className="py-14 sm:py-20 bg-white border-y border-violet-100/70">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="font-display text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-950">
                  Popular Social Networks
                </h2>
                <p className="mt-2 max-w-2xl text-sm sm:text-base text-slate-600">
                  Select any platform below to inspect live service tiers directly inside the customer panel.
                </p>
              </div>
              <button
                type="button"
                onClick={() => navigateProtected('services')}
                className="inline-flex h-10 items-center gap-1.5 self-start rounded-xl border border-violet-200 bg-violet-50 px-4 text-xs font-bold text-violet-800 hover:bg-violet-100 whitespace-nowrap"
              >
                <span>Explore Full Catalog</span>
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </div>

            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {platforms.map((platform) => (
                <button
                  key={platform.id}
                  type="button"
                  onClick={() => handleServicePreview(platform.id)}
                  className="group flex items-start gap-4 rounded-2xl border border-slate-200/90 bg-white p-5 text-left transition-all duration-150 hover:border-violet-300 hover:shadow-md hover:shadow-violet-950/5"
                >
                  <PlatformIcon platform={platform.id} name={platform.name} icon={platform.icon} size="lg" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="font-display text-base font-bold text-slate-900 group-hover:text-violet-700">
                        {platform.name}
                      </h3>
                      <span className="text-xs font-semibold text-slate-500 tabular-nums whitespace-nowrap">
                        {platform.serviceCount} services
                      </span>
                    </div>
                    <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{platform.description}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section id="features" className="py-14 sm:py-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="max-w-2xl">
              <h2 className="font-display text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-950">
                Built for Speed, Clarity &amp; Reliability
              </h2>
              <p className="mt-2 text-sm sm:text-base text-slate-600">
                Every workflow is tuned so individual creators and high-volume agencies can launch orders without friction.
              </p>
            </div>

            <div className="mt-8 grid gap-5 md:grid-cols-2">
              {featuresList.map((feat) => (
                <article
                  key={feat.id}
                  className="flex flex-col justify-between rounded-2xl border border-violet-100 bg-white p-6 shadow-xs"
                >
                  <div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-mono text-xs font-bold text-violet-700">{feat.index}.</span>
                      <span className="text-xs font-semibold text-emerald-700">{feat.metric}</span>
                    </div>
                    <h3 className="mt-3 font-display text-lg font-bold text-slate-900">{feat.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-slate-600">{feat.description}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* Optional CMS About Section */}
        {(aboutTitle || aboutDescription) && (
          <section className="py-12 bg-violet-50/50 border-t border-violet-100">
            <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 text-center">
              <h2 className="font-display text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-950">
                {aboutTitle || `About ${brandName}`}
              </h2>
              {aboutDescription && (
                <p className="mt-3 text-sm sm:text-base leading-relaxed text-slate-600 max-w-3xl mx-auto">
                  {aboutDescription}
                </p>
              )}
            </div>
          </section>
        )}

        {/* How It Works Section */}
        <section id="how-it-works" className="py-14 sm:py-20 bg-white border-y border-violet-100/70">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="max-w-2xl">
              <h2 className="font-display text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-950">
                How It Works
              </h2>
              <p className="mt-2 text-sm sm:text-base text-slate-600">
                Go from sign-up to live order tracking in four straightforward steps.
              </p>
            </div>

            <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {howItWorksList.map((item) => (
                <div
                  key={item.step}
                  className="rounded-2xl border border-slate-200/80 bg-[#FAF9FE] p-5"
                >
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-violet-700 font-mono text-xs font-bold text-white">
                    {item.step}
                  </span>
                  <h3 className="mt-4 font-display text-base font-bold text-slate-900">{item.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{item.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Why Choose Us Section */}
        <section id="why-us" className="py-14 sm:py-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid gap-10 lg:grid-cols-12 lg:items-center">
              <div className="lg:col-span-5">
                <h2 className="font-display text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-950 text-balance">
                  Why Teams &amp; Creators Choose {brandName}
                </h2>
                <p className="mt-3 text-sm sm:text-base leading-relaxed text-slate-600">
                  Designed cleanly from mobile screens upward, eliminating cluttered legacy tables and confusing pricing layers.
                </p>
                <div className="mt-6 flex flex-wrap gap-4 text-xs font-semibold text-slate-700">
                  <span className="inline-flex items-center gap-1.5">
                    <Zap className="h-4 w-4 text-violet-700" aria-hidden="true" />
                    Instant Order Routing
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <ShieldCheck className="h-4 w-4 text-emerald-600" aria-hidden="true" />
                    Protected Wallet
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <TrendingUp className="h-4 w-4 text-violet-700" aria-hidden="true" />
                    Reseller Ready
                  </span>
                </div>
              </div>

              <div className="lg:col-span-7 grid gap-4 sm:grid-cols-2">
                {WHY_CHOOSE_US_ITEMS.map((item, idx) => {
                  const icons = [
                    <Layers key="l" className="h-5 w-5 text-violet-700" />,
                    <CheckCircle2 key="c" className="h-5 w-5 text-emerald-600" />,
                    <Clock key="t" className="h-5 w-5 text-amber-600" />,
                    <ShieldCheck key="s" className="h-5 w-5 text-violet-700" />,
                  ];
                  return (
                    <div
                      key={item.id}
                      className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs"
                    >
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-50">
                        {icons[idx % icons.length]}
                      </div>
                      <h3 className="mt-3.5 font-display text-base font-bold text-slate-900">
                        {item.title}
                      </h3>
                      <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
                        {item.id === 'why-1'
                          ? `Built natively around ${currencyCode} (${currencySymbol}) pricing and straightforward wallet top-ups without confusing exchange math.`
                          : item.description}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        {/* Frequently Asked Questions */}
        {faqList.length > 0 && (
          <section id="faq" className="py-12 sm:py-16 bg-white border-t border-violet-100/70">
            <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
              <div className="text-center max-w-2xl mx-auto">
                <h2 className="font-display text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-950">
                  Frequently Asked Questions
                </h2>
                <p className="mt-2 text-sm text-slate-600">
                  Quick answers about orders, wallet deposits, and account safety.
                </p>
              </div>
              <div className="mt-8 space-y-3">
                {faqList.map((faq) => {
                  const isOpen = openFaqId === faq.id;
                  return (
                    <div
                      key={faq.id}
                      className="rounded-2xl border border-slate-200/90 bg-[#FAF9FE] overflow-hidden"
                    >
                      <button
                        type="button"
                        onClick={() => setOpenFaqId(isOpen ? null : faq.id)}
                        aria-expanded={isOpen}
                        className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left font-display text-sm sm:text-base font-bold text-slate-900"
                      >
                        <span>{faq.question}</span>
                        <ChevronDown
                          className={`h-4 w-4 shrink-0 text-violet-700 transition-transform ${
                            isOpen ? 'rotate-180' : ''
                          }`}
                        />
                      </button>
                      {isOpen && (
                        <div className="px-5 pb-4 text-sm leading-relaxed text-slate-600 border-t border-slate-200/60 pt-3">
                          {faq.answer}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        )}

        {/* Bottom CTA Section */}
        <section className="py-12 sm:py-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#1C0B4E] via-[#3A1288] to-[#6D28D9] px-6 py-10 sm:px-12 sm:py-14 text-white shadow-xl shadow-violet-950/20">
              <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                <div className="max-w-2xl">
                  <h2 className="font-display text-2xl sm:text-3xl font-extrabold tracking-tight text-balance">
                    Ready to Launch Your Next Social Campaign?
                  </h2>
                  <p className="mt-2 text-sm sm:text-base text-violet-100">
                    Open your customer workspace in seconds or explore services on {brandName}.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3 shrink-0">
                  <button
                    type="button"
                    onClick={() => openAuthModal('register')}
                    className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-amber-400 px-6 text-sm font-bold text-slate-950 shadow-md transition-colors hover:bg-amber-300 whitespace-nowrap"
                  >
                    <span>Get Started</span>
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() => navigateProtected('home')}
                    className="inline-flex h-12 items-center justify-center rounded-xl border border-white/25 bg-white/10 px-6 text-sm font-bold text-white backdrop-blur-xs transition-colors hover:bg-white/20 whitespace-nowrap"
                  >
                    Open Dashboard
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}
