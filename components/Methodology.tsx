'use client';
import { INDICATOR_CONFIGS, GROUP_WEIGHTS } from '@/lib/config';

const C = {
  bg: '#f6f5f1', bg2: '#ecebe5', surface: '#ffffff', border: '#d6d3cc',
  ink: '#1a1d24', ink2: '#3f4654', muted: '#6b7280',
  green: '#2d7a3e', red: '#c0392b', gold: '#9a6f1a',
};

function Section({ title, accent = C.gold, children }: { title: string; accent?: string; children: React.ReactNode }) {
  return (
    <div style={{
      background: C.surface, border: `1px solid ${C.border}`,
      borderLeft: `3px solid ${accent}`, borderRadius: '8px', padding: '20px 24px',
    }}>
      <div style={{
        fontFamily: 'Georgia,serif', fontSize: '18px', fontWeight: '700', color: C.ink,
        marginBottom: '12px', paddingBottom: '10px', borderBottom: `1px solid ${C.border}`,
      }}>{title}</div>
      {children}
    </div>
  );
}

function P({ children }: { children: React.ReactNode }) {
  return <p style={{ fontSize: '14px', color: C.ink2, lineHeight: '1.7', marginBottom: '10px' }}>{children}</p>;
}

function Code({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontFamily: 'ui-monospace,monospace', fontSize: '12px', color: C.ink,
      background: C.bg2, border: `1px solid ${C.border}`, borderRadius: '4px',
      padding: '10px 12px', margin: '6px 0', lineHeight: '1.7', whiteSpace: 'pre',
    }}>{children}</div>
  );
}

export function Methodology() {
  const growthGroups = ['growth_nowcasts', 'growth_financial', 'growth_surveys', 'growth_real_economy'];
  const inflGroups = ['inflation_core_drivers', 'inflation_market', 'inflation_commodities', 'inflation_dollar'];

  function GroupBox({ gk, accent }: { gk: string; accent: string }) {
    const g = GROUP_WEIGHTS[gk];
    const members = Object.keys(INDICATOR_CONFIGS).filter(k => INDICATOR_CONFIGS[k].group === gk);
    const perWeight = (g.weight / members.length).toFixed(1);
    return (
      <div style={{ background: C.bg2, borderRadius: '6px', padding: '14px 16px', marginBottom: '10px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '8px' }}>
          <span style={{ fontFamily: 'Georgia,serif', fontSize: '15px', fontWeight: '700', color: C.ink }}>{g.label}</span>
          <span style={{ fontFamily: 'monospace', fontSize: '14px', fontWeight: '700', color: accent }}>{g.weight}% of pillar</span>
        </div>
        <div style={{ fontSize: '12px', color: C.ink2, fontStyle: 'italic', marginBottom: '10px', lineHeight: '1.6' }}>{g.rationale}</div>
        <div style={{ fontFamily: 'monospace', fontSize: '11px', color: C.muted }}>
          {members.length} indicators × {perWeight}% each = {g.weight}%
        </div>
        <div style={{ fontSize: '12px', color: C.ink2, marginTop: '6px' }}>
          Members: {members.map(k => INDICATOR_CONFIGS[k].name).join(', ')}
        </div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', padding: '32px', display: 'flex', flexDirection: 'column', gap: '24px' }}>

      <Section title="What this dashboard does">
        <P>This is a mechanical leading indicator model. It reads current values for 18 leading indicators, standardises each one, weights them by documented lead-time quality, and produces two composite scores — one for Growth, one for Inflation — ranging from −100 to +100.</P>
        <P>There is no AI interpretation. Every number on the dashboard traces directly to a specific indicator and weight. If you change an indicator value, you can see exactly how much the composite moves.</P>
        <P>The purpose is to organise signals consistently so the team discusses the same framework each week, and so individual readings can be audited against the composite call.</P>
      </Section>

      <Section title="How each indicator becomes a composite score">
        <div style={{ fontSize: '14px', color: C.ink2, lineHeight: '1.7' }}>
          <strong style={{ color: C.ink }}>Step 1 — Standardise each indicator to a z-score.</strong>{' '}
          Z-score measures how many standard deviations the current reading is from its historical mean.
          This lets us compare a 2% GDPNow reading with a 341bps credit spread on the same scale.
        </div>
        <Code>{'z = (current − historical_mean) / historical_std'}</Code>
        <div style={{ fontSize: '14px', color: C.ink2, lineHeight: '1.7', marginTop: '14px' }}>
          <strong style={{ color: C.ink }}>Step 2 — Cap extreme values at ±2.5.</strong>{' '}
          Prevents one unusually extreme indicator from dominating the composite.
        </div>
        <div style={{ fontSize: '14px', color: C.ink2, lineHeight: '1.7', marginTop: '14px' }}>
          <strong style={{ color: C.ink }}>Step 3 — Flip the sign if higher = worse.</strong>{' '}
          Positive composite = GOOD environment. For inflation, rising rent/wages/commodities = NEGATIVE contribution.
        </div>
        <div style={{ fontSize: '14px', color: C.ink2, lineHeight: '1.7', marginTop: '14px' }}>
          <strong style={{ color: C.ink }}>Step 4 — Weight by indicator group.</strong>{' '}See next section.
        </div>
        <div style={{ fontSize: '14px', color: C.ink2, lineHeight: '1.7', marginTop: '14px' }}>
          <strong style={{ color: C.ink }}>Step 5 — Sum and scale to ±100.</strong>
        </div>
        <Code>{'composite = Σ(z × weight / 100) × 40'}</Code>
      </Section>

      <Section title="How indicator weights are decided">
        <P>Weights are NOT arbitrary and NOT empirically fitted. They use a <strong>group-based approach</strong>: indicators are assigned to functional groups based on signal type and documented lead time. Each group gets a fixed share of the pillar total, then split equally among member indicators.</P>
        <P>Example: Growth has four groups totalling 100%. Financial Markets gets 30%. It has 4 indicators, so each gets 30/4 = 7.5%.</P>
      </Section>

      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderLeft: `3px solid ${C.green}`, borderRadius: '8px', padding: '20px 24px' }}>
        <div style={{ fontFamily: 'Georgia,serif', fontSize: '16px', fontWeight: '700', color: C.ink, marginBottom: '14px', paddingBottom: '10px', borderBottom: `1px solid ${C.border}` }}>
          Growth pillar — group weights
        </div>
        {growthGroups.map(gk => <GroupBox key={gk} gk={gk} accent={C.green} />)}
      </div>

      <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderLeft: `3px solid ${C.red}`, borderRadius: '8px', padding: '20px 24px' }}>
        <div style={{ fontFamily: 'Georgia,serif', fontSize: '16px', fontWeight: '700', color: C.ink, marginBottom: '14px', paddingBottom: '10px', borderBottom: `1px solid ${C.border}` }}>
          Inflation pillar — group weights
        </div>
        {inflGroups.map(gk => <GroupBox key={gk} gk={gk} accent={C.red} />)}
      </div>

      <Section title="How to read the output">
        <P><strong style={{ color: C.ink }}>Sign convention — POSITIVE = GOOD environment.</strong> Positive growth = accelerating. Positive inflation = falling (disinflation, good for bonds). Both positive = Goldilocks. Both negative = Stagflation.</P>
        <div style={{ fontSize: '14px', color: C.ink2, lineHeight: '1.7', marginTop: '8px' }}>
          <strong style={{ color: C.ink }}>Signal bucket</strong> — five tiers:
        </div>
        <Code>{`STRONG BULL    ≥ +40
LEAN BULL      +15 to +40
MIXED          −15 to +15
LEAN BEAR      −40 to −15
STRONG BEAR    ≤ −40`}</Code>
        <P><strong style={{ color: C.ink }}>Confidence tier</strong> — derived from indicator agreement percentage and composite magnitude. HIGH needs both strong agreement and large composite.</P>
        <P><strong style={{ color: C.ink }}>Probability ranges</strong> — not point estimates. Bands widen with lower confidence. Honest about uncertainty.</P>
      </Section>

      <Section title="What this is NOT">
        <P>This is not a trading signal. Direction is meaningful; exact numbers are best-estimate.</P>
        <P>This is not empirically calibrated. The group-based weighting is transparent reasoning, not statistical validation.</P>
        <P>Indicator correlation is not modelled. If initial claims, ISM, and WEI all move together, the composite treats them as independent signals. Keep the indicator count modest to limit this.</P>
      </Section>

      <Section title="When to revisit the weights">
        <P>Revisit group weights if the composite reading persistently disagrees with what the team believes — e.g. financial markets signalling bear while real-economy data is strong.</P>
        <P>Revisit individual indicator inclusion if a new dataset emerges with materially better lead time.</P>
        <P>Baseline mean and standard deviation should be recomputed from rolling 10 years of data periodically. Hand-picked baselines can over- or understate z-scores materially.</P>
      </Section>

    </div>
  );
}
