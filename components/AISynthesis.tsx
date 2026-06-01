'use client';
import { useState, useEffect } from 'react';
import type { LiveValue } from '@/lib/types';
import { INDICATOR_CONFIGS } from '@/lib/config';
import { pillarComposite, zscore, clampedZ } from '@/lib/calculations';

const C = {
  bg: '#f6f5f1', bg2: '#ecebe5', surface: '#ffffff', border: '#d6d3cc',
  ink: '#1a1d24', ink2: '#3f4654', muted: '#6b7280',
  red: '#c0392b', amber: '#b8720e', green: '#2d7a3e', blue: '#2760a8', gold: '#9a6f1a',
};

const DEFAULT_NOTES = `DIRECTIONAL BIAS

Stagflation regime: growth slowing, inflation persistent. Not extreme in magnitude but the breadth is notable — indicators are broadly aligned, not mixed.

GROWTH PILLAR
Conference Board LEI is the largest bearish contributor. Initial Claims trending up. Copper-Gold ratio below baseline signals industrial demand softness relative to safe havens. Pushback: GDPNow still above trend, HY spreads near cycle tights.

INFLATION PILLAR
Atlanta Fed wage growth above baseline, 5Y5Y breakeven drifting up, commodity prices positive YoY. Zillow rent is the sleeper — leads CPI shelter by 6-10 months. If it keeps rising, OER follows into 2026.

POSITIONING THOUGHTS
- Trim equity risk into S&P strength
- Long duration carefully — inflation composite says rates may not fall as fast as growth implies
- Underweight HY credit despite tight spreads
- Gold as stagflation hedge

WHAT WOULD CHANGE THIS VIEW
- Initial Claims falling back below 220k for 3 consecutive weeks
- Zillow rent dropping to 3.0% YoY
- HY spreads widening past 400bps (confirming repricing)`;

interface Synthesis {
  key_takeaways?: string[];
  integration?: string;
  agreements?: string;
  contradictions?: string;
  blindspots?: string;
  what_would_change_view?: string;
  portfolio_implication?: string;
}

export function AISynthesis({ liveValues }: { liveValues: Record<string, LiveValue> }) {
  const [notes, setNotes] = useState(DEFAULT_NOTES);
  const [synthesis, setSynthesis] = useState<Synthesis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState('');
  const [lastAt, setLastAt] = useState('');

  useEffect(() => {
    try {
      const saved = localStorage.getItem('cio_notes_text');
      if (saved) setNotes(saved);
      const savedS = localStorage.getItem('cio_notes_synthesis');
      if (savedS) setSynthesis(JSON.parse(savedS));
      const savedAt = localStorage.getItem('cio_notes_synthesized_at');
      if (savedAt) setLastAt(savedAt);
    } catch {}
  }, []);

  function buildPrompt() {
    const growth = pillarComposite('growth', liveValues);
    const inflation = pillarComposite('inflation', liveValues);
    const regime =
      growth > 0 && inflation > 0 ? 'GOLDILOCKS'
      : growth > 0 && inflation < 0 ? 'REFLATION'
      : growth < 0 && inflation > 0 ? 'DEFLATION RISK'
      : 'STAGFLATION';

    const lines = Object.keys(INDICATOR_CONFIGS).map(k => {
      const cfg = INDICATOR_CONFIGS[k];
      const vals = liveValues[k];
      if (!vals) return null;
      const z = clampedZ(zscore({ ...cfg, current: vals.current }));
      const dir = z > 0.5 ? 'supporting +' : z < -0.5 ? 'supporting -' : 'neutral';
      return `  ${cfg.name} (${cfg.pillar}): ${vals.current} ${cfg.unit}, z=${z.toFixed(2)} ${dir}`;
    }).filter(Boolean).join('\n');

    return [
      'You are a senior macro strategist synthesizing quantitative leading indicators into actionable signals.\n',
      `CURRENT QUANTITATIVE SIGNAL:\n- Growth composite: ${growth} (positive = accelerating)\n- Inflation composite: ${inflation} (positive = inflation falling)\n- Regime: ${regime}\n`,
      `INDICATOR DETAIL:\n${lines}\n`,
      `DATA-DRIVEN NOTES:\n---START---\n${notes}\n---END---\n`,
      'Return ONLY valid JSON, no markdown:\n{\n  "key_takeaways": ["3-5 bullets, max 18 words each"],\n  "integration": "1-2 sentences on how notes connect to quant signal",\n  "agreements": "indicators confirming dominant reading, max 25 words",\n  "contradictions": "indicators pushing against, max 25 words",\n  "blindspots": "data gaps or limitations, max 25 words",\n  "what_would_change_view": "data that would shift the view, max 25 words",\n  "portfolio_implication": "one sentence on positioning implication, max 25 words"\n}',
    ].join('\n');
  }

  async function synthesize() {
    if (!notes.trim()) { alert('Add some notes first.'); return; }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/synthesize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 1500,
          system: 'Return only valid JSON. No markdown. No text before or after the JSON object.',
          messages: [{ role: 'user', content: buildPrompt() }],
        }),
      });
      if (!res.ok) throw new Error(`API ${res.status}: ${await res.text().then(t => t.slice(0, 200))}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error.message);
      let raw = (data.content?.[0]?.text ?? '').replace(/```json\s*/gi, '').replace(/```/g, '').trim();
      const match = raw.match(/\{[\s\S]*\}/);
      if (!match) throw new Error('No JSON in response');
      const parsed = JSON.parse(match[0]);
      setSynthesis(parsed);
      const ts = new Date().toLocaleString();
      setLastAt(ts);
      try {
        localStorage.setItem('cio_notes_synthesis', JSON.stringify(parsed));
        localStorage.setItem('cio_notes_synthesized_at', ts);
      } catch {}
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  const wordCount = (notes.trim().match(/\S+/g) || []).length;

  return (
    <div style={{
      maxWidth: '1200px', margin: '0 auto', padding: '24px 32px',
      display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px',
    }}>
      {/* LEFT: editor */}
      <div>
        <div style={{
          background: C.surface, border: `1px solid ${C.border}`,
          borderRadius: '8px', padding: '14px',
          display: 'flex', flexDirection: 'column', gap: '10px',
        }}>
          <div style={{ fontFamily: 'monospace', fontSize: '9px', color: C.muted, textTransform: 'uppercase', letterSpacing: '1px' }}>
            CIO / Macro Notes
          </div>
          <textarea
            value={notes}
            onChange={e => {
              setNotes(e.target.value);
              try { localStorage.setItem('cio_notes_text', e.target.value); } catch {}
            }}
            style={{
              width: '100%', minHeight: '400px',
              fontFamily: 'system-ui, sans-serif', fontSize: '13px', lineHeight: '1.6',
              color: C.ink, background: C.bg2, border: `1px solid ${C.border}`, borderRadius: '4px',
              padding: '12px 14px', resize: 'vertical', outline: 'none',
            }}
            placeholder="Write your macro thesis, data observations, or positioning thoughts here..."
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
            <div style={{ fontFamily: 'monospace', fontSize: '10px', color: C.muted }}>
              {wordCount} words{lastAt ? `  ·  synthesized ${lastAt}` : ''}
            </div>
            <button
              onClick={synthesize}
              disabled={loading}
              style={{
                fontFamily: 'system-ui, sans-serif', fontSize: '13px', fontWeight: '600',
                padding: '10px 18px',
                background: loading ? C.muted : C.gold,
                color: '#fff', border: 'none', borderRadius: '6px',
                cursor: loading ? 'wait' : 'pointer',
              }}
            >
              {loading ? 'Synthesizing…' : '◈ Synthesize with AI'}
            </button>
          </div>
        </div>
      </div>

      {/* RIGHT: synthesis output */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {error && (
          <div style={{ background: C.surface, border: `1px solid ${C.red}`, borderLeft: `3px solid ${C.red}`, borderRadius: '8px', padding: '16px 20px' }}>
            <div style={{ fontFamily: 'monospace', fontSize: '10px', color: C.red, marginBottom: '6px' }}>API ERROR</div>
            <div style={{ fontSize: '12px', color: C.ink2, fontFamily: 'monospace' }}>{error}</div>
          </div>
        )}

        {!synthesis && !loading && !error && (
          <div style={{
            background: C.surface, border: `1px solid ${C.border}`, borderRadius: '8px',
            padding: '60px 24px', textAlign: 'center', color: C.muted, fontSize: '13px', lineHeight: '1.7',
          }}>
            <div style={{ fontSize: '36px', marginBottom: '16px', opacity: 0.3 }}>◈</div>
            <div>Write notes on the left, then click</div>
            <div style={{ color: C.ink, fontWeight: '600', margin: '4px 0' }}>"Synthesize with AI"</div>
            <div>to generate synthesis from current dashboard data.</div>
            <div style={{ fontSize: '11px', marginTop: '20px', color: C.muted, maxWidth: '320px', margin: '20px auto 0', lineHeight: '1.6' }}>
              The AI receives current composite scores, all indicator values, and your notes — returning key takeaways, agreements, contradictions, and portfolio implications.
            </div>
          </div>
        )}

        {loading && (
          <div style={{
            background: C.surface, border: `1px solid ${C.border}`, borderRadius: '8px',
            padding: '60px 24px', textAlign: 'center',
          }}>
            <div style={{
              width: '32px', height: '32px', margin: '0 auto 16px',
              border: `3px solid ${C.border}`, borderTopColor: C.gold,
              borderRadius: '50%', animation: 'spin 0.7s linear infinite',
            }} />
            <div style={{ color: C.muted, fontSize: '12px', fontFamily: 'monospace' }}>AI synthesizing data + signals…</div>
          </div>
        )}

        {synthesis && (
          <>
            {/* Takeaways */}
            <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderLeft: `3px solid ${C.gold}`, borderRadius: '8px', padding: '18px 22px' }}>
              <div style={{ fontFamily: 'monospace', fontSize: '9px', color: C.gold, textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: '12px' }}>◆ Key Takeaways</div>
              {(synthesis.key_takeaways ?? []).map((t, i, arr) => (
                <div key={i} style={{
                  display: 'flex', gap: '10px', marginBottom: '10px',
                  paddingBottom: i < arr.length - 1 ? '10px' : '0',
                  borderBottom: i < arr.length - 1 ? `1px dashed ${C.border}` : 'none',
                }}>
                  <div style={{ fontFamily: 'Georgia,serif', fontSize: '14px', fontWeight: '700', color: C.gold, flexShrink: 0 }}>{i + 1}</div>
                  <div style={{ fontSize: '13px', color: C.ink, lineHeight: '1.7' }}>{t}</div>
                </div>
              ))}
            </div>

            {synthesis.integration && (
              <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderLeft: `3px solid ${C.blue}`, borderRadius: '8px', padding: '14px 18px' }}>
                <div style={{ fontFamily: 'monospace', fontSize: '9px', color: C.blue, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>Integration with quant signal</div>
                <div style={{ fontSize: '13px', color: C.ink2, lineHeight: '1.7' }}>{synthesis.integration}</div>
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              {synthesis.agreements && (
                <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderLeft: `3px solid ${C.green}`, borderRadius: '8px', padding: '12px 14px' }}>
                  <div style={{ fontFamily: 'monospace', fontSize: '9px', color: C.green, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '6px' }}>✓ Confirmed by data</div>
                  <div style={{ fontSize: '12px', color: C.ink2, lineHeight: '1.6' }}>{synthesis.agreements}</div>
                </div>
              )}
              {synthesis.contradictions && (
                <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderLeft: `3px solid ${C.red}`, borderRadius: '8px', padding: '12px 14px' }}>
                  <div style={{ fontFamily: 'monospace', fontSize: '9px', color: C.red, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '6px' }}>✗ Pushed against by data</div>
                  <div style={{ fontSize: '12px', color: C.ink2, lineHeight: '1.6' }}>{synthesis.contradictions}</div>
                </div>
              )}
            </div>

            {synthesis.blindspots && (
              <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderLeft: `3px solid ${C.amber}`, borderRadius: '8px', padding: '12px 16px' }}>
                <div style={{ fontFamily: 'monospace', fontSize: '9px', color: C.amber, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '6px' }}>Data blindspot</div>
                <div style={{ fontSize: '12px', color: C.ink2, lineHeight: '1.6' }}>{synthesis.blindspots}</div>
              </div>
            )}

            {synthesis.what_would_change_view && (
              <div style={{ background: '#ecebe5', border: `1px solid ${C.border}`, borderRadius: '8px', padding: '12px 16px' }}>
                <div style={{ fontFamily: 'monospace', fontSize: '9px', color: C.muted, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '6px' }}>What would change this view</div>
                <div style={{ fontSize: '12px', color: C.ink2, lineHeight: '1.6' }}>{synthesis.what_would_change_view}</div>
              </div>
            )}

            {synthesis.portfolio_implication && (
              <div style={{ background: C.gold + '15', border: `1px solid ${C.gold}`, borderRadius: '8px', padding: '14px 18px' }}>
                <div style={{ fontFamily: 'monospace', fontSize: '9px', color: C.gold, textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: '8px', fontWeight: '700' }}>◈ Portfolio Implication</div>
                <div style={{ fontSize: '13px', color: C.ink, lineHeight: '1.7', fontWeight: '500' }}>{synthesis.portfolio_implication}</div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
