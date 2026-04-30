import { NextResponse } from 'next/server';
import type { ApiResponse, LiveValue } from '@/lib/types';

export const runtime = 'nodejs';
// Cache for 1 hour on Vercel
export const revalidate = 3600;

const FRED_KEY = process.env.FRED_API_KEY || '';
const FRED_BASE = 'https://api.stlouisfed.org/fred/series/observations';

// ── FRED fetcher ─────────────────────────────────────────────────────
async function fredGet(series: string, limit = 20): Promise<number[]> {
  const url = `${FRED_BASE}?series_id=${series}&api_key=${FRED_KEY}&file_type=json&sort_order=desc&limit=${limit}`;
  const res = await fetch(url, { next: { revalidate: 3600 } });
  if (!res.ok) throw new Error(`FRED ${series}: HTTP ${res.status}`);
  const data = await res.json();
  if (data.error_message) throw new Error(`FRED ${series}: ${data.error_message}`);
  return (data.observations as { value: string }[])
    .filter(o => o.value !== '.')
    .map(o => parseFloat(o.value));
}

// For daily series needing YoY: fetch ~500 days so we can find 1-year-ago
async function fredGetLong(series: string): Promise<number[]> {
  return fredGet(series, 500);
}

// ── Yahoo Finance fetcher (unofficial, no key needed) ────────────────
async function yahooChart(
  symbol: string,
  range = '2y',
  interval = '1d'
): Promise<{ timestamps: number[]; closes: number[]; meta: Record<string, number> }> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=${interval}&range=${range}`;
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; CIODashboard/1.0)',
      Accept: 'application/json',
    },
    next: { revalidate: 3600 },
  });
  if (!res.ok) throw new Error(`Yahoo ${symbol}: HTTP ${res.status}`);
  const json = await res.json();
  const result = json?.chart?.result?.[0];
  if (!result) throw new Error(`Yahoo ${symbol}: no result`);
  const timestamps: number[] = result.timestamp || [];
  const closes: number[] = result.indicators?.quote?.[0]?.close || [];
  const meta: Record<string, number> = result.meta || {};
  return { timestamps, closes, meta };
}

async function yahooQuote(symbol: string): Promise<Record<string, number>> {
  const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(symbol)}`;
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; CIODashboard/1.0)',
      Accept: 'application/json',
    },
    next: { revalidate: 3600 },
  });
  if (!res.ok) throw new Error(`Yahoo quote ${symbol}: HTTP ${res.status}`);
  const json = await res.json();
  return json?.quoteResponse?.result?.[0] || {};
}

// ── Helper: YoY % change from a descending array of prices ──────────
// arr[0] = most recent, arr[~252] = ~1 year ago for daily
function calcYoY(arr: number[], periodsBack: number): [number, number] {
  if (arr.length < periodsBack + 2) throw new Error('Not enough data for YoY');
  const current = arr[0];
  const yearAgo = arr[periodsBack];
  // prior = previous period's YoY (shift by one)
  const prior = arr[1] && arr[periodsBack + 1]
    ? ((arr[1] / arr[periodsBack + 1]) - 1) * 100
    : ((current / yearAgo) - 1) * 100;
  return [((current / yearAgo) - 1) * 100, prior];
}

// ── Zillow ZORI CSV parser ────────────────────────────────────────────
async function fetchZori(): Promise<LiveValue> {
  // National ZORI (Observed Rent Index, smoothed, seasonally adjusted)
  const url = 'https://files.zillowstatic.com/research/public_csvs/zori/Metro_zori_uc_sfrcondomfr_tier_0.33_0.67_sm_sa_month.csv';
  const res = await fetch(url, { next: { revalidate: 86400 } }); // cache 24h
  if (!res.ok) throw new Error(`Zillow CSV: HTTP ${res.status}`);
  const text = await res.text();
  const lines = text.trim().split('\n');
  const header = lines[0].split(',');

  // Find the United States row (first row with SizeRank=0 or RegionName="United States")
  let usRow: string[] | null = null;
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',');
    if (cols[2]?.replace(/"/g, '') === 'United States') {
      usRow = cols;
      break;
    }
  }
  if (!usRow) throw new Error('Zillow: United States row not found');

  // Date columns start after the metadata columns (RegionID, SizeRank, RegionName, RegionType, StateName, State, City, Metro, CountyName)
  const metaCols = ['RegionID', 'SizeRank', 'RegionName', 'RegionType', 'StateName', 'State', 'City', 'Metro', 'CountyName'];
  const dataStartIdx = metaCols.length;

  // Get last 14 non-empty values (13 months to compute YoY + one extra for prior)
  const dataVals: number[] = [];
  for (let i = header.length - 1; i >= dataStartIdx && dataVals.length < 14; i--) {
    const v = parseFloat(usRow[i]);
    if (!isNaN(v)) dataVals.push(v);
  }
  if (dataVals.length < 13) throw new Error('Zillow: insufficient data');

  // YoY: (current / 12_months_ago - 1) * 100
  const current = ((dataVals[0] / dataVals[12]) - 1) * 100;
  const prior = dataVals[1] && dataVals[13]
    ? ((dataVals[1] / dataVals[13]) - 1) * 100
    : current;

  return { current: parseFloat(current.toFixed(2)), prior: parseFloat(prior.toFixed(2)) };
}

// ── Atlanta Fed Wage Growth Tracker ──────────────────────────────────
async function fetchAtlantaWage(): Promise<LiveValue> {
  // Atlanta Fed publishes wage growth data as a downloadable CSV
  const url = 'https://www.atlantafed.org/-/media/Documents/chcs/wage-growth-tracker/wage-growth-data.xlsx';
  // The xlsx file is complex; instead use the public summary table they publish
  // Fallback: fetch their JSON data endpoint for the overall median
  // They expose data at this endpoint used by their chart:
  const dataUrl = 'https://www.atlantafed.org/chcs/wage-growth-tracker';

  // Try fetching from their published Excel file via a different approach
  // The Atlanta Fed also provides the data at this static URL in JSON-like form
  // For reliability, we use their known CSV export format
  const csvUrl = 'https://www.atlantafed.org/-/media/Documents/chcs/wage-growth-tracker/wage-growth-data.csv';
  const res = await fetch(csvUrl, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; CIODashboard/1.0)' },
    next: { revalidate: 86400 },
  });
  if (!res.ok) throw new Error(`Atlanta Fed wage: HTTP ${res.status}`);
  const text = await res.text();
  const lines = text.trim().split('\n').filter(l => l.trim());
  if (lines.length < 3) throw new Error('Atlanta Fed wage: too few rows');

  // Find the "Overall" median 3-month moving average column
  const header = lines[0].toLowerCase();
  // Typical columns: date, overall_median_3mma, ...
  // Parse last 2 rows for current and prior
  const last = lines[lines.length - 1].split(',').map(s => s.trim().replace(/"/g, ''));
  const prev = lines[lines.length - 2].split(',').map(s => s.trim().replace(/"/g, ''));

  // Overall median is typically the second column
  const current = parseFloat(last[1]);
  const prior = parseFloat(prev[1]);
  if (isNaN(current)) throw new Error('Atlanta Fed wage: could not parse value');

  return { current: parseFloat(current.toFixed(2)), prior: parseFloat(prior.toFixed(2)) };
}

// ── Main fetch orchestrator ───────────────────────────────────────────
async function fetchAll(): Promise<ApiResponse> {
  const values: Record<string, LiveValue> = {};
  const errors: Record<string, string> = {};

  async function safe<T>(key: string, fn: () => Promise<T>, transform: (v: T) => LiveValue) {
    try {
      const raw = await fn();
      values[key] = transform(raw);
    } catch (e) {
      errors[key] = e instanceof Error ? e.message : String(e);
    }
  }

  // Run all fetches in parallel
  await Promise.allSettled([
    // ── FRED: simple last-2-readings ──
    safe('GDPNOW', () => fredGet('GDPNOW', 5), arr => ({
      current: arr[0], prior: arr[1] ?? arr[0],
    })),
    safe('WEI', () => fredGet('WEI', 5), arr => ({
      current: arr[0], prior: arr[1] ?? arr[0],
    })),
    safe('T10Y3M', () => fredGet('T10Y3M', 10), arr => ({
      // FRED gives percent; multiply by 100 for basis points
      current: parseFloat((arr[0] * 100).toFixed(1)),
      prior: parseFloat((arr[1] * 100).toFixed(1)),
    })),
    safe('HY_SPREAD', () => fredGet('BAMLH0A0HYM2', 10), arr => ({
      // FRED gives percent; multiply by 100 for basis points
      current: parseFloat((arr[0] * 100).toFixed(0)),
      prior: parseFloat((arr[1] * 100).toFixed(0)),
    })),
    safe('ISM_NEW_ORDERS', () => fredGet('NAPMNO', 5), arr => ({
      current: arr[0], prior: arr[1] ?? arr[0],
    })),
    safe('ICSA', () => fredGet('ICSA', 5), arr => ({
      current: arr[0], prior: arr[1] ?? arr[0],
    })),
    safe('PERMIT', () => fredGet('PERMIT', 5), arr => ({
      current: arr[0], prior: arr[1] ?? arr[0],
    })),
    safe('T5YIFR', () => fredGet('T5YIFR', 5), arr => ({
      current: arr[0], prior: arr[1] ?? arr[0],
    })),
    safe('MICH_1YR', () => fredGet('MICH', 5), arr => ({
      current: arr[0], prior: arr[1] ?? arr[0],
    })),

    // ── FRED: LEI — need 6-month annualised change ──
    safe('LEI', () => fredGet('USSLIND', 12), arr => {
      // arr[0] = current index level, arr[6] = 6 months ago
      const curr = arr[0];
      const sixMoAgo = arr[6] ?? arr[arr.length - 1];
      const prevMo = arr[1];
      const sevenMoAgo = arr[7] ?? sixMoAgo;
      // 6-month annualised % change
      const current = ((curr / sixMoAgo) ** 2 - 1) * 100;
      const prior = prevMo && sevenMoAgo ? ((prevMo / sevenMoAgo) ** 2 - 1) * 100 : current;
      return {
        current: parseFloat(current.toFixed(2)),
        prior: parseFloat(prior.toFixed(2)),
      };
    }),

    // ── FRED: YoY series (need long history) ──
    safe('OIL_YOY', () => fredGetLong('DCOILWTICO'), arr => {
      const [current, prior] = calcYoY(arr, 260); // ~260 trading days = 1 year
      return { current: parseFloat(current.toFixed(1)), prior: parseFloat(prior.toFixed(1)) };
    }),
    safe('PPI_YOY', () => fredGetLong('PPIACO'), arr => {
      const [current, prior] = calcYoY(arr, 12); // monthly series, 12 months back
      return { current: parseFloat(current.toFixed(2)), prior: parseFloat(prior.toFixed(2)) };
    }),
    safe('DOLLAR_YOY', () => fredGetLong('DTWEXBGS'), arr => {
      const [current, prior] = calcYoY(arr, 260);
      return { current: parseFloat(current.toFixed(2)), prior: parseFloat(prior.toFixed(2)) };
    }),

    // ── Yahoo Finance: S&P 500 vs 200-day MA ──
    safe('SPX_VS_200DMA', () => yahooQuote('%5EGSPC'), q => {
      const price = q.regularMarketPrice ?? q.ask ?? 0;
      const ma200 = q.twoHundredDayAverage ?? q.fiftyTwoWeekLow ?? 0;
      const prevClose = q.regularMarketPreviousClose ?? price;
      if (!price || !ma200) throw new Error('Yahoo SPX: missing price or MA200');
      const current = ((price / ma200) - 1) * 100;
      const prior = ((prevClose / ma200) - 1) * 100;
      return {
        current: parseFloat(current.toFixed(2)),
        prior: parseFloat(prior.toFixed(2)),
      };
    }),

    // ── Yahoo Finance: Copper / Gold ratio ──
    safe('COPPER_GOLD', async () => {
      const [cu, au] = await Promise.all([yahooQuote('HG%3DF'), yahooQuote('GC%3DF')]);
      return { cu, au };
    }, ({ cu, au }) => {
      const cuPrice = cu.regularMarketPrice ?? 0;
      const auPrice = au.regularMarketPrice ?? 0;
      const cuPrev = cu.regularMarketPreviousClose ?? cuPrice;
      const auPrev = au.regularMarketPreviousClose ?? auPrice;
      if (!cuPrice || !auPrice) throw new Error('Yahoo Copper/Gold: missing price');
      return {
        current: parseFloat((cuPrice / auPrice).toFixed(6)),
        prior: parseFloat((cuPrev / auPrev).toFixed(6)),
      };
    }),

    // ── Yahoo Finance: Bloomberg Commodity Index YoY ──
    safe('BCOM_YOY', () => yahooChart('%5EBCOM', '2y', '1d'), ({ closes }) => {
      const clean = closes.filter(v => v != null && !isNaN(v)).reverse(); // ascending
      const desc = [...clean].reverse(); // back to descending (most recent first)
      const [current, prior] = calcYoY(desc, 252);
      return { current: parseFloat(current.toFixed(2)), prior: parseFloat(prior.toFixed(2)) };
    }),

    // ── Zillow ZORI ──
    safe('ZORI_YOY', () => fetchZori(), v => v),

    // ── Atlanta Fed Wage ──
    safe('ATLANTA_WAGE', () => fetchAtlantaWage(), v => v),
  ]);

  // Stamp any errors onto the values so the UI can show them
  Object.keys(errors).forEach(k => {
    if (!values[k]) {
      values[k] = { current: NaN, prior: NaN, error: errors[k] };
    }
  });

  return { values, fetchedAt: new Date().toISOString() };
}

export async function GET() {
  // If no FRED key configured, return no-key signal
  if (!FRED_KEY || FRED_KEY === 'your_fred_api_key_here') {
    return NextResponse.json({ values: {}, fetchedAt: new Date().toISOString(), noApiKey: true });
  }

  try {
    const data = await fetchAll();
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
