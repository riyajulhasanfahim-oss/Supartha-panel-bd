export type PlatformId =
  | 'instagram'
  | 'youtube'
  | 'facebook'
  | 'tiktok'
  | 'telegram'
  | 'x'
  | 'linkedin'
  | 'webtraffic'
  | 'web-traffic'
  | 'more';

export interface PlatformCategory {
  id: PlatformId;
  name: string;
  shortName: string;
  icon?: string;
  description: string;
  accentColor: string;
  bgTint: string;
  serviceCount: number;
}

export type ServiceType =
  | 'Followers'
  | 'Likes'
  | 'Views'
  | 'Comments'
  | 'Subscribers'
  | 'Members'
  | 'Shares'
  | 'Other';

export const SERVICE_TYPE_OPTIONS: ServiceType[] = [
  'Followers',
  'Likes',
  'Views',
  'Comments',
  'Subscribers',
  'Members',
  'Shares',
  'Other',
];

export interface SmmService {
  id: string;
  categoryId: PlatformId;
  name: string;
  serviceType?: ServiceType;
  ratePerThousand: number;
  minQuantity: number;
  maxQuantity: number;
  averageTime: string;
  deliverySpeed: string;
  refillGuaranteed: boolean;
  description: string;
}
