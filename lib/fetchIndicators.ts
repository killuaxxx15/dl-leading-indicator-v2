/**
 * Core data-fetching logic, shared between:
 *   - app/page.tsx  (server-side render, ISR-cached)
 *   - app/api/indicators/route.ts  (called by the client Refresh button)
 */
import type { ApiResponse, LiveValue } from './types';

const FRED_BASE = 'https://api.stlouisfed.org/fred/series/observations';

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

// ── YoY helper (descending array: arr[0] = most recent) ──────────────
function calcYoY(arr: number[], periodsBack: number): [number, number] {
  if (arr.length < periodsBack + 2) throw new Error('Not enough data for YoY');
  const currentYoY = ((arr[0] / arr[periodsBack]) - 1) * 100;
  const priorYoY = (arr[1] && arr[periodsBack + 1])
    ? ((arr[1] / arr[periodsBack + 1]) - 1) * 100
    : currentYoY;
  return [currentYoY, priorYoY];
}

// ── SPX 200-day MA from FRED SP500 daily series ───────────────────────
async function fetchSPX200DMA(apiKey: string): Promise<LiveValue> {
  const arr = await fredGet('SP500', apiKey, 210);
  if (arr.length < 201) throw new Error('SPX: insufficient data for 200DMA');
  const ma200 = arr.slice(0, 200).reduce((s, v) => s + v, 0) / 200;
  const ma200prior = arr.slice(1, 201).reduce((s, v) => s + v, 0) / 200;
  return {
    current: parseFloat((((arr[0] / ma200) - 1) * 100).toFixed(2)),
    prior:   parseFloat((((arr[1] / ma200prior) - 1) * 100).toFixed(2)),
  };
}

// ── Copper / Gold ratio from FRED monthly series ──────────────────────
async function fetchCopperGold(apiKey: string): Promise<LiveValue> {
  const [copper, gold] = await Promise.all([
    fredGet('PCOPPUSDM', apiKey, 5),         // Global price of Copper, USD/metric ton
    fredGet('GOLDPMGBD228NLBM', apiKey, 5),  // Gold PM fix, USD/troy oz
  ]);
  if (!copper.length || !gold.length) throw new Error('Copper/Gold: missing data');
  return {
    current: parseFloat((copper[0] / gold[0]).toFixed(6)),
    prior:   parseFloat(((copper[1] ?? copper[0]) / (gold[1] ?? gold[0])).toFixed(6)),
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

    // ISM New Orders — try NAPMNO, fall back to composite NAPM
    safe('ISM_NEW_ORDERS', async () => {
      try { return await fredGet('NAPMNO', apiKey, 5); }
      catch { return await fredGet('NAPM', apiKey, 5); }
    }, arr => ({ current: arr[0], prior: arr[1] ?? arr[0] })),

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

    // BCOM proxy: PPI Crude Materials YoY (monthly, FRED series PPICRM)
    safe('BCOM_YOY', () => fredGetLong('PPICRM', apiKey), arr => {
      const [c, p] = calcYoY(arr, 12);
      return { current: parseFloat(c.toFixed(2)), prior: parseFloat(p.toFixed(2)) };
    }),

    // ── Market data via FRED ──────────────────────────────────────────
    safe('SPX_VS_200DMA', () => fetchSPX200DMA(apiKey), v => v),
    safe('COPPER_GOLD',   () => fetchCopperGold(apiKey), v => v),

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
