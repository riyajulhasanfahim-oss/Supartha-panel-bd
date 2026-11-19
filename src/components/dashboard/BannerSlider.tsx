import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, ChevronLeft, ChevronRight, ExternalLink, Play } from 'lucide-react';
import {
  resolveBrandLogoUrl,
  resolveBrandName,
} from '../../config/app.config';
import { useApp } from '../../context/AppContext';
import { SHOWCASE_SLIDES, type ShowcaseTargetAction } from '../../data/showcaseSlides';
import { normalizeBannerSliders } from '../../utils/bannerSliders';

export function BannerSlider() {
  const { systemSettings, setActiveTab } = useApp();
  const brandName = resolveBrandName(systemSettings?.websiteName);
  const logoUrl = resolveBrandLogoUrl(systemSettings?.logo);

  const adminSliders = useMemo(
    () => normalizeBannerSliders(systemSettings?.defaultSettings),
    [systemSettings?.defaultSettings]
  );

  const hasCustomImages = adminSliders.length > 0;
  const totalSlides = hasCustomImages ? adminSliders.length : SHOWCASE_SLIDES.length;

  const [activeIndex, setActiveIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [brokenUrls, setBrokenUrls] = useState<Record<string, boolean>>({});
  const touchStartX = useRef<number | null>(null);
  const didSwipeRef = useRef(false);

  const slidersSignature = useMemo(
    () => adminSliders.map((item) => `${item.imageUrl}::${item.videoUrl}`).join('|'),
    [adminSliders]
  );

  useEffect(() => {
    setActiveIndex(0);
    setBrokenUrls({});
  }, [slidersSignature]);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(media.matches);
    const onChange = (event: MediaQueryListEvent) => setReducedMotion(event.matches);
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    if (totalSlides <= 1 || paused || reducedMotion) return;
    const timer = window.setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % totalSlides);
    }, 5200);
    return () => window.clearInterval(timer);
  }, [totalSlides, paused, reducedMotion]);

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
    if (touchStartX.current === null || totalSlides <= 1) return;
    const endX = e.changedTouches[0]?.clientX ?? touchStartX.current;
    const delta = endX - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(delta) < 36) return;
    didSwipeRef.current = true;
    if (delta > 0) goPrev();
    else goNext();
  };

  const handleSlideAction = (action: ShowcaseTargetAction) => {
    if (action === 'new-order') {
      const card = document.getElementById('new-order-card');
      if (card) {
        card.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }
    }
    if (action === 'services' || action === 'funds' || action === 'api') {
      setActiveTab(action);
    }
  };

  return (
    <section
      aria-label="Promotional banner"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      className="group relative overflow-hidden rounded-xl sm:rounded-2xl border border-slate-200/90 bg-slate-950 shadow-md shadow-violet-950/10"
    >
      <div
        className="flex transition-transform duration-500 ease-out"
        style={{ transform: `translateX(-${activeIndex * 100}%)` }}
      >
        {hasCustomImages
          ? adminSliders.map((slider, idx) => {
              const { imageUrl, videoUrl } = slider;
              const isBroken = Boolean(brokenUrls[imageUrl]);
              const slideInner = (
                <>
                  {isBroken ? (
                    <div className="flex h-full w-full flex-col items-center justify-center bg-gradient-to-r from-[#1A0B3B] via-[#3A1288] to-[#1E1B4B] px-4 text-center text-white">
                      <img
                        src={logoUrl}
                        alt={brandName}
                        className="mb-1.5 h-9 w-9 rounded-full object-cover bg-slate-950 ring-1 ring-sky-400/60"
                      />
                      <span className="font-display text-xs sm:text-sm font-bold">
                        {brandName}
                      </span>
                      <span className="mt-0.5 text-[10px] text-slate-300">
                        Banner #{idx + 1} preview unavailable
                      </span>
                    </div>
                  ) : (
                    <img
                      src={imageUrl}
                      alt={`${brandName} banner ${idx + 1}`}
                      referrerPolicy="no-referrer"
                      loading={idx === 0 ? 'eager' : 'lazy'}
                      decoding="async"
                      fetchPriority={idx === 0 ? 'high' : 'auto'}
                      onError={() =>
                        setBrokenUrls((prev) => ({ ...prev, [imageUrl]: true }))
                      }
                      className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.015]"
                    />
                  )}
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-slate-950/55 via-slate-950/15 to-transparent" />
                  {videoUrl && (
                    <span className="absolute right-2.5 top-2.5 inline-flex items-center gap-1 rounded-lg bg-slate-950/75 px-2 py-1 text-[10px] sm:text-[11px] font-semibold text-white backdrop-blur-xs">
                      <Play className="h-2.5 w-2.5 sm:h-3 sm:w-3 text-amber-300" aria-hidden="true" />
                      <span>Watch Video</span>
                      <ExternalLink className="h-2.5 w-2.5 sm:h-3 sm:w-3 text-slate-300" aria-hidden="true" />
                    </span>
                  )}
                </>
              );

              return videoUrl ? (
                <a
                  key={`${imageUrl}-${idx}`}
                  href={videoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Open video for ${brandName} banner ${idx + 1}`}
                  onClick={(e) => {
                    if (didSwipeRef.current) {
                      e.preventDefault();
                      didSwipeRef.current = false;
                    }
                  }}
                  className="relative block h-[104px] sm:h-[138px] md:h-[156px] w-full shrink-0 overflow-hidden bg-slate-950 cursor-pointer"
                >
                  {slideInner}
                </a>
              ) : (
                <div
                  key={`${imageUrl}-${idx}`}
                  className="relative h-[104px] sm:h-[138px] md:h-[156px] w-full shrink-0 overflow-hidden bg-slate-950"
                >
                  {slideInner}
                </div>
              );
            })
          : SHOWCASE_SLIDES.map((slide, idx) => {
              const isBroken = Boolean(brokenUrls[slide.id]);

              if (slide.isArtworkBanner) {
                return (
                  <div
                    key={slide.id}
                    className={`relative flex h-[104px] sm:h-[138px] md:h-[156px] w-full shrink-0 overflow-hidden ${
                      slide.panelSurfaceClass ?? 'bg-slate-950'
                    }`}
                  >
                    {/* Compact Copy & CTA Column */}
                    <div className="flex flex-1 min-w-0 flex-col justify-center px-2.5 pb-4 pt-1.5 sm:px-5 sm:py-2.5 md:px-6">
                      <div className="hidden sm:flex items-center gap-1.5 text-[11px] font-medium text-slate-300 truncate">
                        <span className="font-semibold text-amber-300">{brandName}</span>
                        <span aria-hidden="true">·</span>
                        <span className="truncate">{slide.kicker}</span>
                      </div>

                      <h2 className="sm:mt-0.5 line-clamp-2 font-display text-[11px] sm:text-sm md:text-base font-extrabold tracking-tight text-white leading-tight text-balance">
                        {slide.title}
                      </h2>

                      <p className="mt-0.5 hidden lg:line-clamp-1 text-xs text-slate-200/90">
                        {slide.subtitle}
                      </p>

                      <div className="mt-1.5 sm:mt-2 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleSlideAction(slide.targetAction)}
                          className="inline-flex h-6 sm:h-7 items-center gap-1 rounded-md sm:rounded-lg bg-amber-400 px-2.5 sm:px-3 text-[10px] sm:text-xs font-bold text-slate-950 shadow-sm transition-colors hover:bg-amber-300 active:scale-[0.98] whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
                        >
                          <span>{slide.ctaLabel}</span>
                          <ArrowRight className="h-2.5 w-2.5 sm:h-3 sm:w-3" aria-hidden="true" />
                        </button>
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
                          <span className="font-display text-xs font-extrabold">{brandName}</span>
                        </div>
                      ) : (
                        <img
                          src={slide.imageUrl}
                          alt={slide.title}
                          referrerPolicy="no-referrer"
                          loading={idx === 0 ? 'eager' : 'lazy'}
                          decoding="async"
                          fetchPriority={idx === 0 ? 'high' : 'auto'}
                          onError={() =>
                            setBrokenUrls((prev) => ({ ...prev, [slide.id]: true }))
                          }
                          className="h-full w-full object-cover object-center transition-transform duration-700 ease-out group-hover:scale-[1.015]"
                        />
                      )}
                    </button>
                  </div>
                );
              }

              return (
                <div
                  key={slide.id}
                  className="relative flex h-[104px] sm:h-[138px] md:h-[156px] w-full shrink-0 items-center overflow-hidden bg-slate-950"
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
                      fetchPriority={idx === 0 ? 'high' : 'auto'}
                      onError={() =>
                        setBrokenUrls((prev) => ({ ...prev, [slide.id]: true }))
                      }
                      className="absolute inset-0 h-full w-full object-cover object-center transition-transform duration-700 ease-out group-hover:scale-[1.02]"
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

                  <div className="relative z-10 flex w-full items-center justify-between gap-3 px-3 pb-4 pt-1.5 sm:py-0 sm:px-6 md:px-8">
                    <div className="flex items-center gap-3 min-w-0 max-w-[82%] sm:max-w-2xl">
                      <img
                        src={logoUrl}
                        alt={brandName}
                        className="hidden sm:block h-10 w-10 md:h-11 md:w-11 shrink-0 rounded-full object-cover bg-slate-950 ring-2 ring-sky-400/60 shadow-md shadow-slate-950/40"
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 text-[9px] sm:text-[11px] font-medium text-slate-300 truncate">
                          <span className="font-semibold text-amber-300">{brandName}</span>
                          <span aria-hidden="true">·</span>
                          <span className="truncate">{slide.kicker}</span>
                        </div>

                        <h2 className="mt-0.5 line-clamp-1 sm:line-clamp-2 font-display text-xs sm:text-base md:text-lg font-extrabold tracking-tight text-white text-balance">
                          {slide.title}
                        </h2>

                        <p className="mt-0.5 hidden md:block line-clamp-1 max-w-xl text-xs text-slate-200/90">
                          {slide.subtitle}
                        </p>

                        <div className="mt-1.5 sm:mt-2 flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleSlideAction(slide.targetAction)}
                            className="inline-flex h-6 sm:h-7 items-center gap-1 rounded-md sm:rounded-lg bg-amber-400 px-2.5 sm:px-3 text-[10px] sm:text-xs font-bold text-slate-950 shadow-sm transition-colors hover:bg-amber-300 active:scale-[0.98] whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
                          >
                            <span>{slide.ctaLabel}</span>
                            <ArrowRight className="h-2.5 w-2.5 sm:h-3 sm:w-3" aria-hidden="true" />
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="hidden md:flex shrink-0 flex-col items-end rounded-xl border border-white/15 bg-slate-950/60 px-3 py-1.5 text-right backdrop-blur-md">
                      <span className="text-[10px] font-medium text-slate-300">
                        {slide.metricLabel}
                      </span>
                      <span className="font-display text-base font-extrabold text-white tabular-nums">
                        {slide.metricValue}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
      </div>

      {totalSlides > 1 && (
        <>
          <button
            type="button"
            onClick={goPrev}
            aria-label="Previous banner"
            className="hidden sm:inline-flex z-10 absolute left-2.5 top-1/2 -translate-y-1/2 h-8 w-8 items-center justify-center rounded-lg border border-white/20 bg-slate-950/55 text-white opacity-0 backdrop-blur-xs transition-opacity duration-200 hover:bg-slate-950/80 group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={goNext}
            aria-label="Next banner"
            className="hidden sm:inline-flex z-10 absolute right-2.5 top-1/2 -translate-y-1/2 h-8 w-8 items-center justify-center rounded-lg border border-white/20 bg-slate-950/55 text-white opacity-0 backdrop-blur-xs transition-opacity duration-200 hover:bg-slate-950/80 group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
          >
            <ChevronRight className="h-4 w-4" />
          </button>

          <div
            className="z-10 absolute bottom-1 left-2.5 sm:bottom-1.5 sm:left-1/2 flex sm:-translate-x-1/2 items-center gap-1 rounded-full bg-slate-950/55 px-2 py-0.5 backdrop-blur-xs"
            role="tablist"
            aria-label="Banner slides"
          >
            {Array.from({ length: totalSlides }).map((_, idx) => {
              const isActive = idx === activeIndex;
              return (
                <button
                  key={idx}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  aria-label={`Go to banner ${idx + 1}`}
                  onClick={() => setActiveIndex(idx)}
                  className={`h-1 sm:h-1.5 rounded-full transition-all duration-300 ${
                    isActive
                      ? 'w-4 sm:w-5 bg-amber-400'
                      : 'w-1 sm:w-1.5 bg-white/50 hover:bg-white/85'
                  }`}
                />
              );
            })}
          </div>
        </>
      )}
    </section>
  );
}
