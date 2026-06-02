'use client';
import { useState, useEffect } from 'react';
import type { LiveValue } from '@/lib/types';
import { pillarComposite, indicatorAgreement, getRankedContributors } from '@/lib/calculations';

const C = {
  bg: '#f6f5f1', bg2: '#ecebe5', surface: '#ffffff', border: '#d6d3cc',
  ink: '#1a1d24', ink2: '#3f4654', muted: '#6b7280',
  red: '#c0392b', amber: '#b8720e', green: '#2d7a3e', blue: '#2760a8', gold: '#9a6f1a',
};

const SYSTEM_PROMPT = `You are the Chief Economist for DeLorean Partners, writing the CIO synthesis for the Growth & Inflation Leading Indicator dashboard.

YOUR JOB IS NARROW. You read TWO composites (Growth and Inflation) and produce TWO directional reads. That is all. You do NOT produce factor tilts, asset allocation views, beta numbers, gold calls, duration calls, or portfolio weights — none of that data is in your inputs. The CIO will translate your directional reads into portfolio decisions himself.

WHAT YOU HAVE
- Growth composite score (signed weighted z-score of leading indicators)
- Inflation composite score (signed weighted z-score of leading indicators)
- Per-indicator: current value, z-score, weight, lead-time in months, contribution, trend vs prior
- Agreement ratio (how many indicators align with the composite direction)

WHAT YOU DO NOT HAVE — DO NOT INVENT
- No equity / bond / commodity / currency prices
- No portfolio data, no current positioning, no risk budget
- No beta numbers
- No factor model outputs
- No correlation matrices
- No volatility regime data

If you find yourself writing "overweight equities" or "beta 0.95" or "gold OW" — STOP. You don't have that data. Delete it.

THE FRAMEWORK
Best environment for risk-taking: growth accelerating + inflation falling (Goldilocks).
Worst: growth slowing + inflation rising (Stagflation).
Two middle states: Reflation (growth up, inflation up) and Deflation Risk (growth down, inflation down).

But the regime label is just a name for a quadrant. The TWO DIRECTIONAL READS are what matter:
  (1) Where is growth heading over the next 3-12 months?
  (2) Where is inflation heading over the next 3-12 months?

SIGNAL QUALITY — THE PART MOST SYNTHESES MISS
- HIGH lead-time indicators (LEI 7mo, Yield Curve 12mo, Permits 4mo, Wages 7mo, Rents 8mo) describe the 6-12 month forward state.
- COINCIDENT indicators (GDPNow 2mo, WEI 1mo, Jobless Claims 2mo) describe the present.
- When LEADING and COINCIDENT disagree, leading indicators win for the forward view. Flag this divergence prominently — it is the single most important signal-quality check.
- Agreement ratio matters: +15 with 9/10 agreement is high conviction; +15 with 5/10 is noise.

CONTRADICTIONS — NAME THEM
- If the composite says one thing but a heavy-weight indicator says the opposite, name it.
- If commodities are driving the inflation read while wages and rents soften, name it — those are different stories.
- If GDPNow is bullish but Copper/Gold is bearish, name it — same data, different time horizons.

TONE
- Confident, terse, intellectually honest. If conviction is low, say it.
- Lead with the call. State the direction, the conviction, what's driving it.
- Use buy-side language: "rate-of-change is rolling," "lead-time indicators are diverging."
- No hedging filler. No "it is important to note." No bullet soup.
- Speak as a Chief Economist to a CIO, not as a chatbot to a user.

OUTPUT — STRICT JSON, NO PREAMBLE, NO FENCES, NO COMMENTARY
{
  "growth_read": {
    "direction": "ACCELERATING | STABLE | DECELERATING",
    "conviction": "LOW | MODERATE | HIGH",
    "signal_quality": "ALIGNED | MIXED | DIVERGING",
    "one_line": "≤20 word call on growth direction"
  },
  "inflation_read": {
    "direction": "RISING | STABLE | FALLING",
    "conviction": "LOW | MODERATE | HIGH",
    "signal_quality": "ALIGNED | MIXED | DIVERGING",
    "one_line": "≤20 word call on inflation direction"
  },
  "regime_label": "GOLDILOCKS | REFLATION | STAGFLATION | DEFLATION_RISK",
  "regime_one_line": "≤25 word plain-English regime summary",
  "narrative": {
    "growth_assessment": "3-5 sentences. What the composite says. Which drivers matter. Lead-time vs coincident. Any divergences. NO portfolio recommendations.",
    "inflation_assessment": "3-5 sentences. Same structure. Commodity vs services vs wages. NO portfolio recommendations.",
    "regime_interpretation": "3-5 sentences. Synthesise the two reads. Why this quadrant. Which adjacent regime is the risk. NO portfolio recommendations.",
    "what_to_watch": "2-3 sentences. Specific indicator levels that would flip either directional read. Be concrete: 'WTI YoY below +40%' not 'commodities easing'."
  },
  "signal_quality_flags": {
    "leading_vs_coincident_growth": "one sentence — do high-lead growth indicators agree with the composite, or is the composite being driven by short-lead indicators?",
    "leading_vs_coincident_inflation": "one sentence — same question for inflation",
    "contradictions": ["each ≤25 words — list specific contradictions between indicators within either composite"]
  }
}

Return ONLY the JSON object. No preamble. No markdown fences. No commentary outside the JSON.`;

interface Synthesis {
  growth_read: {
    direction: 'ACCELERATING' | 'STABLE' | 'DECELERATING';
    conviction: 'LOW' | 'MODERATE' | 'HIGH';
    signal_quality: 'ALIGNED' | 'MIXED' | 'DIVERGING';
    one_line: string;
  };
  inflation_read: {
    direction: 'RISING' | 'STABLE' | 'FALLING';
    conviction: 'LOW' | 'MODERATE' | 'HIGH';
    signal_quality: 'ALIGNED' | 'MIXED' | 'DIVERGING';
    one_line: string;
  };
  regime_label: 'GOLDILOCKS' | 'REFLATION' | 'STAGFLATION' | 'DEFLATION_RISK';
  regime_one_line: string;
  narrative: {
    growth_assessment: string;
    inflation_assessment: string;
    regime_interpretation: string;
    what_to_watch: string;
  };
  signal_quality_flags: {
    leading_vs_coincident_growth: string;
    leading_vs_coincident_inflation: string;
    contradictions: string[];
  };
}

function directionColor(field: 'growth' | 'inflation', direction: string): string {
  if (field === 'growth') {
    if (direction === 'ACCELERATING') return C.green;
    if (direction === 'DECELERATING') return C.red;
    return C.amber;
  }
  if (direction === 'FALLING') return C.green;
  if (direction === 'RISING') return C.red;
  return C.amber;
}

function convictionColor(conviction: string): string {
  if (conviction === 'HIGH') return C.green;
  if (conviction === 'LOW') return C.red;
  return C.amber;
}

function signalQualityColor(sq: string): string {
  if (sq === 'ALIGNED') return C.green;
  if (sq === 'DIVERGING') return C.red;
  return C.amber;
}

function regimeColor(label: string): string {
  if (label === 'GOLDILOCKS') return C.green;
  if (label === 'STAGFLATION') return C.red;
  if (label === 'REFLATION') return C.blue;
  return C.amber;
}

export function AISynthesis({ liveValues }: { liveValues: Record<string, LiveValue> }) {
  const [synthesis, setSynthesis] = useState<Synthesis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastAt, setLastAt] = useState('');

  useEffect(() => {
    try {
      const saved = localStorage.getItem('cio_synthesis_v2');
      if (saved) setSynthesis(JSON.parse(saved));
      const savedAt = localStorage.getItem('cio_synthesis_v2_at');
      if (savedAt) setLastAt(savedAt);
    } catch {}
  }, []);

  function buildUserMessage() {
    const growth = pillarComposite('growth', liveValues);
    const inflation = pillarComposite('inflation', liveValues);
    const gAgreement = indicatorAgreement('growth', liveValues);
    const iAgreement = indicatorAgreement('inflation', liveValues);

    const formatPillar = (pillar: 'growth' | 'inflation') =>
      getRankedContributors(pillar, liveValues).map(({ cfg, vals, z, contrib, totalWeight }) => {
        const trend = vals.current > vals.prior ? '↑' : vals.current < vals.prior ? '↓' : '→';
        const wPct = ((cfg.weight / totalWeight) * 100).toFixed(0);
        return `  ${cfg.name}: ${vals.current}${cfg.unit} z=${z.toFixed(2)} weight=${wPct}% lead=${cfg.lead_months}mo contrib=${contrib.toFixed(1)} trend=${trend}(prior:${vals.prior}${cfg.unit})`;
      }).join('\n');

    return [
      `GROWTH COMPOSITE: ${growth > 0 ? '+' : ''}${growth}`,
      `GROWTH AGREEMENT: ${gAgreement.agree}/${gAgreement.total} aligned (${gAgreement.pct}%)`,
      '',
      `INFLATION COMPOSITE: ${inflation > 0 ? '+' : ''}${inflation}`,
      `INFLATION AGREEMENT: ${iAgreement.agree}/${iAgreement.total} aligned (${iAgreement.pct}%)`,
      '',
      'GROWTH INDICATORS (ranked by absolute contribution):',
      formatPillar('growth'),
      '',
      'INFLATION INDICATORS (ranked by absolute contribution):',
      formatPillar('inflation'),
    ].join('\n');
  }

  async function synthesize() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/synthesize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 2000,
          system: SYSTEM_PROMPT,
          messages: [{ role: 'user', content: buildUserMessage() }],
        }),
      });
      if (!res.ok) throw new Error(`API ${res.status}: ${await res.text().then(t => t.slice(0, 200))}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error.message);
      const raw = (data.content?.[0]?.text ?? '').replace(/```json\s*/gi, '').replace(/```/g, '').trim();
      const match = raw.match(/\{[\s\S]*\}/);
      if (!match) throw new Error('No JSON in response');
      const parsed: Synthesis = JSON.parse(match[0]);
      setSynthesis(parsed);
      const ts = new Date().toLocaleString();
      setLastAt(ts);
      try {
        localStorage.setItem('cio_synthesis_v2', JSON.stringify(parsed));
        localStorage.setItem('cio_synthesis_v2_at', ts);
      } catch {}
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '24px 32px', display: 'flex', flexDirection: 'column', gap: '16px' }}>

      {/* Header bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontFamily: 'monospace', fontSize: '10px', color: C.muted, textTransform: 'uppercase', letterSpacing: '1px' }}>
          CIO Synthesis — Growth &amp; Inflation Directional Read
          {lastAt && <span style={{ marginLeft: '16px', color: C.muted }}>Last generated {lastAt}</span>}
        </div>
        <button
          onClick={synthesize}
          disabled={loading}
          style={{
            fontFamily: 'system-ui, sans-serif', fontSize: '13px', fontWeight: '600',
            padding: '10px 20px',
            background: loading ? C.muted : C.gold,
            color: '#fff', border: 'none', borderRadius: '6px',
            cursor: loading ? 'wait' : 'pointer',
          }}
        >
          {loading ? 'Generating…' : '◈ Generate Synthesis'}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div style={{ background: C.surface, border: `1px solid ${C.red}`, borderLeft: `3px solid ${C.red}`, borderRadius: '8px', padding: '14px 18px' }}>
          <div style={{ fontFamily: 'monospace', fontSize: '10px', color: C.red, marginBottom: '4px' }}>API ERROR</div>
          <div style={{ fontSize: '12px', color: C.ink2, fontFamily: 'monospace' }}>{error}</div>
        </div>
      )}

      {/* Empty state */}
      {!synthesis && !loading && !error && (
        <div style={{
          background: C.surface, border: `1px solid ${C.border}`, borderRadius: '8px',
          padding: '80px 24px', textAlign: 'center', color: C.muted, fontSize: '13px', lineHeight: '1.7',
        }}>
          <div style={{ fontSize: '36px', marginBottom: '16px', opacity: 0.3 }}>◈</div>
          <div>Click <span style={{ color: C.ink, fontWeight: '600' }}>"Generate Synthesis"</span> to produce a directional read</div>
          <div style={{ fontSize: '11px', marginTop: '12px', color: C.muted, maxWidth: '380px', margin: '12px auto 0', lineHeight: '1.6' }}>
            The model reads current composite scores, all indicator z-scores, lead times, and agreement ratios — returning two directional reads: growth and inflation.
          </div>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: '8px', padding: '80px 24px', textAlign: 'center' }}>
          <div style={{
            width: '32px', height: '32px', margin: '0 auto 16px',
            border: `3px solid ${C.border}`, borderTopColor: C.gold,
            borderRadius: '50%', animation: 'spin 0.7s linear infinite',
          }} />
          <div style={{ color: C.muted, fontSize: '12px', fontFamily: 'monospace' }}>Generating directional reads…</div>
        </div>
      )}

      {synthesis && (
        <>
          {/* Directional reads */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            {(['growth', 'inflation'] as const).map(pillar => {
              const read = pillar === 'growth' ? synthesis.growth_read : synthesis.inflation_read;
              const dColor = directionColor(pillar, read.direction);
              return (
                <div key={pillar} style={{ background: C.surface, border: `1px solid ${C.border}`, borderLeft: `3px solid ${dColor}`, borderRadius: '8px', padding: '18px 22px' }}>
                  <div style={{ fontFamily: 'monospace', fontSize: '9px', color: C.muted, textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: '10px' }}>
                    {pillar === 'growth' ? 'Growth Read' : 'Inflation Read'}
                  </div>
                  <div style={{ fontSize: '20px', fontWeight: '700', color: dColor, letterSpacing: '0.5px', marginBottom: '6px' }}>
                    {read.direction}
                  </div>
                  <div style={{ fontSize: '13px', color: C.ink2, lineHeight: '1.6', marginBottom: '14px' }}>
                    {read.one_line}
                  </div>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <span style={{ fontFamily: 'monospace', fontSize: '10px', padding: '3px 8px', borderRadius: '4px', border: `1px solid ${convictionColor(read.conviction)}`, color: convictionColor(read.conviction) }}>
                      {read.conviction} CONVICTION
                    </span>
                    <span style={{ fontFamily: 'monospace', fontSize: '10px', padding: '3px 8px', borderRadius: '4px', border: `1px solid ${signalQualityColor(read.signal_quality)}`, color: signalQualityColor(read.signal_quality) }}>
                      {read.signal_quality}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Regime */}
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderLeft: `3px solid ${regimeColor(synthesis.regime_label)}`, borderRadius: '8px', padding: '14px 22px', display: 'flex', alignItems: 'center', gap: '20px' }}>
            <div style={{ fontFamily: 'monospace', fontSize: '13px', fontWeight: '700', color: regimeColor(synthesis.regime_label), whiteSpace: 'nowrap' }}>
              {synthesis.regime_label.replace('_', ' ')}
            </div>
            <div style={{ fontSize: '13px', color: C.ink2, lineHeight: '1.5' }}>{synthesis.regime_one_line}</div>
          </div>

          {/* Narrative */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            {[
              { key: 'growth_assessment', label: 'Growth Assessment', color: C.blue },
              { key: 'inflation_assessment', label: 'Inflation Assessment', color: C.amber },
              { key: 'regime_interpretation', label: 'Regime Interpretation', color: C.gold },
              { key: 'what_to_watch', label: 'What to Watch', color: C.muted },
            ].map(({ key, label, color }) => (
              <div key={key} style={{ background: C.surface, border: `1px solid ${C.border}`, borderLeft: `3px solid ${color}`, borderRadius: '8px', padding: '14px 18px' }}>
                <div style={{ fontFamily: 'monospace', fontSize: '9px', color, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>{label}</div>
                <div style={{ fontSize: '13px', color: C.ink2, lineHeight: '1.7' }}>
                  {synthesis.narrative[key as keyof typeof synthesis.narrative]}
                </div>
              </div>
            ))}
          </div>

          {/* Signal quality flags */}
          <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: '8px', padding: '16px 22px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ fontFamily: 'monospace', fontSize: '9px', color: C.muted, textTransform: 'uppercase', letterSpacing: '1.5px' }}>Signal Quality Flags</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <div style={{ fontFamily: 'monospace', fontSize: '9px', color: C.blue, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px' }}>Growth — Leading vs Coincident</div>
                <div style={{ fontSize: '12px', color: C.ink2, lineHeight: '1.6' }}>{synthesis.signal_quality_flags.leading_vs_coincident_growth}</div>
              </div>
              <div>
                <div style={{ fontFamily: 'monospace', fontSize: '9px', color: C.amber, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px' }}>Inflation — Leading vs Coincident</div>
                <div style={{ fontSize: '12px', color: C.ink2, lineHeight: '1.6' }}>{synthesis.signal_quality_flags.leading_vs_coincident_inflation}</div>
              </div>
            </div>
            {synthesis.signal_quality_flags.contradictions?.length > 0 && (
              <div>
                <div style={{ fontFamily: 'monospace', fontSize: '9px', color: C.red, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>Contradictions</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {synthesis.signal_quality_flags.contradictions.map((c, i) => (
                    <div key={i} style={{ display: 'flex', gap: '10px', fontSize: '12px', color: C.ink2, lineHeight: '1.5' }}>
                      <span style={{ color: C.red, flexShrink: 0 }}>✗</span>
                      <span>{c}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
