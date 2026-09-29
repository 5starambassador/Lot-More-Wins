import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    message: 'Partners API endpoint ready for Phase 2 implementation',
  });
}
