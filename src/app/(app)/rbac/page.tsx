import { PageHeader } from "@/components/page-header";

export const metadata = { title: "사용자 · 권한 · Recruit SaaS" };

export default function RbacPage() {
  return (
    <div className="space-y-5">
      <PageHeader
        title="사용자 · 권한"
        sub="역할 기반 접근 제어 (RBAC)"
        tag="설정"
      />
      <div className="rounded-lg border border-dashed bg-muted/20 px-4 py-10 text-center text-[12.5px] text-muted-foreground">
        사용자 목록 · 역할 변경 · 초대 UI는 다음 단계에서 추가됩니다.
      </div>
    </div>
  );
}
