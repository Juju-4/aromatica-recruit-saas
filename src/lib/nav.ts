/**
 * 사이드바 네비게이션 + 페이지 메타데이터 (단일 소스).
 * 목업(legacy-mockup.html)의 19개 화면 + 설정 2개와 동일한 그룹/라벨 구조.
 */

export interface NavItem {
  slug: string;
  title: string;
  sub: string;
  tag?: string;
  /** 이 화면이 필요로 하는 데이터 카테고리 key (data-catalog.ts) */
  categories: string[];
  /** 예측/ML 화면 — v1에서는 "예측 모델 대기" 배지 표시 */
  predictive?: boolean;
  /** 설정 화면 (전용 UI, 공통 데이터 골격 미적용) */
  settings?: boolean;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    label: "종합",
    items: [
      {
        slug: "summary",
        title: "종합 현황",
        sub: "채용 · 보상 · 조직 핵심 지표를 한 화면에서 확인합니다",
        tag: "Executive Summary",
        categories: ["recruiting", "offers", "payroll", "headcount_roster"],
      },
    ],
  },
  {
    label: "채용관리",
    items: [
      {
        slug: "ops",
        title: "채용 현황",
        sub: "포지션 · 공고별 퍼널 & 파이프라인 · 인터뷰 일정을 한 화면에서 관리",
        tag: "Tier 1 · Descriptive",
        categories: ["recruiting"],
      },
      {
        slug: "sourcingfunnel",
        title: "소싱 · 퍼널 분석",
        sub: "전형 퍼널 진단 · 소싱 채널 성과 · 채용 비용/기간 구조",
        tag: "Tier 1-2 · Diagnostic",
        categories: ["recruiting", "sourcing_channels"],
      },
    ],
  },
  {
    label: "보상 · 협상",
    items: [
      {
        slug: "compband",
        title: "보상협상 밴드 분석",
        sub: "임직원 연봉 분포 · 직종/연차별 페이밴드 · 중위연봉 순위 (잡플래닛 방법론)",
        tag: "Tier 3 · Diagnostic",
        categories: ["salary"],
      },
      {
        slug: "offersim",
        title: "오퍼 & 시뮬레이터",
        sub: "연봉 페이밴드 분석 + 처우 적절성 시뮬레이터 (직종·연차·평가등급 → 권장 연봉 범위)",
        tag: "Tier 3 · Prescriptive",
        categories: ["salary"],
      },
    ],
  },
  {
    label: "정착 · 리텐션",
    items: [
      {
        slug: "retention",
        title: "합격자 정착 예측",
        sub: "90일 정착 성공률 예측 (Random Forest)",
        tag: "Tier 3 · Predictive",
        categories: ["recruiting", "onboarding_checks", "hr_eval"],
        predictive: true,
      },
      {
        slug: "onboarding",
        title: "온보딩 추적",
        sub: "D-7 ~ D+90 체크리스트 · 만족도 · 멘토 매칭",
        tag: "Tier 2 · Descriptive",
        categories: ["onboarding_checks"],
      },
    ],
  },
  {
    label: "HR 분석 (Saturn Lab)",
    items: [
      {
        slug: "headcount",
        title: "적정인원 진단",
        sub: "재무제표 · 손익계산서 · 인원현황 · 급여대장 기반 적정 인원 진단",
        tag: "Tier 1",
        categories: ["fin_statements", "payroll", "headcount_roster"],
        predictive: true,
      },
      {
        slug: "paysim",
        title: "임금인상 시뮬레이터",
        sub: "내년도 경영실적 입력 → 적정 인상률 도출 · 3가지 매출 시나리오 비교",
        tag: "Tier 3",
        categories: ["fin_statements", "payroll"],
        predictive: true,
      },
      {
        slug: "invest",
        title: "투자효율 분석",
        sub: "채용 · 교육 · 복지 · 보상 투자 대비 성과 기여도",
        tag: "Tier 1",
        categories: ["fin_statements", "payroll", "hr_eval"],
      },
      {
        slug: "orgeff",
        title: "조직 효율성 진단",
        sub: "관리 Span · 조직 계층 · 부서별 효율성 스코어",
        tag: "Tier 2",
        categories: ["org_chart", "headcount_roster"],
      },
      {
        slug: "jobfit",
        title: "직무-역량 적합도",
        sub: "직원별 보유 역량과 직무 요구 역량 간 매칭 분석",
        tag: "Tier 2",
        categories: ["competency", "headcount_roster"],
      },
      {
        slug: "hipo",
        title: "핵심인재 식별",
        sub: "9-Box 매트릭스 · 성과 × 잠재력 기반 HIPO 식별",
        tag: "Tier 2",
        categories: ["hr_eval", "competency"],
      },
      {
        slug: "churn",
        title: "이탈 예측",
        sub: "재직자 대상 이직 위험도 예측",
        tag: "Tier 3 · Predictive",
        categories: ["hr_eval", "payroll", "attendance", "surveys"],
        predictive: true,
      },
      {
        slug: "conflict",
        title: "갈등 리스크 분석",
        sub: "팀별 갈등 지수 · 유형 분포 · 조정 현황",
        tag: "Tier 2",
        categories: ["surveys", "org_chart"],
      },
      {
        slug: "labor",
        title: "노무 적합도 진단",
        sub: "근로기준법 등 노동관계법령 컴플라이언스 체크",
        tag: "노무",
        categories: ["attendance", "payroll"],
      },
      {
        slug: "dataentry",
        title: "데이터 입력",
        sub: "재무 · 급여 · 인사 원본 데이터 업로드 및 관리 (전역 허브)",
        tag: "데이터 관리",
        categories: [],
      },
    ],
  },
  {
    label: "설정",
    items: [
      {
        slug: "org",
        title: "조직 관리",
        sub: "전사 조직도 · 부서 · 레벨 · 승인 정책 관리",
        tag: "설정",
        categories: [],
        settings: true,
      },
      {
        slug: "rbac",
        title: "사용자 · 권한",
        sub: "역할 기반 접근 제어 (RBAC)",
        tag: "설정",
        categories: [],
        settings: true,
      },
    ],
  },
];

export const NAV_ITEMS: NavItem[] = NAV_GROUPS.flatMap((g) => g.items);

export const NAV_MAP: Record<string, NavItem> = Object.fromEntries(
  NAV_ITEMS.map((i) => [i.slug, i]),
);

export function getNavItem(slug: string): NavItem | undefined {
  return NAV_MAP[slug];
}
