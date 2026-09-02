import type { OfferCase } from "@/lib/offer-cases";
import { AR_BENEFITS, AR_BENEFIT_TOTAL, raisePct } from "@/lib/career-calc";

const won = (n: unknown) => {
  const v = Number(n);
  return Number.isFinite(v) ? v : 0;
};

// "YYYY-MM-DD" → Excel 날짜 serial (1900 체계)
const EPOCH = Date.parse("1899-12-30");
const toSerial = (s: string): number | null => {
  const t = Date.parse(s);
  return Number.isNaN(t) ? null : Math.round((t - EPOCH) / 86400000);
};

type Cell = string | number | { f: string; v: number; z?: string };

/**
 * 처우확인사항 엑셀 생성 → { blob, base64 }
 * 원본 양식과 동일하게 파생 셀은 **수식**으로 채운다 (열면 재계산됨).
 * 캐시값(v)도 함께 넣어 미리보기에서도 값이 보이게 한다.
 */
export async function buildOfferXlsx(
  oc: OfferCase,
  teamRows: { division: string; department: string; grade: string; salary: number; career: string }[],
): Promise<{ blob: Blob; base64: string; fileName: string }> {
  const XLSX = await import("xlsx");
  const p = oc.payload ?? {};

  const prev = won(p.prev_salary);
  const base = won(p.proposed_base);
  const monthly = won(p.proposed_monthly) || Math.round(base / 12);
  const laborAdd = won(p.labor_cost_total) || AR_BENEFIT_TOTAL; // 식대·복지 가산분
  const cur = {
    base: won(p.cur_base),
    meal: won(p.cur_meal),
    job: won(p.cur_job_allowance),
    ot: won(p.cur_overtime),
    bonus: won(p.cur_fixed_bonus),
  };
  const curMonthlySum = cur.base + cur.ot + cur.meal; // 원본 D35 = D30+D33+D31
  const curAnnualSum = cur.base * 12 + cur.meal * 12 + cur.job * 12 + cur.ot * 12 + cur.bonus;

  const A: Cell[][] = [];
  const row = (cells: Cell[]) => A.push(cells) && A.length; // 1-based Excel 행번호 반환

  row(["지원자 처우 확인사항"]);
  row(["*총경력 건강보험 자격득실 확인서 기준 (15일 미만 절사) / 인턴기간 제외"]);
  row([]);
  row(["이름", oc.candidate_name, "지원부문", p.applied_field ?? oc.position]);
  row(["총 경력(인정경력)", p.total_career_label ?? "", "출생연도", p.birth_year ?? ""]);
  row(["최종 직장", p.last_company ?? "", "성별", p.gender ?? ""]);
  const rPrev = row(["직전연봉", prev, "입사희망일", p.desired_join_date ?? ""]); // B{rPrev}
  row(["", "", "제안연봉", base]);
  row([]);
  row(["1) 제안 연봉 상세 및 담당자의견"]);
  row(["제안직급", p.proposed_grade ?? ""]);
  row(["제안연봉(기본급)", "제안월급", "직전 대비 인상률(기본급)", "인건비(식대·복지 가산)", "직전 대비 인상률(복지 포함)"]);
  const rDet = row([
    base,
    { f: `A${A.length + 1}/12`, v: monthly },
    { f: `(A${A.length + 1}-B${rPrev})/B${rPrev}`, v: raisePct(prev, base) / 100, z: "0.0%" },
    laborAdd,
    { f: `((A${A.length + 1}+D${A.length + 1})-B${rPrev})/B${rPrev}`, v: raisePct(prev, base + laborAdd) / 100, z: "0.0%" },
  ]);
  // ↑ A.length+1 == rDet (push 전이라 아직 A.length 는 이전 길이)
  row([]);
  row(["[담당자 의견]"]);
  for (const line of (oc.opinion_draft ?? "").split("\n")) row([line]);
  row([]);
  row(["2) 산정내역 (현재 직장 · 1년 환산)"]);
  row(["항목", "월(원)", "1년 환산(원)"]);
  const rBase = row(["기본급", cur.base, { f: `B${A.length + 1}*12`, v: cur.base * 12 }]);
  const rMeal = row(["식대(비과세)", cur.meal, { f: `B${A.length + 1}*12`, v: cur.meal * 12 }]);
  const rJob = row(["직무/직책수당", cur.job, { f: `B${A.length + 1}*12`, v: cur.job * 12 }]);
  const rOt = row(["시간외수당", cur.ot, { f: `B${A.length + 1}*12`, v: cur.ot * 12 }]);
  const rBonus = row(["고정상여", cur.bonus, { f: `B${A.length + 1}`, v: cur.bonus }]);
  const rSum = row([
    "급여 계",
    { f: `B${rBase}+B${rOt}+B${rMeal}`, v: curMonthlySum },
    { f: `SUM(C${rBase}:C${rOt})+C${rBonus}`, v: curAnnualSum },
  ]);
  row([]);
  row(["[기본급 및 복지 비교]"]);
  row(["구분", "연봉(기본급)", "총 연봉(복지포함)"]);
  row(["현재 직장", { f: `B${rSum}*12`, v: curMonthlySum * 12 }, { f: `C${rSum}`, v: curAnnualSum }]);
  row(["제안", { f: `A${rDet}`, v: base }, { f: `A${rDet}+D${rDet}`, v: base + laborAdd }]);
  row([]);
  const rAr1 = row(["AR 복지(가산)", "식대", AR_BENEFITS.meal]);
  row(["", "통신비", AR_BENEFITS.telecom]);
  const rAr3 = row(["", "복지포인트", AR_BENEFITS.welfarePoint]);
  row(["", "계", { f: `SUM(C${rAr1}:C${rAr3})`, v: AR_BENEFIT_TOTAL }]);
  row([]);
  row(["3) 팀원 연봉 현황"]);
  row(["본부", "부서", "직급", "연봉", "경력"]);
  for (const t of teamRows) row([t.division, t.department, t.grade, t.salary, t.career]);

  const ws = XLSX.utils.aoa_to_sheet(
    A.map((r) => r.map((c) => (typeof c === "object" ? "" : c))),
  );
  // 수식 셀 주입
  A.forEach((r, ri) => {
    r.forEach((c, ci) => {
      if (typeof c === "object") {
        const addr = XLSX.utils.encode_cell({ r: ri, c: ci });
        ws[addr] = { t: "n", f: c.f, v: c.v, ...(c.z ? { z: c.z } : {}) };
      }
    });
  });
  ws["!cols"] = [{ wch: 22 }, { wch: 16 }, { wch: 18 }, { wch: 20 }, { wch: 18 }];

  // 경력산정 시트 — 원본과 동일하게 DATEDIF 수식
  const career = (oc.career_rows ?? []) as {
    company: string;
    start: string;
    end: string;
    isIntern?: boolean;
  }[];
  const cAoa: Cell[][] = [["NO", "기업명", "입사일", "퇴사일", "경력(원본 DATEDIF)", "인턴여부"]];
  career.forEach((c, i) => {
    const rr = i + 2; // 엑셀 행 (헤더 다음부터)
    const ds = toSerial(c.start);
    const de = toSerial(c.end);
    cAoa.push([
      i + 1,
      c.company,
      ds != null ? { f: `${ds}`, v: ds, z: "yyyy-mm-dd" } : "",
      de != null ? { f: `${de}`, v: de, z: "yyyy-mm-dd" } : "",
      ds != null && de != null
        ? {
            f: `DATEDIF(C${rr},D${rr},"Y")&"년 "&DATEDIF(C${rr},D${rr},"YM")&"개월 "&DATEDIF(C${rr},D${rr},"MD")&"일"`,
            v: 0,
          }
        : "",
      c.isIntern ? "인턴(제외)" : "",
    ]);
  });
  const cws = XLSX.utils.aoa_to_sheet(
    cAoa.map((r) => r.map((c) => (typeof c === "object" ? "" : c))),
  );
  cAoa.forEach((r, ri) => {
    r.forEach((c, ci) => {
      if (typeof c === "object") {
        const addr = XLSX.utils.encode_cell({ r: ri, c: ci });
        cws[addr] =
          "z" in c && c.z === "yyyy-mm-dd"
            ? { t: "n", v: c.v, z: "yyyy-mm-dd" }
            : { t: "s", f: c.f, v: "" };
      }
    });
  });
  cws["!cols"] = [{ wch: 5 }, { wch: 20 }, { wch: 14 }, { wch: 14 }, { wch: 24 }, { wch: 12 }];

  const wb = XLSX.utils.book_new();
  wb.Workbook = { CalcPr: { fullCalcOnLoad: true } } as never;
  XLSX.utils.book_append_sheet(wb, ws, "처우산정");
  XLSX.utils.book_append_sheet(wb, cws, "경력산정");

  const out = XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
  const blob = new Blob([out], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const b64 = XLSX.write(wb, { type: "base64", bookType: "xlsx" }) as string;
  const safe = (s: string) => s.replace(/[\\/:*?"<>|]/g, "_");
  return {
    blob,
    base64: b64,
    fileName: `처우확인사항_${safe(oc.position)}_${safe(oc.candidate_name)}.xlsx`,
  };
}

/** 팀즈 메신저용 요약 텍스트 (사진 형식) */
export function buildTeamsMessage(oc: OfferCase): string {
  const p = oc.payload ?? {};
  const prev = won(p.prev_salary);
  const base = won(p.proposed_base);
  const pctStr = prev > 0 ? ` (${raisePct(prev, base).toFixed(0)}% 인상)` : "";
  return [
    `[${oc.position}_${oc.candidate_name}]`,
    `처우확인사항_${oc.position}_${oc.candidate_name}.xlsx`,
    "",
    `직전처우: 약 ${(prev / 10000).toLocaleString("ko-KR")}만원`,
    `제안처우: 약 ${(base / 10000).toLocaleString("ko-KR")}만원${pctStr} / ${
      p.proposed_grade ?? ""
    } (경력 ${p.total_career_label ?? "-"})`,
    "",
    (oc.opinion_draft ?? "").split("\n").filter(Boolean).slice(-3).join("\n"),
    "",
    "검토부탁드립니다.",
  ].join("\n");
}
