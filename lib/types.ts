export interface GroupWeight {
  weight: number;
  label: string;
  rationale: string;
}

export interface IndicatorConfig {
  pillar: 'growth' | 'inflation';
  group: string;
  name: string;
  source: string;
  lead_months: number;
  direction: 'positive' | 'negative' | 'positive_50';
  baseline_mean: number;
  baseline_std: number;
  unit: string;
  note: string;
  weight: number; // computed
  source_url: string;
  source_label: string;
}

export interface LiveValue {
  current: number;
  prior: number;
  lastUpdated?: string;
  error?: string;
}

export interface ApiResponse {
  values: Record<string, LiveValue>;
  fetchedAt: string;
  noApiKey?: boolean;
}
