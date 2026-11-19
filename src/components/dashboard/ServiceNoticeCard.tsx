import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { resolveBrandName } from '../../config/app.config';
import { useApp } from '../../context/AppContext';

interface NoticeSection {
  title: string;
  bullets?: readonly string[];
  paragraph?: string;
}

const NOTICE_SECTIONS: readonly NoticeSection[] = [
  {
    title: '১. সার্ভিসের ধরন',
    bullets: [
      'প্রতিটি সার্ভিসের কাজের ধরন ও ডেলিভারি পদ্ধতি আলাদা।',
      'অর্ডার করার আগে সার্ভিসের Description, Speed, Start Time এবং অন্যান্য তথ্য দেখে নিন।',
      'সব সার্ভিস একই মানের বা একই গতিতে কাজ করে না।',
    ],
  },
  {
    title: '২. Drop বা সংখ্যা কমে যাওয়া',
    bullets: [
      'কিছু সার্ভিসে ডেলিভারি সম্পন্ন হওয়ার পর ফলোয়ার, লাইক, ভিউ বা অন্যান্য সংখ্যা কমে যেতে পারে। একে Drop বলা হয়।',
      'যেসব সার্ভিসে Drop হওয়ার সম্ভাবনা রয়েছে, সেগুলো ব্যবহারের আগে বিবেচনা করুন।',
      'Non-Drop সার্ভিসে সংখ্যা কমার সম্ভাবনা তুলনামূলক কম হলেও ১০০% স্থায়ী থাকার নিশ্চয়তা নেই।',
    ],
  },
  {
    title: '৩. Refill বা সংখ্যা পুনরায় পূরণ',
    bullets: [
      'যেসব সার্ভিসে Refill সুবিধা রয়েছে, সেগুলোতে নির্দিষ্ট সময়ের মধ্যে Drop হলে পুনরায় পূরণের সুযোগ থাকতে পারে।',
      'No Refill সার্ভিসে Drop হলে পুনরায় পূরণ করা হবে না।',
      'Refill-এর মেয়াদ ও শর্ত সার্ভিসের বিবরণ অনুযায়ী প্রযোজ্য হবে।',
    ],
  },
  {
    title: '৪. অর্ডার দেওয়ার আগে সতর্কতা',
    bullets: [
      'সঠিক Username, Link বা Post URL প্রদান করুন।',
      'অর্ডার চলাকালীন অ্যাকাউন্ট বা পোস্ট Public রাখুন।',
      'একই লিংকে একাধিক অর্ডার একসঙ্গে করবেন না।',
      'চলমান অর্ডারের মধ্যে নতুন অর্ডার দিলে ডেলিভারিতে সমস্যা হতে পারে।',
    ],
  },
  {
    title: '৫. অর্ডার সম্পন্ন হওয়ার পর',
    bullets: [
      'অর্ডার Processing বা In Progress অবস্থায় থাকলে অপেক্ষা করুন।',
      'ভুল লিংক বা ভুল তথ্য দিয়ে অর্ডার করলে ডেলিভারি ব্যর্থ হতে পারে।',
      'সফলভাবে সম্পন্ন হওয়া অর্ডার সাধারণত বাতিল বা রিফান্ডযোগ্য নয়।',
      'সার্ভিসের নির্ধারিত সময়ের মধ্যে ডেলিভারি না হলে Support Ticket খুলুন।',
    ],
  },
  {
    title: '৬. বিশেষ ঘোষণা',
    paragraph:
      'আমরা সর্বোচ্চ চেষ্টা করি ভালো মানের সার্ভিস প্রদান করতে। তবে সোশ্যাল মিডিয়া প্ল্যাটফর্মের নিজস্ব নিয়ম, আপডেট ও পরিবর্তনের কারণে সার্ভিসের ফলাফল পরিবর্তিত হতে পারে।',
  },
  {
    title: '৭. পেমেন্ট ও ব্যালেন্স সংক্রান্ত নির্দেশনা',
    bullets: [
      'পেমেন্ট করার পর ব্যালেন্স আপডেট হতে কিছুক্ষণ অপেক্ষা করুন।',
      'ব্যালেন্স যুক্ত না হলে পুনরায় পেমেন্ট করবেন না।',
      'সমস্যা হলে Transaction ID ও পেমেন্ট স্ক্রিনশটসহ Support Ticket খুলুন।',
      'সঠিক নম্বরে ও সঠিক পরিমাণে পেমেন্ট নিশ্চিত করুন।',
      'পেমেন্ট যাচাই সম্পন্ন হওয়ার পর ব্যালেন্স যুক্ত হবে।',
    ],
  },
] as const;

export function ServiceNoticeCard() {
  const { systemSettings } = useApp();
  const brandName = resolveBrandName(systemSettings?.websiteName);

  return (
    <section
      aria-labelledby="service-notice-heading"
      className="overflow-hidden rounded-2xl sm:rounded-3xl border border-amber-200/80 bg-white shadow-xs"
    >
      {/* Header */}
      <div className="border-b border-amber-100 bg-gradient-to-r from-amber-50/90 via-amber-50/50 to-violet-50/50 px-4 py-3.5 sm:px-6 sm:py-4">
        <div className="flex items-start gap-3">
          <span
            aria-hidden="true"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-amber-200 bg-amber-100/80 text-amber-700 shadow-2xs"
          >
            <AlertTriangle className="h-4.5 w-4.5" />
          </span>
          <div className="min-w-0">
            <h2
              id="service-notice-heading"
              className="font-display text-sm sm:text-base font-extrabold text-slate-950 leading-snug"
            >
              ⚠️ গুরুত্বপূর্ণ সার্ভিস নোটিশ ও নির্দেশনা
            </h2>
            <p className="mt-1 text-xs sm:text-[13px] leading-relaxed text-slate-700">
              প্রিয় গ্রাহক, আমাদের থেকে কোনো সার্ভিস অর্ডার করার আগে নিচের বিষয়গুলো ভালোভাবে পড়ে নিন।
            </p>
          </div>
        </div>
      </div>

      {/* 7 Sections */}
      <div className="p-3.5 sm:p-5">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-3.5">
          {NOTICE_SECTIONS.map((section, idx) => {
            const isFullWidth = idx === NOTICE_SECTIONS.length - 1;
            return (
              <div
                key={section.title}
                className={`rounded-xl border border-slate-200/75 bg-slate-50/60 p-3.5 sm:p-4 ${
                  isFullWidth ? 'md:col-span-2' : ''
                }`}
              >
                <h3 className="font-display text-[13px] sm:text-sm font-bold text-violet-950 leading-snug">
                  {section.title}
                </h3>

                {section.paragraph && (
                  <p className="mt-2 text-xs sm:text-[13px] leading-[1.7] text-slate-700">
                    {section.paragraph}
                  </p>
                )}

                {section.bullets && (
                  <ul className="mt-2 space-y-1.5">
                    {section.bullets.map((bullet) => (
                      <li
                        key={bullet}
                        className="flex items-start gap-2 text-xs sm:text-[13px] leading-[1.65] text-slate-700"
                      >
                        <span
                          aria-hidden="true"
                          className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-violet-600"
                        />
                        <span>{bullet}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Closing Consent & Sign-off */}
      <div className="flex flex-col gap-1 border-t border-violet-100 bg-violet-50/50 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p className="text-xs sm:text-[13px] font-semibold leading-relaxed text-slate-800">
          অর্ডার করার মাধ্যমে আপনি উপরোক্ত নিয়ম ও শর্তাবলিতে সম্মতি প্রদান করছেন।
        </p>
        <p className="text-xs sm:text-[13px] font-bold text-violet-700 shrink-0">
          ধন্যবাদ – {brandName}
        </p>
      </div>
    </section>
  );
}
