import { PageHeader } from "@/components/page-header";
import { DATA_CATEGORIES } from "@/lib/data-catalog";
import { CategoryDataSection } from "@/components/data/category-data-section";
import { DataEntryOverview } from "./overview";

export const metadata = { title: "데이터 입력 · Recruit SaaS" };

export default function DataEntryPage() {
  return (
    <div className="space-y-5">
      <PageHeader
        title="데이터 입력"
        sub="재무 · 급여 · 인사 원본 데이터 업로드 및 관리 (전역 허브)"
        tag="데이터 관리"
      />

      <DataEntryOverview />

      <div className="space-y-3">
        {DATA_CATEGORIES.map((c) => (
          <CategoryDataSection key={c.key} categoryKey={c.key} />
        ))}
      </div>
    </div>
  );
}
