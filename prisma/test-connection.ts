import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables from .env.local or .env
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function main() {
  console.log('--- Database Connection Test ---');
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    console.warn('⚠️  DATABASE_URL is not set in environment or .env file.');
    console.info('ℹ️  Phase 1 allows development without live database configured.');
    console.info('ℹ️  To connect to PostgreSQL, set DATABASE_URL in .env.local.');
    process.exit(0);
  }

  // Obfuscate password in URL for display
  const maskedUrl = databaseUrl.replace(/:([^@]+)@/, ':****@');
  console.log(`Connecting to: ${maskedUrl}`);

  const prisma = new PrismaClient({
    log: ['error', 'warn'],
  });

  try {
    const startTime = Date.now();
    await prisma.$queryRaw`SELECT 1 as connected;`;
    const latency = Date.now() - startTime;
    console.log(`✅ Database connection successful! (Latency: ${latency}ms)`);
    await prisma.$disconnect();
    process.exit(0);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('❌ Database connection failed:', message);
    console.info('ℹ️  Ensure your PostgreSQL service is running and credentials in DATABASE_URL are correct.');
    await prisma.$disconnect();
    // In Phase 1, DB test exits with 0 or 1 depending on whether connection was required
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal error in database connection test:', err);
  process.exit(1);
});
