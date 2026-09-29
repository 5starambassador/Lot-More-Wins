import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    message: 'Points API endpoint ready for Phase 2 implementation',
  });
}
