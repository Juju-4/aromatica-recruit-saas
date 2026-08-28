import { CategoryDataSection } from "./category-data-section";

/**
 * 분석 화면 상단 — 이 분석에 필요한 데이터 카테고리별 관리 UI.
 */
export function RequiredDataPanel({ categories }: { categories: string[] }) {
  if (categories.length === 0) return null;

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <h2 className="text-[13px] font-extrabold">데이터 관리</h2>
        <span className="text-[11px] text-muted-foreground">
          이 분석에 필요한 데이터를 업로드 · 수정 · 삭제합니다. 변경 사항은 아래
          분석 결과에 실시간 반영됩니다.
        </span>
      </div>
      <div className="space-y-3">
        {categories.map((key) => (
          <CategoryDataSection key={key} categoryKey={key} />
        ))}
      </div>
    </section>
  );
}
