import { NextResponse } from 'next/server';
import { fetchAll } from '@/lib/fetchIndicators';

export const runtime = 'nodejs';
export const revalidate = 3600;

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
      headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400' },
    });
  } catch (e) {
    return NextResponse.json(
      { values: {}, fetchedAt: new Date().toISOString(), error: String(e) },
      { status: 500 }
    );
  }
}
