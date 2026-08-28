import { notFound } from "next/navigation";
import { NAV_ITEMS, getNavItem } from "@/lib/nav";
import { getCategory } from "@/lib/data-catalog";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export function generateStaticParams() {
  return NAV_ITEMS.map((i) => ({ slug: i.slug }));
}

export const dynamicParams = false;

export default async function AnalysisPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const item = getNavItem(slug);
  if (!item) notFound();

  return (
    <div>
      <PageHeader title={item.title} sub={item.sub} tag={item.tag} />

      {item.predictive ? (
        <div className="mb-4 rounded-lg border border-dashed border-accent-foreground/30 bg-accent/40 px-4 py-3 text-[12.5px] text-accent-foreground">
          이 화면은 예측 분석 화면입니다. 데이터가 충분히 쌓이면 예측 모델이 활성화되며,
          그 전까지는 업로드한 실데이터의 집계 지표만 표시됩니다.
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-[13px]">이 분석에 필요한 데이터</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {item.categories.length === 0 ? (
            <p className="text-[12.5px] text-muted-foreground">
              이 화면은 별도 업로드 없이 다른 화면의 데이터를 종합하거나, 설정 데이터를
              사용합니다.
            </p>
          ) : (
            item.categories.map((key) => {
              const cat = getCategory(key);
              return (
                <div
                  key={key}
                  className="flex items-start justify-between gap-3 rounded-md border bg-muted/40 px-3 py-2"
                >
                  <div>
                    <div className="text-[12.5px] font-bold">
                      {cat?.label ?? key}
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      {cat?.description}
                    </div>
                  </div>
                  <Badge variant="outline" className="shrink-0 text-[10px]">
                    미업로드
                  </Badge>
                </div>
              );
            })
          )}
          <p className="pt-2 text-[11px] text-muted-foreground">
            (양식 다운로드 · 업로드 · 원본 확인/수정/삭제 기능은 다음 단계에서 이 화면에
            추가됩니다.)
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
