'use client';
import { useState, useCallback } from 'react';
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

type Tab = 'dashboard' | 'synthesis' | 'methodology';

export function AppShell({ initialData }: { initialData: ApiResponse | null }) {
  const [tab, setTab] = useState<Tab>('dashboard');
  const [liveValues, setLiveValues] = useState<Record<string, LiveValue>>(
    initialData?.values ?? {}
  );
  const [fetchedAt, setFetchedAt] = useState<string | null>(initialData?.fetchedAt ?? null);
  const [noApiKey, setNoApiKey] = useState(initialData?.noApiKey ?? false);
  const [refreshing, setRefreshing] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Count live (non-error) indicators
  const liveCount = Object.values(liveValues).filter(
    v => v.current != null && !isNaN(v.current) && !v.error
  ).length;
  const totalCount = Object.keys(INDICATOR_CONFIGS).length;

  const dataStatus: 'no-key' | 'live' | 'fallback' =
    noApiKey ? 'no-key' :
    liveCount > 0 ? 'live' :
    'fallback';

  // Manual refresh (calls the API route, same logic but fresh)
  const refresh = useCallback(async () => {
    setRefreshing(true);
    setFetchError(null);
    try {
      const res = await fetch('/api/indicators');
      if (!res.ok) throw new Error(`API returned ${res.status}`);
      const data: ApiResponse = await res.json();
      if (data.noApiKey) {
        setNoApiKey(true);
      } else {
        setLiveValues(data.values);
        setFetchedAt(data.fetchedAt);
        setNoApiKey(false);
      }
    } catch (e) {
      setFetchError(e instanceof Error ? e.message : String(e));
    } finally {
      setRefreshing(false);
    }
  }, []);

  const today = new Date().toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric',
  });

  return (
    <>
      {/* ── Header ── */}
      <div style={{ background: C.bg2, borderBottom: `1px solid ${C.border}`, padding: '20px 32px', position: 'relative' }}>
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

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px', flexShrink: 0 }}>
              <StatusPill status={dataStatus} liveCount={liveCount} total={totalCount} fetchedAt={fetchedAt} />
              <DataSourcesButton liveValues={liveValues} />
            </div>
          </div>

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
            </div>
          )}

          {fetchError && !noApiKey && (
            <div style={{
              marginTop: '12px', padding: '10px 14px',
              background: '#fde8e8', border: '1px solid #c0392b40', borderRadius: '6px',
              fontSize: '11px', color: '#7f1f1f', fontFamily: 'monospace',
            }}>
              Refresh error: {fetchError}
            </div>
          )}
        </div>
      </div>

      {/* ── Tab bar ── */}
      <div style={{ background: C.surface, borderBottom: `1px solid ${C.border}`, position: 'sticky', top: 0, zIndex: 50 }}>
        <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '0 32px', display: 'flex' }}>
          {([
            { id: 'dashboard',   label: 'Dashboard' },
            { id: 'synthesis',   label: 'AI Synthesis' },
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

          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', paddingRight: '4px' }}>
            <button
              onClick={refresh}
              disabled={refreshing}
              title="Fetch fresh data from sources"
              style={{
                background: 'none', border: `1px solid ${C.border}`, borderRadius: '5px',
                padding: '5px 10px', cursor: refreshing ? 'wait' : 'pointer',
                fontSize: '11px', fontFamily: 'monospace', color: C.muted,
                display: 'flex', alignItems: 'center', gap: '5px',
              }}
            >
              <span style={{ display: 'inline-block', animation: refreshing ? 'spin 1s linear infinite' : 'none' }}>↻</span>
              {refreshing ? 'Refreshing…' : 'Refresh'}
            </button>
          </div>
        </div>
      </div>

      {/* ── Tab content ── */}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      {tab === 'dashboard'   && <Dashboard liveValues={liveValues} />}
      {tab === 'synthesis'   && <AISynthesis liveValues={liveValues} />}
      {tab === 'methodology' && <Methodology />}
    </>
  );
}

// ── Status pill ───────────────────────────────────────────────────────
function StatusPill({
  status, liveCount, total, fetchedAt,
}: {
  status: 'live' | 'fallback' | 'no-key';
  liveCount: number;
  total: number;
  fetchedAt: string | null;
}) {
  const map = {
    live:     { color: '#2d7a3e', bg: '#e0f0e4', dot: '#2d7a3e', label: `Live · ${liveCount}/${total} indicators` },
    fallback: { color: '#b8720e', bg: '#fcefd6', dot: '#b8720e', label: 'Stale data · fetch failed' },
    'no-key': { color: '#b8720e', bg: '#fcefd6', dot: '#b8720e', label: 'No API key configured' },
  };
  const s = map[status];
  const timeLabel = fetchedAt
    ? new Date(fetchedAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
    : null;

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '6px',
      background: s.bg, border: `1px solid ${s.color}40`,
      borderRadius: '20px', padding: '4px 10px',
    }}>
      <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: s.dot, flexShrink: 0 }} />
      <span style={{ fontFamily: 'monospace', fontSize: '10px', color: s.color, fontWeight: '600' }}>
        {s.label}
        {timeLabel && <span style={{ fontWeight: '400', marginLeft: '5px', opacity: 0.7 }}>· {timeLabel}</span>}
      </span>
    </div>
  );
}
