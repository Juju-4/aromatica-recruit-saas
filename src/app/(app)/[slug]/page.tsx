import { notFound } from "next/navigation";
import { NAV_ITEMS, getNavItem } from "@/lib/nav";
import { PageHeader } from "@/components/page-header";
import { RequiredDataPanel } from "@/components/data/required-data-panel";
import { DataSummary } from "@/components/data/data-summary";
import { SmartUpload } from "@/components/data/smart-upload";
import { SalaryAnalytics } from "@/components/salary/salary-analytics";
import { SourcingFunnelDashboard } from "@/components/recruiting/sourcing-funnel-dashboard";
import { OnboardingTracker } from "@/components/retention/onboarding-tracker";
import { RetentionAnalysis } from "@/components/retention/retention-analysis";
import { OfferWorkflow } from "@/components/offer/offer-workflow";

/** 고도화된 화면 — 단일 스마트 업로드 + 전용 분석 컴포넌트 (카테고리별 업로드 카드 없음) */
const CUSTOM_ANALYSIS: Record<string, React.ReactNode> = {
  compband: <SalaryAnalytics />,
  offersim: (
    <div className="space-y-6">
      <OfferWorkflow />
      <SalaryAnalytics showOfferEvaluator />
    </div>
  ),
  sourcingfunnel: <SourcingFunnelDashboard />,
  onboarding: <OnboardingTracker />,
  retention: <RetentionAnalysis />,
};

/** 전용 라우트 파일이 처리하는 slug */
const DEDICATED = new Set(["dataentry", "org", "rbac", "ops"]);

export function generateStaticParams() {
  return NAV_ITEMS.filter((i) => !DEDICATED.has(i.slug)).map((i) => ({
    slug: i.slug,
  }));
}

export default async function AnalysisPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const item = getNavItem(slug);
  if (!item || DEDICATED.has(slug)) notFound();

  const custom = CUSTOM_ANALYSIS[slug];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageHeader title={item.title} sub={item.sub} tag={item.tag} />
        {custom ? <SmartUpload /> : null}
      </div>

      {item.predictive && !custom ? (
        <div className="rounded-lg border border-dashed border-accent-foreground/30 bg-accent/40 px-4 py-3 text-[12.5px] text-accent-foreground">
          이 화면은 <b>예측 분석</b> 화면입니다. 데이터가 충분히 쌓이면 예측 모델이
          활성화되며, 그 전까지는 업로드한 실데이터의 집계 지표만 표시됩니다.
        </div>
      ) : null}

      {custom ?? (
        <>
          {slug === "summary" ? null : (
            <RequiredDataPanel categories={item.categories} />
          )}
          <DataSummary categories={item.categories} predictive={item.predictive} />
        </>
      )}
    </div>
  );
}
