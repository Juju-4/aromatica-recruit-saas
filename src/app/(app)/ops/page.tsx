import { PageHeader } from "@/components/page-header";
import { SmartUpload } from "@/components/data/smart-upload";
import { PositionsTable } from "@/components/recruiting/positions-table";
import { RecruitingDashboard } from "@/components/recruiting/recruiting-dashboard";

export const metadata = { title: "채용 현황 · Recruit SaaS" };

export default function OpsPage() {
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageHeader
          title="채용 현황"
          sub="채용 중인 포지션·TO 관리 + 지원자 현황·유입·단계별 진행 (진단·비용 분석은 소싱·퍼널 화면)"
          tag="Tier 1 · Descriptive"
        />
        <SmartUpload />
      </div>

      <PositionsTable />
      <RecruitingDashboard />
    </div>
  );
}
