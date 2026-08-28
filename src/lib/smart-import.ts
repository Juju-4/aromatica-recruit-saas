import type { DataCategory } from "@/lib/data-catalog";
import { DATA_CATEGORIES } from "@/lib/data-catalog";

function norm(s: string): string {
  return String(s)
    .replace(/\(.*?\)/g, "") // (만원), (단위: ...)
    .replace(/[\s·:/_-]/g, "")
    .toLowerCase()
    .trim();
}

export interface SheetDetection {
  sheetName: string;
  rowCount: number;
  headers: string[];
  best: { categoryKey: string; label: string; score: number; matched: string[] } | null;
  candidates: { categoryKey: string; label: string; score: number }[];
  /** best 카테고리 key 로 매핑된 행 */
  rows: Record<string, unknown>[];
  /** 원본 헤더 그대로의 행 (카테고리 오버라이드 시 재매핑용) */
  rawRows: Record<string, unknown>[];
}

/** 원본 행을 임의 카테고리 컬럼 key 로 매핑 */
export function mapRowsToCategory(
  rawRows: Record<string, unknown>[],
  headers: string[],
  cat: DataCategory,
): Record<string, unknown>[] {
  const labelToKey = new Map(cat.columns.map((c) => [norm(c.label), c.key]));
  const keyByHeader = new Map<string, string>();
  for (const h of headers) {
    const n = norm(h);
    let key = labelToKey.get(n);
    if (!key) {
      for (const [ln, k] of labelToKey) {
        if (n && (n.includes(ln) || ln.includes(n))) {
          key = k;
          break;
        }
      }
    }
    if (key) keyByHeader.set(h, key);
  }
  return rawRows
    .map((r) => {
      const m: Record<string, unknown> = {};
      for (const [h, v] of Object.entries(r)) {
        const key = keyByHeader.get(h);
        if (key) m[key] = typeof v === "string" ? v.trim() : v;
      }
      return m;
    })
    .filter((r) => Object.values(r).some((v) => v !== "" && v != null));
}

/** 한 시트의 헤더를 카테고리 정의와 대조해 점수화 */
function scoreCategory(headers: string[], cat: DataCategory) {
  const H = headers.map(norm).filter(Boolean);
  const matched: string[] = [];
  let reqHit = 0;
  let reqTotal = 0;
  for (const col of cat.columns) {
    const target = norm(col.label);
    const altTarget = norm(col.key);
    const hit = H.some(
      (h) => h === target || h === altTarget || h.includes(target) || target.includes(h),
    );
    if (col.required) reqTotal++;
    if (hit) {
      matched.push(col.label);
      if (col.required) reqHit++;
    }
  }
  const coverage = matched.length / cat.columns.length;
  const reqCoverage = reqTotal > 0 ? reqHit / reqTotal : 1;
  // 필수 컬럼 충족을 강하게 가중
  const score = reqCoverage * 0.65 + coverage * 0.35;
  return { score, matched, reqCoverage };
}

export function detectSheet(
  sheetName: string,
  headers: string[],
  rows: Record<string, unknown>[],
  rawRows: Record<string, unknown>[] = [],
): SheetDetection {
  const scored = DATA_CATEGORIES.map((cat) => {
    const { score, matched, reqCoverage } = scoreCategory(headers, cat);
    return { cat, score, matched, reqCoverage };
  })
    .filter((x) => x.reqCoverage >= 0.6 && x.matched.length >= 2)
    .sort((a, b) => b.score - a.score);

  const top = scored[0];
  return {
    sheetName,
    rowCount: rows.length,
    headers,
    best: top
      ? {
          categoryKey: top.cat.key,
          label: top.cat.label,
          score: top.score,
          matched: top.matched,
        }
      : null,
    candidates: scored.slice(0, 4).map((s) => ({
      categoryKey: s.cat.key,
      label: s.cat.label,
      score: s.score,
    })),
    rows,
    rawRows,
  };
}

/** 업로드 파일(엑셀 다중시트/CSV)을 통째로 읽어 시트별 카테고리 자동 판별 */
export async function analyzeFile(file: File): Promise<SheetDetection[]> {
  const XLSX = await import("xlsx");
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const out: SheetDetection[] = [];

  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName];
    if (!ws) continue;
    const aoa = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, blankrows: false });
    if (aoa.length < 2) continue;
    const headers = (aoa[0] as unknown[]).map((h) => String(h ?? "").trim());
    const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, {
      defval: "",
      raw: false,
    });

    const rawRows = json.filter((r) =>
      Object.values(r).some((v) => v !== "" && v != null),
    );
    const det = detectSheet(sheetName, headers, [], rawRows);
    if (!det.best) {
      out.push(det);
      continue;
    }
    const cat = DATA_CATEGORIES.find((c) => c.key === det.best!.categoryKey)!;
    out.push({ ...det, rows: mapRowsToCategory(rawRows, headers, cat) });
  }

  return out;
}
