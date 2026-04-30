'use client';
import { useState } from 'react';
import type { LiveValue } from '@/lib/types';
import { INDICATOR_CONFIGS } from '@/lib/config';

const C = {
  bg: '#f6f5f1', bg2: '#ecebe5', surface: '#ffffff', border: '#d6d3cc',
  ink: '#1a1d24', ink2: '#3f4654', muted: '#6b7280', gold: '#9a6f1a',
  green: '#2d7a3e', orange: '#b8720e', red: '#c0392b',
};

function formatValue(current: number, unit: string): string {
  if (current == null || isNaN(current)) return 'N/A';
  if (unit === 'claims') return current.toLocaleString('en-US', { maximumFractionDigits: 0 });
  if (unit === 'k SAAR') return current.toLocaleString('en-US', { maximumFractionDigits: 0 });
  if (unit === 'bps') return current.toLocaleString('en-US', { maximumFractionDigits: 0 });
  if (unit === 'ratio') return current.toFixed(5);
  return current.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 2 });
}

function ValueBadge({ v, unit }: { v: LiveValue; unit: string }) {
  const isFallback = v.error === 'fallback';
  const isMissing = v.current == null || isNaN(v.current);

  if (isMissing) {
    return (
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: '4px',
        fontFamily: 'monospace', fontSize: '11px', color: C.red,
      }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: C.red, display: 'inline-block', flexShrink: 0 }} />
        N/A
      </span>
    );
  }

  const dotColor = isFallback ? C.orange : C.green;
  const textColor = isFallback ? C.orange : C.green;

  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: '4px',
      fontFamily: 'monospace', fontSize: '11px', color: textColor,
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: dotColor, display: 'inline-block', flexShrink: 0 }} />
      {formatValue(v.current, unit)}
      <span style={{ fontSize: '9px', color: C.muted }}>{unit}</span>
      {isFallback && (
        <span style={{
          fontSize: '8px', background: '#fcefd6', color: C.orange,
          border: `1px solid ${C.orange}50`, borderRadius: '3px',
          padding: '0 4px', lineHeight: '14px',
        }}>
          ref
        </span>
      )}
    </span>
  );
}

export function DataSourcesButton({ liveValues }: { liveValues: Record<string, LiveValue> }) {
  const [open, setOpen] = useState(false);

  const growthKeys = Object.keys(INDICATOR_CONFIGS).filter(k => INDICATOR_CONFIGS[k].pillar === 'growth');
  const inflationKeys = Object.keys(INDICATOR_CONFIGS).filter(k => INDICATOR_CONFIGS[k].pillar === 'inflation');

  const liveCount = Object.values(liveValues).filter(v => !v.error || v.error !== 'fallback').length;
  const totalCount = Object.keys(INDICATOR_CONFIGS).length;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        style={{
          fontFamily: 'system-ui, sans-serif',
          fontSize: '12px', fontWeight: '600',
          padding: '8px 16px',
          background: C.surface, color: C.gold,
          border: `1px solid ${C.gold}60`,
          borderRadius: '6px', cursor: 'pointer',
          letterSpacing: '0.3px',
          display: 'flex', alignItems: 'center', gap: '6px',
          transition: 'background 0.15s',
        }}
        onMouseEnter={e => ((e.target as HTMLElement).style.background = '#fdf8f0')}
        onMouseLeave={e => ((e.target as HTMLElement).style.background = C.surface)}
      >
        <span style={{ fontSize: '14px' }}>⛁</span> Data Sources
      </button>

      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
            zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '20px',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: C.surface, borderRadius: '12px', border: `1px solid ${C.border}`,
              width: '100%', maxWidth: '800px', maxHeight: '85vh',
              display: 'flex', flexDirection: 'column',
              boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
            }}
          >
            {/* Header */}
            <div style={{
              padding: '20px 24px', borderBottom: `1px solid ${C.border}`,
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              flexShrink: 0,
            }}>
              <div>
                <div style={{ fontFamily: 'Georgia,serif', fontSize: '18px', fontWeight: '700', color: C.ink }}>
                  Live Data Sources
                </div>
                <div style={{ fontFamily: 'monospace', fontSize: '10px', color: C.muted, marginTop: '3px' }}>
                  {liveCount}/{totalCount} indicators live · click any row to open source
                  &nbsp;&nbsp;
                  <span style={{ color: C.green }}>● live</span>
                  &nbsp;&nbsp;
                  <span style={{ color: C.orange }}>● ref (fallback)</span>
                  &nbsp;&nbsp;
                  <span style={{ color: C.red }}>● N/A</span>
                </div>
              </div>
              <button
                onClick={() => setOpen(false)}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  fontSize: '20px', color: C.muted, lineHeight: 1, padding: '4px 8px',
                  borderRadius: '4px',
                }}
                onMouseEnter={e => ((e.target as HTMLElement).style.background = C.bg2)}
                onMouseLeave={e => ((e.target as HTMLElement).style.background = 'none')}
              >
                ×
              </button>
            </div>

            {/* Indicator table */}
            <div style={{ overflowY: 'auto', padding: '16px 24px 24px' }}>
              {/* Column headers */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: '2fr 1.4fr 1fr 1fr',
                gap: '8px',
                padding: '0 10px 8px',
                borderBottom: `1px solid ${C.border}`,
                marginBottom: '8px',
              }}>
                {['Indicator', 'Source', 'Current Value', 'Lead'].map(h => (
                  <div key={h} style={{ fontSize: '9px', fontFamily: 'monospace', color: C.muted, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{h}</div>
                ))}
              </div>

              {/* Growth section */}
              <SectionLabel label="Growth Indicators" />
              {growthKeys.map(k => (
                <IndicatorRow key={k} indicatorKey={k} liveValues={liveValues} />
              ))}

              {/* Inflation section */}
              <SectionLabel label="Inflation Indicators" />
              {inflationKeys.map(k => (
                <IndicatorRow key={k} indicatorKey={k} liveValues={liveValues} />
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function SectionLabel({ label }: { label: string }) {
  return (
    <div style={{
      fontFamily: 'Georgia,serif', fontSize: '11px', fontWeight: '700',
      color: C.gold, letterSpacing: '0.8px', textTransform: 'uppercase',
      padding: '12px 10px 6px',
    }}>
      {label}
    </div>
  );
}

function IndicatorRow({ indicatorKey, liveValues }: { indicatorKey: string; liveValues: Record<string, LiveValue> }) {
  const cfg = INDICATOR_CONFIGS[indicatorKey];
  const v = liveValues[indicatorKey] ?? { current: NaN, prior: NaN };
  const isMissing = v.current == null || isNaN(v.current);
  const isFallback = v.error === 'fallback';

  return (
    <a
      href={cfg.source_url}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        display: 'grid',
        gridTemplateColumns: '2fr 1.4fr 1fr 1fr',
        gap: '8px',
        alignItems: 'center',
        padding: '9px 10px',
        marginBottom: '2px',
        background: C.bg2,
        borderRadius: '6px',
        border: `1px solid ${isMissing ? C.red + '30' : isFallback ? C.orange + '30' : C.border}`,
        textDecoration: 'none',
        transition: 'border-color 0.15s, background 0.15s',
        cursor: 'pointer',
      }}
      onMouseEnter={e => {
        const el = e.currentTarget as HTMLElement;
        el.style.borderColor = C.gold;
        el.style.background = '#fdf8f0';
      }}
      onMouseLeave={e => {
        const el = e.currentTarget as HTMLElement;
        el.style.borderColor = isMissing ? C.red + '30' : isFallback ? C.orange + '30' : C.border;
        el.style.background = C.bg2;
      }}
    >
      {/* Indicator name */}
      <div>
        <div style={{ fontSize: '12px', fontWeight: '600', color: C.ink }}>{cfg.name}</div>
        <div style={{ fontSize: '9px', color: C.muted, fontFamily: 'monospace', marginTop: '1px' }}>
          {indicatorKey}
        </div>
      </div>

      {/* Source label */}
      <div style={{ fontSize: '10px', color: C.gold, fontFamily: 'monospace', wordBreak: 'break-word' }}>
        {cfg.source_label}
        <span style={{ fontSize: '8px', color: C.muted, marginLeft: '4px' }}>↗</span>
      </div>

      {/* Live value */}
      <ValueBadge v={v} unit={cfg.unit} />

      {/* Lead time */}
      <div style={{ fontSize: '10px', color: C.muted, fontFamily: 'monospace' }}>
        {cfg.lead_months}mo lead
      </div>
    </a>
  );
}
