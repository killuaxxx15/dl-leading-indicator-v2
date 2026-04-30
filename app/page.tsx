'use client';
import { useState, useEffect, useCallback } from 'react';
import type { LiveValue, ApiResponse } from '@/lib/types';
import { INDICATOR_CONFIGS } from '@/lib/config';
import { Dashboard } from '@/components/Dashboard';
import { Methodology } from '@/components/Methodology';
import { AISynthesis } from '@/components/AISynthesis';
import { DataSourcesButton } from '@/components/DataSources';

const C = {
  bg: '#f6f5f1', bg2: '#ecebe5', surface: '#ffffff', border: '#d6d3cc',
  ink: '#1a1d24', ink2: '#3f4654', muted: '#6b7280', gold: '#9a6f1a',
};

// Fallback values if API hasn't loaded yet (or fetch fails)
// These match the original hand-coded values so the dashboard always shows something
const FALLBACK_VALUES: Record<string, LiveValue> = {
  GDPNOW:        { current: 2.4,       prior: 2.1,     error: 'fallback' },
  WEI:           { current: 1.9,       prior: 2.2,     error: 'fallback' },
  T10Y3M:        { current: 21,        prior: 8,       error: 'fallback' },
  HY_SPREAD:     { current: 341,       prior: 295,     error: 'fallback' },
  SPX_VS_200DMA: { current: 2.1,       prior: 4.8,     error: 'fallback' },
  COPPER_GOLD:   { current: 0.00192,   prior: 0.00205, error: 'fallback' },
  ISM_NEW_ORDERS:{ current: 48.3,      prior: 49.2,    error: 'fallback' },
  LEI:           { current: -3.2,      prior: -3.8,    error: 'fallback' },
  ICSA:          { current: 242000,    prior: 221000,  error: 'fallback' },
  PERMIT:        { current: 1387,      prior: 1452,    error: 'fallback' },
  ZORI_YOY:      { current: 4.2,       prior: 3.8,     error: 'fallback' },
  ATLANTA_WAGE:  { current: 4.1,       prior: 4.3,     error: 'fallback' },
  T5YIFR:        { current: 2.44,      prior: 2.31,    error: 'fallback' },
  MICH_1YR:      { current: 3.2,       prior: 2.9,     error: 'fallback' },
  BCOM_YOY:      { current: 8.2,       prior: 5.1,     error: 'fallback' },
  OIL_YOY:       { current: 18.5,      prior: 12.3,    error: 'fallback' },
  PPI_YOY:       { current: 3.1,       prior: 2.4,     error: 'fallback' },
  DOLLAR_YOY:    { current: -2.1,      prior: 1.4,     error: 'fallback' },
};

type Tab = 'dashboard' | 'synthesis' | 'methodology';

export default function Home() {
  const [tab, setTab] = useState<Tab>('dashboard');
  const [liveValues, setLiveValues] = useState<Record<string, LiveValue>>(FALLBACK_VALUES);
  const [loading, setLoading] = useState(true);
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);
  const [noApiKey, setNoApiKey] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [dataStatus, setDataStatus] = useState<'loading' | 'live' | 'fallback' | 'no-key'>('loading');

  const loadData = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const res = await fetch('/api/indicators');
      if (!res.ok) throw new Error(`API returned ${res.status}`);
      const data: ApiResponse = await res.json();

      if (data.noApiKey) {
        setNoApiKey(true);
        setDataStatus('no-key');
        setLoading(false);
        return;
      }

      // Merge live values with fallbacks for any missing keys
      const merged: Record<string, LiveValue> = { ...FALLBACK_VALUES };
      let liveCount = 0;
      Object.keys(data.values).forEach(k => {
        const v = data.values[k];
        if (!isNaN(v.current)) {
          merged[k] = v;
          liveCount++;
        }
      });

      setLiveValues(merged);
      setFetchedAt(data.fetchedAt);
      setDataStatus(liveCount > 0 ? 'live' : 'fallback');
    } catch (e) {
      setFetchError(e instanceof Error ? e.message : String(e));
      setDataStatus('fallback');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  // Count how many live (non-fallback) values we have
  const liveCount = Object.values(liveValues).filter(v => !v.error || v.error !== 'fallback').length;
  const totalCount = Object.keys(INDICATOR_CONFIGS).length;

  return (
    <>
      {/* ── Header ── */}
      <div style={{ background: C.bg2, borderBottom: `1px solid ${C.border}`, padding: '20px 32px', position: 'relative' }}>
        {/* Top accent bar */}
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: '3px',
          background: 'linear-gradient(90deg,#2d7a3e,#b8720e,#c0392b)',
        }} />
        <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px', flexWrap: 'wrap' }}>
                <div style={{ fontFamily: 'Georgia,serif', fontSize: '22px', fontWeight: '900', color: C.ink }}>
                  CIO <span style={{ color: C.gold }}>Growth & Inflation Leading Indicator</span>
                </div>
                <div style={{ fontFamily: 'monospace', fontSize: '10px', color: C.muted }}>
                  as of {today}
                </div>
              </div>
              <div style={{ fontFamily: 'monospace', fontSize: '10px', color: C.muted, marginTop: '6px', maxWidth: '800px', lineHeight: '1.7' }}>
                Mechanical weighted z-score composite across leading indicators. Every indicator standardised to its own history, weighted by lead-time quality, and summed. No AI interpretation — every number shows how it contributes.
              </div>
            </div>

            {/* Data status pill */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px', flexShrink: 0 }}>
              <StatusPill status={dataStatus} liveCount={liveCount} total={totalCount} loading={loading} />
              <DataSourcesButton />
            </div>
          </div>

          {/* No API key banner */}
          {noApiKey && (
            <div style={{
              marginTop: '12px', padding: '10px 14px',
              background: '#fdf3d0', border: '1px solid #c9a227', borderRadius: '6px',
              fontSize: '12px', color: '#7a5a10', lineHeight: '1.6',
            }}>
              <strong>FRED API key not configured.</strong> Add your free key to{' '}
              <code style={{ background: '#f5e7b0', padding: '1px 5px', borderRadius: '3px' }}>.env.local</code> as{' '}
              <code style={{ background: '#f5e7b0', padding: '1px 5px', borderRadius: '3px' }}>FRED_API_KEY=your_key</code>.
              {' '}Get one free at{' '}
              <a href="https://fred.stlouisfed.org/docs/api/api_key.html" target="_blank" rel="noopener noreferrer" style={{ color: '#7a5a10', fontWeight: '600' }}>
                fred.stlouisfed.org ↗
              </a>
              . Showing last-known reference values in the meantime.
            </div>
          )}

          {fetchError && !noApiKey && (
            <div style={{
              marginTop: '12px', padding: '10px 14px',
              background: '#fde8e8', border: '1px solid #c0392b40', borderRadius: '6px',
              fontSize: '11px', color: '#7f1f1f', fontFamily: 'monospace',
            }}>
              Data fetch error: {fetchError} — showing reference values.
            </div>
          )}
        </div>
      </div>

      {/* ── Tab bar ── */}
      <div style={{ background: C.surface, borderBottom: `1px solid ${C.border}`, position: 'sticky', top: 0, zIndex: 50 }}>
        <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '0 32px', display: 'flex' }}>
          {([
            { id: 'dashboard', label: 'Dashboard' },
            { id: 'synthesis', label: 'AI Synthesis' },
            { id: 'methodology', label: 'Methodology' },
          ] as { id: Tab; label: string }[]).map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                fontFamily: 'system-ui, sans-serif',
                fontSize: '13px',
                fontWeight: tab === t.id ? '700' : '500',
                padding: '14px 20px',
                background: 'transparent',
                border: 'none',
                borderBottom: tab === t.id ? `3px solid ${C.gold}` : '3px solid transparent',
                color: tab === t.id ? C.ink : C.ink2,
                cursor: 'pointer',
                letterSpacing: '0.3px',
                marginBottom: '-1px',
                transition: 'color 0.15s',
              }}
            >
              {t.label}
            </button>
          ))}

          {/* Refresh button */}
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', paddingRight: '4px' }}>
            <button
              onClick={loadData}
              disabled={loading}
              title="Refresh live data"
              style={{
                background: 'none', border: `1px solid ${C.border}`, borderRadius: '5px',
                padding: '5px 10px', cursor: loading ? 'wait' : 'pointer',
                fontSize: '11px', fontFamily: 'monospace', color: C.muted,
                display: 'flex', alignItems: 'center', gap: '5px',
              }}
            >
              <span style={{ display: 'inline-block', animation: loading ? 'spin 1s linear infinite' : 'none' }}>↻</span>
              {loading ? 'Refreshing…' : 'Refresh'}
            </button>
          </div>
        </div>
      </div>

      {/* ── Tab content ── */}
      {tab === 'dashboard' && <Dashboard liveValues={liveValues} />}
      {tab === 'synthesis' && <AISynthesis liveValues={liveValues} />}
      {tab === 'methodology' && <Methodology />}
    </>
  );
}

// ── Status pill ──────────────────────────────────────────────────────

function StatusPill({
  status, liveCount, total, loading,
}: {
  status: 'loading' | 'live' | 'fallback' | 'no-key';
  liveCount: number;
  total: number;
  loading: boolean;
}) {
  const map = {
    loading: { color: '#6b7280', bg: '#f3f4f6', dot: '#6b7280', label: 'Loading data…' },
    live:    { color: '#2d7a3e', bg: '#e0f0e4', dot: '#2d7a3e', label: `Live · ${liveCount}/${total} indicators` },
    fallback:{ color: '#b8720e', bg: '#fcefd6', dot: '#b8720e', label: `Reference values · fetch failed` },
    'no-key':{ color: '#b8720e', bg: '#fcefd6', dot: '#b8720e', label: 'Reference values · no API key' },
  };
  const s = map[status];
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '6px',
      background: s.bg, border: `1px solid ${s.color}40`,
      borderRadius: '20px', padding: '4px 10px',
    }}>
      <div style={{
        width: '7px', height: '7px', borderRadius: '50%', background: s.dot,
        animation: status === 'live' ? 'none' : status === 'loading' ? 'spin 1s linear infinite' : 'none',
        flexShrink: 0,
      }} />
      <span style={{ fontFamily: 'monospace', fontSize: '10px', color: s.color, fontWeight: '600' }}>{s.label}</span>
    </div>
  );
}
