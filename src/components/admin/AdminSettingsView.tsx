import React, { useEffect, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Globe,
  Image as ImageIcon,
  LayoutTemplate,
  Palette,
  Plus,
  Save,
  Sliders,
  Trash2,
  Video,
} from 'lucide-react';
import {
  APP_CONFIG,
  resolveBrandFaviconUrl,
  resolveBrandLogoUrl,
  resolveBrandName,
} from '../../config/app.config';
import { HOW_IT_WORKS_STEPS, LANDING_FEATURES } from '../../data/mockLanding';
import { useApp } from '../../context/AppContext';
import type {
  SettingsFaqItem,
  SettingsHowItWorksItem,
  SettingsLandingFeatureItem,
} from '../../lib/firestore/collections';
import { adminService } from '../../services/admin.service';
import { normalizeCurrencySymbol } from '../../utils/pricing';
import {
  type BannerSliderItem,
  getVideoPlatform,
  isSupportedSliderVideoUrl,
  isValidHttpUrl,
  normalizeBannerSliders,
  normalizeVideoUrl,
} from '../../utils/bannerSliders';

type SettingsTab = 'branding' | 'landing';

const DEFAULT_FAQS: SettingsFaqItem[] = [
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

export function AdminSettingsView() {
  const { showToast, refreshSystemSettings, refreshSetupState } = useApp();
  const [activeTab, setActiveTab] = useState<SettingsTab>('branding');
  const [saving, setSaving] = useState(false);

  // Branding & Contact
  const [websiteName, setWebsiteName] = useState(APP_CONFIG.brandName);
  const [brandTagline, setBrandTagline] = useState(APP_CONFIG.brandTagline);
  const [websiteDescription, setWebsiteDescription] = useState(
    `${APP_CONFIG.brandName} — Fast, reliable, white-label ${APP_CONFIG.brandTagline} platform.`
  );
  const [logo, setLogo] = useState(APP_CONFIG.brandLogoUrl);
  const [favicon, setFavicon] = useState(APP_CONFIG.brandLogoUrl);
  const [themeColor, setThemeColor] = useState('#6D28D9');
  const [secondaryColor, setSecondaryColor] = useState('#4F46E5');
  const [currencyCode, setCurrencyCode] = useState(APP_CONFIG.currencyCode);
  const [currencySymbol, setCurrencySymbol] = useState(APP_CONFIG.currencySymbol);
  const [defaultProfitMargin, setDefaultProfitMargin] = useState<number>(30);
  const [autoSyncEnabled, setAutoSyncEnabled] = useState<boolean>(true);
  const [supportEmail, setSupportEmail] = useState(APP_CONFIG.supportEmail);
  const [supportWhatsapp, setSupportWhatsapp] = useState('');
  const [supportHours, setSupportHours] = useState(APP_CONFIG.supportHours);
  const [footerText, setFooterText] = useState('All rights reserved.');
  const [socialFacebook, setSocialFacebook] = useState('');
  const [socialTelegram, setSocialTelegram] = useState('');
  const [socialYoutube, setSocialYoutube] = useState('');
  const [socialInstagram, setSocialInstagram] = useState('');
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [existingDefaultSettings, setExistingDefaultSettings] = useState<Record<string, unknown>>({});
  const [bannerItems, setBannerItems] = useState<BannerSliderItem[]>([]);
  const [newBannerUrl, setNewBannerUrl] = useState('');
  const [newBannerVideoUrl, setNewBannerVideoUrl] = useState('');

  // Landing Page CMS
  const [heroTitle, setHeroTitle] = useState('Grow Your Social Media');
  const [heroSubtitle, setHeroSubtitle] = useState('Faster • Cheaper • More Reliable');
  const [heroDescription, setHeroDescription] = useState('');
  const [heroCtaLabel, setHeroCtaLabel] = useState('Browse Services');
  const [aboutTitle, setAboutTitle] = useState('');
  const [aboutDescription, setAboutDescription] = useState('');
  const [landingFeatures, setLandingFeatures] =
    useState<SettingsLandingFeatureItem[]>(LANDING_FEATURES);
  const [howItWorks, setHowItWorks] =
    useState<SettingsHowItWorksItem[]>(HOW_IT_WORKS_STEPS);
  const [landingFaqs, setLandingFaqs] = useState<SettingsFaqItem[]>(DEFAULT_FAQS);

  useEffect(() => {
    adminService.getSystemSettings().then((sys) => {
      if (!sys) return;
      setWebsiteName(resolveBrandName(sys.websiteName));
      if (sys.brandTagline) setBrandTagline(sys.brandTagline);
      if (sys.websiteDescription) setWebsiteDescription(sys.websiteDescription);
      setLogo(resolveBrandLogoUrl(sys.logo));
      setFavicon(resolveBrandFaviconUrl(sys.favicon));
      if (sys.themeColor) setThemeColor(sys.themeColor);
      if (sys.secondaryColor) setSecondaryColor(sys.secondaryColor);
      if (sys.currency) setCurrencyCode(sys.currency);
      if (sys.currencySymbol || sys.currency) {
        setCurrencySymbol(normalizeCurrencySymbol(sys.currencySymbol, sys.currency));
      }
      if (typeof sys.defaultProfitMargin === 'number') {
        setDefaultProfitMargin(sys.defaultProfitMargin);
      }
      if (typeof sys.autoSyncEnabled === 'boolean') setAutoSyncEnabled(sys.autoSyncEnabled);
      if (sys.supportEmail !== undefined) setSupportEmail(sys.supportEmail);
      if (sys.supportWhatsapp !== undefined) setSupportWhatsapp(sys.supportWhatsapp);
      if (sys.supportHours) setSupportHours(sys.supportHours);
      if (sys.footerText !== undefined) setFooterText(sys.footerText);
      if (sys.socialLinks) {
        setSocialFacebook(sys.socialLinks.facebook ?? '');
        setSocialTelegram(sys.socialLinks.telegram ?? '');
        setSocialYoutube(sys.socialLinks.youtube ?? '');
        setSocialInstagram(sys.socialLinks.instagram ?? '');
      }
      if (sys.heroTitle) setHeroTitle(sys.heroTitle);
      if (sys.heroSubtitle) setHeroSubtitle(sys.heroSubtitle);
      if (sys.heroDescription !== undefined) setHeroDescription(sys.heroDescription);
      if (sys.heroCtaLabel) setHeroCtaLabel(sys.heroCtaLabel);
      if (sys.aboutTitle !== undefined) setAboutTitle(sys.aboutTitle);
      if (sys.aboutDescription !== undefined) setAboutDescription(sys.aboutDescription);
      if (sys.landingFeatures && sys.landingFeatures.length > 0) {
        setLandingFeatures(sys.landingFeatures);
      }
      if (sys.howItWorks && sys.howItWorks.length > 0) {
        setHowItWorks(sys.howItWorks);
      }
      if (sys.landingFaqs && sys.landingFaqs.length > 0) {
        setLandingFaqs(sys.landingFaqs);
      }
      if (typeof sys.maintenanceMode === 'boolean') setMaintenanceMode(sys.maintenanceMode);
      if (sys.defaultSettings && typeof sys.defaultSettings === 'object') {
        const rawDefaults = sys.defaultSettings as Record<string, unknown>;
        setExistingDefaultSettings(rawDefaults);
        setBannerItems(normalizeBannerSliders(rawDefaults));
      }
    });
  }, []);

  const handleAddBannerUrl = () => {
    const trimmed = newBannerUrl.trim();
    const trimmedVideo = newBannerVideoUrl.trim();
    if (!trimmed) {
      if (trimmedVideo) {
        showToast({
          title: 'Banner Image Required',
          description: 'Please enter the banner image URL before adding a video link.',
          tone: 'warning',
        });
      }
      return;
    }
    if (!isValidHttpUrl(trimmed)) {
      showToast({
        title: 'Invalid Banner URL',
        description: 'Please enter a valid image URL starting with http:// or https://.',
        tone: 'warning',
      });
      return;
    }
    if (trimmedVideo && !isSupportedSliderVideoUrl(trimmedVideo)) {
      showToast({
        title: 'Invalid Video Link',
        description: 'Only valid YouTube or Facebook video links are allowed (optional).',
        tone: 'warning',
      });
      return;
    }
    if (bannerItems.length >= 10) {
      showToast({
        title: 'Limit Reached',
        description: 'You can add up to 10 banner slider images.',
        tone: 'warning',
      });
      return;
    }
    const normalizedVideo = trimmedVideo ? normalizeVideoUrl(trimmedVideo).slice(0, 500) : '';
    setBannerItems((prev) => [
      ...prev,
      { imageUrl: trimmed.slice(0, 500), videoUrl: normalizedVideo },
    ]);
    setNewBannerUrl('');
    setNewBannerVideoUrl('');
  };

  const handleMoveBanner = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= bannerItems.length) return;
    setBannerItems((prev) => {
      const next = [...prev];
      const [item] = next.splice(index, 1);
      next.splice(target, 0, item);
      return next;
    });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const cleanSocialLinks = {
        ...(socialFacebook.trim() ? { facebook: socialFacebook.trim().slice(0, 240) } : {}),
        ...(socialTelegram.trim() ? { telegram: socialTelegram.trim().slice(0, 240) } : {}),
        ...(socialYoutube.trim() ? { youtube: socialYoutube.trim().slice(0, 240) } : {}),
        ...(socialInstagram.trim() ? { instagram: socialInstagram.trim().slice(0, 240) } : {}),
      };

      const sanitizedFeatures = landingFeatures
        .filter((f) => f.title.trim())
        .slice(0, 6)
        .map((f, idx) => ({
          id: f.id || `feat-${idx + 1}`,
          index: f.index.trim() || String(idx + 1).padStart(2, '0'),
          title: f.title.trim().slice(0, 100),
          description: f.description.trim().slice(0, 300),
          metric: f.metric.trim().slice(0, 60),
        }));

      const sanitizedSteps = howItWorks
        .filter((s) => s.title.trim())
        .slice(0, 4)
        .map((s, idx) => ({
          step: s.step.trim() || String(idx + 1).padStart(2, '0'),
          title: s.title.trim().slice(0, 80),
          description: s.description.trim().slice(0, 260),
        }));

      const sanitizedFaqs = landingFaqs
        .filter((q) => q.question.trim() && q.answer.trim())
        .slice(0, 8)
        .map((q, idx) => ({
          id: q.id || `faq-${idx + 1}`,
          question: q.question.trim().slice(0, 160),
          answer: q.answer.trim().slice(0, 500),
        }));

      const pendingTrimmed = newBannerUrl.trim();
      const pendingVideoTrimmed = newBannerVideoUrl.trim();
      if (pendingVideoTrimmed && !pendingTrimmed) {
        showToast({
          title: 'Banner Image Required',
          description: 'Please enter a banner image URL for the new video link or clear the video field.',
          tone: 'warning',
        });
        setSaving(false);
        return;
      }
      if (pendingTrimmed && !isValidHttpUrl(pendingTrimmed)) {
        showToast({
          title: 'Invalid Banner URL',
          description: 'Banner image URL must start with http:// or https://.',
          tone: 'warning',
        });
        setSaving(false);
        return;
      }
      if (pendingVideoTrimmed && !isSupportedSliderVideoUrl(pendingVideoTrimmed)) {
        showToast({
          title: 'Invalid Video Link',
          description: 'New slider Video URL must be a valid YouTube or Facebook link.',
          tone: 'warning',
        });
        setSaving(false);
        return;
      }

      const combinedBanners: BannerSliderItem[] = pendingTrimmed
        ? [
            ...bannerItems,
            {
              imageUrl: pendingTrimmed,
              videoUrl: pendingVideoTrimmed ? normalizeVideoUrl(pendingVideoTrimmed) : '',
            },
          ]
        : bannerItems;

      for (let i = 0; i < combinedBanners.length; i++) {
        const row = combinedBanners[i];
        if (row.imageUrl.trim() && row.videoUrl.trim() && !isSupportedSliderVideoUrl(row.videoUrl)) {
          showToast({
            title: `Invalid Video Link on Slider #${i + 1}`,
            description: 'Please enter a valid YouTube or Facebook video URL, or leave it blank.',
            tone: 'warning',
          });
          setSaving(false);
          return;
        }
      }

      const sanitizedBannerItems = combinedBanners
        .map((item) => ({
          imageUrl: item.imageUrl.trim().slice(0, 500),
          videoUrl: item.videoUrl.trim() ? normalizeVideoUrl(item.videoUrl).slice(0, 500) : '',
        }))
        .filter((item) => isValidHttpUrl(item.imageUrl))
        .slice(0, 10);

      const sanitizedBannerImages = sanitizedBannerItems.map((item) => item.imageUrl);

      setBannerItems(sanitizedBannerItems);
      if (pendingTrimmed) {
        setNewBannerUrl('');
        setNewBannerVideoUrl('');
      }

      await adminService.updateSystemSettings({
        websiteName: websiteName.trim() || APP_CONFIG.brandName,
        brandTagline: brandTagline.trim() || APP_CONFIG.brandTagline,
        websiteDescription: websiteDescription.trim(),
        logo: logo.trim(),
        favicon: favicon.trim(),
        themeColor: themeColor.trim() || '#6D28D9',
        secondaryColor: secondaryColor.trim() || '#4F46E5',
        currency: currencyCode.trim() || APP_CONFIG.currencyCode,
        currencySymbol: normalizeCurrencySymbol(
          currencySymbol,
          currencyCode.trim() || APP_CONFIG.currencyCode
        ),
        defaultProfitMargin: Math.max(0, Math.min(500, Number(defaultProfitMargin) || 0)),
        autoSyncEnabled,
        supportEmail: supportEmail.trim(),
        supportWhatsapp: supportWhatsapp.trim(),
        supportHours: supportHours.trim(),
        footerText: footerText.trim(),
        socialLinks: cleanSocialLinks,
        heroTitle: heroTitle.trim() || 'Grow Your Social Media',
        heroSubtitle: heroSubtitle.trim() || 'Faster • Cheaper • More Reliable',
        heroDescription: heroDescription.trim(),
        heroCtaLabel: heroCtaLabel.trim() || 'Browse Services',
        aboutTitle: aboutTitle.trim(),
        aboutDescription: aboutDescription.trim(),
        landingFeatures: sanitizedFeatures,
        howItWorks: sanitizedSteps,
        landingFaqs: sanitizedFaqs,
        defaultSettings: {
          ...existingDefaultSettings,
          bannerImages: sanitizedBannerImages,
          bannerItems: sanitizedBannerItems.map((item) =>
            item.videoUrl
              ? { imageUrl: item.imageUrl, videoUrl: item.videoUrl }
              : { imageUrl: item.imageUrl }
          ),
        },
        maintenanceMode,
        brandingConfigured: true,
      });

      await Promise.all([refreshSystemSettings(), refreshSetupState()]);
      showToast({
        title: 'White-Label Settings Saved',
        description: 'Branding, theme palette, banner slider, and settings updated live.',
        tone: 'success',
      });
    } catch (err) {
      showToast({
        title: 'Save Failed',
        description: err instanceof Error ? err.message : 'Ensure database is initialized first.',
        tone: 'error',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-xl sm:text-2xl font-extrabold text-slate-950">
            White-Label Branding &amp; Website CMS
          </h1>
          <p className="text-xs sm:text-sm text-slate-500">
            Configure custom buyer identity, theme palette, support links, and public Landing Page sections in{' '}
            <code className="font-mono">settings/system</code>.
          </p>
        </div>

        <div className="inline-flex rounded-2xl border border-violet-200 bg-white p-1">
          <button
            type="button"
            onClick={() => setActiveTab('branding')}
            className={`inline-flex h-9 items-center gap-1.5 rounded-xl px-3.5 text-xs font-bold transition-colors whitespace-nowrap ${
              activeTab === 'branding'
                ? 'bg-violet-700 text-white'
                : 'text-slate-600 hover:bg-violet-50'
            }`}
          >
            <Palette className="h-3.5 w-3.5" />
            <span>Brand &amp; Theme</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('landing')}
            className={`inline-flex h-9 items-center gap-1.5 rounded-xl px-3.5 text-xs font-bold transition-colors whitespace-nowrap ${
              activeTab === 'landing'
                ? 'bg-violet-700 text-white'
                : 'text-slate-600 hover:bg-violet-50'
            }`}
          >
            <LayoutTemplate className="h-3.5 w-3.5" />
            <span>Landing Page CMS</span>
          </button>
        </div>
      </div>

      <form
        onSubmit={handleSave}
        className="rounded-3xl border border-violet-100 bg-white p-5 sm:p-6 shadow-xs space-y-6"
      >
        {activeTab === 'branding' ? (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2.5">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-100 text-violet-700">
                  <Sliders className="h-5 w-5" />
                </span>
                <div>
                  <h2 className="font-display text-base font-bold text-slate-900">
                    White-Label Identity &amp; Palette
                  </h2>
                  <p className="text-xs text-slate-500">
                    Updates logo, browser title, favicon, theme colors, and footer across the entire panel.
                  </p>
                </div>
              </div>

              <div
                style={{
                  backgroundImage: `linear-gradient(135deg, ${themeColor}, ${secondaryColor})`,
                }}
                className="flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-bold text-white shadow-xs"
              >
                <img
                  src={resolveBrandLogoUrl(logo)}
                  alt={websiteName || APP_CONFIG.brandName}
                  className="h-5 w-5 shrink-0 rounded-full object-cover bg-slate-950 ring-1 ring-white/50"
                />
                <span>{websiteName || APP_CONFIG.brandName}</span>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Website Name *
                </label>
                <input
                  type="text"
                  required
                  value={websiteName}
                  onChange={(e) => setWebsiteName(e.target.value)}
                  className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Brand Tagline
                </label>
                <input
                  type="text"
                  value={brandTagline}
                  onChange={(e) => setBrandTagline(e.target.value)}
                  placeholder="SMM Panel"
                  className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Currency Code
                  </label>
                  <input
                    type="text"
                    required
                    value={currencyCode}
                    onChange={(e) => setCurrencyCode(e.target.value)}
                    className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Symbol
                  </label>
                  <input
                    type="text"
                    value={currencySymbol}
                    onChange={(e) => setCurrencySymbol(e.target.value)}
                    placeholder="৳"
                    className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Logo Image URL (Optional)
                </label>
                <input
                  type="text"
                  value={logo}
                  onChange={(e) => setLogo(e.target.value)}
                  placeholder="/assets/aistudio/... or https://example.com/logo.png"
                  className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Favicon URL (Optional)
                </label>
                <input
                  type="text"
                  value={favicon}
                  onChange={(e) => setFavicon(e.target.value)}
                  placeholder="/assets/aistudio/... or https://example.com/favicon.ico"
                  className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Default Profit Margin (%)
                </label>
                <input
                  type="number"
                  min={0}
                  max={500}
                  value={defaultProfitMargin}
                  onChange={(e) => setDefaultProfitMargin(Number(e.target.value))}
                  className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm tabular-nums"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Primary Brand Color
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={themeColor}
                    onChange={(e) => setThemeColor(e.target.value)}
                    className="h-10 w-12 cursor-pointer rounded-xl border border-slate-200 bg-white p-1"
                  />
                  <input
                    type="text"
                    value={themeColor}
                    onChange={(e) => setThemeColor(e.target.value)}
                    className="h-10 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 font-mono text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Secondary Accent Color
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={secondaryColor}
                    onChange={(e) => setSecondaryColor(e.target.value)}
                    className="h-10 w-12 cursor-pointer rounded-xl border border-slate-200 bg-white p-1"
                  />
                  <input
                    type="text"
                    value={secondaryColor}
                    onChange={(e) => setSecondaryColor(e.target.value)}
                    className="h-10 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 font-mono text-sm"
                  />
                </div>
              </div>

              <div className="flex flex-col justify-center gap-2 pt-2">
                <label className="inline-flex items-center gap-2.5 text-xs font-semibold text-slate-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoSyncEnabled}
                    onChange={(e) => setAutoSyncEnabled(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-violet-700"
                  />
                  <span>Enable Provider Auto-Sync</span>
                </label>
                <label className="inline-flex items-center gap-2.5 text-xs font-semibold text-rose-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={maintenanceMode}
                    onChange={(e) => setMaintenanceMode(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-rose-600"
                  />
                  <span>Enable Maintenance Mode</span>
                </label>
              </div>
            </div>

            {/* User Panel Banner Slider Images */}
            <div className="rounded-2xl border border-violet-200/80 bg-violet-50/40 p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <ImageIcon className="h-4 w-4 text-violet-700" />
                  <p className="text-xs font-bold uppercase tracking-wide text-violet-900">
                    Home Page Banner Slider Images ({bannerItems.length}/10)
                  </p>
                </div>
                <span className="text-[11px] text-slate-500">
                  Optional YouTube or Facebook video link opens when clicked
                </span>
              </div>

              <div className="grid gap-2 lg:grid-cols-12">
                <input
                  type="url"
                  value={newBannerUrl}
                  onChange={(e) => setNewBannerUrl(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddBannerUrl();
                    }
                  }}
                  placeholder="Banner Image URL (https://example.com/banner-image.jpg)"
                  className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm lg:col-span-5"
                />
                <div className="relative lg:col-span-5">
                  <Video className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="url"
                    value={newBannerVideoUrl}
                    onChange={(e) => setNewBannerVideoUrl(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddBannerUrl();
                      }
                    }}
                    placeholder="Optional Video URL (YouTube / Facebook link)"
                    className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleAddBannerUrl}
                  className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl bg-violet-700 px-4 text-xs font-bold text-white hover:bg-violet-800 whitespace-nowrap lg:col-span-2"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Add Banner</span>
                </button>
              </div>

              {bannerItems.length > 0 && (
                <div className="space-y-2.5 pt-1">
                  {bannerItems.map((item, idx) => {
                    const platform = item.videoUrl ? getVideoPlatform(item.videoUrl) : null;
                    const hasInvalidVideo =
                      Boolean(item.videoUrl.trim()) && !isSupportedSliderVideoUrl(item.videoUrl);

                    return (
                      <div
                        key={idx}
                        className="rounded-xl border border-slate-200 bg-white p-2.5 space-y-2"
                      >
                        <div className="flex flex-wrap items-center gap-2.5">
                          <img
                            src={item.imageUrl}
                            alt={`Banner preview ${idx + 1}`}
                            className="h-10 w-20 shrink-0 rounded-lg border border-slate-100 bg-slate-100 object-cover"
                          />
                          <div className="min-w-0 flex-1 space-y-1.5">
                            <input
                              type="url"
                              value={item.imageUrl}
                              onChange={(e) =>
                                setBannerItems((prev) =>
                                  prev.map((entry, i) =>
                                    i === idx ? { ...entry, imageUrl: e.target.value } : entry
                                  )
                                )
                              }
                              aria-label={`Banner ${idx + 1} image URL`}
                              placeholder="https://example.com/banner-image.jpg"
                              className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-xs"
                            />
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleMoveBanner(idx, -1)}
                              disabled={idx === 0}
                              aria-label="Move banner up"
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                            >
                              <ArrowUp className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleMoveBanner(idx, 1)}
                              disabled={idx === bannerItems.length - 1}
                              aria-label="Move banner down"
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                            >
                              <ArrowDown className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setBannerItems((prev) => prev.filter((_, i) => i !== idx))
                              }
                              aria-label="Remove banner image"
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 sm:pl-[5.625rem]">
                          <div className="relative min-w-0 flex-1">
                            <Video className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                            <input
                              type="url"
                              value={item.videoUrl}
                              onChange={(e) =>
                                setBannerItems((prev) =>
                                  prev.map((entry, i) =>
                                    i === idx ? { ...entry, videoUrl: e.target.value } : entry
                                  )
                                )
                              }
                              aria-label={`Banner ${idx + 1} optional video URL`}
                              placeholder="Optional Video URL (YouTube or Facebook link)"
                              className={`h-8 w-full rounded-lg border pl-8 pr-2.5 text-xs ${
                                hasInvalidVideo
                                  ? 'border-rose-300 bg-rose-50/60 text-rose-800'
                                  : 'border-slate-200 bg-slate-50 text-slate-700'
                              }`}
                            />
                          </div>
                          {platform && (
                            <span
                              className={`inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                                platform === 'youtube'
                                  ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                  : 'bg-blue-50 text-blue-700 border border-blue-200'
                              }`}
                            >
                              {platform === 'youtube' ? 'YouTube Video' : 'Facebook Video'}
                            </span>
                          )}
                          {hasInvalidVideo && (
                            <span className="text-[11px] font-medium text-rose-600">
                              Enter a YouTube or Facebook link
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Contact & Social Links */}
            <div className="rounded-2xl border border-slate-200/80 bg-slate-50/60 p-4 space-y-4">
              <p className="text-xs font-bold uppercase tracking-wide text-slate-700">
                Contact Information, Footer &amp; Social Channels
              </p>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Support Email
                  </label>
                  <input
                    type="email"
                    value={supportEmail}
                    onChange={(e) => setSupportEmail(e.target.value)}
                    className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Support WhatsApp
                  </label>
                  <input
                    type="text"
                    value={supportWhatsapp}
                    onChange={(e) => setSupportWhatsapp(e.target.value)}
                    placeholder="+8801XXXXXXXXX"
                    className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Support Hours
                  </label>
                  <input
                    type="text"
                    value={supportHours}
                    onChange={(e) => setSupportHours(e.target.value)}
                    placeholder="24/7 Live Support"
                    className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Footer Text
                  </label>
                  <input
                    type="text"
                    value={footerText}
                    onChange={(e) => setFooterText(e.target.value)}
                    placeholder="All rights reserved."
                    className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Facebook URL
                  </label>
                  <input
                    type="url"
                    value={socialFacebook}
                    onChange={(e) => setSocialFacebook(e.target.value)}
                    placeholder="https://facebook.com/..."
                    className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Telegram URL
                  </label>
                  <input
                    type="url"
                    value={socialTelegram}
                    onChange={(e) => setSocialTelegram(e.target.value)}
                    placeholder="https://t.me/..."
                    className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    YouTube URL
                  </label>
                  <input
                    type="url"
                    value={socialYoutube}
                    onChange={(e) => setSocialYoutube(e.target.value)}
                    placeholder="https://youtube.com/..."
                    className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Instagram URL
                  </label>
                  <input
                    type="url"
                    value={socialInstagram}
                    onChange={(e) => setSocialInstagram(e.target.value)}
                    placeholder="https://instagram.com/..."
                    className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-xs"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Website Description
              </label>
              <textarea
                rows={2}
                value={websiteDescription}
                onChange={(e) => setWebsiteDescription(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm"
              />
            </div>
          </>
        ) : (
          <div className="space-y-6">
            {/* Hero & About Section */}
            <div className="rounded-2xl border border-violet-100 bg-violet-50/40 p-4 space-y-3">
              <p className="text-xs font-bold uppercase tracking-wide text-violet-800">
                Hero Section &amp; Customer Dashboard Banner
              </p>
              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Hero Title
                  </label>
                  <input
                    type="text"
                    value={heroTitle}
                    onChange={(e) => setHeroTitle(e.target.value)}
                    className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Hero Subtitle
                  </label>
                  <input
                    type="text"
                    value={heroSubtitle}
                    onChange={(e) => setHeroSubtitle(e.target.value)}
                    className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    CTA Button Text
                  </label>
                  <input
                    type="text"
                    value={heroCtaLabel}
                    onChange={(e) => setHeroCtaLabel(e.target.value)}
                    className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Landing Hero Description
                </label>
                <textarea
                  rows={2}
                  value={heroDescription}
                  onChange={(e) => setHeroDescription(e.target.value)}
                  placeholder="Optional custom lead paragraph for the public landing hero..."
                  className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm"
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2 pt-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    About Section Heading (Optional)
                  </label>
                  <input
                    type="text"
                    value={aboutTitle}
                    onChange={(e) => setAboutTitle(e.target.value)}
                    placeholder="Built for Creators & Agencies"
                    className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    About Section Copy (Optional)
                  </label>
                  <input
                    type="text"
                    value={aboutDescription}
                    onChange={(e) => setAboutDescription(e.target.value)}
                    placeholder="Short paragraph describing your SMM brand..."
                    className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"
                  />
                </div>
              </div>
            </div>

            {/* Dynamic Features CMS */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-display text-sm font-bold text-slate-900">
                  Features Grid ({landingFeatures.length}/6)
                </h3>
                {landingFeatures.length < 6 && (
                  <button
                    type="button"
                    onClick={() =>
                      setLandingFeatures((prev) => [
                        ...prev,
                        {
                          id: `feat-${Date.now()}`,
                          index: String(prev.length + 1).padStart(2, '0'),
                          title: 'New Feature',
                          description: '',
                          metric: 'Verified',
                        },
                      ])
                    }
                    className="inline-flex h-8 items-center gap-1 rounded-xl border border-violet-200 bg-violet-50 px-3 text-xs font-bold text-violet-800 hover:bg-violet-100"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Add Feature</span>
                  </button>
                )}
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                {landingFeatures.map((feat, idx) => (
                  <div
                    key={feat.id}
                    className="rounded-2xl border border-slate-200/80 bg-slate-50/70 p-3.5 space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-xs font-bold text-violet-700">
                        Feature #{idx + 1}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setLandingFeatures((prev) => prev.filter((_, i) => i !== idx))
                        }
                        className="text-rose-600 hover:text-rose-700"
                        aria-label="Remove feature"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        value={feat.title}
                        onChange={(e) =>
                          setLandingFeatures((prev) =>
                            prev.map((item, i) =>
                              i === idx ? { ...item, title: e.target.value } : item
                            )
                          )
                        }
                        placeholder="Feature title"
                        className="h-9 rounded-xl border border-slate-200 bg-white px-2.5 text-xs font-semibold"
                      />
                      <input
                        type="text"
                        value={feat.metric}
                        onChange={(e) =>
                          setLandingFeatures((prev) =>
                            prev.map((item, i) =>
                              i === idx ? { ...item, metric: e.target.value } : item
                            )
                          )
                        }
                        placeholder="Proof metric"
                        className="h-9 rounded-xl border border-slate-200 bg-white px-2.5 text-xs"
                      />
                    </div>
                    <textarea
                      rows={2}
                      value={feat.description}
                      onChange={(e) =>
                        setLandingFeatures((prev) =>
                          prev.map((item, i) =>
                            i === idx ? { ...item, description: e.target.value } : item
                          )
                        )
                      }
                      placeholder="Feature description"
                      className="w-full rounded-xl border border-slate-200 bg-white p-2 text-xs"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* How It Works CMS */}
            <div className="space-y-3">
              <h3 className="font-display text-sm font-bold text-slate-900">
                How It Works Steps ({howItWorks.length}/4)
              </h3>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {howItWorks.map((step, idx) => (
                  <div
                    key={step.step + idx}
                    className="rounded-2xl border border-slate-200/80 bg-slate-50/70 p-3 space-y-2"
                  >
                    <p className="font-mono text-xs font-bold text-violet-700">Step {step.step}</p>
                    <input
                      type="text"
                      value={step.title}
                      onChange={(e) =>
                        setHowItWorks((prev) =>
                          prev.map((item, i) =>
                            i === idx ? { ...item, title: e.target.value } : item
                          )
                        )
                      }
                      className="h-9 w-full rounded-xl border border-slate-200 bg-white px-2.5 text-xs font-semibold"
                    />
                    <textarea
                      rows={2}
                      value={step.description}
                      onChange={(e) =>
                        setHowItWorks((prev) =>
                          prev.map((item, i) =>
                            i === idx ? { ...item, description: e.target.value } : item
                          )
                        )
                      }
                      className="w-full rounded-xl border border-slate-200 bg-white p-2 text-xs"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* FAQ CMS */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-display text-sm font-bold text-slate-900">
                  Landing FAQs ({landingFaqs.length}/8)
                </h3>
                {landingFaqs.length < 8 && (
                  <button
                    type="button"
                    onClick={() =>
                      setLandingFaqs((prev) => [
                        ...prev,
                        { id: `faq-${Date.now()}`, question: '', answer: '' },
                      ])
                    }
                    className="inline-flex h-8 items-center gap-1 rounded-xl border border-violet-200 bg-violet-50 px-3 text-xs font-bold text-violet-800 hover:bg-violet-100"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Add FAQ</span>
                  </button>
                )}
              </div>
              <div className="space-y-2.5">
                {landingFaqs.map((faq, idx) => (
                  <div
                    key={faq.id}
                    className="rounded-2xl border border-slate-200/80 bg-slate-50/70 p-3.5 space-y-2"
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={faq.question}
                        onChange={(e) =>
                          setLandingFaqs((prev) =>
                            prev.map((item, i) =>
                              i === idx ? { ...item, question: e.target.value } : item
                            )
                          )
                        }
                        placeholder="Question"
                        className="h-9 flex-1 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setLandingFaqs((prev) => prev.filter((_, i) => i !== idx))
                        }
                        className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100"
                        aria-label="Delete FAQ"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <textarea
                      rows={2}
                      value={faq.answer}
                      onChange={(e) =>
                        setLandingFaqs((prev) =>
                          prev.map((item, i) =>
                            i === idx ? { ...item, answer: e.target.value } : item
                          )
                        )
                      }
                      placeholder="Answer"
                      className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs"
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="flex justify-end border-t border-slate-100 pt-4">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex h-11 items-center gap-2 rounded-xl bg-violet-700 px-6 text-sm font-bold text-white hover:bg-violet-800 disabled:opacity-60 whitespace-nowrap"
          >
            <Save className="h-4 w-4" />
            <span>{saving ? 'Saving Settings...' : 'Save White-Label Settings'}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
