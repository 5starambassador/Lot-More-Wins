import path from 'node:path';
import { fileURLToPath } from 'node:url';

const monorepoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Dependencies are hoisted to the monorepo root; trace from there so serverless
  // functions include the Prisma query engine and other root node_modules.
  outputFileTracingRoot: monorepoRoot,
  // Fonts and logo read from disk by the QR card renderer (lib/qr-card).
  outputFileTracingIncludes: { '/api/partner/qr-card': ['./assets/**/*'] },
  transpilePackages: ['@lotmorewins/types', '@lotmorewins/validation', '@lotmorewins/api-client'],
};

export default nextConfig;
