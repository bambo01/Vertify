// next.config.js
const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    // Point this to your deployed backend
    const origin = (process.env.NEXT_PUBLIC_API_ORIGIN || 'https://verity.up.railway.app').replace(/\/$/, '');
    return [
      {
        source: '/api/:path*',
        destination: `${origin}/api/:path*`,
      },
    ];
  },

  webpack: (config) => {
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      '@': path.resolve(__dirname, 'src'),

      // prevent bundling server-only deps
      'pino-pretty': false,
      'pino-std-serializers': false,
      'process-warning': false,
      'sonic-boom': false,
    };
    return config;
  },
};

module.exports = nextConfig;
