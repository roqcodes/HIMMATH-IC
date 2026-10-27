import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";

const withSerwist = withSerwistInit({
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
  register: false,
  disable: process.env.NODE_ENV === 'development',
});

const securityHeaders = [
  {
    key: 'X-Frame-Options',
    value: 'DENY',
  },
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff',
  },
  {
    key: 'Referrer-Policy',
    value: 'strict-origin-when-cross-origin',
  },
  {
    key: 'X-DNS-Prefetch-Control',
    value: 'on',
  },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
  {
    key: 'Permissions-Policy',
    value: 'camera=(self), microphone=(), geolocation=()',
  },
];

/** Legacy branch slug — must not match HQ `/admin/*` ASIC routes. */
const legacyBranchSlug = ':slug((?!admin$)[^/]+)';

const nextConfig: NextConfig = {
  poweredByHeader: false,
  productionBrowserSourceMaps: true,
  experimental: {
    serverActions: {
      bodySizeLimit: '32mb',
    },
  },
  async redirects() {
    return [
      { source: '/branch/admin', destination: '/admin/sales', permanent: false },
      { source: '/branch/admin/:path*', destination: '/admin/:path*', permanent: false },
      { source: '/warehouse/admin', destination: '/admin/warehouse', permanent: false },
      { source: '/warehouse/admin/:path*', destination: '/admin/warehouse', permanent: false },
      { source: '/admin/ic-transfer-admin', destination: '/admin/sales', permanent: false },
      { source: '/admin/ic-transfer-admin/purchase', destination: '/admin/purchases', permanent: false },
      { source: '/admin/ic-transfer-admin/sales', destination: '/admin/sales', permanent: false },
      { source: '/admin/ic-transfer-admin/warehouse', destination: '/admin/warehouse', permanent: false },
      { source: '/admin/ic-transfer-admin/warehouse/:id', destination: '/admin/warehouse/:id', permanent: false },
      { source: '/admin/ic-transfer-admin/regions', destination: '/admin/regions', permanent: false },
      { source: '/admin/ic-transfer-admin/transactions', destination: '/admin/sales', permanent: false },
      { source: '/admin/ic-transfer-admin/non-stock-deals', destination: '/admin/sales', permanent: false },
      { source: '/admin/ic-transfer-admin/metal', destination: '/admin/sales', permanent: false },
      { source: '/admin/transactions', destination: '/admin/sales', permanent: false },
      { source: '/admin/non-stock-deals', destination: '/admin/sales', permanent: false },
      { source: '/admin/metal', destination: '/admin/sales', permanent: false },
      { source: '/admin/ic-transfer-admin/finance', destination: '/admin/ic-finance', permanent: false },
      { source: '/admin/ic-transfer-admin/settings/suppliers', destination: '/admin/suppliers', permanent: false },
      { source: '/admin/ic-transfer-admin/settings/rates', destination: '/admin/rates', permanent: false },
      { source: '/admin/ic-transfer-admin/settings/agents', destination: '/admin/agents', permanent: false },
      { source: '/admin/ic-transfer-admin/settings/commission', destination: '/admin/commission', permanent: false },
      { source: '/group/:path*', destination: '/admin/sales', permanent: false },
      { source: '/funds/:path*', destination: '/admin/sales', permanent: false },
      { source: '/physical/:path*', destination: '/admin/sales', permanent: false },
      { source: '/physical-deals/:path*', destination: '/admin/sales', permanent: false },
      { source: '/usdt/:path*', destination: '/admin/sales', permanent: false },
      { source: '/currency/:path*', destination: '/admin/sales', permanent: false },
      { source: '/investors/:path*', destination: '/admin/users', permanent: false },
      { source: '/invoices/:path*', destination: '/admin/sales', permanent: false },
      { source: '/finance/:path*', destination: '/admin/ic-finance', permanent: false },
      { source: '/reports/:path*', destination: '/admin/reconciliation', permanent: false },
      { source: '/users', destination: '/admin/users', permanent: false },
      { source: '/branches', destination: '/admin/branches', permanent: false },
      { source: '/settings', destination: '/admin/global-settings', permanent: false },
      { source: `/${legacyBranchSlug}/ic-transfer-branch`, destination: '/branch/:slug/orders', permanent: false },
      { source: `/${legacyBranchSlug}/ic-transfer`, destination: '/branch/:slug/orders', permanent: false },
      { source: `/${legacyBranchSlug}/ic-transfer/purchase`, destination: '/branch/:slug/purchases', permanent: false },
      { source: `/${legacyBranchSlug}/ic-transfer/warehouse`, destination: '/branch/:slug/warehouse', permanent: false },
      { source: `/${legacyBranchSlug}/ic-transfer/suppliers`, destination: '/branch/:slug/suppliers', permanent: false },
      { source: `/${legacyBranchSlug}/ic-transfer/rates`, destination: '/branch/:slug/rates', permanent: false },
      { source: `/${legacyBranchSlug}/ic-transfer-admin`, destination: '/branch/:slug/sales', permanent: false },
      { source: `/${legacyBranchSlug}/ic-transfer-admin/purchase`, destination: '/branch/:slug/purchases', permanent: false },
      { source: `/${legacyBranchSlug}/ic-transfer-admin/sales`, destination: '/branch/:slug/sales', permanent: false },
      { source: `/${legacyBranchSlug}/ic-transfer-admin/warehouse/:path*`, destination: '/branch/:slug/warehouse', permanent: false },
      { source: `/${legacyBranchSlug}/ic-transfer-admin/regions`, destination: '/admin/regions', permanent: false },
      { source: `/${legacyBranchSlug}/ic-funds`, destination: '/branch/:slug/payments', permanent: false },
      { source: `/${legacyBranchSlug}/ic-funds/:section`, destination: '/branch/:slug/:section', permanent: false },
      { source: `/${legacyBranchSlug}/warehouse/order-settlement`, destination: '/delivery/:slug/settlement', permanent: false },
      { source: `/${legacyBranchSlug}/group/:path*`, destination: '/branch/:slug/orders', permanent: false },
      { source: `/${legacyBranchSlug}/funds/:path*`, destination: '/branch/:slug/payments', permanent: false },
      { source: `/${legacyBranchSlug}/physical/:path*`, destination: '/branch/:slug/orders', permanent: false },
      { source: `/${legacyBranchSlug}/physical-deals/:path*`, destination: '/branch/:slug/orders', permanent: false },
      { source: `/${legacyBranchSlug}/usdt/:path*`, destination: '/branch/:slug/orders', permanent: false },
      { source: `/${legacyBranchSlug}/currency/:path*`, destination: '/branch/:slug/orders', permanent: false },
      { source: `/${legacyBranchSlug}/investors/:path*`, destination: '/branch/:slug/accounts', permanent: false },
      { source: `/${legacyBranchSlug}/customers`, destination: '/branch/:slug/accounts', permanent: false },
      { source: `/${legacyBranchSlug}/products/:path*`, destination: '/branch/:slug/orders', permanent: false },
      { source: `/${legacyBranchSlug}/finance/:path*`, destination: '/branch/:slug/reports', permanent: false },
      { source: `/${legacyBranchSlug}/settings`, destination: '/branch/:slug/rates', permanent: false },
      {
        source: `/${legacyBranchSlug}/ic-transfer/sales`,
        destination: '/:slug/ic-transfer-admin/sales',
        permanent: true,
      },
      {
        source: `/${legacyBranchSlug}/ic-transfer/regions`,
        destination: '/:slug/ic-transfer-admin/regions',
        permanent: true,
      },
      {
        source: `/${legacyBranchSlug}/ic-transfer/settings/:path*`,
        destination: '/:slug/ic-transfer-admin/settings/:path*',
        permanent: true,
      },
      {
        source: `/${legacyBranchSlug}/ic-transfer/finance`,
        destination: '/:slug/ic-transfer-admin/finance',
        permanent: true,
      },
    ];
  },
  async headers() {
    return [
      {
        // Apply to all routes
        source: '/(.*)',
        headers: securityHeaders,
      },
    ];
  },
};

export default withSerwist(nextConfig);

// Trigger server restart

// Trigger server restart after successful deletion of [id]
