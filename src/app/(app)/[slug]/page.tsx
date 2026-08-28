import { notFound } from "next/navigation";
import { NAV_ITEMS, getNavItem } from "@/lib/nav";
import { PageHeader } from "@/components/page-header";
import { RequiredDataPanel } from "@/components/data/required-data-panel";
import { DataSummary } from "@/components/data/data-summary";

/** dataentry / org / rbac 는 전용 라우트 파일이 처리한다. */
const DEDICATED = new Set(["dataentry", "org", "rbac"]);

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

  return (
    <div className="space-y-5">
      <PageHeader title={item.title} sub={item.sub} tag={item.tag} />

      {item.predictive ? (
        <div className="rounded-lg border border-dashed border-accent-foreground/30 bg-accent/40 px-4 py-3 text-[12.5px] text-accent-foreground">
          이 화면은 <b>예측 분석</b> 화면입니다. 데이터가 충분히 쌓이면 예측 모델이
          활성화되며, 그 전까지는 업로드한 실데이터의 집계 지표만 표시됩니다.
        </div>
      ) : null}

      {slug === "summary" ? null : (
        <RequiredDataPanel categories={item.categories} />
      )}

      <DataSummary
        categories={item.categories}
        predictive={item.predictive}
      />
    </div>
  );
}
