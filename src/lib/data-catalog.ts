/**
 * 데이터 카탈로그 — 단일 소스.
 * 각 분석에 필요한 "엑셀 양식"의 컬럼 정의이며, 아래 3곳에서 함께 사용된다:
 *   1) 다운로드용 .xlsx 양식 생성 (헤더 + 예시행 + 작성안내)
 *   2) 업로드 파일 검증 (필수 컬럼 존재 여부)
 *   3) 원본 데이터 그리드의 컬럼 렌더링
 */

export type ColumnType = "text" | "number" | "date" | "select";

export interface CatalogColumn {
  key: string;
  label: string;
  type: ColumnType;
  example: string | number;
  required?: boolean;
  help?: string;
}

export interface DataCategory {
  key: string;
  label: string;
  description: string;
  columns: CatalogColumn[];
}

export const DATA_CATEGORIES: DataCategory[] = [
  {
    key: "fin_statements",
    label: "재무제표 · 손익계산서",
    description: "매출·영업이익·인건비 등 경영 지표. 적정인원·임금인상·투자효율 분석의 기준 데이터.",
    columns: [
      { key: "account", label: "계정명", type: "text", example: "매출액", required: true },
      { key: "amount_current", label: "당기금액(천원)", type: "number", example: 2487000, required: true },
      { key: "amount_prev", label: "전기금액(천원)", type: "number", example: 1731000 },
      { key: "period", label: "기준연월", type: "text", example: "2026-06", required: true },
      { key: "note", label: "비고", type: "text", example: "" },
    ],
  },
  {
    key: "payroll",
    label: "급여대장",
    description: "사번별 급여 구성. 보상밴드·임금인상·인건비율 분석에 사용.",
    columns: [
      { key: "emp_no", label: "사번", type: "text", example: "A-0101", required: true },
      { key: "name", label: "성명", type: "text", example: "김서연", required: true },
      { key: "dept", label: "부서", type: "text", example: "인사팀", required: true },
      { key: "grade", label: "직급", type: "text", example: "L3" },
      { key: "base_pay", label: "기본급(천원)", type: "number", example: 4200, required: true },
      { key: "fixed_allow", label: "고정수당(천원)", type: "number", example: 300 },
      { key: "bonus", label: "상여(천원)", type: "number", example: 0 },
      { key: "employer_insurance", label: "4대보험 회사부담(천원)", type: "number", example: 410 },
      { key: "pay_month", label: "지급월", type: "text", example: "2026-07", required: true },
    ],
  },
  {
    key: "headcount_roster",
    label: "인원현황",
    description: "재직·입퇴사 명부. 조직 효율성·적정인원·직무적합도 분석의 인원 기준.",
    columns: [
      { key: "emp_no", label: "사번", type: "text", example: "A-0101", required: true },
      { key: "name", label: "성명", type: "text", example: "박준호", required: true },
      { key: "dept", label: "부서", type: "text", example: "개발팀", required: true },
      { key: "grade", label: "직급", type: "text", example: "L5" },
      { key: "emp_type", label: "고용형태", type: "select", example: "정규직" },
      { key: "hire_date", label: "입사일", type: "date", example: "2023-03-02", required: true },
      { key: "leave_date", label: "퇴사일", type: "date", example: "" },
      { key: "status", label: "재직상태", type: "select", example: "재직" },
    ],
  },
  {
    key: "hr_eval",
    label: "인사평가",
    description: "성과·역량 평가 결과. 핵심인재 식별·이탈 예측·투자효율 분석에 사용.",
    columns: [
      { key: "emp_no", label: "사번", type: "text", example: "A-0101", required: true },
      { key: "name", label: "성명", type: "text", example: "박준호", required: true },
      { key: "dept", label: "부서", type: "text", example: "개발팀" },
      { key: "period", label: "평가기간", type: "text", example: "2026-H1", required: true },
      { key: "perf_grade", label: "성과등급", type: "select", example: "A" },
      { key: "potential_grade", label: "잠재력등급", type: "select", example: "B" },
      { key: "score", label: "종합점수", type: "number", example: 87 },
      { key: "evaluator", label: "평가자", type: "text", example: "정다은" },
    ],
  },
  {
    key: "recruiting",
    label: "채용 · 전형기록",
    description: "지원자별 전형 단계 이력. 채용현황·퍼널·소싱 분석의 핵심 데이터.",
    columns: [
      { key: "applicant_id", label: "지원자ID", type: "text", example: "R-2026-0142", required: true },
      { key: "name", label: "이름", type: "text", example: "이도현", required: true },
      { key: "position", label: "포지션", type: "text", example: "백엔드 개발자", required: true },
      { key: "dept", label: "부서", type: "text", example: "개발팀" },
      { key: "channel", label: "소싱채널", type: "text", example: "내부 추천" },
      { key: "applied_at", label: "지원일", type: "date", example: "2026-07-15", required: true },
      { key: "stage", label: "현재단계", type: "select", example: "1차 면접", required: true },
      { key: "status", label: "상태", type: "select", example: "진행중" },
      { key: "stage_changed_at", label: "단계변경일", type: "date", example: "2026-08-01" },
    ],
  },
  {
    key: "sourcing_channels",
    label: "소싱 채널",
    description: "채널별 계약·비용·성과. 소싱 채널 ROI/Yield 분석에 사용.",
    columns: [
      { key: "channel", label: "채널명", type: "text", example: "내부 추천(Referral)", required: true },
      { key: "type", label: "유형", type: "text", example: "무료·상시" },
      { key: "monthly_cost", label: "월 비용(원)", type: "number", example: 2000000 },
      { key: "contract_end", label: "계약 만료", type: "text", example: "2027-01" },
      { key: "integration", label: "연동상태", type: "select", example: "연동됨" },
      { key: "applicants", label: "지원자수", type: "number", example: 210, required: true },
      { key: "hires", label: "합격자수", type: "number", example: 26, required: true },
    ],
  },
  {
    key: "offers",
    label: "오퍼 · 보상",
    description: "후보자별 오퍼 구성(Base/Incentive/Stock/RSU/Sign-on). 보상밴드·오퍼 시뮬레이터에 사용.",
    columns: [
      { key: "candidate", label: "후보자", type: "text", example: "이도현", required: true },
      { key: "position", label: "포지션", type: "text", example: "백엔드 개발자", required: true },
      { key: "job_family", label: "직군", type: "text", example: "개발" },
      { key: "grade", label: "직급", type: "text", example: "L4" },
      { key: "base", label: "Base(천원)", type: "number", example: 6200, required: true },
      { key: "incentive", label: "인센티브(천원)", type: "number", example: 600 },
      { key: "stock", label: "Stock(천원)", type: "number", example: 0 },
      { key: "rsu", label: "RSU(천원)", type: "number", example: 0 },
      { key: "sign_on", label: "Sign-on(천원)", type: "number", example: 500 },
      { key: "offer_status", label: "오퍼상태", type: "select", example: "협상중" },
      { key: "offer_date", label: "오퍼일", type: "date", example: "2026-08-10" },
    ],
  },
  {
    key: "org_chart",
    label: "조직도 · 부서",
    description: "부서 계층·부서장·인원·승인정책. 조직 관리 및 조직 효율성 분석에 사용.",
    columns: [
      { key: "dept", label: "부서", type: "text", example: "개발팀", required: true },
      { key: "parent_dept", label: "상위부서", type: "text", example: "한국사업본부" },
      { key: "head", label: "부서장", type: "text", example: "박준호" },
      { key: "headcount", label: "인원수", type: "number", example: 11 },
      { key: "level_scheme", label: "레벨체계", type: "text", example: "L1~L6" },
      { key: "approval_policy", label: "채용 승인 정책", type: "text", example: "HM → CTO 2단계 승인" },
    ],
  },
  {
    key: "competency",
    label: "역량 진단",
    description: "직원별 직무 요구역량 대비 보유역량. 직무-역량 적합도·핵심인재 분석에 사용.",
    columns: [
      { key: "emp_no", label: "사번", type: "text", example: "A-0101", required: true },
      { key: "name", label: "성명", type: "text", example: "박준호", required: true },
      { key: "job", label: "직무", type: "text", example: "백엔드 개발", required: true },
      { key: "competency", label: "역량명", type: "text", example: "시스템 설계", required: true },
      { key: "required_level", label: "요구수준(1-5)", type: "number", example: 4, required: true },
      { key: "current_level", label: "보유수준(1-5)", type: "number", example: 3, required: true },
    ],
  },
  {
    key: "onboarding_checks",
    label: "온보딩 체크",
    description: "입사자별 D-7~D+90 체크리스트·만족도·멘토. 온보딩 추적·정착 예측에 사용.",
    columns: [
      { key: "emp_no", label: "사번", type: "text", example: "A-0210", required: true },
      { key: "name", label: "성명", type: "text", example: "최유진", required: true },
      { key: "hire_date", label: "입사일", type: "date", example: "2026-08-01", required: true },
      { key: "check_item", label: "체크항목", type: "text", example: "장비 지급", required: true },
      { key: "phase", label: "단계", type: "select", example: "D-7" },
      { key: "done", label: "완료여부", type: "select", example: "완료" },
      { key: "satisfaction", label: "만족도(1-5)", type: "number", example: 4 },
      { key: "mentor", label: "멘토", type: "text", example: "박준호" },
    ],
  },
  {
    key: "surveys",
    label: "이직 · 재직 서베이",
    description: "몰입도·이직의향·갈등경험 설문. 이탈 예측·갈등 리스크 분석에 사용.",
    columns: [
      { key: "emp_ref", label: "사번(익명 가능)", type: "text", example: "A-0101" },
      { key: "dept", label: "부서", type: "text", example: "영업팀", required: true },
      { key: "survey_date", label: "설문일", type: "date", example: "2026-08-01", required: true },
      { key: "engagement", label: "몰입도(1-5)", type: "number", example: 3, required: true },
      { key: "turnover_intent", label: "이직의향(1-5)", type: "number", example: 4, required: true },
      { key: "conflict_exp", label: "갈등경험(1-5)", type: "number", example: 2 },
      { key: "comment", label: "코멘트", type: "text", example: "" },
    ],
  },
  {
    key: "attendance",
    label: "근태",
    description: "사번별 월 근로시간·연차. 노무 적합도 진단·이탈 예측에 사용.",
    columns: [
      { key: "emp_no", label: "사번", type: "text", example: "A-0101", required: true },
      { key: "name", label: "성명", type: "text", example: "김서연", required: true },
      { key: "dept", label: "부서", type: "text", example: "인사팀" },
      { key: "period", label: "기준월", type: "text", example: "2026-07", required: true },
      { key: "contract_hours", label: "소정근로시간", type: "number", example: 174, required: true },
      { key: "overtime_hours", label: "연장근로시간", type: "number", example: 12 },
      { key: "night_hours", label: "야간근로시간", type: "number", example: 0 },
      { key: "holiday_hours", label: "휴일근로시간", type: "number", example: 0 },
      { key: "annual_leave_used", label: "연차사용일", type: "number", example: 1.5 },
    ],
  },
];

export const CATEGORY_MAP: Record<string, DataCategory> = Object.fromEntries(
  DATA_CATEGORIES.map((c) => [c.key, c]),
);

export function getCategory(key: string): DataCategory | undefined {
  return CATEGORY_MAP[key];
}
