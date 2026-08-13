/**
 * The downloadable CCPI audit report, as a string.
 *
 * Split out of `components/ccpi-audit-admin.tsx` (P6-13) unchanged. The Blob,
 * the object URL and the synthetic anchor click stayed in the component —
 * they are browser plumbing. What moved is the part that can be wrong: the
 * report is the panel's claims in a file the owner keeps, so every figure in
 * it goes through the same null-safe formatters the screen does.
 *
 * NOT re-indented in the move. The body is one template literal, so leading
 * whitespace is report content, not source formatting — indenting it to match
 * the new function would have put two spaces in front of every line of the
 * markdown the owner downloads.
 */
import { type IndicatorDetail, type PillarAudit, EM_DASH, raw } from "./format"

export function buildAuditReport(auditData: any): string {
const report = `# CCPI AUDIT REPORT
Generated: ${new Date().toISOString()}

## CCPI Index Calculation
Score: ${raw(auditData.ccpi.finalCCPI)}/100
Formula: ${auditData.ccpi.formula}

${auditData.ccpi.executiveSummary}

Validation: ${auditData.ccpi.validation.text}

## Data Quality
Certainty (live/AI weight): ${auditData.dataQuality.certainty === null ? EM_DASH : `${auditData.dataQuality.certainty}%`}
Indicator tiers: ${auditData.dataQuality.tierCounts.live} live · ${auditData.dataQuality.tierCounts.aiEstimate} AI estimate · ${auditData.dataQuality.tierCounts.baseline} baseline · ${auditData.dataQuality.tierCounts.unknown} unknown
${auditData.dataQuality.pillars
  .map(
(p: any) =>
  `- ${p.name}: score ${raw(p.score)} · scored weight ${raw(p.scoredMax)}/100 (live ${raw(p.liveMax)}, AI ${raw(p.aiMax)})${p.excluded.length ? ` · excluded: ${p.excluded.join(", ")}` : ""}`,
  )
  .join("\n")}

Pillar Weights:
- Momentum & Technical: ${auditData.ccpi.weights.momentum}%
- Risk Appetite & Volatility: ${auditData.ccpi.weights.riskAppetite}%
- Valuation & Market Structure: ${auditData.ccpi.weights.valuation}%
- Macro Economic: ${auditData.ccpi.weights.macro}%

---

## Crash Amplifier Bonus System
Base Score: ${raw(auditData.crashAmplifier.baseScore)} | Bonus: ${raw(auditData.crashAmplifier.totalBonus)} | Final Score: ${raw(auditData.crashAmplifier.finalScore)}
Formula: ${auditData.crashAmplifier.formula}

${auditData.crashAmplifier.executiveSummary}

Crash Amplifier Triggers:
${auditData.crashAmplifier.triggers.map((trigger: any) => `- ${trigger.condition}: ${trigger.bonus}`).join("\n")}

Active Bonuses:
${auditData.crashAmplifier.bonuses.length > 0 ? auditData.crashAmplifier.bonuses.map((bonus: any) => `- ${bonus.reason}: +${bonus.points} points`).join("\n") : "- None"}

---

## Canary Warning System
Active Warnings: ${raw(auditData.canaries.active)} / ${raw(auditData.canaries.total)} indicators
Formula: ${auditData.canaries.formula}

${auditData.canaries.executiveSummary}

Severity Levels:
- High: ${auditData.canaries.severityLevels.high}
- Medium: ${auditData.canaries.severityLevels.medium}

---

${auditData.pillars
  .map(
(pillar: PillarAudit) => `
## ${pillar.name}
Weight: ${pillar.weight}% | Score: ${raw(pillar.score)}/100 | Scored weight: ${raw(pillar.scoredMax)}/100 (live ${raw(pillar.liveMax)}, AI ${raw(pillar.aiMax)})
Formula: ${pillar.formula}
Calculation: ${pillar.calculation}

### Executive Summary
${pillar.executiveSummary}

### Validation
${pillar.validation}

### Indicators (${pillar.indicators.length})
${pillar.indicators
  .map(
(ind: IndicatorDetail, idx: number) => `
${idx + 1}. **${ind.name}**
   Formula: ${ind.formula}
   Current Value: ${JSON.stringify(ind.currentValue)}
   
   Summary: ${ind.executiveSummary}
   
   Ranges:
   - Safe: ${ind.ranges.safe}
   - Warning: ${ind.ranges.warning}
   - Danger: ${ind.ranges.danger}
   
   Data Sources:
   - Primary: ${ind.dataSources.primary}
   - Current: ${ind.dataSources.currentSource} (${ind.dataSources.status})
   - Fallback Chain: ${ind.dataSources.fallbackChain.join(" → ")}
   
   Canary Thresholds:
   - Medium Risk: ${ind.canaryThresholds.medium}
   - High Risk: ${ind.canaryThresholds.high}
`,
  )
  .join("\n")}
`,
  )
  .join("\n---\n")}

---
**END OF AUDIT REPORT**
`

  return report
}
