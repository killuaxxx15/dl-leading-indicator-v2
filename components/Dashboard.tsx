'use client';
import type { LiveValue } from '@/lib/types';
import { INDICATOR_CONFIGS } from '@/lib/config';
import {
  pillarComposite, signalBucket, indicatorAgreement, confidenceTier,
  probabilityRanges, scoreColor, directionTier, trafficLight,
  zscore, clampedZ, getRankedContributors,
} from '@/lib/calculations';

const C = {
  bg: '#f6f5f1', bg2: '#ecebe5', surface: '#ffffff', border: '#d6d3cc',
  ink: '#1a1d24', ink2: '#3f4654', muted: '#6b7280',
  red: '#c0392b', amber: '#b8720e', green: '#2d7a3e', blue: '#2760a8', gold: '#9a6f1a',
};

// ── Indicator row ────────────────────────────────────────────────────

function IndicatorRow({
  rowKey, vals, totalWeight,
}: {
  rowKey: string;
  vals: { cfg: typeof INDICATOR_CONFIGS[string]; vals: LiveValue; z: number; contrib: number; totalWeight: number };
  totalWeight: number;
}) {
  const { cfg, vals: v, z, contrib } = vals;
  const zClamped = clampedZ(z);
  const contrib_pp = (zClamped * cfg.weight / totalWeight) * 40;
  const weightPct = Math.round((cfg.weight / totalWeight) * 100);
  const light = trafficLight(zClamped);

  const priorVal = v.prior ?? v.current ?? 0;
  const prior_z_raw = (priorVal - cfg.baseline_mean) / cfg.baseline_std;
  const prior_z = cfg.direction === 'negative' ? -prior_z_raw
    : cfg.direction === 'positive_50' ? (priorVal - 50) / cfg.baseline_std
    : prior_z_raw;
  const delta = zClamped - prior_z;
  const arrow = delta > 0.05 ? '↑' : delta < -0.05 ? '↓' : '→';
  const arrowCol = delta > 0.05 ? C.green : delta < -0.05 ? C.red : C.muted;

  const barPct = Math.min(50, Math.abs(zClamped) * 20);
  const barCol = zClamped > 0 ? C.green : C.red;

  const badValue = v.current == null || isNaN(v.current);
  const hasError = badValue || !!(v as any).error;
  const displayVal = badValue ? 'N/A' : v.current.toLocaleString();

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '22px 150px 1fr 80px 70px 90px',
      gap: '10px', alignItems: 'center',
      padding: '10px 14px', borderBottom: `1px solid ${C.border}`,
      fontSize: '12px',
    }}>
      {/* Traffic light */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div title={light.label} style={{
          width: '13px', height: '13px', borderRadius: '50%',
          background: hasError ? C.muted : light.color,
          boxShadow: hasError ? 'none' : `0 0 0 3px ${light.color}18`,
        }} />
      </div>

      {/* Name */}
      <div>
        <div style={{ fontWeight: '600', color: C.ink, fontSize: '11px' }}>{cfg.name}</div>
        <div style={{ fontFamily: 'monospace', fontSize: '8px', color: C.muted, marginTop: '2px' }}>
          {rowKey} · {cfg.source} · leads {cfg.lead_months}mo
        </div>
      </div>

      {/* Value + z-bar */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', fontSize: '10px' }}>
          <span style={{ color: C.ink, fontWeight: '600' }}>
            {displayVal}{hasError ? '' : ` ${cfg.unit}`}
          </span>
          <span style={{ fontFamily: 'monospace', color: C.muted }}>
            {isNaN(z) ? '—' : `z = ${z.toFixed(2)}`}
          </span>
        </div>
        <div style={{ position: 'relative', height: '6px', background: '#e5e3dc', borderRadius: '3px', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: '1px', background: '#a8a39a', zIndex: 2 }} />
          {!isNaN(zClamped) && (
            <div style={{
              position: 'absolute', top: 0, bottom: 0,
              width: `${barPct}%`, background: barCol, borderRadius: '3px',
              [zClamped > 0 ? 'left' : 'right']: '50%',
            }} />
          )}
        </div>
      </div>

      {/* Weight */}
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontFamily: 'monospace', fontSize: '12px', fontWeight: '700', color: C.gold }}>{weightPct}%</div>
        <div style={{ fontFamily: 'monospace', fontSize: '8px', color: C.muted, marginTop: '2px' }}>weight</div>
      </div>

      {/* Contribution */}
      <div style={{ textAlign: 'right' }}>
        <div style={{ fontFamily: 'monospace', fontSize: '13px', fontWeight: '700', color: contrib_pp > 0 ? C.green : C.red }}>
          {isNaN(contrib_pp) ? '—' : `${contrib_pp > 0 ? '+' : ''}${contrib_pp.toFixed(1)}`}
        </div>
        <div style={{ fontFamily: 'monospace', fontSize: '8px', color: C.muted, marginTop: '2px' }}>contrib. pts</div>
      </div>

      {/* Trend */}
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '18px', color: arrowCol, lineHeight: 1 }}>{arrow}</div>
        <div style={{ fontFamily: 'monospace', fontSize: '8px', color: C.muted, marginTop: '2px' }}>vs prior</div>
      </div>
    </div>
  );
}

// ── Pillar card ──────────────────────────────────────────────────────

function PillarCard({
  pillar, title, question, liveValues,
}: {
  pillar: 'growth' | 'inflation';
  title: string;
  question: string;
  liveValues: Record<string, LiveValue>;
}) {
  const composite = pillarComposite(pillar, liveValues);
  const compCol = scoreColor(composite);
  const tier = directionTier(composite);
  const bucket = signalBucket(composite);
  const agreement = indicatorAgreement(pillar, liveValues);
  const confidence = confidenceTier(composite, agreement.pct);
  const ranges = probabilityRanges(composite, confidence);
  const ranked = getRankedContributors(pillar, liveValues);
  const totalWeight = Object.keys(INDICATOR_CONFIGS)
    .filter(k => INDICATOR_CONFIGS[k].pillar === pillar)
    .reduce((s, k) => s + INDICATOR_CONFIGS[k].weight, 0);

  const forList = ranked.filter(r => r.contrib > 0.3);
  const againstList = ranked.filter(r => r.contrib < -0.3);
  const neutralList = ranked.filter(r => r.contrib >= -0.3 && r.contrib <= 0.3);
  const forSum = forList.reduce((s, r) => s + r.contrib, 0);
  const againstSum = againstList.reduce((s, r) => s + r.contrib, 0);

  const compPct = Math.min(50, Math.abs(composite) / 2);
  const lbl = pillar === 'growth' ? ['Deceleration', 'Neutral', 'Acceleration'] : ['Reflation', 'Stable', 'Disinflation'];
  const conventionNote = pillar === 'growth'
    ? '+ = growth accelerating (good)   |   − = growth slowing (bad)'
    : '+ = inflation falling (good)   |   − = inflation rising (bad)';

  const forLabel = pillar === 'growth' ? 'FOR stronger growth' : 'FOR disinflation (bullish bonds)';
  const againstLabel = pillar === 'growth' ? 'AGAINST (weaker growth)' : 'AGAINST (rising inflation)';

  const probItems = pillar === 'growth'
    ? [
        { key: 'bear' as const, label: 'Recession / stall', color: C.red },
        { key: 'mid' as const, label: 'Soft landing', color: C.amber },
        { key: 'bull' as const, label: 'Reacceleration', color: C.green },
      ]
    : [
        { key: 'bear' as const, label: 'Re-acceleration (bad)', color: C.red },
        { key: 'mid' as const, label: 'Sticky > 2.5%', color: C.amber },
        { key: 'bull' as const, label: 'Decline to target (good)', color: C.green },
      ];

  return (
    <div className="fade-in" style={{
      background: C.surface, border: `1px solid ${C.border}`, borderRadius: '12px',
      overflow: 'hidden', boxShadow: '0 2px 24px rgba(0,0,0,0.08)',
    }}>
      {/* Header */}
      <div style={{
        padding: '20px 24px', background: compCol + '12',
        borderBottom: `1px solid ${C.border}`,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        flexWrap: 'wrap', gap: '16px',
      }}>
        <div>
          <div style={{ fontFamily: 'monospace', fontSize: '9px', color: C.muted, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px' }}>
            {pillar} composite
          </div>
          <div style={{ fontFamily: 'Georgia,serif', fontSize: '18px', fontWeight: '700', color: C.ink, marginBottom: '2px' }}>{title}</div>
          <div style={{ fontSize: '12px', color: C.ink2, marginBottom: '4px' }}>{question}</div>
          <div style={{ fontFamily: 'monospace', fontSize: '10px', color: C.muted, fontStyle: 'italic' }}>{conventionNote}</div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '18px', flexShrink: 0 }}>
          {/* Direction pill */}
          <div style={{
            background: tier.bg, border: `2px solid ${tier.color}`,
            borderRadius: '12px', padding: '10px 16px', textAlign: 'center', minWidth: '120px',
          }}>
            <div style={{ fontSize: '28px', fontWeight: '900', color: tier.color, lineHeight: 1, marginBottom: '4px' }}>{tier.arrow}</div>
            <div style={{ fontFamily: 'monospace', fontSize: '10px', color: tier.color, fontWeight: '700', letterSpacing: '1px' }}>{tier.label}</div>
          </div>
          {/* Numeric score */}
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontFamily: 'Georgia,serif', fontSize: '48px', fontWeight: '900', color: compCol, lineHeight: 1 }}>
              {composite > 0 ? '+' : ''}{composite}
            </div>
            <div style={{ fontFamily: 'monospace', fontSize: '9px', color: compCol, marginTop: '4px' }}>/ 100 · weighted z-score</div>
          </div>
        </div>
      </div>

      {/* Composite bar */}
      <div style={{ padding: '14px 24px', borderBottom: `1px solid ${C.border}`, background: C.bg2 }}>
        <div style={{ position: 'relative', height: '10px', background: '#e5e3dc', borderRadius: '5px', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: '2px', background: '#a8a39a', zIndex: 2 }} />
          <div style={{
            position: 'absolute', top: 0, bottom: 0, width: `${compPct}%`,
            background: compCol, borderRadius: '5px',
            [composite > 0 ? 'left' : 'right']: '50%',
          }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px', fontFamily: 'monospace', fontSize: '9px', color: C.muted }}>
          {lbl.map(l => <span key={l}>{l}</span>)}
        </div>
      </div>

      {/* Signal / Confidence / Agreement */}
      <div style={{ padding: '18px 24px', borderBottom: `1px solid ${C.border}`, background: C.bg2 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px', flexWrap: 'wrap', marginBottom: '14px' }}>
          <div>
            <div style={{ fontFamily: 'monospace', fontSize: '9px', color: C.muted, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px' }}>Signal</div>
            <div style={{ fontFamily: 'Georgia,serif', fontSize: '22px', fontWeight: '900', color: bucket.color, lineHeight: 1 }}>{bucket.label}</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontFamily: 'monospace', fontSize: '9px', color: C.muted, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px' }}>Confidence</div>
            <div style={{ fontFamily: 'Georgia,serif', fontSize: '18px', fontWeight: '700', color: confidence.color }}>{confidence.label}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontFamily: 'monospace', fontSize: '9px', color: C.muted, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px' }}>Agreement</div>
            <div style={{ fontFamily: 'Georgia,serif', fontSize: '18px', fontWeight: '700', color: C.ink }}>{agreement.agree}/{agreement.total}</div>
            <div style={{ fontFamily: 'monospace', fontSize: '9px', color: C.muted, marginTop: '2px' }}>indicators aligned</div>
          </div>
        </div>
        <div style={{ fontFamily: 'monospace', fontSize: '9px', color: C.muted, lineHeight: '1.6', paddingTop: '10px', borderTop: `1px solid ${C.border}` }}>
          Direction reflects mechanical signal. Confidence tier is heuristic (not calibrated). Probability bands below widen with lower confidence.
        </div>
      </div>

      {/* For vs Against */}
      <div style={{ padding: '16px 24px', borderBottom: `1px solid ${C.border}` }}>
        <div style={{ fontFamily: 'monospace', fontSize: '9px', color: C.muted, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '12px' }}>
          For vs Against — indicators grouped by contribution
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
          {/* FOR */}
          <div style={{ background: C.green + '0a', border: `1px solid ${C.green}30`, borderLeft: `3px solid ${C.green}`, borderRadius: '6px', padding: '12px 14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '10px' }}>
              <div style={{ fontFamily: 'monospace', fontSize: '9px', color: C.green, textTransform: 'uppercase', letterSpacing: '1px', fontWeight: '700' }}>{forLabel}</div>
              <div style={{ fontFamily: 'Georgia,serif', fontSize: '16px', fontWeight: '900', color: C.green }}>{forSum > 0 ? '+' : ''}{forSum.toFixed(1)}pts</div>
            </div>
            {forList.length === 0
              ? <div style={{ fontSize: '11px', color: C.muted, fontStyle: 'italic' }}>No indicators supporting this side</div>
              : forList.map(r => (
                <div key={r.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0', borderBottom: `1px dashed ${C.border}`, fontSize: '11px' }}>
                  <div>
                    <div style={{ fontWeight: '600', color: C.ink }}>{r.cfg.name}</div>
                    <div style={{ fontFamily: 'monospace', fontSize: '8px', color: C.muted, marginTop: '2px' }}>{r.key} · {r.cfg.weight.toFixed(1)}%</div>
                  </div>
                  <div style={{ fontFamily: 'monospace', fontSize: '12px', fontWeight: '700', color: C.green }}>+{r.contrib.toFixed(1)}</div>
                </div>
              ))
            }
          </div>
          {/* AGAINST */}
          <div style={{ background: C.red + '0a', border: `1px solid ${C.red}30`, borderLeft: `3px solid ${C.red}`, borderRadius: '6px', padding: '12px 14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '10px' }}>
              <div style={{ fontFamily: 'monospace', fontSize: '9px', color: C.red, textTransform: 'uppercase', letterSpacing: '1px', fontWeight: '700' }}>{againstLabel}</div>
              <div style={{ fontFamily: 'Georgia,serif', fontSize: '16px', fontWeight: '900', color: C.red }}>{againstSum.toFixed(1)}pts</div>
            </div>
            {againstList.length === 0
              ? <div style={{ fontSize: '11px', color: C.muted, fontStyle: 'italic' }}>No indicators supporting this side</div>
              : againstList.map(r => (
                <div key={r.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0', borderBottom: `1px dashed ${C.border}`, fontSize: '11px' }}>
                  <div>
                    <div style={{ fontWeight: '600', color: C.ink }}>{r.cfg.name}</div>
                    <div style={{ fontFamily: 'monospace', fontSize: '8px', color: C.muted, marginTop: '2px' }}>{r.key} · {r.cfg.weight.toFixed(1)}%</div>
                  </div>
                  <div style={{ fontFamily: 'monospace', fontSize: '12px', fontWeight: '700', color: C.red }}>{r.contrib.toFixed(1)}</div>
                </div>
              ))
            }
          </div>
        </div>
        <div style={{
          marginTop: '10px', padding: '8px 12px', background: C.bg2, borderRadius: '4px',
          fontFamily: 'monospace', fontSize: '10px', color: C.ink2,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <span>NET = {forSum >= 0 ? '+' : ''}{forSum.toFixed(1)} + ({againstSum.toFixed(1)}) = {(forSum + againstSum).toFixed(1)}pts</span>
          {neutralList.length > 0 && (
            <span style={{ color: C.muted }}>{neutralList.length} indicator{neutralList.length > 1 ? 's' : ''} neutral (|contrib| &lt; 0.3)</span>
          )}
        </div>
      </div>

      {/* Probability ranges */}
      <div style={{ padding: '16px 24px', borderBottom: `1px solid ${C.border}` }}>
        <div style={{ fontFamily: 'monospace', fontSize: '9px', color: C.muted, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '12px' }}>
          Probability ranges — wider = less confident
        </div>
        {probItems.map(p => {
          const range = ranges[p.key];
          return (
            <div key={p.key} style={{ marginBottom: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '5px' }}>
                <span style={{ color: C.ink2 }}>{p.label}</span>
                <span style={{ fontFamily: 'monospace', color: p.color, fontWeight: '700' }}>{range[0]}–{range[1]}%</span>
              </div>
              <div style={{ position: 'relative', height: '7px', background: '#e5e3dc', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{
                  position: 'absolute', left: `${range[0]}%`, width: `${range[1] - range[0]}%`,
                  top: 0, bottom: 0, background: p.color, borderRadius: '4px', opacity: 0.8,
                }} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Indicator table */}
      <div style={{
        padding: '10px 14px', background: C.bg2, borderBottom: `1px solid ${C.border}`,
        display: 'grid', gridTemplateColumns: '22px 150px 1fr 80px 70px 90px', gap: '10px',
        fontFamily: 'monospace', fontSize: '8px', color: C.muted, textTransform: 'uppercase', letterSpacing: '0.8px',
      }}>
        <div />
        <div>Indicator</div>
        <div>Current & z-score</div>
        <div style={{ textAlign: 'center' }}>Weight</div>
        <div style={{ textAlign: 'right' }}>Contribution</div>
        <div style={{ textAlign: 'center' }}>Trend</div>
      </div>

      {ranked.map(r => (
        <IndicatorRow key={r.key} rowKey={r.key} vals={r} totalWeight={totalWeight} />
      ))}

      {/* Footer */}
      <div style={{
        padding: '14px 24px', background: C.bg2, borderTop: `1px solid ${C.border}`,
        fontFamily: 'monospace', fontSize: '9px', color: C.muted,
      }}>
        TOP 3 DRIVERS: {ranked.slice(0, 3).map(r => `${r.cfg.name} (${r.contrib > 0 ? '+' : ''}${r.contrib.toFixed(1)})`).join('  ·  ')}
      </div>
    </div>
  );
}

// ── Regime section ───────────────────────────────────────────────────

function RegimeBar({ liveValues }: { liveValues: Record<string, LiveValue> }) {
  const growthComp = pillarComposite('growth', liveValues);
  const inflComp = pillarComposite('inflation', liveValues);

  const regime =
    growthComp > 0 && inflComp > 0 ? 'GOLDILOCKS'
    : growthComp > 0 && inflComp < 0 ? 'REFLATION'
    : growthComp < 0 && inflComp > 0 ? 'DEFLATION RISK'
    : 'STAGFLATION';

  const regimeCol =
    regime === 'GOLDILOCKS' ? C.green
    : regime === 'STAGFLATION' ? C.red
    : regime === 'REFLATION' ? C.amber
    : C.blue;

  const regimeDesc =
    regime === 'GOLDILOCKS' ? 'Growth expanding + inflation cooling. Best regime for risk assets.'
    : regime === 'STAGFLATION' ? 'Growth slowing + inflation rising. Worst regime — no Fed option.'
    : regime === 'REFLATION' ? 'Growth expanding + inflation rising. Risk-on but watch inflation.'
    : 'Growth slowing + inflation cooling. Fed cuts likely — good for duration.';

  function tierLite(c: number) {
    if (c >= 40) return { arrow: '↑↑', color: '#1a8540' };
    if (c >= 15) return { arrow: '↑', color: '#2d7a3e' };
    if (c > -15) return { arrow: '→', color: '#b8720e' };
    if (c > -40) return { arrow: '↓', color: '#a82828' };
    return { arrow: '↓↓', color: '#7f1f1f' };
  }
  const gT = tierLite(growthComp);
  const iT = tierLite(inflComp);

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto', padding: '0 32px 40px' }}>
      <div style={{
        background: C.surface, border: `1px solid ${C.border}`,
        borderTop: `3px solid ${regimeCol}`, borderRadius: '12px',
        padding: '28px 32px', display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', gap: '24px', flexWrap: 'wrap',
        boxShadow: '0 2px 24px rgba(0,0,0,0.08)',
      }}>
        <div>
          <div style={{ fontFamily: 'monospace', fontSize: '9px', color: C.muted, textTransform: 'uppercase', letterSpacing: '1.5px', marginBottom: '6px' }}>
            Mechanical regime classification
          </div>
          <div style={{ fontFamily: 'Georgia,serif', fontSize: '28px', fontWeight: '900', color: regimeCol }}>{regime}</div>
          <div style={{ fontSize: '12px', color: C.ink2, marginTop: '6px', maxWidth: '400px', lineHeight: '1.6' }}>{regimeDesc}</div>
        </div>
        <div style={{ display: 'flex', gap: '30px' }}>
          {[
            { label: 'Growth', comp: growthComp, t: gT },
            { label: 'Inflation', comp: inflComp, t: iT },
          ].map(({ label, comp, t }) => (
            <div key={label} style={{ textAlign: 'center' }}>
              <div style={{ fontFamily: 'monospace', fontSize: '9px', color: C.muted, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '6px' }}>{label}</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', justifyContent: 'center' }}>
                <span style={{ fontFamily: 'system-ui,sans-serif', fontSize: '24px', fontWeight: '900', color: t.color, lineHeight: 1 }}>{t.arrow}</span>
                <span style={{ fontFamily: 'Georgia,serif', fontSize: '32px', fontWeight: '900', color: scoreColor(comp), lineHeight: 1 }}>
                  {comp > 0 ? '+' : ''}{comp}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Main dashboard export ─────────────────────────────────────────────

export function Dashboard({ liveValues }: { liveValues: Record<string, LiveValue> }) {
  return (
    <>
      <div style={{
        maxWidth: '1400px', margin: '0 auto', padding: '20px 32px 24px',
        display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px',
      }}>
        <PillarCard
          pillar="growth"
          title="Growth Composite"
          question="Will growth accelerate or decelerate over the next 3-12 months?"
          liveValues={liveValues}
        />
        <PillarCard
          pillar="inflation"
          title="Inflation Composite"
          question="Will inflation rise further or fall over the next 3-12 months?"
          liveValues={liveValues}
        />
      </div>
      <RegimeBar liveValues={liveValues} />
    </>
  );
}
