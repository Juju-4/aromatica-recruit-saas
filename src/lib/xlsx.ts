import type { DataCategory } from "@/lib/data-catalog";

// SheetJS 는 무겁다(~400KB). 실제로 양식 생성/파싱할 때만 동적 로드해서
// 페이지 초기 번들에서 제외한다.
async function loadXLSX() {
  return await import("xlsx");
}

/**
 * 카테고리 정의로부터 다운로드용 엑셀 양식(.xlsx)을 만든다.
 * - 시트1 "데이터": 헤더행(한글 라벨) + 예시 1행
 * - 시트2 "작성안내": 각 컬럼 설명/필수여부/형식
 */
export async function buildTemplateBlob(category: DataCategory): Promise<Blob> {
  const XLSX = await loadXLSX();
  const headers = category.columns.map((c) => c.label);
  const example = category.columns.map((c) => c.example ?? "");

  const wsData = XLSX.utils.aoa_to_sheet([headers, example]);
  wsData["!cols"] = category.columns.map((c) => ({
    wch: Math.max(12, c.label.length * 2, String(c.example ?? "").length + 2),
  }));

  const guideRows = [
    ["컬럼", "필수", "형식", "설명 / 예시"],
    ...category.columns.map((c) => [
      c.label,
      c.required ? "필수" : "선택",
      typeLabel(c.type),
      `${c.help ?? ""}${c.help ? " · " : ""}예: ${c.example}`,
    ]),
    [],
    ["※ 안내", "", "", ""],
    ["", "", "", "첫 행(헤더)의 컬럼 이름은 바꾸지 마세요."],
    ["", "", "", "예시 행은 지우고 실제 데이터를 입력한 뒤 업로드하세요."],
    ["", "", "", "날짜는 YYYY-MM-DD 형식(예: 2026-08-01)을 권장합니다."],
  ];
  const wsGuide = XLSX.utils.aoa_to_sheet(guideRows);
  wsGuide["!cols"] = [{ wch: 22 }, { wch: 8 }, { wch: 10 }, { wch: 60 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, wsData, "데이터");
  XLSX.utils.book_append_sheet(wb, wsGuide, "작성안내");

  const out = XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
  return new Blob([out], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

function typeLabel(t: string): string {
  return t === "number"
    ? "숫자"
    : t === "date"
      ? "날짜"
      : t === "select"
        ? "구분"
        : "텍스트";
}

export interface ParseResult {
  rows: Record<string, unknown>[];
  errors: string[];
  matchedColumns: string[];
}

/**
 * 업로드된 엑셀/CSV 파일을 카테고리 정의에 맞춰 파싱.
 * 헤더(한글 라벨)를 컬럼 key 로 매핑하고, 필수 컬럼 누락을 errors 로 돌려준다.
 */
export async function parseUpload(
  file: File,
  category: DataCategory,
): Promise<ParseResult> {
  const XLSX = await loadXLSX();
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const sheetName = wb.SheetNames.find((n) => n === "데이터") ?? wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];

  if (!ws) {
    return { rows: [], errors: ["시트를 찾을 수 없습니다."], matchedColumns: [] };
  }

  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, {
    defval: "",
    raw: false,
  });

  const errors: string[] = [];
  const labelToKey = new Map(
    category.columns.map((c) => [c.label.trim(), c.key]),
  );
  const foundLabels = new Set<string>();

  const rows = raw
    .map((r) => {
      const mapped: Record<string, unknown> = {};
      for (const [label, value] of Object.entries(r)) {
        const key = labelToKey.get(label.trim());
        if (key) {
          foundLabels.add(label.trim());
          mapped[key] = typeof value === "string" ? value.trim() : value;
        }
      }
      return mapped;
    })
    .filter((r) => Object.values(r).some((v) => v !== "" && v != null));

  for (const col of category.columns) {
    if (col.required && !foundLabels.has(col.label.trim())) {
      errors.push(`필수 컬럼 "${col.label}" 을(를) 찾을 수 없습니다.`);
    }
  }
  if (rows.length === 0 && errors.length === 0) {
    errors.push(
      "데이터 행이 없습니다. 예시 행 아래에 실제 데이터를 입력했는지 확인해주세요.",
    );
  }

  return { rows, errors, matchedColumns: [...foundLabels] };
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
