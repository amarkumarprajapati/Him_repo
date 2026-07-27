import { clientEnv } from '@/utils/env';

export const siteConfig = {
  name: clientEnv.NEXT_PUBLIC_APP_NAME,
  fullName: 'Integrated Telemetry Monitoring & Synchronization System',
  description:
    'Secure, reliable, synchronized telemetry monitoring for on-premise deployments.',
  tagline: 'SECURE. RELIABLE. SYNCHRONIZED.',
} as const;

export type SiteConfig = typeof siteConfig;
