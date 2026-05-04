/**
 * Core data-fetching logic, shared between:
 *   - app/page.tsx  (server-side render, ISR-cached)
 *   - app/api/indicators/route.ts  (called by the client Refresh button)
 */
import type { ApiResponse, LiveValue } from './types';

const FRED_BASE = 'https://api.stlouisfed.org/fred/series/observations';

// Browser headers to avoid 401 from Yahoo
const BROWSER_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9',
  'Referer': 'https://finance.yahoo.com/',
};

// ── FRED fetcher ──────────────────────────────────────────────────────
async function fredGet(series: string, apiKey: string, limit = 20): Promise<number[]> {
  const url = `${FRED_BASE}?series_id=${series}&api_key=${apiKey}&file_type=json&sort_order=desc&limit=${limit}`;
  const res = await fetch(url, { next: { revalidate: 3600 } });
  if (!res.ok) throw new Error(`FRED ${series}: HTTP ${res.status}`);
  const data = await res.json();
  if (data.error_message) throw new Error(`FRED ${series}: ${data.error_message}`);
  return (data.observations as { value: string }[])
    .filter(o => o.value !== '.')
    .map(o => parseFloat(o.value));
}

async function fredGetLong(series: string, apiKey: string, limit = 500): Promise<number[]> {
  return fredGet(series, apiKey, limit);
}

// ── Yahoo Finance chart fetcher ───────────────────────────────────────
async function yahooChart(
  symbol: string,
  range = '2y',
  interval = '1d'
): Promise<{ timestamps: number[]; closes: number[] }> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=${interval}&range=${range}`;
  const res = await fetch(url, {
    headers: BROWSER_HEADERS,
    next: { revalidate: 3600 },
  });
  if (!res.ok) throw new Error(`Yahoo ${symbol}: HTTP ${res.status}`);
  const json = await res.json();
  const result = json?.chart?.result?.[0];
  if (!result) throw new Error(`Yahoo ${symbol}: no data`);
  const timestamps: number[] = result.timestamp || [];
  const closes: number[] = result.indicators?.quote?.[0]?.close || [];
  return { timestamps, closes };
}

// ── YoY helper (descending array: arr[0] = most recent) ──────────────
function calcYoY(arr: number[], periodsBack: number): [number, number] {
  if (arr.length < periodsBack + 2) throw new Error('Not enough data for YoY');
  const currentYoY = ((arr[0] / arr[periodsBack]) - 1) * 100;
  const priorYoY = (arr[1] && arr[periodsBack + 1])
    ? ((arr[1] / arr[periodsBack + 1]) - 1) * 100
    : currentYoY;
  return [currentYoY, priorYoY];
}

// ── S&P 500 vs 200DMA from Yahoo ──────────────────────────────────────
async function fetchSPX200DMA(): Promise<LiveValue> {
  const { closes } = await yahooChart('^GSPC', '2y', '1d'); // S&P 500
  const desc = closes.filter(v => v != null && !isNaN(v)).reverse(); // Yahoo is ascending, reverse to descending
  if (desc.length < 201) throw new Error('SPX: insufficient data');
  const ma200 = desc.slice(0, 200).reduce((s, v) => s + v, 0) / 200;
  const ma200prior = desc.slice(1, 201).reduce((s, v) => s + v, 0) / 200;
  return {
    current: parseFloat((((desc[0] / ma200) - 1) * 100).toFixed(2)),
    prior:   parseFloat((((desc[1] / ma200prior) - 1) * 100).toFixed(2)),
  };
}

// ── Copper / Gold ratio from Yahoo ────────────────────────────────────
async function fetchCopperGold(): Promise<LiveValue> {
  const [cu, au] = await Promise.all([
    yahooChart('HG=F', '2y', '1d'),  // copper futures
    yahooChart('GC=F', '2y', '1d'),  // gold futures
  ]);
  const cuClean = cu.closes.filter(v => v != null && !isNaN(v));
  const auClean = au.closes.filter(v => v != null && !isNaN(v));
  if (!cuClean.length || !auClean.length) throw new Error('Copper/Gold: missing data');
  const cuCurrent = cuClean[cuClean.length - 1];
  const auCurrent = auClean[auClean.length - 1];
  const cuPrior = cuClean.length > 1 ? cuClean[cuClean.length - 2] : cuCurrent;
  const auPrior = auClean.length > 1 ? auClean[auClean.length - 2] : auCurrent;
  return {
    current: parseFloat((cuCurrent / auCurrent).toFixed(6)),
    prior:   parseFloat((cuPrior / auPrior).toFixed(6)),
  };
}

// ── Bloomberg Commodity Index YoY from Yahoo ──────────────────────────
async function fetchBCOMYoY(): Promise<LiveValue> {
  // Try ^BCOM first, fall back to DJP (iPath Bloomberg Commodity ETN)
  let closes: number[] = [];
  try {
    const result = await yahooChart('^BCOM', '2y', '1d');
    closes = result.closes;
  } catch {
    const result = await yahooChart('DJP', '2y', '1d');
    closes = result.closes;
  }
  const desc = closes.filter(v => v != null && !isNaN(v)).reverse(); // Yahoo is ascending, reverse to descending
  if (desc.length < 253) throw new Error('BCOM: insufficient data for YoY');
  const [current, prior] = calcYoY(desc, 252);
  return {
    current: parseFloat(current.toFixed(2)),
    prior:   parseFloat(prior.toFixed(2)),
  };
}

// ── Zillow ZORI CSV → national rent YoY ──────────────────────────────
async function fetchZori(): Promise<LiveValue> {
  const urls = [
    'https://files.zillowstatic.com/research/public_csvs/zori/Metro_zori_uc_sfrcondomfr_sm_sa_month.csv',
    'https://files.zillowstatic.com/research/public_csvs/zori/Metro_zori_uc_sfrcondomfr_tier_0.33_0.67_sm_sa_month.csv',
    'https://files.zillowstatic.com/research/public_v2/zori/Metro_zori_uc_sfrcondomfr_sm_sa_month.csv',
  ];
  let text: string | null = null;
  for (const url of urls) {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; CIODashboard/1.0)' },
        next: { revalidate: 86400 },
      });
      if (res.ok) { text = await res.text(); break; }
    } catch { /* try next */ }
  }
  if (!text) throw new Error('Zillow CSV: all URLs failed');

  const lines = text.trim().split('\n');
  let usRow: string[] | null = null;
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',');
    if (cols[2]?.replace(/"/g, '') === 'United States') { usRow = cols; break; }
  }
  if (!usRow) throw new Error('Zillow: United States row not found');

  const header = lines[0].split(',');
  let dataStartIdx = 0;
  for (let i = 0; i < header.length; i++) {
    if (/^\d{4}-\d{2}/.test(header[i]?.replace(/"/g, ''))) { dataStartIdx = i; break; }
  }
  if (dataStartIdx === 0) dataStartIdx = 5;

  const vals: number[] = [];
  for (let i = header.length - 1; i >= dataStartIdx && vals.length < 15; i--) {
    const v = parseFloat(usRow[i]);
    if (!isNaN(v)) vals.push(v);
  }
  if (vals.length < 13) throw new Error('Zillow: insufficient data');

  const current = ((vals[0] / vals[12]) - 1) * 100;
  const prior   = (vals[1] && vals[13]) ? ((vals[1] / vals[13]) - 1) * 100 : current;
  return { current: parseFloat(current.toFixed(2)), prior: parseFloat(prior.toFixed(2)) };
}

// ── Main orchestrator ─────────────────────────────────────────────────
export async function fetchAll(apiKey: string): Promise<ApiResponse> {
  const values: Record<string, LiveValue> = {};
  const errors: Record<string, string> = {};

  async function safe<T>(key: string, fn: () => Promise<T>, transform: (v: T) => LiveValue) {
    try {
      values[key] = transform(await fn());
    } catch (e) {
      errors[key] = e instanceof Error ? e.message : String(e);
    }
  }

  await Promise.allSettled([
    // ── FRED: direct readings ──────────────────────────────────────────
    safe('GDPNOW', () => fredGet('GDPNOW', apiKey, 5), arr => ({
      current: arr[0], prior: arr[1] ?? arr[0],
    })),
    safe('WEI', () => fredGet('WEI', apiKey, 5), arr => ({
      current: arr[0], prior: arr[1] ?? arr[0],
    })),
    safe('T10Y3M', () => fredGet('T10Y3M', apiKey, 10), arr => ({
      current: parseFloat((arr[0] * 100).toFixed(1)),
      prior:   parseFloat((arr[1] * 100).toFixed(1)),
    })),
    safe('HY_SPREAD', () => fredGet('BAMLH0A0HYM2', apiKey, 10), arr => ({
      current: parseFloat((arr[0] * 100).toFixed(0)),
      prior:   parseFloat((arr[1] * 100).toFixed(0)),
    })),

    // Industrial Production Index (INDPRO)
    safe('ISM_NEW_ORDERS', () => fredGet('INDPRO', apiKey, 5), arr => ({
      current: arr[0], prior: arr[1] ?? arr[0],
    })),

    safe('ICSA',   () => fredGet('ICSA',   apiKey, 5), arr => ({ current: arr[0], prior: arr[1] ?? arr[0] })),
    safe('PERMIT', () => fredGet('PERMIT', apiKey, 5), arr => ({ current: arr[0], prior: arr[1] ?? arr[0] })),
    safe('T5YIFR', () => fredGet('T5YIFR', apiKey, 5), arr => ({ current: arr[0], prior: arr[1] ?? arr[0] })),
    safe('MICH_1YR', () => fredGet('MICH',  apiKey, 5), arr => ({ current: arr[0], prior: arr[1] ?? arr[0] })),

    // LEI — USSLIND is already an annualised 6-month growth rate (%), use directly
    safe('LEI', () => fredGet('USSLIND', apiKey, 5), arr => ({
      current: parseFloat(arr[0].toFixed(2)),
      prior:   parseFloat((arr[1] ?? arr[0]).toFixed(2)),
    })),

    // ── FRED: YoY series ──────────────────────────────────────────────
    safe('OIL_YOY', () => fredGetLong('DCOILWTICO', apiKey), arr => {
      const [c, p] = calcYoY(arr, 260);
      return { current: parseFloat(c.toFixed(1)), prior: parseFloat(p.toFixed(1)) };
    }),
    safe('PPI_YOY', () => fredGetLong('PPIACO', apiKey), arr => {
      const [c, p] = calcYoY(arr, 12);
      return { current: parseFloat(c.toFixed(2)), prior: parseFloat(p.toFixed(2)) };
    }),
    safe('DOLLAR_YOY', () => fredGetLong('DTWEXBGS', apiKey), arr => {
      const [c, p] = calcYoY(arr, 260);
      return { current: parseFloat(c.toFixed(2)), prior: parseFloat(p.toFixed(2)) };
    }),

    // ── Yahoo Finance: real-time market data ───────────────────────────
    safe('SPX_VS_200DMA', () => fetchSPX200DMA(), v => v),
    safe('COPPER_GOLD',   () => fetchCopperGold(), v => v),
    safe('BCOM_YOY',      () => fetchBCOMYoY(), v => v),

    // ── Rent YoY: Zillow ZORI → fallback to FRED rent CPI ────────────
    safe('ZORI_YOY', async () => {
      try { return await fetchZori(); }
      catch {
        const arr = await fredGetLong('CUSR0000SEHA', apiKey);
        const [c, p] = calcYoY(arr, 12);
        return { current: parseFloat(c.toFixed(2)), prior: parseFloat(p.toFixed(2)) };
      }
    }, v => v),

    // Atlanta Wage: FRED Average Hourly Earnings YoY
    safe('ATLANTA_WAGE', () => fredGetLong('AHETPI', apiKey), arr => {
      const [c, p] = calcYoY(arr, 12);
      return { current: parseFloat(c.toFixed(2)), prior: parseFloat(p.toFixed(2)) };
    }),
  ]);

  // Stamp errors so the UI can show them
  Object.keys(errors).forEach(k => {
    if (!values[k]) values[k] = { current: NaN, prior: NaN, error: errors[k] };
  });

  return { values, fetchedAt: new Date().toISOString() };
}
