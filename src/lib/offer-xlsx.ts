import type { OfferCase } from "@/lib/offer-cases";
import { AR_BENEFITS, AR_BENEFIT_TOTAL, raisePct } from "@/lib/career-calc";

const won = (n: unknown) => {
  const v = Number(n);
  return Number.isFinite(v) ? v : 0;
};

/** 처우확인사항 엑셀 생성 → { blob, base64 } */
export async function buildOfferXlsx(
  oc: OfferCase,
  teamRows: { division: string; department: string; grade: string; salary: number; career: string }[],
): Promise<{ blob: Blob; base64: string; fileName: string }> {
  const XLSX = await import("xlsx");
  const p = oc.payload ?? {};

  const prev = won(p.prev_salary);
  const base = won(p.proposed_base);
  const laborCost = won(p.labor_cost_total) || AR_BENEFIT_TOTAL;
  const curAnnualBase =
    (won(p.cur_base) +
      won(p.cur_meal) +
      won(p.cur_job_allowance) +
      won(p.cur_overtime) +
      won(p.cur_fixed_bonus)) *
    12;

  const A: (string | number)[][] = [
    ["지원자 처우 확인사항"],
    ["*총경력 건강보험 자격득실 확인서 기준 (15일 미만 절사) / 인턴기간 제외"],
    [],
    ["이름", oc.candidate_name, "지원부문", p.applied_field ?? oc.position],
    ["총 경력(인정경력)", p.total_career_label ?? "", "출생연도", p.birth_year ?? ""],
    ["최종 직장", p.last_company ?? "", "성별", p.gender ?? ""],
    ["직전연봉", prev, "입사희망일", p.desired_join_date ?? ""],
    ["", "", "제안연봉", base],
    [],
    ["1) 제안 연봉 상세 및 담당자의견"],
    ["제안직급", p.proposed_grade ?? ""],
    [
      "제안연봉(기본급)",
      "제안월급",
      "직전 대비 인상률(기본급)",
      "인건비(식대·복지 포함)",
      "직전 대비 인상률(복지 포함)",
    ],
    [
      base,
      won(p.proposed_monthly) || Math.round(base / 12),
      `${raisePct(prev, base).toFixed(1)}%`,
      laborCost,
      `${raisePct(prev, base + laborCost).toFixed(1)}%`,
    ],
    [],
    ["[담당자 의견]"],
    ...(oc.opinion_draft ?? "").split("\n").map((l) => [l]),
    [],
    ["2) 산정내역 (현재 직장 · 1년 환산)"],
    ["기본급", won(p.cur_base), won(p.cur_base) * 12],
    ["식대(비과세)", won(p.cur_meal), won(p.cur_meal) * 12],
    ["직무/직책수당", won(p.cur_job_allowance), won(p.cur_job_allowance) * 12],
    ["시간외수당", won(p.cur_overtime), won(p.cur_overtime) * 12],
    ["고정상여", won(p.cur_fixed_bonus), won(p.cur_fixed_bonus) * 12],
    ["급여 계", "", curAnnualBase],
    [],
    ["[기본급 및 복지 비교]"],
    ["구분", "연봉(기본급)", "총 연봉(복지포함)"],
    ["현재 직장", curAnnualBase, curAnnualBase],
    ["제안", base, base + laborCost],
    [],
    ["AR 복지", "식대", AR_BENEFITS.meal],
    ["", "통신비", AR_BENEFITS.telecom],
    ["", "복지포인트", AR_BENEFITS.welfarePoint],
    ["", "계", AR_BENEFIT_TOTAL],
    [],
    ["3) 팀원 연봉 현황"],
    ["본부", "부서", "직급", "연봉", "경력"],
    ...teamRows.map((t) => [t.division, t.department, t.grade, t.salary, t.career]),
  ];

  const ws = XLSX.utils.aoa_to_sheet(A);
  ws["!cols"] = [{ wch: 22 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 18 }];

  const career = (oc.career_rows ?? []) as {
    company: string;
    start: string;
    end: string;
    isIntern?: boolean;
  }[];
  const cAoa: (string | number)[][] = [
    ["NO", "기업명", "입사일", "퇴사일", "인턴여부"],
    ...career.map((c, i) => [
      i + 1,
      c.company,
      c.start,
      c.end,
      c.isIntern ? "인턴(제외)" : "",
    ]),
  ];
  const cws = XLSX.utils.aoa_to_sheet(cAoa);

  const wb = XLSX.utils.book_new();
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
  const pctStr =
    prev > 0 ? ` (${raisePct(prev, base).toFixed(0)}% 인상)` : "";
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
