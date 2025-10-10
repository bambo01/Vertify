// next.config.js
const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config) => {
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      '@': path.resolve(__dirname, 'src'),

      // 👇 prevent Webpack from trying to bundle these server-only deps
      'pino-pretty': false,
      'pino-std-serializers': false,
      'process-warning': false,
      'sonic-boom': false,
    };
    return config;
  },
};

module.exports = nextConfig;
