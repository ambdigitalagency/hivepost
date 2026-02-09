/** @type {import('next').NextConfig} */
const nextConfig = {
  // 开发环境禁用 webpack 缓存，避免 .next 与源码不同步导致 MODULE_NOT_FOUND（948.js、vendor-chunks/next-auth.js）
  webpack: (config, { dev }) => {
    if (dev) config.cache = false;
    return config;
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
      {
        protocol: 'https',
        hostname: 'replicate.delivery',
        pathname: '/**',
      },
    ],
  },
};

export default nextConfig;
