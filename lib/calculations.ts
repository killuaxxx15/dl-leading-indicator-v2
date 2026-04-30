import type { IndicatorConfig, LiveValue } from './types';
import { GROUP_WEIGHTS, INDICATOR_CONFIGS } from './config';

export function zscore(indicator: IndicatorConfig & { current: number | null }): number {
  const v = indicator.current ?? NaN;
  if (v == null || isNaN(v)) return NaN;
  if (indicator.direction === 'positive_50') {
    return (v - 50) / indicator.baseline_std;
  }
  const raw = (v - indicator.baseline_mean) / indicator.baseline_std;
  return indicator.direction === 'negative' ? -raw : raw;
}

export function clampedZ(z: number): number {
  return Math.max(-2.5, Math.min(2.5, z));
}

export function pillarComposite(
  pillar: 'growth' | 'inflation',
  liveValues: Record<string, { current: number; prior: number }>
): number {
  const keys = Object.keys(INDICATOR_CONFIGS).filter(k => INDICATOR_CONFIGS[k].pillar === pillar);
  const totalWeight = keys.reduce((s, k) => s + INDICATOR_CONFIGS[k].weight, 0);
  let weightedSum = 0;
  keys.forEach(k => {
    const cfg = INDICATOR_CONFIGS[k];
    const vals = liveValues[k];
    if (!vals || vals.current == null) return;
    const z = zscore({ ...cfg, current: vals.current });
    if (isNaN(z)) return;
    weightedSum += clampedZ(z) * (cfg.weight / totalWeight);
  });
  return Math.round(weightedSum * 40);
}

export function signalBucket(composite: number) {
  if (composite >= 40) return { label: 'STRONG BULL', color: '#2d7a3e', short: 'strong bull' };
  if (composite >= 15) return { label: 'LEAN BULL', color: '#8dc878', short: 'lean bull' };
  if (composite > -15) return { label: 'MIXED', color: '#b8720e', short: 'mixed' };
  if (composite > -40) return { label: 'LEAN BEAR', color: '#d47848', short: 'lean bear' };
  return { label: 'STRONG BEAR', color: '#c0392b', short: 'strong bear' };
}

export function indicatorAgreement(
  pillar: 'growth' | 'inflation',
  liveValues: Record<string, { current: number; prior: number }>
) {
  const keys = Object.keys(INDICATOR_CONFIGS).filter(k => INDICATOR_CONFIGS[k].pillar === pillar);
  const composite = pillarComposite(pillar, liveValues);
  if (composite === 0) return { agree: 0, total: keys.length, pct: 50 };
  const compSign = composite > 0 ? 1 : -1;
  let agree = 0;
  keys.forEach(k => {
    const cfg = INDICATOR_CONFIGS[k];
    const vals = liveValues[k];
    if (!vals || vals.current == null) return;
    const raw = zscore({ ...cfg, current: vals.current });
    if (isNaN(raw)) return;
    const z = clampedZ(raw);
    if (Math.abs(z) < 0.15) return;
    if ((z > 0 ? 1 : -1) === compSign) agree++;
  });
  return { agree, total: keys.length, pct: Math.round((agree / keys.length) * 100) };
}

export function confidenceTier(composite: number, agreementPct: number) {
  const absC = Math.abs(composite);
  if (agreementPct >= 80 && absC >= 30) return { label: 'HIGH', color: '#2d7a3e', bandWidth: 5 };
  if (agreementPct >= 65 && absC >= 15) return { label: 'MODERATE', color: '#8dc878', bandWidth: 10 };
  if (agreementPct >= 50) return { label: 'LOW', color: '#b8720e', bandWidth: 15 };
  return { label: 'VERY LOW', color: '#c0392b', bandWidth: 25 };
}

export function probabilityRanges(composite: number, confidence: { bandWidth: number }) {
  let base: { bear: number; mid: number; bull: number };
  if (composite > 40) base = { bear: 5, mid: 25, bull: 70 };
  else if (composite > 15) base = { bear: 15, mid: 50, bull: 35 };
  else if (composite > -15) base = { bear: 25, mid: 55, bull: 20 };
  else if (composite > -40) base = { bear: 45, mid: 40, bull: 15 };
  else base = { bear: 70, mid: 25, bull: 5 };
  const bw = confidence.bandWidth;
  return {
    bear: [Math.max(0, base.bear - bw), Math.min(100, base.bear + bw)],
    mid: [Math.max(0, base.mid - bw), Math.min(100, base.mid + bw)],
    bull: [Math.max(0, base.bull - bw), Math.min(100, base.bull + bw)],
  };
}

export function scoreColor(s: number): string {
  if (s > 30) return '#2d7a3e';
  if (s > 10) return '#8dc878';
  if (s > -10) return '#b8720e';
  if (s > -30) return '#d47848';
  return '#c0392b';
}

export function directionTier(c: number) {
  if (c >= 40) return { arrow: '↑↑', label: 'STRONG BULL', color: '#1a8540', bg: '#d4f0dc' };
  if (c >= 15) return { arrow: '↑', label: 'LEAN BULL', color: '#2d7a3e', bg: '#e0f0e4' };
  if (c > -15) return { arrow: '→', label: 'MIXED', color: '#b8720e', bg: '#fcefd6' };
  if (c > -40) return { arrow: '↓', label: 'LEAN BEAR', color: '#a82828', bg: '#f5dfdf' };
  return { arrow: '↓↓', label: 'STRONG BEAR', color: '#7f1f1f', bg: '#ebcfcf' };
}

export function trafficLight(z: number) {
  if (Math.abs(z) < 0.5) return { color: '#b8720e', label: 'NEUTRAL' };
  if (z > 0) return { color: '#2d7a3e', label: 'SUPPORTS +' };
  return { color: '#c0392b', label: 'SUPPORTS −' };
}

export interface RankedContributor {
  key: string;
  cfg: IndicatorConfig;
  vals: LiveValue;
  z: number;
  contrib: number;
  abs: number;
  totalWeight: number;
}

export function getRankedContributors(
  pillar: 'growth' | 'inflation',
  liveValues: Record<string, LiveValue>
): RankedContributor[] {
  const keys = Object.keys(INDICATOR_CONFIGS).filter(k => INDICATOR_CONFIGS[k].pillar === pillar);
  const totalWeight = keys.reduce((s, k) => s + INDICATOR_CONFIGS[k].weight, 0);
  const result: RankedContributor[] = [];
  for (const k of keys) {
    const cfg = INDICATOR_CONFIGS[k];
    const vals = liveValues[k];
    if (!vals || isNaN(vals.current)) continue;
    const z = clampedZ(zscore({ ...cfg, current: vals.current }));
    const contrib = (z * cfg.weight / totalWeight) * 40;
    result.push({ key: k, cfg, vals, z, contrib, abs: Math.abs(contrib), totalWeight });
  }
  return result.sort((a, b) => b.abs - a.abs);
}
