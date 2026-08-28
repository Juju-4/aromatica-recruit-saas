import type { DataCategory, CatalogColumn } from "@/lib/data-catalog";
import { DATA_CATEGORIES } from "@/lib/data-catalog";

function norm(s: string): string {
  return String(s)
    .replace(/\(.*?\)/g, "")
    .replace(/[\s·:/_\-&]/g, "")
    .toLowerCase()
    .trim();
}

/** 포지션 현황표 전용 pseudo-category (datasets 아닌 positions 테이블로 라우팅) */
export const POSITIONS_PSEUDO: DataCategory = {
  key: "__positions__",
  label: "채용 포지션 현황",
  description: "본부·부서·포지션·TO·면접 진행 메모. 채용 현황 화면의 포지션 표로 반영됩니다.",
  columns: [
    { key: "division", label: "본부", type: "text", example: "생산본부" },
    { key: "department", label: "부서", type: "text", example: "SCM팀" },
    { key: "title", label: "포지션", type: "text", example: "원료구매담당자", required: true },
    { key: "channel", label: "채널", type: "text", example: "사람인" },
    { key: "job_level", label: "직책", type: "text", example: "M" },
    { key: "target_count", label: "TO", type: "number", example: 1 },
    { key: "stage1_note", label: "1차 면접", type: "text", example: "한세진(9/1), 강수현(9/1)" },
    { key: "stage2_note", label: "2차&최종 면접", type: "text", example: "최예랑(면접 조율 대기)" },
    { key: "offer_note", label: "처우협상", type: "text", example: "김택유 합격" },
    { key: "note", label: "비고", type: "text", example: "충원" },
  ],
};

const ALL_CATS: DataCategory[] = [POSITIONS_PSEUDO, ...DATA_CATEGORIES];

export interface SheetDetection {
  sheetName: string;
  rowCount: number;
  headers: string[];
  best: { categoryKey: string; label: string; score: number; matched: string[] } | null;
  candidates: { categoryKey: string; label: string; score: number }[];
  rows: Record<string, unknown>[];
  rawRows: Record<string, unknown>[];
}

/** 원본 행을 카테고리 컬럼 key 로 매핑 + 매칭 안 된 컬럼도 원래 헤더로 보존 */
export function mapRowsToCategory(
  rawRows: Record<string, unknown>[],
  headers: string[],
  cat: DataCategory,
): Record<string, unknown>[] {
  const keyByHeader = buildHeaderMap(headers, cat.columns);
  return rawRows
    .map((r) => {
      const m: Record<string, unknown> = {};
      for (const [h, v] of Object.entries(r)) {
        const val = typeof v === "string" ? v.trim() : v;
        const key = keyByHeader.get(h);
        if (key) m[key] = val;
        else if (val !== "" && val != null) m[h] = val; // 원본 컬럼 보존
      }
      return m;
    })
    .filter((r) => Object.values(r).some((v) => v !== "" && v != null));
}

function buildHeaderMap(
  headers: string[],
  columns: CatalogColumn[],
): Map<string, string> {
  // 컬럼별 매칭 후보(라벨 + key + aliases) 정규화
  const candByKey: { key: string; cands: string[] }[] = columns.map((c) => ({
    key: c.key,
    cands: [c.label, c.key, ...(c.aliases ?? [])].map(norm).filter(Boolean),
  }));
  const out = new Map<string, string>();
  const used = new Set<string>();

  // 1) 정확 일치 우선
  for (const h of headers) {
    const n = norm(h);
    if (!n) continue;
    const hit = candByKey.find((c) => !used.has(c.key) && c.cands.includes(n));
    if (hit) {
      out.set(h, hit.key);
      used.add(hit.key);
    }
  }
  // 2) 부분 일치
  for (const h of headers) {
    if (out.has(h)) continue;
    const n = norm(h);
    if (!n) continue;
    const hit = candByKey.find(
      (c) =>
        !used.has(c.key) &&
        c.cands.some((cd) => cd.length >= 2 && (n.includes(cd) || cd.includes(n))),
    );
    if (hit) {
      out.set(h, hit.key);
      used.add(hit.key);
    }
  }
  return out;
}

function scoreCategory(
  headers: string[],
  cat: DataCategory,
  rawRows: Record<string, unknown>[],
) {
  const map = buildHeaderMap(headers, cat.columns);
  const keyByHeader = map; // header -> catKey
  const catKeyToHeader = new Map<string, string>();
  for (const [h, k] of map) if (!catKeyToHeader.has(k)) catKeyToHeader.set(k, h);

  // 실제 데이터가 들어있는 매칭만 인정 (상위 25행 표본)
  const sample = rawRows.slice(0, 25);
  const hasData = (catKey: string) => {
    const h = catKeyToHeader.get(catKey);
    if (!h) return false;
    return sample.some((r) => {
      const v = r[h];
      return v != null && String(v).trim() !== "";
    });
  };
  // 숫자여야 하는 컬럼은 숫자 데이터 확인
  const numericOk = (col: CatalogColumn) => {
    if (col.type !== "number") return true;
    const h = catKeyToHeader.get(col.key);
    if (!h) return false;
    return sample.some((r) => {
      const s = String(r[h] ?? "").replace(/[, ]/g, "");
      return s !== "" && Number.isFinite(Number(s));
    });
  };

  const solidCols = cat.columns.filter(
    (c) => keyByHeader && catKeyToHeader.has(c.key) && hasData(c.key) && numericOk(c),
  );
  const matched = solidCols.map((c) => c.label);
  const reqCols = cat.columns.filter((c) => c.required);
  const reqHit = reqCols.filter((c) => solidCols.some((s) => s.key === c.key)).length;
  const reqCoverage = reqCols.length ? reqHit / reqCols.length : 1;
  const coverage = matched.length / cat.columns.length;
  const score = reqCoverage * 0.65 + coverage * 0.35;
  return { score, matched, reqCoverage, matchCount: matched.length };
}

export function detectSheet(
  sheetName: string,
  headers: string[],
  rows: Record<string, unknown>[],
  rawRows: Record<string, unknown>[] = [],
): SheetDetection {
  const scored = ALL_CATS.map((cat) => {
    const r = scoreCategory(headers, cat, rawRows);
    return { cat, ...r };
  })
    .filter((x) => x.matchCount >= 2)
    .sort((a, b) => b.score - a.score);

  const top = scored[0];
  // 확신 조건: 필수 컬럼 대부분 채워짐 + 매칭 3개 이상 (또는 필수 100% + 2개↑)
  const confident =
    !!top &&
    ((top.reqCoverage >= 0.7 && top.matchCount >= 3) ||
      (top.reqCoverage >= 0.99 && top.matchCount >= 2));

  return {
    sheetName,
    rowCount: rawRows.length || rows.length,
    headers,
    best: confident
      ? {
          categoryKey: top.cat.key,
          label: top.cat.label,
          score: top.score,
          matched: top.matched,
        }
      : null,
    candidates: scored.slice(0, 5).map((s) => ({
      categoryKey: s.cat.key,
      label: s.cat.label,
      score: s.score,
    })),
    rows,
    rawRows,
  };
}

/** 헤더가 몇 번째 행에 있는지 추정 (빈 행·머리말·병합셀 대비) */
function findHeaderRow(aoa: unknown[][]): number {
  let best = 0;
  let bestScore = -1;
  for (let i = 0; i < Math.min(6, aoa.length); i++) {
    const row = aoa[i] ?? [];
    const nonEmpty = row.filter((c) => String(c ?? "").trim()).length;
    const texty = row.filter((c) => {
      const s = String(c ?? "").trim();
      return s && Number.isNaN(Number(s));
    }).length;
    const score = nonEmpty + texty * 0.5;
    if (score > bestScore) {
      bestScore = score;
      best = i;
    }
  }
  return best;
}

export async function analyzeFile(file: File): Promise<SheetDetection[]> {
  const XLSX = await import("xlsx");
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const out: SheetDetection[] = [];

  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName];
    if (!ws) continue;
    const aoa = XLSX.utils.sheet_to_json<unknown[]>(ws, {
      header: 1,
      blankrows: false,
    });
    if (aoa.length < 2) continue;

    const hRow = findHeaderRow(aoa);
    const rawHeaders = (aoa[hRow] as unknown[]).map((h, i) => {
      const s = String(h ?? "").trim();
      return s || `열${i + 1}`;
    });
    // 중복 헤더 방지
    const seen = new Map<string, number>();
    const headers = rawHeaders.map((h) => {
      const n = (seen.get(h) ?? 0) + 1;
      seen.set(h, n);
      return n > 1 ? `${h}_${n}` : h;
    });

    const rawRows: Record<string, unknown>[] = [];
    for (let r = hRow + 1; r < aoa.length; r++) {
      const row = aoa[r] ?? [];
      const obj: Record<string, unknown> = {};
      headers.forEach((h, i) => {
        const v = row[i];
        if (v !== "" && v != null) obj[h] = typeof v === "string" ? v.trim() : v;
      });
      if (Object.keys(obj).length) rawRows.push(obj);
    }
    if (rawRows.length === 0) continue;

    const det = detectSheet(sheetName, headers, [], rawRows);
    if (det.best) {
      const cat = ALL_CATS.find((c) => c.key === det.best!.categoryKey)!;
      det.rows = mapRowsToCategory(rawRows, headers, cat);
    } else {
      // 인식 실패 — 원본 그대로 보존, 사용자가 종류 선택
      det.rows = rawRows;
    }
    out.push(det);
  }

  return out;
}

export { ALL_CATS };
