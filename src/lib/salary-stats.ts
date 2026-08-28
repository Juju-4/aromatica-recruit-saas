/**
 * 연봉 벤치마크 분석 — 잡플래닛 "연봉 데이터 리포트" 방법론 기반.
 *
 * 핵심 개념
 *  - "연봉" = 중위연봉(50%ile). 평균이 아님.
 *  - "연봉 범위" = 사분위수 범위(IQR) = 25%ile ~ 75%ile
 *  - 분포는 box plot(min·25·median·mean·75·max)으로 표현
 *  - 세그먼트: 직종 × 직급 × 연차그룹
 *  - 이상치(outlier)는 1.5×IQR 밖 값으로 정의해 통계에서 제외
 */

export interface SalaryRow {
  month: string;
  job_family: string;
  role: string;
  grade: string;
  years: number;
  annual_salary: number;
}

export type RawRow = Record<string, unknown>;

export function parseSalaryRows(rows: RawRow[]): SalaryRow[] {
  return rows
    .map((r) => ({
      month: String(r.month ?? "").trim(),
      job_family: String(r.job_family ?? "").trim() || "(미분류)",
      role: String(r.role ?? "").trim() || "(미분류)",
      grade: String(r.grade ?? "").trim() || "(미지정)",
      years: num(r.years) ?? 0,
      annual_salary: num(r.annual_salary) ?? 0,
    }))
    .filter((r) => r.annual_salary > 0);
}

function num(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = Number(String(v).replace(/[, ]/g, ""));
  return Number.isFinite(n) ? n : null;
}

/** 선형보간 백분위수 (Jobplanet 25/50/75%ile 과 동일 방식) */
export function quantile(sortedAsc: number[], p: number): number {
  if (sortedAsc.length === 0) return 0;
  if (sortedAsc.length === 1) return sortedAsc[0];
  const idx = (sortedAsc.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sortedAsc[lo];
  return sortedAsc[lo] + (sortedAsc[hi] - sortedAsc[lo]) * (idx - lo);
}

export interface Stats {
  n: number;
  min: number;
  p25: number;
  median: number;
  mean: number;
  p75: number;
  max: number;
  iqr: number;
  /** box plot 수염 (1.5×IQR 규칙, 데이터 범위로 clamp) */
  whiskerLow: number;
  whiskerHigh: number;
}

export function computeStats(values: number[], dropOutliers = true): Stats {
  const sorted = [...values].sort((a, b) => a - b);
  if (sorted.length === 0) {
    return {
      n: 0, min: 0, p25: 0, median: 0, mean: 0, p75: 0, max: 0,
      iqr: 0, whiskerLow: 0, whiskerHigh: 0,
    };
  }
  let work = sorted;
  const p25raw = quantile(sorted, 0.25);
  const p75raw = quantile(sorted, 0.75);
  const iqrRaw = p75raw - p25raw;
  if (dropOutliers && iqrRaw > 0) {
    const lo = p25raw - 1.5 * iqrRaw;
    const hi = p75raw + 1.5 * iqrRaw;
    work = sorted.filter((v) => v >= lo && v <= hi);
    if (work.length === 0) work = sorted;
  }
  const p25 = quantile(work, 0.25);
  const p75 = quantile(work, 0.75);
  const iqr = p75 - p25;
  return {
    n: work.length,
    min: work[0],
    p25,
    median: quantile(work, 0.5),
    mean: work.reduce((a, b) => a + b, 0) / work.length,
    p75,
    max: work[work.length - 1],
    iqr,
    whiskerLow: Math.max(work[0], p25 - 1.5 * iqr),
    whiskerHigh: Math.min(work[work.length - 1], p75 + 1.5 * iqr),
  };
}

/** 대상 값이 분포에서 몇 %ile 위치인지 (0~100) */
export function percentileRank(values: number[], target: number): number {
  if (values.length === 0) return 0;
  const below = values.filter((v) => v < target).length;
  const equal = values.filter((v) => v === target).length;
  return ((below + equal * 0.5) / values.length) * 100;
}

export const TENURE_BUCKETS: { key: string; label: string; test: (y: number) => boolean }[] = [
  { key: "t1", label: "1~3년차", test: (y) => y >= 0 && y <= 3 },
  { key: "t2", label: "4~6년차", test: (y) => y >= 4 && y <= 6 },
  { key: "t3", label: "7~10년차", test: (y) => y >= 7 && y <= 10 },
  { key: "t4", label: "11년차+", test: (y) => y >= 11 },
];

export function tenureLabel(years: number): string {
  return TENURE_BUCKETS.find((b) => b.test(years))?.label ?? "기타";
}

export interface GroupStat extends Stats {
  key: string;
  label: string;
}

export function groupBy(
  rows: SalaryRow[],
  keyFn: (r: SalaryRow) => string,
): GroupStat[] {
  const m = new Map<string, number[]>();
  for (const r of rows) {
    const k = keyFn(r);
    const arr = m.get(k) ?? [];
    arr.push(r.annual_salary);
    m.set(k, arr);
  }
  return [...m.entries()]
    .map(([label, vals]) => ({ key: label, label, ...computeStats(vals) }))
    .sort((a, b) => b.median - a.median);
}

export function byJobFamily(rows: SalaryRow[]): GroupStat[] {
  return groupBy(rows, (r) => r.job_family);
}
export function byGrade(rows: SalaryRow[]): GroupStat[] {
  return groupBy(rows, (r) => r.grade);
}
export function byTenure(rows: SalaryRow[]): GroupStat[] {
  const order = TENURE_BUCKETS.map((b) => b.label);
  return groupBy(rows, (r) => tenureLabel(r.years)).sort(
    (a, b) => order.indexOf(a.label) - order.indexOf(b.label),
  );
}

/** 월(period) 2개 이상일 때 최신 vs 직전 인상 동향 */
export interface TrendResult {
  hasPrev: boolean;
  latestMonth: string;
  prevMonth: string | null;
  latestMedian: number;
  prevMedian: number;
  deltaAmount: number;
  deltaPct: number;
  byTenure: {
    label: string;
    latestMedian: number;
    prevMedian: number;
    deltaPct: number;
  }[];
}

export function computeTrend(rows: SalaryRow[]): TrendResult {
  const months = [...new Set(rows.map((r) => r.month).filter(Boolean))].sort();
  const latestMonth = months[months.length - 1] ?? "";
  const prevMonth = months.length >= 2 ? months[months.length - 2] : null;
  const latestRows = rows.filter((r) => r.month === latestMonth);
  const prevRows = prevMonth ? rows.filter((r) => r.month === prevMonth) : [];

  const latestMedian = computeStats(latestRows.map((r) => r.annual_salary)).median;
  const prevMedian = prevMonth
    ? computeStats(prevRows.map((r) => r.annual_salary)).median
    : 0;

  const tByLabel = TENURE_BUCKETS.map((b) => {
    const lm = computeStats(
      latestRows.filter((r) => b.test(r.years)).map((r) => r.annual_salary),
    ).median;
    const pm = prevMonth
      ? computeStats(
          prevRows.filter((r) => b.test(r.years)).map((r) => r.annual_salary),
        ).median
      : 0;
    return {
      label: b.label,
      latestMedian: lm,
      prevMedian: pm,
      deltaPct: pm > 0 ? ((lm - pm) / pm) * 100 : 0,
    };
  }).filter((t) => t.latestMedian > 0);

  return {
    hasPrev: !!prevMonth && prevMedian > 0,
    latestMonth,
    prevMonth,
    latestMedian,
    prevMedian,
    deltaAmount: latestMedian - prevMedian,
    deltaPct: prevMedian > 0 ? ((latestMedian - prevMedian) / prevMedian) * 100 : 0,
    byTenure: tByLabel,
  };
}

export function won(manwon: number): string {
  if (!Number.isFinite(manwon)) return "-";
  return `${Math.round(manwon).toLocaleString("ko-KR")}만원`;
}
