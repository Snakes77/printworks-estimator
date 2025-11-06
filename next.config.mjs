/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb'
    },
    serverComponentsExternalPackages: ['@sparticuz/chromium']
  },
  typescript: {
    ignoreBuildErrors: false
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'dmc-encore.co.uk',
        pathname: '/wp-content/**',
      },
    ],
  },
};

export default nextConfig;
