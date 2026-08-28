import { PageHeader } from "@/components/page-header";
import { UsersAdmin } from "./users-admin";

export const metadata = { title: "사용자 · 권한 · Recruit SaaS" };

export default function RbacPage() {
  return (
    <div className="space-y-5">
      <PageHeader
        title="사용자 · 권한"
        sub="역할 기반 접근 제어 (RBAC) · 관리자만 역할을 변경할 수 있습니다"
        tag="설정"
      />
      <UsersAdmin />
    </div>
  );
}
