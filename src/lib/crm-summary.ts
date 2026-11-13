import { CRM_PIPELINE, STAGE_BY_KEY } from "@/config/crm";
import type { CrmDeal, CrmStage } from "@/types/domain";

/** Pipeline totals, shared by the server and the board (which updates them as cards move). Pure. */
export interface StageSummary {
  stage: CrmStage;
  count: number;
  amount: number;
}

export interface PipelineSummary {
  stages: StageSummary[];
  /** Open (not yet won) pipeline value: Prospect through Close. */
  openValue: number;
  openCount: number;
  /** Sum of amount × probability over open, not-yet-won deals. */
  weightedForecast: number;
  wonValue: number;
  wonCount: number;
  lostCount: number;
  /** Won ÷ (won + lost), as a percentage; null with no decided deals. */
  winRate: number | null;
}

/** Totals for the board header. Pure. */
export function summarizePipeline(deals: readonly Pick<CrmDeal, "stage" | "amount" | "probability" | "status">[]): PipelineSummary {
  const stages = CRM_PIPELINE.map((s) => ({ stage: s.key, count: 0, amount: 0 }));
  const byStage = new Map(stages.map((s) => [s.stage, s]));
  let openValue = 0, openCount = 0, weightedForecast = 0, wonValue = 0, wonCount = 0, lostCount = 0;
  for (const d of deals) {
    if (d.status === "LOST") {
      lostCount++;
      continue;
    }
    const amount = d.amount ?? 0;
    const s = byStage.get(d.stage)!;
    s.count++;
    s.amount += amount;
    if (STAGE_BY_KEY[d.stage].won) {
      wonValue += amount;
      wonCount++;
    } else {
      openValue += amount;
      openCount++;
      weightedForecast += (amount * d.probability) / 100;
    }
  }
  const decided = wonCount + lostCount;
  return { stages, openValue, openCount, weightedForecast: Math.round(weightedForecast), wonValue, wonCount, lostCount, winRate: decided ? Math.round((wonCount / decided) * 100) : null };
}

