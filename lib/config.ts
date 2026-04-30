import type { GroupWeight, IndicatorConfig } from './types';

export const GROUP_WEIGHTS: Record<string, GroupWeight> = {
  growth_nowcasts: {
    weight: 30,
    label: 'Direct GDP nowcasts',
    rationale: 'Most direct signal — already forecasts the target variable. Lead 1-2 months.',
  },
  growth_financial: {
    weight: 30,
    label: 'Financial market signals',
    rationale: 'Markets aggregate all available information. Lead 3-6 months.',
  },
  growth_surveys: {
    weight: 20,
    label: 'Survey & sentiment',
    rationale: 'Forward-looking business decisions. Lead 4-7 months.',
  },
  growth_real_economy: {
    weight: 20,
    label: 'Real-economy leads',
    rationale: 'Early physical activity signals. Lead 2-4 months.',
  },
  inflation_core_drivers: {
    weight: 40,
    label: 'Core drivers (wages + rent)',
    rationale: 'Shelter and wages are 60%+ of core CPI. Longest, most robust leads (6-10 months).',
  },
  inflation_market: {
    weight: 25,
    label: 'Market-implied expectations',
    rationale: 'Breakevens and consumer expectations. Daily/monthly. Lead 3-6 months.',
  },
  inflation_commodities: {
    weight: 25,
    label: 'Commodity & producer prices',
    rationale: 'Upstream input costs. Lead 2-4 months for goods CPI.',
  },
  inflation_dollar: {
    weight: 10,
    label: 'Currency',
    rationale: 'DXY impact on import prices. Lead 3-6 months.',
  },
};

// Raw config before weight computation
type RawConfig = Omit<IndicatorConfig, 'weight'>;

const RAW: Record<string, RawConfig> = {
  // ── GROWTH: Direct GDP nowcasts (30%) ──
  GDPNOW: {
    pillar: 'growth', group: 'growth_nowcasts',
    name: 'Atlanta Fed GDPNow', source: 'FRED',
    lead_months: 2, direction: 'positive',
    baseline_mean: 2.1, baseline_std: 1.3, unit: '% SAAR',
    note: 'Atlanta Fed nowcast of current-quarter real GDP. Updates 6-7×/month.',
    source_url: 'https://fred.stlouisfed.org/series/GDPNOW',
    source_label: 'FRED · GDPNOW',
  },
  WEI: {
    pillar: 'growth', group: 'growth_nowcasts',
    name: 'Weekly Economic Index', source: 'NY Fed / FRED',
    lead_months: 1, direction: 'positive',
    baseline_mean: 1.8, baseline_std: 1.5, unit: '% annualised',
    note: 'NY Fed WEI scaled to 4-quarter GDP growth. Weekly.',
    source_url: 'https://fred.stlouisfed.org/series/WEI',
    source_label: 'FRED · WEI',
  },

  // ── GROWTH: Financial market signals (30%) ──
  T10Y3M: {
    pillar: 'growth', group: 'growth_financial',
    name: 'Yield Curve 10Y-3M', source: 'FRED',
    lead_months: 12, direction: 'positive',
    baseline_mean: 110, baseline_std: 90, unit: 'bps',
    note: 'Inversion predicts recession 6-18 months out. ~85% accuracy since 1960.',
    source_url: 'https://fred.stlouisfed.org/series/T10Y3M',
    source_label: 'FRED · T10Y3M',
  },
  HY_SPREAD: {
    pillar: 'growth', group: 'growth_financial',
    name: 'HY Credit Spread (OAS)', source: 'FRED',
    lead_months: 3, direction: 'negative',
    baseline_mean: 450, baseline_std: 180, unit: 'bps',
    note: 'ICE BofA US HY OAS. Widens early in credit stress.',
    source_url: 'https://fred.stlouisfed.org/series/BAMLH0A0HYM2',
    source_label: 'FRED · BAMLH0A0HYM2',
  },
  SPX_VS_200DMA: {
    pillar: 'growth', group: 'growth_financial',
    name: 'S&P 500 vs 200-day MA', source: 'Yahoo Finance',
    lead_months: 3, direction: 'positive',
    baseline_mean: 3.0, baseline_std: 7.5, unit: '% above 200d',
    note: 'Equity market is itself a leading indicator per Conference Board LEI.',
    source_url: 'https://finance.yahoo.com/quote/%5EGSPC/',
    source_label: 'Yahoo Finance · ^GSPC',
  },
  COPPER_GOLD: {
    pillar: 'growth', group: 'growth_financial',
    name: 'Copper / Gold ratio', source: 'Yahoo Finance',
    lead_months: 3, direction: 'positive',
    baseline_mean: 0.00220, baseline_std: 0.00030, unit: 'ratio',
    note: 'Pro-cyclical copper vs safe-haven gold. Macro desk favourite.',
    source_url: 'https://finance.yahoo.com/quote/HG%3DF/',
    source_label: 'Yahoo Finance · HG=F / GC=F',
  },

  // ── GROWTH: Survey & sentiment (20%) ──
  ISM_NEW_ORDERS: {
    pillar: 'growth', group: 'growth_surveys',
    name: 'ISM Mfg New Orders', source: 'FRED',
    lead_months: 2, direction: 'positive_50',
    baseline_mean: 51, baseline_std: 4.5, unit: 'index (50 neutral)',
    note: 'New orders lead production 1-2 months. 50 = neutral.',
    source_url: 'https://fred.stlouisfed.org/series/NAPMNO',
    source_label: 'FRED · NAPMNO',
  },
  LEI: {
    pillar: 'growth', group: 'growth_surveys',
    name: 'Conference Board LEI', source: 'FRED',
    lead_months: 7, direction: 'positive',
    baseline_mean: 0, baseline_std: 4, unit: '% 6mo annual',
    note: '10-component composite. Proven recession indicator.',
    source_url: 'https://fred.stlouisfed.org/series/USSLIND',
    source_label: 'FRED · USSLIND',
  },

  // ── GROWTH: Real-economy leads (20%) ──
  ICSA: {
    pillar: 'growth', group: 'growth_real_economy',
    name: 'Initial Jobless Claims', source: 'FRED',
    lead_months: 2, direction: 'negative',
    baseline_mean: 215000, baseline_std: 35000, unit: 'claims',
    note: 'Weekly initial claims. Rising = labor demand softening.',
    source_url: 'https://fred.stlouisfed.org/series/ICSA',
    source_label: 'FRED · ICSA',
  },
  PERMIT: {
    pillar: 'growth', group: 'growth_real_economy',
    name: 'Building Permits', source: 'FRED',
    lead_months: 4, direction: 'positive',
    baseline_mean: 1450, baseline_std: 120, unit: 'k SAAR',
    note: 'Leads construction employment 3-4 months.',
    source_url: 'https://fred.stlouisfed.org/series/PERMIT',
    source_label: 'FRED · PERMIT',
  },

  // ── INFLATION: Core drivers (40%) ──
  ZORI_YOY: {
    pillar: 'inflation', group: 'inflation_core_drivers',
    name: 'Zillow Rent Index YoY', source: 'Zillow Research',
    lead_months: 8, direction: 'negative',
    baseline_mean: 3.5, baseline_std: 2.5, unit: '% YoY',
    note: 'Leads CPI rent 6-10 months (KC Fed research). Shelter is 1/3 of CPI.',
    source_url: 'https://www.zillow.com/research/data/',
    source_label: 'Zillow Research · ZORI',
  },
  ATLANTA_WAGE: {
    pillar: 'inflation', group: 'inflation_core_drivers',
    name: 'Atlanta Fed Wage Growth', source: 'Atlanta Fed',
    lead_months: 7, direction: 'negative',
    baseline_mean: 3.5, baseline_std: 1.0, unit: '% YoY',
    note: 'Leads services inflation 6-9 months. Services = 60% of core CPI.',
    source_url: 'https://www.atlantafed.org/chcs/wage-growth-tracker',
    source_label: 'Atlanta Fed · Wage Growth Tracker',
  },

  // ── INFLATION: Market-implied expectations (25%) ──
  T5YIFR: {
    pillar: 'inflation', group: 'inflation_market',
    name: '5Y5Y Inflation Breakeven', source: 'FRED',
    lead_months: 3, direction: 'negative',
    baseline_mean: 2.2, baseline_std: 0.25, unit: '%',
    note: 'Market-implied inflation for years 5-10. Daily.',
    source_url: 'https://fred.stlouisfed.org/series/T5YIFR',
    source_label: 'FRED · T5YIFR',
  },
  MICH_1YR: {
    pillar: 'inflation', group: 'inflation_market',
    name: 'Michigan 1yr Inflation Expectations', source: 'FRED',
    lead_months: 6, direction: 'negative',
    baseline_mean: 3.0, baseline_std: 0.8, unit: '%',
    note: 'Consumer inflation expectations lead wage demands 3-6 months.',
    source_url: 'https://fred.stlouisfed.org/series/MICH',
    source_label: 'FRED · MICH',
  },

  // ── INFLATION: Commodities & producer (25%) ──
  BCOM_YOY: {
    pillar: 'inflation', group: 'inflation_commodities',
    name: 'Bloomberg Commodity Index YoY', source: 'Yahoo Finance',
    lead_months: 3, direction: 'negative',
    baseline_mean: 0, baseline_std: 15, unit: '% YoY',
    note: 'Broad commodity basket. Leads goods inflation 2-4 months.',
    source_url: 'https://finance.yahoo.com/quote/%5EBCOM/',
    source_label: 'Yahoo Finance · ^BCOM',
  },
  OIL_YOY: {
    pillar: 'inflation', group: 'inflation_commodities',
    name: 'WTI Crude YoY', source: 'FRED',
    lead_months: 3, direction: 'negative',
    baseline_mean: 0, baseline_std: 30, unit: '% YoY',
    note: 'Leads headline CPI goods component 2-3 months.',
    source_url: 'https://fred.stlouisfed.org/series/DCOILWTICO',
    source_label: 'FRED · DCOILWTICO',
  },
  PPI_YOY: {
    pillar: 'inflation', group: 'inflation_commodities',
    name: 'PPI All Commodities YoY', source: 'FRED',
    lead_months: 3, direction: 'negative',
    baseline_mean: 2.5, baseline_std: 3.5, unit: '% YoY',
    note: 'Producer prices lead core goods CPI 2-4 months.',
    source_url: 'https://fred.stlouisfed.org/series/PPIACO',
    source_label: 'FRED · PPIACO',
  },

  // ── INFLATION: Currency (10%) ──
  DOLLAR_YOY: {
    pillar: 'inflation', group: 'inflation_dollar',
    name: 'DXY YoY Change', source: 'FRED',
    lead_months: 5, direction: 'positive',
    baseline_mean: 0, baseline_std: 5, unit: '% YoY',
    note: 'Weak dollar = import inflation. Uses broad trade-weighted USD index.',
    source_url: 'https://fred.stlouisfed.org/series/DTWEXBGS',
    source_label: 'FRED · DTWEXBGS',
  },
};

// Count indicators per group for weight calculation
function groupCounts(raw: Record<string, RawConfig>): Record<string, number> {
  const counts: Record<string, number> = {};
  Object.values(raw).forEach(ind => {
    counts[ind.group] = (counts[ind.group] || 0) + 1;
  });
  return counts;
}

const counts = groupCounts(RAW);

export const INDICATOR_CONFIGS: Record<string, IndicatorConfig> = Object.fromEntries(
  Object.entries(RAW).map(([key, cfg]) => [
    key,
    { ...cfg, weight: GROUP_WEIGHTS[cfg.group].weight / counts[cfg.group] },
  ])
);

// All unique data source links for the "Data Sources" button
export const DATA_SOURCE_LINKS = [
  { label: 'FRED API (Federal Reserve Economic Data)', url: 'https://fred.stlouisfed.org/', description: 'GDPNow, WEI, Yield Curve, HY Spreads, ISM, LEI, Initial Claims, Building Permits, 5Y5Y Breakeven, Michigan Expectations, WTI Crude, PPI, Trade-Weighted USD' },
  { label: 'Atlanta Fed GDPNow', url: 'https://fred.stlouisfed.org/series/GDPNOW', description: 'Current-quarter real GDP nowcast' },
  { label: 'NY Fed Weekly Economic Index', url: 'https://fred.stlouisfed.org/series/WEI', description: 'Weekly proxy for 4-quarter GDP growth' },
  { label: 'ICE BofA HY OAS (FRED)', url: 'https://fred.stlouisfed.org/series/BAMLH0A0HYM2', description: 'US High Yield bond spread over Treasuries' },
  { label: 'ISM Mfg New Orders (FRED)', url: 'https://fred.stlouisfed.org/series/NAPMNO', description: 'ISM Manufacturing New Orders Index' },
  { label: 'Conference Board LEI (FRED)', url: 'https://fred.stlouisfed.org/series/USSLIND', description: '10-component leading economic index' },
  { label: 'Initial Jobless Claims (FRED)', url: 'https://fred.stlouisfed.org/series/ICSA', description: 'Weekly initial unemployment insurance claims' },
  { label: 'Building Permits (FRED)', url: 'https://fred.stlouisfed.org/series/PERMIT', description: 'New housing units authorized (SAAR)' },
  { label: '5Y5Y Inflation Breakeven (FRED)', url: 'https://fred.stlouisfed.org/series/T5YIFR', description: 'Market-implied forward inflation rate (years 5–10)' },
  { label: 'Michigan Inflation Expectations (FRED)', url: 'https://fred.stlouisfed.org/series/MICH', description: 'U of Michigan 1-year consumer inflation expectations' },
  { label: 'WTI Crude Oil (FRED)', url: 'https://fred.stlouisfed.org/series/DCOILWTICO', description: 'West Texas Intermediate spot price' },
  { label: 'PPI All Commodities (FRED)', url: 'https://fred.stlouisfed.org/series/PPIACO', description: 'Producer Price Index, all commodities' },
  { label: 'Trade-Weighted USD (FRED)', url: 'https://fred.stlouisfed.org/series/DTWEXBGS', description: 'Broad goods & services trade-weighted dollar index' },
  { label: 'S&P 500 (Yahoo Finance)', url: 'https://finance.yahoo.com/quote/%5EGSPC/', description: 'S&P 500 index vs 200-day moving average' },
  { label: 'Copper Futures (Yahoo Finance)', url: 'https://finance.yahoo.com/quote/HG%3DF/', description: 'HG=F copper futures price (USD/lb)' },
  { label: 'Gold Futures (Yahoo Finance)', url: 'https://finance.yahoo.com/quote/GC%3DF/', description: 'GC=F gold futures price (USD/oz)' },
  { label: 'Bloomberg Commodity Index (Yahoo Finance)', url: 'https://finance.yahoo.com/quote/%5EBCOM/', description: '^BCOM broad commodity basket index' },
  { label: 'Zillow Observed Rent Index (ZORI)', url: 'https://www.zillow.com/research/data/', description: 'National rent index, leads CPI shelter 6–10 months' },
  { label: 'Atlanta Fed Wage Growth Tracker', url: 'https://www.atlantafed.org/chcs/wage-growth-tracker', description: 'Median wage growth for continuously employed workers' },
];
