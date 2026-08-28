export interface Applicant {
  name: string;
  position: string;
  job_family: string;
  channel: string;
  applied_at: string;
  stage: string;
  status: string;
  reject_reason: string;
  first_result_at: string; // 서류결과일
  first_interview_at: string;
  final_result_at: string;
  joined_at: string;
}

export type Raw = Record<string, unknown>;

const s = (v: unknown) => (v == null ? "" : String(v).trim());

/** ATS 원본의 다양한 컬럼명을 흡수 */
export function parseApplicants(rows: Raw[]): Applicant[] {
  return rows
    .map((r) => ({
      name: s(r.name) || s(r.applicant_name) || s(r.applicant_id),
      position: s(r.position) || s(r.job) || "(미지정)",
      job_family: s(r.job_family) || s(r.family) || "",
      channel: normChannel(s(r.channel) || s(r.source)),
      applied_at: normDate(s(r.applied_at) || s(r.apply_date)),
      stage: s(r.stage) || s(r.current_stage),
      status: s(r.status) || "진행중",
      reject_reason: s(r.reject_reason) || s(r.reason),
      first_result_at: normDate(s(r.doc_result_at) || s(r.first_result_at)),
      first_interview_at: normDate(s(r.first_interview_at)),
      final_result_at: normDate(
        s(r.final_result_at) || s(r.result_at) || s(r.stage_changed_at),
      ),
      joined_at: normDate(s(r.joined_at) || s(r.join_date) || s(r.hire_date)),
    }))
    .filter((a) => a.name || a.position !== "(미지정)");
}

function normDate(v: string): string {
  if (!v) return "";
  // "2024-12-24 00:13" → "2024-12-24"
  const m = v.match(/\d{4}[-./]\d{1,2}[-./]\d{1,2}/);
  return m ? m[0].replace(/[./]/g, "-") : v;
}

const CHANNEL_MAP: [RegExp, string][] = [
  [/saramin/i, "사람인"],
  [/wanted/i, "원티드"],
  [/linkedin/i, "링크드인"],
  [/jobkorea/i, "잡코리아"],
  [/rocketpunch|로켓펀치/i, "로켓펀치"],
  [/jumpit|점핏/i, "점핏"],
  [/programmers|프로그래머스/i, "프로그래머스"],
  [/greeting|그리팅/i, "그리팅"],
  [/notion/i, "노션 공고"],
  [/instagram|facebook|threads/i, "SNS"],
  [/referral|추천|지인/i, "내부추천"],
  [/헤드헌|search firm|hunt/i, "헤드헌터"],
  [/homepage|career|자사|채용홈|self|직접|website/i, "직접지원"],
];
function normChannel(v: string): string {
  if (!v) return "(미상)";
  for (const [re, label] of CHANNEL_MAP) if (re.test(v)) return label;
  // 도메인만 남기고 정리
  return v.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
}

/** 전형 단계 순위 (한국형 ATS 공통 키워드) */
export function stageRank(stage: string): number {
  const t = stage.toLowerCase();
  if (/입사|onboard|합류/.test(t)) return 90;
  if (/제안|오퍼|처우|offer/.test(t)) return 80;
  if (/최종|임원|ceo|대표|hr&ceo/.test(t)) return 70;
  if (/2차|이차|second/.test(t)) return 60;
  // "실무 커피챗" 은 면접이 아니라 커피챗이므로 커피챗을 먼저 판정
  if (/커피챗|coffee|사전\s*대화|pre-?screen|캐주얼/.test(t)) return 40;
  if (/실무|1차|일차|technical|hiring manager|\bhm\b/.test(t)) return 50;
  if (/필터링|스크리닝|screening|서류\s*검토|검토\s*대상/.test(t)) return 30;
  if (/서류|document|resume/.test(t)) return 25;
  if (/접수|지원|apply|applied|\bnew\b/.test(t)) return 10;
  return 20;
}

// 주의: "불합격" 은 "합격" 을 포함하므로 REJECT 를 먼저 판정한다.
export const REJECT = /불합격|탈락|reject|declined|not selected/i;
export const PASS = /합격|채용\s*확정|입사|hired|offer\s*accepted|onboarded/i;
export const DROP = /취소|사퇴|포기|withdraw|dropped/i;
export const HOLD = /보류|hold|on-?hold|pending/i;

export const isRejected = (a: Applicant) => REJECT.test(a.status);
export const isDropped = (a: Applicant) => DROP.test(a.status);
export const isHold = (a: Applicant) => HOLD.test(a.status);
export const isPassed = (a: Applicant) =>
  !isRejected(a) && !isDropped(a) && (PASS.test(a.status) || !!a.joined_at);
export const isInProgress = (a: Applicant) =>
  !isPassed(a) && !isRejected(a) && !isHold(a) && !isDropped(a);

function daysBetween(a: string, b: string): number | null {
  const da = Date.parse(a);
  const db = Date.parse(b);
  if (Number.isNaN(da) || Number.isNaN(db)) return null;
  const d = Math.round((db - da) / 86400000);
  return d >= 0 && d < 3650 ? d : null;
}

export interface Kpi {
  total: number;
  inProgress: number;
  passed: number;
  rejected: number;
  hold: number;
  passRate: number;
  avgDaysToHire: number | null;
}

export function kpi(apps: Applicant[]): Kpi {
  const total = apps.length;
  const passed = apps.filter(isPassed).length;
  const rejected = apps.filter(isRejected).length;
  const hd = apps
    .map((a) => daysBetween(a.applied_at, a.joined_at || a.final_result_at))
    .filter((n): n is number => n != null);
  return {
    total,
    inProgress: apps.filter(isInProgress).length,
    passed,
    rejected,
    hold: apps.filter(isHold).length,
    passRate: total ? (passed / total) * 100 : 0,
    avgDaysToHire: hd.length
      ? Math.round(hd.reduce((x, y) => x + y, 0) / hd.length)
      : null,
  };
}

export function inflow(
  apps: Applicant[],
  granularity: "week" | "month" = "month",
): { label: string; value: number }[] {
  const m = new Map<string, number>();
  for (const a of apps) {
    const dt = new Date(a.applied_at);
    if (Number.isNaN(dt.getTime())) continue;
    const key =
      granularity === "month"
        ? `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`
        : weekKey(dt);
    m.set(key, (m.get(key) ?? 0) + 1);
  }
  return [...m.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([label, value]) => ({ label, value }));
}
function weekKey(dt: Date): string {
  const jan1 = new Date(dt.getFullYear(), 0, 1);
  const w = Math.ceil(((dt.getTime() - jan1.getTime()) / 86400000 + jan1.getDay() + 1) / 7);
  return `${dt.getFullYear()} ${String(w).padStart(2, "0")}주`;
}

export interface GroupRow {
  key: string;
  applied: number;
  passed: number;
  rejected: number;
  inProgress: number;
  passRate: number;
  avgDaysToHire: number | null;
}

function groupRows(apps: Applicant[], keyFn: (a: Applicant) => string): GroupRow[] {
  const m = new Map<string, Applicant[]>();
  for (const a of apps) {
    const k = keyFn(a) || "(미상)";
    (m.get(k) ?? m.set(k, []).get(k)!).push(a);
  }
  return [...m.entries()]
    .map(([key, list]) => {
      const passed = list.filter(isPassed).length;
      const hd = list
        .map((a) => daysBetween(a.applied_at, a.joined_at || a.final_result_at))
        .filter((n): n is number => n != null);
      return {
        key,
        applied: list.length,
        passed,
        rejected: list.filter(isRejected).length,
        inProgress: list.filter(isInProgress).length,
        passRate: list.length ? (passed / list.length) * 100 : 0,
        avgDaysToHire: hd.length
          ? Math.round(hd.reduce((x, y) => x + y, 0) / hd.length)
          : null,
      };
    })
    .sort((a, b) => b.applied - a.applied);
}

export const byChannel = (a: Applicant[]) => groupRows(a, (x) => x.channel);
export const byPosition = (a: Applicant[]) => groupRows(a, (x) => x.position);
export const byJobFamily = (a: Applicant[]) => groupRows(a, (x) => x.job_family);
export const hasJobFamily = (a: Applicant[]) =>
  a.some((x) => x.job_family && x.job_family !== "(미상)");

/** 불합격 분석: 사유가 있으면 사유별, 없으면 '어느 단계에서 탈락' */
export function rejectBreakdown(apps: Applicant[]): {
  mode: "reason" | "stage";
  rows: { label: string; value: number }[];
} {
  const rejected = apps.filter(isRejected);
  const hasReason = rejected.some((a) => a.reject_reason);
  const m = new Map<string, number>();
  for (const a of rejected) {
    const k = hasReason
      ? a.reject_reason || "(미기재)"
      : a.stage || "(단계 미기재)";
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return {
    mode: hasReason ? "reason" : "stage",
    rows: [...m.entries()]
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value),
  };
}

/** 데이터에 실제로 존재하는 단계로 퍼널 구성 (현재 단계 기준 '이상 도달') */
export function funnel(apps: Applicant[]): {
  label: string;
  reached: number;
  conv: number;
  drop: number;
}[] {
  const stagesPresent = [...new Set(apps.map((a) => a.stage).filter(Boolean))];
  if (stagesPresent.length === 0) return [];
  // 순위 버킷으로 묶고, 버킷 대표명 = 가장 많이 쓰인 단계명
  const byRank = new Map<number, Map<string, number>>();
  for (const st of apps.map((a) => a.stage).filter(Boolean)) {
    const r = stageRank(st);
    const inner = byRank.get(r) ?? new Map();
    inner.set(st, (inner.get(st) ?? 0) + 1);
    byRank.set(r, inner);
  }
  const buckets = [...byRank.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([rank, names]) => ({
      rank,
      label: [...names.entries()].sort((a, b) => b[1] - a[1])[0][0],
    }));

  const rankOf = (a: Applicant) => {
    if (a.joined_at) return 90;
    if (isPassed(a)) return Math.max(80, stageRank(a.stage));
    return stageRank(a.stage);
  };
  const ranks = apps.map(rankOf);
  const counts = buckets.map((b) => ranks.filter((r) => r >= b.rank).length);
  return buckets.map((b, i) => ({
    label: b.label,
    reached: counts[i],
    conv: i === 0 ? 100 : counts[i - 1] ? (counts[i] / counts[i - 1]) * 100 : 0,
    drop:
      i === 0 ? 0 : counts[i - 1] ? ((counts[i - 1] - counts[i]) / counts[i - 1]) * 100 : 0,
  }));
}

/** 단계별 현재 인원 + 평가중/불합격/합격 분해 */
export function stageBreakdown(apps: Applicant[]): {
  label: string;
  total: number;
  inProgress: number;
  rejected: number;
  passed: number;
}[] {
  const m = new Map<string, Applicant[]>();
  for (const a of apps) {
    const k = a.stage || "(단계 미기재)";
    (m.get(k) ?? m.set(k, []).get(k)!).push(a);
  }
  return [...m.entries()]
    .map(([label, list]) => ({
      label,
      total: list.length,
      inProgress: list.filter(isInProgress).length,
      rejected: list.filter(isRejected).length,
      passed: list.filter(isPassed).length,
    }))
    .sort((a, b) => stageRank(a.label) - stageRank(b.label));
}

export function recent(apps: Applicant[], n = 12): Applicant[] {
  return [...apps]
    .filter((a) => a.applied_at)
    .sort((a, b) => b.applied_at.localeCompare(a.applied_at))
    .slice(0, n);
}

export const pct = (n: number) => `${n.toFixed(1)}%`;
