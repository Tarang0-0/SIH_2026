"use client";

import React from 'react';

export function HeroCardSkeleton() {
  return (
    <div className="glass-panel rounded-3xl p-6 sm:p-8 border border-white/10 space-y-6">
      {/* Header skeleton */}
      <div className="flex items-center justify-between border-b border-white/10 pb-5">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl skeleton-shimmer"></div>
          <div className="space-y-2">
            <div className="w-48 h-6 rounded-lg skeleton-shimmer"></div>
            <div className="w-32 h-3.5 rounded-lg skeleton-shimmer"></div>
          </div>
        </div>
        <div className="w-32 h-8 rounded-xl skeleton-shimmer"></div>
      </div>

      {/* 2 Forecast Cards skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-4 border-b border-white/10">
        <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/5 space-y-3">
          <div className="w-24 h-3 rounded skeleton-shimmer"></div>
          <div className="w-36 h-5 rounded skeleton-shimmer"></div>
          <div className="w-28 h-10 rounded-xl skeleton-shimmer"></div>
          <div className="w-40 h-3 rounded skeleton-shimmer"></div>
        </div>
        <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/5 space-y-3">
          <div className="w-24 h-3 rounded skeleton-shimmer"></div>
          <div className="w-36 h-5 rounded skeleton-shimmer"></div>
          <div className="w-28 h-10 rounded-xl skeleton-shimmer"></div>
          <div className="w-40 h-3 rounded skeleton-shimmer"></div>
        </div>
      </div>

      {/* Footer skeleton */}
      <div className="flex items-center justify-between pt-2">
        <div className="w-40 h-4 rounded skeleton-shimmer"></div>
        <div className="w-32 h-6 rounded-lg skeleton-shimmer"></div>
      </div>
    </div>
  );
}

export function RouteTrackerSkeleton() {
  return (
    <div className="glass-panel rounded-2xl p-5 border border-white/10 space-y-4">
      <div className="flex justify-between items-center">
        <div className="w-36 h-4 rounded skeleton-shimmer"></div>
        <div className="w-24 h-4 rounded skeleton-shimmer"></div>
      </div>
      <div className="py-4 flex justify-between gap-4">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex flex-col items-center space-y-2">
            <div className="w-5 h-5 rounded-full skeleton-shimmer"></div>
            <div className="w-10 h-3 rounded skeleton-shimmer"></div>
            <div className="w-12 h-3 rounded skeleton-shimmer"></div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function TableSkeleton() {
  return (
    <div className="space-y-3">
      <div className="flex justify-between">
        <div className="w-48 h-4 rounded skeleton-shimmer"></div>
        <div className="w-28 h-4 rounded skeleton-shimmer"></div>
      </div>
      <div className="rounded-xl border border-white/10 bg-slate-900/40 p-4 space-y-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="flex items-center justify-between gap-4 py-2 border-b border-white/5 last:border-0">
            <div className="w-32 h-4 rounded skeleton-shimmer"></div>
            <div className="w-16 h-4 rounded skeleton-shimmer"></div>
            <div className="w-16 h-4 rounded skeleton-shimmer"></div>
            <div className="w-20 h-4 rounded skeleton-shimmer"></div>
          </div>
        ))}
      </div>
    </div>
  );
}
