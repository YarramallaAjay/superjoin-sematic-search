/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@superjoin/database', '@superjoin/llm-config'],
  outputFileTracingRoot: require('path').join(__dirname, '../../'),
  experimental: {
    // Enable webpack 5 features
    esmExternals: true
  },
  webpack: (config, { buildId, dev, isServer, defaultLoaders, webpack }) => {
    // Handle workspace packages
    config.resolve.alias = {
      ...config.resolve.alias,
      '@superjoin/database': require('path').resolve(__dirname, '../../packages/database/src'),
      '@superjoin/llm-config': require('path').resolve(__dirname, '../../packages/llm-config/src'),
      '@superjoin/backend': require('path').resolve(__dirname, '../backend/src'),
    };
    
    // Don't bundle backend files, just resolve them
    if (isServer) {
      config.externals = [...(config.externals || []), '@superjoin/backend'];
    }
    
    return config;
  },
};

module.exports = nextConfig;