'use client';
import { useState } from 'react';
import { DATA_SOURCE_LINKS } from '@/lib/config';

const C = {
  bg2: '#ecebe5', surface: '#ffffff', border: '#d6d3cc',
  ink: '#1a1d24', ink2: '#3f4654', muted: '#6b7280', gold: '#9a6f1a',
};

export function DataSourcesButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        style={{
          fontFamily: 'system-ui, sans-serif',
          fontSize: '12px',
          fontWeight: '600',
          padding: '8px 16px',
          background: C.surface,
          color: C.gold,
          border: `1px solid ${C.gold}60`,
          borderRadius: '6px',
          cursor: 'pointer',
          letterSpacing: '0.3px',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
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
              width: '100%', maxWidth: '720px', maxHeight: '80vh',
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
                  Data Sources
                </div>
                <div style={{ fontFamily: 'monospace', fontSize: '10px', color: C.muted, marginTop: '3px' }}>
                  All indicator data refreshes automatically — no mock data.
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

            {/* Source list */}
            <div style={{ overflowY: 'auto', padding: '12px 24px 24px' }}>
              {DATA_SOURCE_LINKS.map((src, i) => (
                <a
                  key={i}
                  href={src.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'block',
                    padding: '12px 14px',
                    marginBottom: '6px',
                    background: C.bg2,
                    borderRadius: '8px',
                    border: `1px solid ${C.border}`,
                    textDecoration: 'none',
                    transition: 'border-color 0.15s, background 0.15s',
                  }}
                  onMouseEnter={e => {
                    const el = e.currentTarget as HTMLElement;
                    el.style.borderColor = C.gold;
                    el.style.background = '#fdf8f0';
                  }}
                  onMouseLeave={e => {
                    const el = e.currentTarget as HTMLElement;
                    el.style.borderColor = C.border;
                    el.style.background = C.bg2;
                  }}
                >
                  <div style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
                    gap: '12px',
                  }}>
                    <div style={{ fontSize: '13px', fontWeight: '600', color: C.gold }}>
                      {src.label}
                    </div>
                    <div style={{ fontSize: '9px', fontFamily: 'monospace', color: C.muted, flexShrink: 0 }}>
                      ↗ open
                    </div>
                  </div>
                  <div style={{ fontSize: '11px', color: C.ink2, marginTop: '3px', lineHeight: '1.5' }}>
                    {src.description}
                  </div>
                  <div style={{ fontSize: '9px', fontFamily: 'monospace', color: C.muted, marginTop: '4px', wordBreak: 'break-all' }}>
                    {src.url}
                  </div>
                </a>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
