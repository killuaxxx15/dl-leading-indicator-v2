'use client';
import { useState } from 'react';
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
  const liveValues: Record<string, LiveValue> = initialData?.values ?? {};
  const fetchedAt: string | null = initialData?.fetchedAt ?? null;

  const liveCount = Object.values(liveValues).filter(
    v => v.current != null && !isNaN(v.current) && !v.error
  ).length;
  const totalCount = Object.keys(INDICATOR_CONFIGS).length;

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
              <StatusPill liveCount={liveCount} total={totalCount} fetchedAt={fetchedAt} />
              <DataSourcesButton liveValues={liveValues} />
            </div>
          </div>

          {liveCount === 0 && (
            <div style={{
              marginTop: '12px', padding: '10px 14px',
              background: '#fdf3d0', border: '1px solid #c9a227', borderRadius: '6px',
              fontSize: '12px', color: '#7a5a10', lineHeight: '1.6',
            }}>
              <strong>No data yet.</strong> Run <code style={{ background: '#f5e7b0', padding: '1px 5px', borderRadius: '3px' }}>python scripts/fetch_indicators.py</code> locally,
              or trigger the <strong>Update Indicators</strong> workflow in GitHub Actions. Data updates automatically every weekday at 10 AM ET.
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
  liveCount, total, fetchedAt,
}: {
  liveCount: number;
  total: number;
  fetchedAt: string | null;
}) {
  const hasData = liveCount > 0;
  const color = hasData ? '#2d7a3e' : '#b8720e';
  const bg    = hasData ? '#e0f0e4' : '#fcefd6';
  const label = hasData ? `Daily · ${liveCount}/${total} indicators` : 'No data yet';
  const dateLabel = fetchedAt && hasData
    ? new Date(fetchedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : null;

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '6px',
      background: bg, border: `1px solid ${color}40`,
      borderRadius: '20px', padding: '4px 10px',
    }}>
      <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: color, flexShrink: 0 }} />
      <span style={{ fontFamily: 'monospace', fontSize: '10px', color, fontWeight: '600' }}>
        {label}
        {dateLabel && <span style={{ fontWeight: '400', marginLeft: '5px', opacity: 0.7 }}>· {dateLabel}</span>}
      </span>
    </div>
  );
}
