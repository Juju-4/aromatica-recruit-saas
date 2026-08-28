export type Raw = Record<string, unknown>;

export interface CheckRow {
  emp_no: string;
  name: string;
  hire_date: string;
  check_item: string;
  phase: string;
  done: string;
  satisfaction: number | null;
  mentor: string;
}

const s = (v: unknown) => (v == null ? "" : String(v).trim());
const nOrNull = (v: unknown) => {
  const n = Number(s(v));
  return Number.isFinite(n) && s(v) !== "" ? n : null;
};
const isDone = (v: string) =>
  /^(y|yes|완료|done|true|1|o|ok)$/i.test(v.trim());

export function parseChecks(rows: Raw[]): CheckRow[] {
  return rows
    .map((r) => ({
      emp_no: s(r.emp_no),
      name: s(r.name) || s(r.emp_no) || "(미상)",
      hire_date: s(r.hire_date),
      check_item: s(r.check_item),
      phase: s(r.phase),
      done: s(r.done),
      satisfaction: nOrNull(r.satisfaction),
      mentor: s(r.mentor),
    }))
    .filter((r) => r.name && r.check_item);
}

export interface PersonProgress {
  key: string;
  name: string;
  hire_date: string;
  mentor: string;
  total: number;
  done: number;
  progress: number;
  satisfaction: number | null;
}

export function byPerson(rows: CheckRow[]): PersonProgress[] {
  const m = new Map<string, CheckRow[]>();
  for (const r of rows) {
    const k = r.emp_no || r.name;
    (m.get(k) ?? m.set(k, []).get(k)!).push(r);
  }
  return [...m.entries()]
    .map(([key, list]) => {
      const done = list.filter((x) => isDone(x.done)).length;
      const sats = list
        .map((x) => x.satisfaction)
        .filter((n): n is number => n != null);
      return {
        key,
        name: list[0].name,
        hire_date: list[0].hire_date,
        mentor: list.find((x) => x.mentor)?.mentor ?? "",
        total: list.length,
        done,
        progress: list.length ? (done / list.length) * 100 : 0,
        satisfaction: sats.length
          ? sats.reduce((a, b) => a + b, 0) / sats.length
          : null,
      };
    })
    .sort((a, b) => b.hire_date.localeCompare(a.hire_date));
}

export const PHASE_ORDER = ["D-7", "D-3", "D-DAY", "D-Day", "D+7", "D+30", "D+90"];

export function byPhase(
  rows: CheckRow[],
): { label: string; total: number; done: number; rate: number }[] {
  const m = new Map<string, { total: number; done: number }>();
  for (const r of rows) {
    const k = r.phase || "(미지정)";
    const e = m.get(k) ?? { total: 0, done: 0 };
    e.total++;
    if (isDone(r.done)) e.done++;
    m.set(k, e);
  }
  return [...m.entries()]
    .map(([label, e]) => ({
      label,
      total: e.total,
      done: e.done,
      rate: e.total ? (e.done / e.total) * 100 : 0,
    }))
    .sort((a, b) => {
      const ia = PHASE_ORDER.indexOf(a.label);
      const ib = PHASE_ORDER.indexOf(b.label);
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
    });
}

export function satisfactionDist(
  rows: CheckRow[],
): { label: string; value: number }[] {
  const m = new Map<number, number>();
  for (const r of rows) {
    if (r.satisfaction == null) continue;
    const b = Math.round(r.satisfaction);
    m.set(b, (m.get(b) ?? 0) + 1);
  }
  return [1, 2, 3, 4, 5].map((v) => ({
    label: `${v}점`,
    value: m.get(v) ?? 0,
  }));
}

export interface OnbKpi {
  people: number;
  avgProgress: number;
  avgSatisfaction: number | null;
  mentorRate: number;
}

export function onbKpi(people: PersonProgress[]): OnbKpi {
  const n = people.length;
  const sats = people
    .map((p) => p.satisfaction)
    .filter((x): x is number => x != null);
  return {
    people: n,
    avgProgress: n ? people.reduce((s, p) => s + p.progress, 0) / n : 0,
    avgSatisfaction: sats.length
      ? sats.reduce((a, b) => a + b, 0) / sats.length
      : null,
    mentorRate: n ? (people.filter((p) => p.mentor).length / n) * 100 : 0,
  };
}
