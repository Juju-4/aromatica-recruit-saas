import {
  type Applicant,
  isPassed,
  isRejected,
  stageRank,
} from "@/lib/recruiting-stats";

export type Raw = Record<string, unknown>;
const s = (v: unknown) => (v == null ? "" : String(v).trim());
const num = (v: unknown) => {
  const n = Number(s(v).replace(/[, ]/g, ""));
  return Number.isFinite(n) ? n : 0;
};

/** sourcing_channels 데이터셋 행 → 채널명 기준 맵 */
export interface ChannelMeta {
  channel: string;
  type: string;
  monthlyCost: number;
  contractEnd: string;
  integration: string;
}
export function parseChannelMeta(rows: Raw[]): Map<string, ChannelMeta> {
  const m = new Map<string, ChannelMeta>();
  for (const r of rows) {
    const name = s(r.channel);
    if (!name) continue;
    m.set(normKey(name), {
      channel: name,
      type: s(r.type),
      monthlyCost: num(r.monthly_cost),
      contractEnd: s(r.contract_end),
      integration: s(r.integration) || "미연동",
    });
  }
  return m;
}
const normKey = (v: string) => v.replace(/\s|\(.*?\)/g, "").toLowerCase();

export interface ChannelPerf {
  channel: string;
  type: string;
  applied: number;
  hires: number;
  yield: number; // 합격/지원 %
  monthlyCost: number;
  annualCost: number;
  contractEnd: string;
  integration: string;
  roi: number | null; // (hires × benefit) / annualCost
  action: "확대" | "유지" | "축소" | "-";
}

export function channelPerformance(
  apps: Applicant[],
  meta: Map<string, ChannelMeta>,
  benefitManwon: number,
): ChannelPerf[] {
  const g = new Map<string, Applicant[]>();
  for (const a of apps) {
    const k = a.channel || "(미상)";
    (g.get(k) ?? g.set(k, []).get(k)!).push(a);
  }
  // 데이터셋에만 있고 지원자가 아직 없는 채널도 포함
  for (const mk of meta.values()) {
    if (![...g.keys()].some((k) => normKey(k) === normKey(mk.channel)))
      g.set(mk.channel, []);
  }

  const rows: ChannelPerf[] = [...g.entries()].map(([channel, list]) => {
    const applied = list.length;
    const hires = list.filter(isPassed).length;
    const md = meta.get(normKey(channel));
    const monthlyCost = md?.monthlyCost ?? 0;
    const annualCost = monthlyCost * 12;
    const y = applied ? (hires / applied) * 100 : 0;
    const benefitWon = benefitManwon * 10000;
    const roi = annualCost > 0 ? (hires * benefitWon) / annualCost : null;

    let action: ChannelPerf["action"] = "-";
    if (roi != null) action = roi >= 6 ? "확대" : roi >= 3 ? "유지" : "축소";
    else if (hires > 0) action = "확대"; // 무료 채널인데 성과 있음

    return {
      channel,
      type: md?.type ?? "",
      applied,
      hires,
      yield: y,
      monthlyCost,
      annualCost,
      contractEnd: md?.contractEnd ?? "",
      integration: md?.integration ?? "미등록",
      roi,
      action,
    };
  });
  return rows.sort((a, b) => (b.roi ?? -1) - (a.roi ?? -1) || b.applied - a.applied);
}

/** 전형 퍼널 (현재 단계 기준 '해당 이상 도달') — 전사 */
const FUNNEL_STEPS: { label: string; rank: number }[] = [
  { label: "지원", rank: 10 },
  { label: "스크리닝", rank: 28 },
  { label: "1차", rank: 45 },
  { label: "2차", rank: 60 },
  { label: "최종", rank: 70 },
  { label: "오퍼", rank: 80 },
  { label: "합격", rank: 90 },
];

function rankOf(a: Applicant): number {
  if (a.joined_at) return 95;
  if (isPassed(a)) return Math.max(85, stageRank(a.stage));
  return stageRank(a.stage);
}

export function overallFunnel(apps: Applicant[]) {
  const ranks = apps.map(rankOf);
  return FUNNEL_STEPS.map((step, i) => {
    const reached = ranks.filter((r) => r >= step.rank).length;
    const prev = i > 0 ? ranks.filter((r) => r >= FUNNEL_STEPS[i - 1].rank).length : reached;
    return {
      label: step.label,
      reached,
      conv: i === 0 ? 100 : prev ? (reached / prev) * 100 : 0,
      drop: i === 0 ? 0 : prev ? ((prev - reached) / prev) * 100 : 0,
    };
  });
}

/** 포지션 × 단계 전환 테이블 */
export function positionStageMatrix(apps: Applicant[]) {
  const g = new Map<string, Applicant[]>();
  for (const a of apps) {
    (g.get(a.position) ?? g.set(a.position, []).get(a.position)!).push(a);
  }
  return [...g.entries()]
    .map(([position, list]) => {
      const ranks = list.map(rankOf);
      const cells = FUNNEL_STEPS.map(
        (st) => ranks.filter((r) => r >= st.rank).length,
      );
      const applied = cells[0] || list.length;
      const passed = cells[cells.length - 1];
      return {
        position,
        cells,
        finalConv: applied ? (passed / applied) * 100 : 0,
      };
    })
    .sort((a, b) => b.cells[0] - a.cells[0]);
}

export const FUNNEL_LABELS = FUNNEL_STEPS.map((s) => s.label);

/** Drop-off: 불합격자를 사유(없으면 탈락 단계)별로 */
export function dropoffBreakdown(apps: Applicant[]) {
  const rejected = apps.filter(isRejected);
  const hasReason = rejected.some((a) => a.reject_reason);
  const m = new Map<string, number>();
  for (const a of rejected) {
    const k = hasReason ? a.reject_reason || "(미기재)" : a.stage || "(단계 미기재)";
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  const total = rejected.length || 1;
  return {
    mode: hasReason ? ("reason" as const) : ("stage" as const),
    total: rejected.length,
    rows: [...m.entries()]
      .map(([label, value]) => ({ label, value, pct: (value / total) * 100 }))
      .sort((a, b) => b.value - a.value),
  };
}

/** Cost / Time to Hire */
export interface CostTime {
  annualChannelCost: number;
  totalHires: number;
  costPerHire: number | null;
  avgTimeToHire: number | null; // 지원 → 입사(일)
  avgTimeToResult: number | null; // 지원 → 최종결과(일)
}

export function costTimeToHire(
  apps: Applicant[],
  meta: Map<string, ChannelMeta>,
): CostTime {
  const annualChannelCost =
    [...meta.values()].reduce((sum, c) => sum + c.monthlyCost, 0) * 12;
  const totalHires = apps.filter(isPassed).length;
  const dayList = (to: (a: Applicant) => string) =>
    apps
      .map((a) => {
        const da = Date.parse(a.applied_at);
        const db = Date.parse(to(a));
        if (Number.isNaN(da) || Number.isNaN(db)) return null;
        const d = Math.round((db - da) / 86400000);
        return d >= 0 && d < 3650 ? d : null;
      })
      .filter((n): n is number => n != null);
  const avg = (arr: number[]) =>
    arr.length ? Math.round(arr.reduce((x, y) => x + y, 0) / arr.length) : null;

  return {
    annualChannelCost,
    totalHires,
    costPerHire:
      annualChannelCost > 0 && totalHires > 0
        ? Math.round(annualChannelCost / totalHires)
        : null,
    avgTimeToHire: avg(dayList((a) => a.joined_at)),
    avgTimeToResult: avg(dayList((a) => a.final_result_at)),
  };
}

export const wonM = (won: number) =>
  won >= 1e8
    ? `₩${(won / 1e8).toFixed(1)}억`
    : won >= 1e4
      ? `₩${Math.round(won / 1e4).toLocaleString("ko-KR")}만`
      : `₩${won.toLocaleString("ko-KR")}`;
