import React, { useEffect, useRef, useState } from 'react';
import { ArrowRight, ChevronLeft, ChevronRight, Layers } from 'lucide-react';
import { resolveBrandLogoUrl, resolveBrandName } from '../../config/app.config';
import { useApp } from '../../context/AppContext';
import { SHOWCASE_SLIDES, type ShowcaseTargetAction } from '../../data/showcaseSlides';

export function LandingShowcaseSlider() {
  const { systemSettings, openAuthModal, navigateProtected } = useApp();
  const brandName = resolveBrandName(systemSettings?.websiteName);
  const logoUrl = resolveBrandLogoUrl(systemSettings?.logo);

  const [activeIndex, setActiveIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [brokenSlides, setBrokenSlides] = useState<Record<string, boolean>>({});
  const touchStartX = useRef<number | null>(null);
  const didSwipeRef = useRef(false);

  const totalSlides = SHOWCASE_SLIDES.length;

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(media.matches);
    const onChange = (event: MediaQueryListEvent) => setReducedMotion(event.matches);
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    if (paused || reducedMotion || totalSlides <= 1) return;
    const timer = window.setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % totalSlides);
    }, 5200);
    return () => window.clearInterval(timer);
  }, [paused, reducedMotion, totalSlides]);

  const goPrev = () => {
    setActiveIndex((prev) => (prev - 1 + totalSlides) % totalSlides);
  };

  const goNext = () => {
    setActiveIndex((prev) => (prev + 1) % totalSlides);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0]?.clientX ?? null;
    didSwipeRef.current = false;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const currentX = e.touches[0]?.clientX ?? touchStartX.current;
    if (Math.abs(currentX - touchStartX.current) >= 12) {
      didSwipeRef.current = true;
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const endX = e.changedTouches[0]?.clientX ?? touchStartX.current;
    const delta = endX - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(delta) < 36) return;
    didSwipeRef.current = true;
    if (delta > 0) goPrev();
    else goNext();
  };

  const handleSlideAction = (action: ShowcaseTargetAction) => {
    if (action === 'services') {
      navigateProtected('services');
      return;
    }
    if (action === 'funds') {
      navigateProtected('funds');
      return;
    }
    if (action === 'api') {
      navigateProtected('api');
      return;
    }
    openAuthModal('register');
  };

  const currentSlide = SHOWCASE_SLIDES[activeIndex] ?? SHOWCASE_SLIDES[0];

  return (
    <section
      aria-label="Platform highlights showcase"
      className="py-2.5 sm:py-4 bg-[#F6F5FB]"
    >
      <div className="mx-auto max-w-7xl px-3 sm:px-6 lg:px-8">
        {/* Compact Header & Chapter Switcher */}
        <div className="flex flex-col gap-1.5 sm:gap-2.5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center justify-between gap-2 min-w-0">
            <h2 className="font-display text-sm sm:text-xl font-extrabold tracking-tight text-slate-950 text-balance">
              Social Growth Highlights
            </h2>
            <span className="sm:hidden font-mono text-[10px] font-semibold text-slate-500 tabular-nums">
              {String(activeIndex + 1).padStart(2, '0')} / {String(totalSlides).padStart(2, '0')}
            </span>
          </div>

          <div
            role="tablist"
            aria-label="Showcase slides"
            className="flex items-center gap-1 overflow-x-auto rounded-lg sm:rounded-xl border border-slate-200/90 bg-white p-0.5 sm:p-1"
          >
            {SHOWCASE_SLIDES.map((slide, idx) => {
              const isActive = idx === activeIndex;
              return (
                <button
                  key={slide.id}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => setActiveIndex(idx)}
                  className={`h-6 sm:h-7 rounded-md sm:rounded-lg px-2 sm:px-2.5 text-[10px] sm:text-xs font-semibold transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-600 ${
                    isActive
                      ? 'bg-slate-950 text-white shadow-xs'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-950'
                  }`}
                >
                  {slide.tabLabel}
                </button>
              );
            })}
          </div>
        </div>

        {/* Ultra-Compact Mobile-Friendly Slider Frame */}
        <div
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          className="relative mt-2 sm:mt-3 overflow-hidden rounded-xl sm:rounded-2xl border border-slate-200/80 bg-slate-950 shadow-md shadow-violet-950/10"
        >
          <div
            className="flex transition-transform duration-500 ease-out"
            style={{ transform: `translateX(-${activeIndex * 100}%)` }}
          >
            {SHOWCASE_SLIDES.map((slide, idx) => {
              const isBroken = Boolean(brokenSlides[slide.id]);

              if (slide.isArtworkBanner) {
                return (
                  <div
                    key={slide.id}
                    className={`relative flex h-[112px] sm:h-[156px] lg:h-[186px] w-full shrink-0 overflow-hidden ${
                      slide.panelSurfaceClass ?? 'bg-slate-950'
                    }`}
                  >
                    {/* Left Copy & CTA Column */}
                    <div className="flex flex-1 min-w-0 flex-col justify-center px-3 pb-5 pt-2 sm:px-6 sm:py-3 lg:px-8 lg:py-4">
                      <div className="hidden sm:flex items-center gap-2 text-[11px] font-medium text-slate-300 truncate">
                        <img
                          src={logoUrl}
                          alt={brandName}
                          className="h-5 w-5 shrink-0 rounded-full object-cover bg-slate-950 ring-1 ring-sky-400/60"
                        />
                        <span className="font-semibold text-amber-300">{brandName}</span>
                        <span aria-hidden="true">·</span>
                        <span className="truncate">{slide.kicker}</span>
                      </div>

                      <h3 className="sm:mt-1.5 line-clamp-2 font-display text-[11px] sm:text-base lg:text-xl font-extrabold tracking-tight text-white leading-tight sm:leading-snug text-balance">
                        {slide.title}
                      </h3>

                      <p className="mt-1 hidden md:line-clamp-1 text-xs text-slate-200/90 max-w-lg">
                        {slide.subtitle}
                      </p>

                      <div className="mt-1.5 sm:mt-2.5 flex items-center gap-2.5">
                        <button
                          type="button"
                          onClick={() => handleSlideAction(slide.targetAction)}
                          className="inline-flex h-6 sm:h-8 items-center gap-1 rounded-md sm:rounded-xl bg-amber-400 px-2.5 sm:px-3.5 text-[10px] sm:text-xs font-bold text-slate-950 shadow-sm transition-colors hover:bg-amber-300 active:scale-[0.98] whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
                        >
                          <span>{slide.ctaLabel}</span>
                          <ArrowRight className="h-2.5 w-2.5 sm:h-3.5 sm:w-3.5" aria-hidden="true" />
                        </button>
                        <div className="hidden lg:flex items-center gap-1.5 text-xs font-semibold text-slate-200">
                          <Layers className="h-3.5 w-3.5 text-amber-300" aria-hidden="true" />
                          <span className="tabular-nums">{slide.metricValue}</span>
                          <span className="text-slate-300 font-medium">{slide.metricLabel}</span>
                        </div>
                      </div>
                    </div>

                    {/* Proportional Uncropped 16:9 Artwork Banner */}
                    <button
                      type="button"
                      onClick={() => {
                        if (didSwipeRef.current) {
                          didSwipeRef.current = false;
                          return;
                        }
                        handleSlideAction(slide.targetAction);
                      }}
                      aria-label={`${slide.title} — ${slide.ctaLabel}`}
                      className="relative aspect-[16/9] h-full shrink-0 overflow-hidden text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
                    >
                      {isBroken ? (
                        <div
                          className={`flex h-full w-full flex-col items-center justify-center bg-gradient-to-br ${slide.fallbackGradient} px-3 text-center text-white`}
                        >
                          <img
                            src={logoUrl}
                            alt={brandName}
                            className="mb-1 h-8 w-8 rounded-full object-cover bg-slate-950 ring-1 ring-sky-400/60"
                          />
                          <p className="font-display text-xs font-extrabold">{brandName}</p>
                        </div>
                      ) : (
                        <img
                          src={slide.imageUrl}
                          alt={slide.title}
                          referrerPolicy="no-referrer"
                          loading={idx === 0 ? 'eager' : 'lazy'}
                          decoding="async"
                          onError={() =>
                            setBrokenSlides((prev) => ({ ...prev, [slide.id]: true }))
                          }
                          className="h-full w-full object-cover object-center"
                        />
                      )}
                    </button>
                  </div>
                );
              }

              return (
                <div
                  key={slide.id}
                  className="relative flex h-[112px] sm:h-[156px] lg:h-[186px] w-full shrink-0 items-center overflow-hidden"
                >
                  {isBroken ? (
                    <div
                      className={`absolute inset-0 bg-gradient-to-br ${slide.fallbackGradient}`}
                    />
                  ) : (
                    <img
                      src={slide.imageUrl}
                      alt={slide.title}
                      referrerPolicy="no-referrer"
                      loading={idx === 0 ? 'eager' : 'lazy'}
                      decoding="async"
                      onError={() =>
                        setBrokenSlides((prev) => ({ ...prev, [slide.id]: true }))
                      }
                      className="absolute inset-0 h-full w-full object-cover object-center"
                    />
                  )}

                  {/* Measured Contrast Scrim */}
                  <div
                    aria-hidden="true"
                    className="absolute inset-0 bg-gradient-to-r from-[#080414]/92 via-[#12082B]/72 to-[#080414]/15"
                  />
                  <div
                    aria-hidden="true"
                    className="absolute inset-0 bg-gradient-to-t from-[#080414]/65 via-transparent to-transparent"
                  />

                  {/* Compact Slide Content */}
                  <div className="relative z-10 flex w-full items-center justify-between gap-3 px-3.5 pb-4 pt-2 sm:px-7 sm:py-3 lg:px-9">
                    <div className="max-w-[78%] sm:max-w-xl min-w-0">
                      <div className="flex items-center gap-1.5 text-[9px] sm:text-xs font-medium text-amber-300 truncate">
                        <span className="hidden sm:inline font-semibold">{brandName}</span>
                        <span className="hidden sm:inline text-slate-400" aria-hidden="true">·</span>
                        <span className="truncate">{slide.kicker}</span>
                      </div>

                      <h3 className="mt-0.5 line-clamp-1 sm:line-clamp-2 font-display text-xs sm:text-lg lg:text-xl font-extrabold tracking-tight text-white leading-snug text-balance">
                        {slide.title}
                      </h3>

                      <p className="mt-1 hidden md:line-clamp-1 text-xs text-slate-200/90">
                        {slide.subtitle}
                      </p>

                      <div className="mt-1.5 sm:mt-2.5 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleSlideAction(slide.targetAction)}
                          className="inline-flex h-6 sm:h-8 items-center gap-1 rounded-md sm:rounded-xl bg-amber-400 px-2.5 sm:px-3.5 text-[10px] sm:text-xs font-bold text-slate-950 shadow-sm transition-colors hover:bg-amber-300 active:scale-[0.98] whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
                        >
                          <span>{slide.ctaLabel}</span>
                          <ArrowRight className="h-2.5 w-2.5 sm:h-3.5 sm:w-3.5" aria-hidden="true" />
                        </button>
                      </div>
                    </div>

                    <div className="hidden lg:flex shrink-0 items-center gap-3 rounded-2xl border border-white/15 bg-slate-950/65 px-4 py-2 backdrop-blur-md">
                      <div className="text-right">
                        <div className="flex items-center justify-end gap-1.5 text-[11px] font-medium text-slate-300">
                          <Layers className="h-3.5 w-3.5 text-amber-300" aria-hidden="true" />
                          <span>{slide.metricLabel}</span>
                        </div>
                        <p className="font-display text-xl font-extrabold text-white tabular-nums leading-tight">
                          {slide.metricValue}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Floating Bottom Controls */}
          {totalSlides > 1 && (
            <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex items-center justify-between gap-2 px-2.5 pb-1.5 sm:px-6 sm:pb-2 lg:px-8">
              <div className="pointer-events-auto flex items-center gap-1 rounded-full bg-slate-950/55 px-2 py-0.5 backdrop-blur-xs">
                {SHOWCASE_SLIDES.map((item, dotIdx) => {
                  const isCurrent = dotIdx === activeIndex;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setActiveIndex(dotIdx)}
                      aria-label={`View slide ${dotIdx + 1}: ${item.tabLabel}`}
                      aria-current={isCurrent ? 'true' : undefined}
                      className={`h-1 sm:h-1.5 rounded-full transition-all duration-200 ${
                        isCurrent
                          ? 'w-4 sm:w-6 bg-amber-400'
                          : 'w-1 sm:w-1.5 bg-white/45 hover:bg-white/75'
                      }`}
                    />
                  );
                })}
              </div>

              <div className="pointer-events-auto flex items-center gap-1">
                <span className="hidden md:inline rounded-full bg-slate-950/55 px-2.5 py-0.5 text-[11px] font-medium text-slate-200 backdrop-blur-xs truncate max-w-[180px]">
                  {currentSlide.kicker}
                </span>
                <button
                  type="button"
                  onClick={goPrev}
                  aria-label="Previous showcase slide"
                  className="inline-flex h-6 w-6 sm:h-7 sm:w-7 items-center justify-center rounded-md sm:rounded-lg border border-white/25 bg-slate-950/65 text-white backdrop-blur-xs transition-colors hover:bg-slate-950/85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
                >
                  <ChevronLeft className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={goNext}
                  aria-label="Next showcase slide"
                  className="inline-flex h-6 w-6 sm:h-7 sm:w-7 items-center justify-center rounded-md sm:rounded-lg border border-white/25 bg-slate-950/65 text-white backdrop-blur-xs transition-colors hover:bg-slate-950/85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
                >
                  <ChevronRight className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
