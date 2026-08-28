import { getCategory } from "@/lib/data-catalog";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { DatasetManager } from "./dataset-manager";

/**
 * 한 데이터 카테고리에 대한 업로드/원본/수정/삭제 전체 UI를 카드로 감싼다.
 * 분석 화면과 "데이터 입력" 허브에서 공통으로 사용.
 */
export function CategoryDataSection({ categoryKey }: { categoryKey: string }) {
  const cat = getCategory(categoryKey);
  if (!cat) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-[13px]">{cat.label}</CardTitle>
        <CardDescription className="text-[11.5px]">
          {cat.description}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <DatasetManager categoryKey={categoryKey} />
      </CardContent>
    </Card>
  );
}
