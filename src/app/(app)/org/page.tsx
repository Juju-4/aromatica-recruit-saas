import { PageHeader } from "@/components/page-header";

export const metadata = { title: "조직 관리 · Recruit SaaS" };

export default function OrgPage() {
  return (
    <div className="space-y-5">
      <PageHeader
        title="조직 관리"
        sub="전사 조직도 · 부서 · 레벨 · 승인 정책 관리"
        tag="설정"
      />
      <div className="rounded-lg border border-dashed bg-muted/20 px-4 py-10 text-center text-[12.5px] text-muted-foreground">
        부서 등록 · 조직도 편집 UI는 다음 단계에서 추가됩니다.
      </div>
    </div>
  );
}
