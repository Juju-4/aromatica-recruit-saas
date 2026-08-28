import { createClient } from "@/lib/supabase/client";
import { getCategory, type CatalogColumn } from "@/lib/data-catalog";

export type Rows = Record<string, unknown>[];

/** 카테고리별 활성(is_active) 데이터셋들의 모든 행을 합쳐서 반환 */
export async function loadActiveRows(
  categoryKeys: string[],
): Promise<Record<string, Rows>> {
  const supabase = createClient();
  const out: Record<string, Rows> = {};
  if (categoryKeys.length === 0) return out;

  const { data: datasets } = await supabase
    .from("datasets")
    .select("id, category_key, is_active")
    .in("category_key", categoryKeys);

  const activeByCat = new Map<string, string[]>();
  for (const d of datasets ?? []) {
    const row = d as { id: string; category_key: string; is_active: boolean };
    if (!row.is_active) continue;
    const arr = activeByCat.get(row.category_key) ?? [];
    arr.push(row.id);
    activeByCat.set(row.category_key, arr);
  }

  for (const key of categoryKeys) {
    const ids = activeByCat.get(key) ?? [];
    if (ids.length === 0) {
      out[key] = [];
      continue;
    }
    const { data: rows } = await supabase
      .from("dataset_rows")
      .select("values")
      .in("dataset_id", ids)
      .order("row_no", { ascending: true });
    out[key] = (rows ?? []).map((r) => (r as { values: Rows[number] }).values);
  }
  return out;
}

export function toNumber(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = Number(String(v).replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

export function sum(rows: Rows, key: string): number {
  return rows.reduce((s, r) => s + (toNumber(r[key]) ?? 0), 0);
}
export function avg(rows: Rows, key: string): number {
  const nums = rows.map((r) => toNumber(r[key])).filter((n): n is number => n != null);
  return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0;
}

export function countBy(rows: Rows, key: string): { label: string; value: number }[] {
  const m = new Map<string, number>();
  for (const r of rows) {
    const k = String(r[key] ?? "").trim() || "(미입력)";
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return [...m.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);
}

export function sumBy(
  rows: Rows,
  groupKey: string,
  valueKey: string,
): { label: string; value: number }[] {
  const m = new Map<string, number>();
  for (const r of rows) {
    const k = String(r[groupKey] ?? "").trim() || "(미입력)";
    m.set(k, (m.get(k) ?? 0) + (toNumber(r[valueKey]) ?? 0));
  }
  return [...m.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);
}

const GROUP_PRIORITY = [
  "dept",
  "channel",
  "position",
  "stage",
  "status",
  "job_family",
  "account",
  "check_item",
  "competency",
  "perf_grade",
];

export function pickGroupColumn(categoryKey: string): CatalogColumn | null {
  const cat = getCategory(categoryKey);
  if (!cat) return null;
  for (const key of GROUP_PRIORITY) {
    const c = cat.columns.find((x) => x.key === key);
    if (c) return c;
  }
  return cat.columns.find((c) => c.type === "text") ?? null;
}

export function numericColumns(categoryKey: string): CatalogColumn[] {
  return getCategory(categoryKey)?.columns.filter((c) => c.type === "number") ?? [];
}
