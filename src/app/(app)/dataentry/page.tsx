import { PageHeader } from "@/components/page-header";
import { DATA_CATEGORIES } from "@/lib/data-catalog";
import { CategoryDataSection } from "@/components/data/category-data-section";
import { SmartUpload } from "@/components/data/smart-upload";
import { TemplateDownloadButton } from "@/components/data/template-download-button";
import { DataEntryOverview } from "./overview";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata = { title: "데이터 입력 · Recruit SaaS" };

export default function DataEntryPage() {
  return (
    <div className="space-y-5">
      <PageHeader
        title="데이터 입력"
        sub="파일을 올리면 어떤 데이터인지 자동으로 분류합니다. 여러 시트가 있는 엑셀도 한 번에 처리됩니다."
        tag="데이터 관리"
      />

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <div>
            <CardTitle className="text-[13px]">데이터 업로드</CardTitle>
            <p className="mt-1 text-[11.5px] text-muted-foreground">
              엑셀/CSV 파일 하나를 올리면 헤더를 읽고 알맞은 종류로 자동 배정합니다.
              분류 결과는 저장 전에 직접 바꿀 수 있습니다.
            </p>
          </div>
          <SmartUpload />
        </CardHeader>
        <CardContent>
          <div className="text-[11px] font-semibold text-muted-foreground">
            양식이 필요하면 여기서 받으세요
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {DATA_CATEGORIES.map((c) => (
              <TemplateDownloadButton
                key={c.key}
                categoryKey={c.key}
                variant="outline"
                size="xs"
                label={c.label}
              />
            ))}
          </div>
        </CardContent>
      </Card>

      <DataEntryOverview />

      <div>
        <h2 className="mb-2 text-[13px] font-extrabold">종류별 데이터 관리</h2>
        <div className="space-y-3">
          {DATA_CATEGORIES.map((c) => (
            <CategoryDataSection key={c.key} categoryKey={c.key} />
          ))}
        </div>
      </div>
    </div>
  );
}
