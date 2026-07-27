import type { Metadata } from 'next';
import { Suspense } from 'react';
import { HimshravanBranding } from '@/components/auth/himshravan-branding';
import { LoginForm } from '@/components/auth/login-form';
import { RadarStatus } from '@/components/auth/radar-status';

export const metadata: Metadata = {
  title: 'Sign in',
  description: 'Sign in to HIMSHRAVAN — Integrated Telemetry Monitoring & Synchronization System.',
};

export default function LoginPage() {
  return (
    <div className="relative h-screen w-screen overflow-hidden bg-[#04080F] text-slate-100 selection:bg-[#4ade80]/30">
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#132c45]/40 via-[#04080F] to-[#04080F]" />
      </div>

      <div className="relative z-10 mx-auto grid h-full w-full max-w-[1440px] grid-cols-1 items-center px-4 lg:grid-cols-3 lg:gap-6 lg:px-6 xl:gap-10">
        <section className="hidden h-full min-w-0 lg:flex lg:items-center lg:justify-center">
          <HimshravanBranding />
        </section>
        <section className="flex h-full min-w-0 items-center justify-center">
          <Suspense fallback={null}>
            <LoginForm />
          </Suspense>
        </section>
        <section className="hidden h-full min-w-0 lg:flex lg:items-center lg:justify-center">
          <RadarStatus />
        </section>
      </div>
      <p className="absolute inset-x-0 bottom-3 z-20 text-center text-[10px] font-bold tracking-[0.2em] text-slate-500/70">
        © 2026 HIMSHRAVAN. ALL RIGHTS RESERVED.
      </p>
    </div>
  );
}
