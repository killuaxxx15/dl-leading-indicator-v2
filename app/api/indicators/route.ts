import { NextResponse } from 'next/server';
import { fetchAll } from '@/lib/fetchIndicators';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const FRED_KEY = process.env.FRED_API_KEY || '';

export async function GET() {
  if (!FRED_KEY || FRED_KEY === 'your_fred_api_key_here') {
    return NextResponse.json({
      values: {},
      fetchedAt: new Date().toISOString(),
      noApiKey: true,
    });
  }

  try {
    const data = await fetchAll(FRED_KEY);
    return NextResponse.json(data, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (e) {
    return NextResponse.json(
      { values: {}, fetchedAt: new Date().toISOString(), error: String(e) },
      { status: 500 }
    );
  }
}
