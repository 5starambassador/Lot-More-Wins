/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@lotmorewins/types', '@lotmorewins/validation', '@lotmorewins/api-client'],
};

export default nextConfig;
