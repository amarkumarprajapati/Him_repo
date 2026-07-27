import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  allowedDevOrigins: ['10.75.197.62', 'localhost', 'himshraven-c2.in', 'himshraven-c2.in:30301', '192.168.43.194', '192.168.43.194:30301', '192.168.1.122', '192.168.1.122:30301', '192.78.10.34', '192.78.10.34:30301', '10.10.202.21', '10.10.202.21:30301'],
  reactStrictMode: false,
  poweredByHeader: false,
  compress: true,
  output: 'standalone',
  experimental: {
    optimizePackageImports: [
      'lucide-react',
      'framer-motion',
      'react-leaflet',
      '@radix-ui/react-checkbox',
      '@radix-ui/react-label',
      '@radix-ui/react-select',
      '@radix-ui/react-slot',
      '@radix-ui/react-tabs',
      '@tanstack/react-query',
      '@reduxjs/toolkit',
      'react-redux',
      'react-toastify',
      'zod',
    ],
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**' },
    ],
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-DNS-Prefetch-Control', value: 'on' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
