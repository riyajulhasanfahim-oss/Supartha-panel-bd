import React from 'react';
import { BannerSlider } from '../components/dashboard/BannerSlider';
import { StatsGrid } from '../components/dashboard/StatsGrid';
import { NewOrderCard } from '../components/dashboard/NewOrderCard';
import { PopularServices } from '../components/dashboard/PopularServices';
import { RecentOrdersCard } from '../components/dashboard/RecentOrdersCard';
import { SupportBanner } from '../components/dashboard/SupportBanner';
import { ServiceNoticeCard } from '../components/dashboard/ServiceNoticeCard';

export function DashboardHome() {
  return (
    <div className="space-y-4 sm:space-y-5">
      <BannerSlider />
      <PopularServices />
      <StatsGrid />
      <NewOrderCard />
      <RecentOrdersCard />
      <SupportBanner />
      <ServiceNoticeCard />
    </div>
  );
}
