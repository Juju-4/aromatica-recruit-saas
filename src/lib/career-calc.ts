/** 경력 산정 — 건강보험 자격득실 기준, 15일 미만 절사, 인턴 제외 */

export interface CareerRow {
  company: string;
  start: string; // YYYY-MM-DD
  end: string;
  isIntern?: boolean;
}

export interface CareerResult {
  totalMonths: number; // 절사 반영된 총 개월
  years: number;
  months: number;
  label: string; // "00년 00개월"
  perRow: { days: number; years: number; months: number; label: string }[];
}

function parseD(s: string): Date | null {
  if (!s) return null;
  const t = Date.parse(s);
  return Number.isNaN(t) ? null : new Date(t);
}

/** 두 날짜 사이 개월수 (일 단위는 15일 규칙으로 개월에 반영) */
function diffYMD(a: Date, b: Date) {
  let years = b.getFullYear() - a.getFullYear();
  let months = b.getMonth() - a.getMonth();
  let days = b.getDate() - a.getDate() + 1; // 자격득실은 양 끝 포함
  if (days < 0) {
    months -= 1;
    const prevMonth = new Date(b.getFullYear(), b.getMonth(), 0).getDate();
    days += prevMonth;
  }
  if (months < 0) {
    years -= 1;
    months += 12;
  }
  const totalDays = Math.round((b.getTime() - a.getTime()) / 86400000) + 1;
  return { years, months, days, totalDays };
}

export function computeCareer(rows: CareerRow[]): CareerResult {
  let totalMonths = 0;
  const perRow = rows.map((r) => {
    const s = parseD(r.start);
    const e = parseD(r.end);
    if (!s || !e || e < s || r.isIntern) {
      return { days: 0, years: 0, months: 0, label: "0년 0개월 0일" };
    }
    const { years, months, days, totalDays } = diffYMD(s, e);
    // 15일 미만 절사: days < 15 → 버림, >= 15 → 1개월 반영
    const roundedMonths = years * 12 + months + (days >= 15 ? 1 : 0);
    totalMonths += roundedMonths;
    return {
      days: totalDays,
      years,
      months,
      label: `${years}년 ${months}개월 ${days}일`,
    };
  });
  const years = Math.floor(totalMonths / 12);
  const months = totalMonths % 12;
  return {
    totalMonths,
    years,
    months,
    label: `${years}년 ${months}개월`,
    perRow,
  };
}

/** 현재 직장 급여 항목 → 1년 환산 */
export interface PayItems {
  base: number; // 기본급(월)
  meal: number; // 식대(비과세, 월)
  jobAllowance: number; // 직무/직책수당(월)
  overtime: number; // 시간외수당(월)
  fixedBonus: number; // 고정상여(월 환산)
  monthsWorked: number; // 근무개월 (환산 기준, 보통 12)
}

export function annualize(p: PayItems) {
  const monthlyTotal = p.base + p.meal + p.jobAllowance + p.overtime + p.fixedBonus;
  const factor = 12;
  return {
    monthlyBase: p.base,
    monthlyTotal,
    annualBase: p.base * factor,
    annualMeal: p.meal * factor,
    annualTotal: monthlyTotal * factor,
  };
}

/** 아로마티카 복지 (설정값 · 필요시 수정) */
export const AR_BENEFITS = {
  meal: 2_400_000, // 식대 연
  telecom: 960_000, // 통신비 연
  welfarePoint: 500_000, // 복지포인트 연
};
export const AR_BENEFIT_TOTAL =
  AR_BENEFITS.meal + AR_BENEFITS.telecom + AR_BENEFITS.welfarePoint;

export function raisePct(current: number, proposed: number): number {
  if (!current) return 0;
  return ((proposed - current) / current) * 100;
}
