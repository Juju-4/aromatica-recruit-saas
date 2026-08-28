import { PageHeader } from "@/components/page-header";
import { DepartmentsAdmin } from "./departments-admin";

export const metadata = { title: "조직 관리 · Recruit SaaS" };

export default function OrgPage() {
  return (
    <div className="space-y-5">
      <PageHeader
        title="조직 관리"
        sub="전사 부서 · 부서장 · 레벨 · 채용 승인 정책 관리 (관리자 전용 편집)"
        tag="설정"
      />
      <DepartmentsAdmin />
    </div>
  );
}
