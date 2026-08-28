const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  compiler: { removeConsole: process.env.NODE_ENV === "production" },
  experimental: { optimizePackageImports: ["@seul/ui"] },
  transpilePackages: ['@seul/ui', '@seul/tokens', '@seul/icons'],
};

module.exports = nextConfig;
