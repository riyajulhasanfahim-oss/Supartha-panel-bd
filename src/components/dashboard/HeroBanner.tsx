import React, { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { useApp } from '../../context/AppContext';

interface HeroSlide {
  id: string;
  headlineTop: string;
  headlineAccent: string;
  subtitle: string;
  ctaLabel: string;
  targetTab: 'services' | 'funds' | 'home';
}

const HERO_SLIDES: HeroSlide[] = [
  {
    id: 'slide-1',
    headlineTop: 'Grow Your',
    headlineAccent: 'Social Media',
    subtitle: 'Faster • Cheaper • More Reliable',
    ctaLabel: 'Browse Services',
    targetTab: 'services',
  },
  {
    id: 'slide-2',
    headlineTop: 'Scale Client',
    headlineAccent: 'Campaigns',
    subtitle: 'Automated Delivery • 30-Day Refill Protection',
    ctaLabel: 'Start New Order',
    targetTab: 'home',
  },
  {
    id: 'slide-3',
    headlineTop: 'Instant Wallet',
    headlineAccent: 'Top-Ups',
    subtitle: 'Local BDT Rates • Zero Hidden Fees',
    ctaLabel: 'Add Funds',
    targetTab: 'funds',
  },
];

export function HeroBanner() {
  const { setActiveTab, systemSettings } = useApp();
  const [activeIndex, setActiveIndex] = useState(0);

  const primaryTitle = (systemSettings?.heroTitle ?? '').trim() || 'Grow Your Social Media';
  const titleWords = primaryTitle.split(' ');
  const headlineTop =
    titleWords.length > 2 ? titleWords.slice(0, -2).join(' ') : titleWords[0] ?? 'Grow Your';
  const headlineAccent =
    titleWords.length > 2
      ? titleWords.slice(-2).join(' ')
      : titleWords.slice(1).join(' ') || 'Social Media';

  const slides: HeroSlide[] = [
    {
      id: 'slide-1',
      headlineTop,
      headlineAccent,
      subtitle: (systemSettings?.heroSubtitle ?? '').trim() || 'Faster • Cheaper • More Reliable',
      ctaLabel: (systemSettings?.heroCtaLabel ?? '').trim() || 'Browse Services',
      targetTab: 'services',
    },
    ...HERO_SLIDES.slice(1),
  ];

  const current = slides[activeIndex] ?? slides[0];
  const primaryColor = systemSettings?.themeColor?.trim();
  const secondaryColor = systemSettings?.secondaryColor?.trim();
  const customGradientStyle =
    primaryColor && primaryColor !== '#6D28D9'
      ? {
          backgroundImage: `linear-gradient(135deg, #1C0B4E 0%, ${primaryColor} 58%, ${
            secondaryColor || '#4F46E5'
          } 100%)`,
        }
      : undefined;

  const handleCta = () => {
    if (current.targetTab === 'home') {
      const el = document.getElementById('new-order-card');
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    setActiveTab(current.targetTab);
  };

  return (
    <section
      aria-label="Featured announcement"
      style={customGradientStyle}
      className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#1C0B4E] via-[#3A1288] to-[#5E24D6] p-5 sm:p-7 text-white shadow-lg shadow-violet-950/15"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-16 -right-12 h-56 w-56 rounded-full bg-fuchsia-500/20 blur-2xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-20 left-1/3 h-48 w-48 rounded-full bg-indigo-400/20 blur-2xl"
      />

      <div className="relative z-10 grid items-center gap-5 sm:grid-cols-12">
        <div className="sm:col-span-7">
          <h1 className="font-display text-2xl sm:text-3xl lg:text-4xl font-extrabold leading-tight tracking-tight text-balance">
            {current.headlineTop}{' '}
            <span className="text-amber-300">{current.headlineAccent}</span>
          </h1>
          <p className="mt-2 text-xs sm:text-sm font-medium text-violet-100/95">
            {current.subtitle}
          </p>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleCta}
              className="inline-flex h-10 items-center gap-2 rounded-full bg-amber-400 px-5 text-xs sm:text-sm font-bold text-slate-950 shadow-md shadow-amber-400/25 transition-transform duration-150 hover:bg-amber-300 active:scale-[0.98] whitespace-nowrap"
            >
              <span>{current.ctaLabel}</span>
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Clean Vector Growth Graphic */}
        <div className="hidden sm:flex sm:col-span-5 justify-end">
          <div className="relative flex h-36 w-full max-w-[230px] items-center justify-center rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur-xs">
            <svg viewBox="0 0 220 130" fill="none" className="h-full w-full" aria-hidden="true">
              {/* Rising analytics bars */}
              <rect x="18" y="88" width="18" height="28" rx="4" fill="#A78BFA" fillOpacity="0.45" />
              <rect x="44" y="72" width="18" height="44" rx="4" fill="#A78BFA" fillOpacity="0.65" />
              <rect x="70" y="54" width="18" height="62" rx="4" fill="#C4B5FD" fillOpacity="0.85" />
              <rect x="96" y="34" width="18" height="82" rx="4" fill="#DDD6FE" />

              {/* Growth arrow */}
              <path
                d="M16 94C58 84 94 56 142 22"
                stroke="#FACC15"
                strokeWidth="3.5"
                strokeLinecap="round"
              />
              <path
                d="M132 20H145V33"
                stroke="#FACC15"
                strokeWidth="3.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              {/* Platform Badges */}
              <rect x="148" y="24" width="32" height="32" rx="9" fill="#E1306C" />
              <circle cx="164" cy="40" r="7" stroke="white" strokeWidth="2" />
              <rect x="176" y="64" width="30" height="30" rx="9" fill="#FF0000" />
              <path d="M188 74L198 79L188 84V74Z" fill="white" />
              <rect x="132" y="78" width="30" height="30" rx="9" fill="#1877F2" />
              <path d="M148 100V92H151L151.6 88.5H148V86.8C148 85.8 148.4 85 149.8 85H151.8V82C151 81.9 149.8 81.8 148.7 81.8C145.9 81.8 144.3 83.4 144.3 86.4V88.5H141.5V92H144.3V100H148Z" fill="white" />
            </svg>
          </div>
        </div>
      </div>

      {/* Carousel Indicators */}
      <div className="relative z-10 mt-4 flex items-center justify-center gap-2 sm:justify-start">
        {HERO_SLIDES.map((slide, idx) => {
          const isCurrent = idx === activeIndex;
          return (
            <button
              key={slide.id}
              type="button"
              onClick={() => setActiveIndex(idx)}
              aria-label={`View slide ${idx + 1}`}
              aria-current={isCurrent ? 'true' : undefined}
              className={`h-2 rounded-full transition-all duration-150 ${
                isCurrent ? 'w-6 bg-white' : 'w-2 bg-white/40 hover:bg-white/70'
              }`}
            />
          );
        })}
      </div>
    </section>
  );
}
