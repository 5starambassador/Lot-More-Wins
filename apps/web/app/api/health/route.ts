import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  let dbStatus: 'connected' | 'disconnected' | 'not_configured' = 'not_configured';

  if (process.env.DATABASE_URL) {
    try {
      await prisma.$queryRaw`SELECT 1`;
      dbStatus = 'connected';
    } catch {
      dbStatus = 'disconnected';
    }
  }

  return NextResponse.json(
    {
      status: 'ok',
      service: 'lot-more-wins-api',
      timestamp: new Date().toISOString(),
      database: dbStatus,
    },
    { status: 200 }
  );
}
