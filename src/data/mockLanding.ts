export interface LandingFeature {
  id: string;
  index: string;
  title: string;
  description: string;
  metric: string;
}

export interface HowItWorksStep {
  step: string;
  title: string;
  description: string;
}

export interface WhyChooseUsItem {
  id: string;
  title: string;
  description: string;
}

export const LANDING_FEATURES: LandingFeature[] = [
  {
    id: 'feat-speed',
    index: '01',
    title: 'Automated Instant Order Routing',
    description: 'Orders dispatch within seconds after submission with real-time progress tracking directly in your customer workspace.',
    metric: 'Under 30s average start',
  },
  {
    id: 'feat-pricing',
    index: '02',
    title: 'Direct Wholesale Rate Structure',
    description: 'Transparent per-1,000-unit pricing with zero hidden service fees, tailored for creators, agencies, and resellers.',
    metric: 'Up to 40% reseller savings',
  },
  {
    id: 'feat-refill',
    index: '03',
    title: '30-Day Refill Protection',
    description: 'Eligible follower and subscriber packages include automated refill monitoring so campaign counts stay consistent.',
    metric: '99.2% delivery stability',
  },
  {
    id: 'feat-mobile',
    index: '04',
    title: 'Mobile-First Control Center',
    description: 'Place bulk or single campaigns from any smartphone in three taps—no desktop spreadsheet wrangling required.',
    metric: '24/7 ticket & order support',
  },
];

export const HOW_IT_WORKS_STEPS: HowItWorksStep[] = [
  {
    step: '01',
    title: 'Create Your Account',
    description: 'Sign up in seconds to access the unified customer dashboard and full multi-platform service catalog.',
  },
  {
    step: '02',
    title: 'Add Funds Securely',
    description: 'Top up your wallet using local mobile banking or card options with clear transaction receipts.',
  },
  {
    step: '03',
    title: 'Select Service & Link',
    description: 'Choose your target social network, pick a quality tier, enter the post or profile link, and set quantity.',
  },
  {
    step: '04',
    title: 'Track Live Delivery',
    description: 'Monitor pending, processing, and completed orders from a clean single-screen activity feed.',
  },
];

export const WHY_CHOOSE_US_ITEMS: WhyChooseUsItem[] = [
  {
    id: 'why-1',
    title: 'Native Currency & Familiar Flow',
    description: 'Built natively around your configured currency pricing and straightforward wallet top-ups without confusing exchange math.',
  },
  {
    id: 'why-2',
    title: 'Multi-Platform Coverage',
    description: 'Manage Instagram, YouTube, Facebook, TikTok, Telegram, and X campaigns from one consistent interface.',
  },
  {
    id: 'why-3',
    title: 'Dedicated Human Support',
    description: 'Reach our support desk directly from any order row whenever you need delivery clarification or refill assistance.',
  },
  {
    id: 'why-4',
    title: 'Reseller-Ready Scalability',
    description: 'Structured for future API key access, bulk order presets, and high-volume agency fulfillment.',
  },
];
