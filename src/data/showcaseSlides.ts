import socialBoostImg from '../assets/images/smm_social_boost_banner_1795012749964.jpg';
import youtubeCreatorImg from '../assets/images/smm_youtube_creator_banner_1795012751786.jpg';
import reelsTiktokImg from '../assets/images/smm_reels_tiktok_banner_1795012752222.jpg';
import multiPlatformImg from '../assets/images/smm_multi_platform_banner_1795012752193.jpg';

export type ShowcaseTargetAction = 'services' | 'new-order' | 'funds' | 'api';

export interface ShowcaseSlide {
  id: string;
  tabLabel: string;
  kicker: string;
  title: string;
  subtitle: string;
  ctaLabel: string;
  targetAction: ShowcaseTargetAction;
  metricValue: string;
  metricLabel: string;
  imageUrl: string;
  fallbackGradient: string;
  isArtworkBanner?: boolean;
  panelSurfaceClass?: string;
}

export const SHOWCASE_SLIDES: readonly ShowcaseSlide[] = [
  {
    id: 'supartha-welcome-banner',
    tabLabel: '01. Supartha Panel',
    kicker: 'Official Trusted SMM Panel',
    title: 'Welcome to Supartha Panel — Grow Fast. Grow Smart.',
    subtitle:
      'Followers, likes, views & subscribers with instant delivery, 100% safe execution, and affordable BDT pricing.',
    ctaLabel: 'Join Now',
    targetAction: 'new-order',
    metricValue: '24/7',
    metricLabel: 'Customer Support',
    imageUrl: '/assets/aistudio/file_0000000053ac81faba1c893d99347b82_7ff0f8a1.png',
    fallbackGradient: 'from-[#2A0958] via-[#4C1D95] to-[#1E1B4B]',
    isArtworkBanner: true,
    panelSurfaceClass: 'bg-gradient-to-br from-[#160530] via-[#2C0E5E] to-[#120729]',
  },
  {
    id: 'supartha-growth-banner',
    tabLabel: '02. Get Started',
    kicker: 'Instagram · YouTube · TikTok · Facebook',
    title: 'Boost Your Social Media Presence Today',
    subtitle:
      'Low prices, reliable fulfillment, and instant delivery across Instagram, YouTube, Facebook, TikTok & Telegram.',
    ctaLabel: 'Get Started Now',
    targetAction: 'services',
    metricValue: '100%',
    metricLabel: 'Safe & Reliable',
    imageUrl: '/assets/aistudio/file_0000000084348211bebf8dc443028bd1_e0c8d2d6.png',
    fallbackGradient: 'from-[#020817] via-[#061A44] to-[#0A2558]',
    isArtworkBanner: true,
    panelSurfaceClass: 'bg-gradient-to-br from-[#020614] via-[#06183E] to-[#040B24]',
  },
  {
    id: 'social-boost',
    tabLabel: '03. Instagram & Likes',
    kicker: 'Instagram & Social Engagement',
    title: 'Boost Instagram Followers, Likes & Viral Reach',
    subtitle:
      'High-quality followers, instant post likes, and non-drop packages built for creators and brands.',
    ctaLabel: 'Boost Instagram',
    targetAction: 'services',
    metricValue: '180+',
    metricLabel: 'Active Services',
    imageUrl: socialBoostImg,
    fallbackGradient: 'from-[#170A35] via-[#2B1261] to-[#0F172A]',
  },
  {
    id: 'youtube-growth',
    tabLabel: '04. YouTube Growth',
    kicker: 'YouTube Studio Growth',
    title: 'Skyrocket YouTube Views, Watch Time & Subscribers',
    subtitle:
      'High-retention video views and watch hours with live progress counters and refill coverage.',
    ctaLabel: 'Explore YouTube',
    targetAction: 'new-order',
    metricValue: '< 30s',
    metricLabel: 'Avg Order Start',
    imageUrl: youtubeCreatorImg,
    fallbackGradient: 'from-[#0F172A] via-[#1E1B4B] to-[#312E81]',
  },
  {
    id: 'reels-tiktok',
    tabLabel: '05. TikTok & Reels',
    kicker: 'Short-Form Viral Boost',
    title: 'Go Viral Faster on TikTok & Facebook Reels',
    subtitle:
      'Fast-start video views, shares, and followers engineered to push your Reels into trending feeds.',
    ctaLabel: 'Boost Reels & TikTok',
    targetAction: 'services',
    metricValue: '24/7',
    metricLabel: 'Auto Delivery',
    imageUrl: reelsTiktokImg,
    fallbackGradient: 'from-[#160B2E] via-[#2A1459] to-[#1E293B]',
  },
  {
    id: 'multi-platform',
    tabLabel: '06. All Platforms',
    kicker: 'Facebook · Telegram · Reseller Hub',
    title: 'All Social Networks in One Fast Reseller Panel',
    subtitle:
      'Manage Facebook pages, Telegram channels, and bulk orders smoothly with local BDT wallet top-ups.',
    ctaLabel: 'View All Services',
    targetAction: 'funds',
    metricValue: 'API v2',
    metricLabel: 'Reseller Ready',
    imageUrl: multiPlatformImg,
    fallbackGradient: 'from-[#111827] via-[#1E1B4B] to-[#3B0764]',
  },
] as const;
