'use client';

import { cn } from '@/utils/cn';

function Shimmer({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-lg bg-slate-200 dark:bg-slate-800',
        className
      )}
    >
      <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/20 dark:via-white/10 to-transparent" />
    </div>
  );
}

export function StatCardSkeleton() {
  return (
    <div className="bg-white dark:bg-[#0f172a] rounded-xl border border-slate-200 dark:border-white/5 p-4 flex flex-col justify-between h-[140px] shadow-sm">
      <div className="flex justify-between items-start">
        <Shimmer className="h-3 w-24" />
        <Shimmer className="h-4 w-4 rounded-full" />
      </div>
      <div className="flex flex-col gap-2">
        <Shimmer className="h-8 w-16" />
        <Shimmer className="h-3 w-28" />
      </div>
    </div>
  );
}

export function TableCardSkeleton() {
  return (
    <div className="bg-white dark:bg-[#0f172a] rounded-2xl border border-slate-200 dark:border-white/5 p-5 flex flex-col shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
        <Shimmer className="h-3 w-28" />
        <div className="flex items-center gap-3">
          <Shimmer className="h-7 w-48 rounded-md" />
          <Shimmer className="h-7 w-28 rounded-md" />
        </div>
      </div>
      <div className="space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Shimmer key={i} className="h-10 w-full" />
        ))}
      </div>
    </div>
  );
}

export function SystemResourcesSkeleton() {
  return (
    <div className="bg-white dark:bg-[#0f172a] rounded-2xl border border-slate-200 dark:border-white/5 p-5 flex flex-col shadow-sm">
      <Shimmer className="h-3 w-36 mb-4" />
      <div className="flex-1 grid grid-cols-2 gap-4">
        <div className="flex flex-col h-full gap-3">
          <Shimmer className="h-3 w-20" />
          <Shimmer className="h-8 w-16" />
          <Shimmer className="flex-1 w-full" />
        </div>
        <div className="flex flex-col h-full gap-3">
          <Shimmer className="h-3 w-24" />
          <Shimmer className="h-8 w-16" />
          <Shimmer className="flex-1 w-full" />
        </div>
      </div>
    </div>
  );
}

export function NodeStatusSkeleton() {
  return (
    <div className="bg-white dark:bg-[#0f172a] rounded-2xl border border-slate-200 dark:border-white/5 p-5 flex flex-col shadow-sm">
      <div className="flex justify-between items-center mb-4">
        <Shimmer className="h-3 w-20" />
        <Shimmer className="h-3 w-14" />
      </div>
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Shimmer key={i} className="h-8 w-full" />
        ))}
      </div>
    </div>
  );
}

export function HeartbeatOverviewSkeleton() {
  return (
    <div className="bg-white dark:bg-[#0f172a] rounded-2xl border border-slate-200 dark:border-white/5 p-5 flex flex-col h-[240px] shadow-sm">
      <Shimmer className="h-3 w-32 mb-2" />
      <div className="flex-1 flex items-center justify-between px-2 gap-4">
        <Shimmer className="h-32 w-32 rounded-full" />
        <div className="flex flex-col gap-3 w-32">
          <Shimmer className="h-4 w-full" />
          <Shimmer className="h-4 w-full" />
          <Shimmer className="h-4 w-full" />
        </div>
      </div>
    </div>
  );
}

export function RecentActivitySkeleton() {
  return (
    <div className="bg-white dark:bg-[#0f172a] rounded-2xl border border-slate-200 dark:border-white/5 p-5 flex flex-col flex-1 min-h-[180px] shadow-sm">
      <div className="flex justify-between items-center mb-4">
        <Shimmer className="h-3 w-36" />
        <Shimmer className="h-3 w-12" />
      </div>
      <div className="flex flex-col gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex items-center justify-between gap-3">
            <div className="flex items-start gap-3 flex-1">
              <Shimmer className="h-4 w-4 rounded-full" />
              <div className="flex flex-col gap-1 flex-1">
                <Shimmer className="h-3 w-full" />
                <Shimmer className="h-2.5 w-24" />
              </div>
            </div>
            <Shimmer className="h-3 w-14" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function MapViewSkeleton() {
  return (
    <div className="max-w-[1600px] mx-auto pb-10 animate-pulse">
      <div className="mb-6">
        <div className="h-8 w-40 bg-slate-200 dark:bg-slate-800 rounded-lg" />
      </div>

      <div className="flex flex-col gap-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <StatCardSkeleton />
          <StatCardSkeleton />
          <StatCardSkeleton />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <StatCardSkeleton />
          <StatCardSkeleton />
          <StatCardSkeleton />
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
          <div className="xl:col-span-2 flex flex-col gap-5">
            <TableCardSkeleton />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 h-[380px]">
              <SystemResourcesSkeleton />
              <NodeStatusSkeleton />
            </div>
          </div>
          <div className="flex flex-col gap-5">
            <HeartbeatOverviewSkeleton />
            <RecentActivitySkeleton />
          </div>
        </div>
      </div>
    </div>
  );
}
