"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { createClient } from "@/lib/supabase/client";
import { loadActiveRows } from "@/lib/analytics";
import {
  parseApplicants,
  kpi,
  inflow,
  byChannel,
  byPosition,
  byJobFamily,
  hasJobFamily,
  rejectBreakdown,
  funnel,
  stageBreakdown,
  recent,
  pct,
  type Applicant,
} from "@/lib/recruiting-stats";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

export function RecruitingDashboard() {
  const [apps, setApps] = useState<Applicant[] | null>(null);

  const load = useCallback(async () => {
    const data = await loadActiveRows(["recruiting"]);
    setApps(parseApplicants(data.recruiting ?? []));
  }, []);

  useEffect(() => {
    void load();
    const supabase = createClient();
    const ch = supabase
      .channel("recruiting-dash")
      .on("postgres_changes", { event: "*", schema: "public", table: "dataset_rows" }, () => void load())
      .on("postgres_changes", { event: "*", schema: "public", table: "datasets" }, () => void load())
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
  }, [load]);

  const k = useMemo(() => (apps ? kpi(apps) : null), [apps]);
  const flow = useMemo(() => (apps ? inflow(apps, "month") : []), [apps]);
  const chan = useMemo(() => (apps ? byChannel(apps) : []), [apps]);
  const rej = useMemo(() => (apps ? rejectBreakdown(apps) : { mode: "stage" as const, rows: [] }), [apps]);
  const pos = useMemo(() => (apps ? byPosition(apps) : []), [apps]);
  const fam = useMemo(() => (apps ? byJobFamily(apps) : []), [apps]);
  const showFam = useMemo(() => (apps ? hasJobFamily(apps) : false), [apps]);
  const fun = useMemo(() => (apps ? funnel(apps) : []), [apps]);
  const stages = useMemo(() => (apps ? stageBreakdown(apps) : []), [apps]);
  const rec = useMemo(() => (apps ? recent(apps, 12) : []), [apps]);

  if (apps === null) return <Skeleton className="h-64 w-full" />;

  if (apps.length === 0) {
    return (
      <div className="rounded-lg border border-dashed bg-muted/20 px-4 py-10 text-center text-[12.5px] text-muted-foreground">
        <b>채용 · 지원자 데이터</b> 를 업로드하면 지원자 유입·경로별 성과·불합격
        분석·포지션별 퍼널이 여기에 표시됩니다. (우측 상단 <b>데이터 업로드</b>)
      </div>
    );
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-2">
        <h2 className="text-[13px] font-extrabold">지원자 분석</h2>
        <span className="text-[11px] text-muted-foreground">
          업로드된 지원자 데이터 기준 · 실시간 갱신
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <Tile label="총 지원자" value={`${k!.total.toLocaleString("ko-KR")}명`} />
        <Tile label="평가중" value={`${k!.inProgress}명`} />
        <Tile label="합격" value={`${k!.passed}명`} accent />
        <Tile label="불합격" value={`${k!.rejected}명`} />
        <Tile label="합격률" value={pct(k!.passRate)} />
        <Tile
          label="평균 소요일"
          value={k!.avgDaysToHire != null ? `${k!.avgDaysToHire}일` : "—"}
        />
      </div>

      {flow.length > 1 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-[13px]">지원자 유입 추이 (월별)</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer
              config={{ value: { label: "지원자", color: "var(--chart-1)" } }}
              className="h-52 w-full"
            >
              <AreaChart data={flow} margin={{ left: 4, right: 12 }}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 10 }} />
                <YAxis width={28} tickLine={false} axisLine={false} tick={{ fontSize: 10 }} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Area
                  dataKey="value"
                  type="monotone"
                  stroke="var(--color-value)"
                  fill="var(--color-value)"
                  fillOpacity={0.15}
                  strokeWidth={2}
                />
              </AreaChart>
            </ChartContainer>
          </CardContent>
        </Card>
      ) : null}

      {/* 단계별 현황 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-[13px]">전형 단계별 현황</CardTitle>
          <p className="text-[11px] text-muted-foreground">
            현재 단계 기준 인원 · 평가중 / 불합격 / 합격 분해
          </p>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto border-t">
            <table className="w-full text-[12px]">
              <thead className="bg-muted">
                <tr>
                  {["단계", "인원", "평가중", "불합격", "합격"].map((h) => (
                    <th key={h} className="px-3 py-1.5 text-left font-semibold">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {stages.map((s) => (
                  <tr key={s.label} className="border-b last:border-0">
                    <td className="px-3 py-1.5 font-medium">{s.label}</td>
                    <td className="px-3 py-1.5">{s.total}</td>
                    <td className="px-3 py-1.5 text-muted-foreground">{s.inProgress}</td>
                    <td className="px-3 py-1.5 text-destructive">{s.rejected}</td>
                    <td className="px-3 py-1.5 text-[color:var(--good)]">{s.passed}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* 퍼널 */}
      {fun.length > 1 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-[13px]">전형 퍼널 (근사)</CardTitle>
            <p className="text-[11px] text-muted-foreground">
              현재 단계 기준 해당 단계 이상 도달자 수 · 전형 이력이 없으므로 근사치
            </p>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {fun.map((s, i) => {
              const max = fun[0]?.reached || 1;
              return (
                <div key={s.label} className="grid grid-cols-[120px_1fr_130px] items-center gap-2">
                  <span className="truncate text-[11.5px] font-semibold" title={s.label}>
                    {s.label}
                  </span>
                  <div className="h-6 rounded bg-muted">
                    <div
                      className="flex h-6 items-center rounded bg-[color:var(--chart-1)] px-2 text-[11px] font-bold text-white"
                      style={{ width: `${Math.max(6, (s.reached / max) * 100)}%` }}
                    >
                      {s.reached}
                    </div>
                  </div>
                  <span className="text-[10.5px] text-muted-foreground">
                    {i === 0 ? "-" : `전환 ${s.conv.toFixed(0)}% · 이탈 ${s.drop.toFixed(0)}%`}
                  </span>
                </div>
              );
            })}
          </CardContent>
        </Card>
      ) : null}

      {/* 경로별 */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-[13px]">지원 경로별 지원자</CardTitle>
          </CardHeader>
          <CardContent>
            <RankBar data={chan.map((c) => ({ label: c.key, value: c.applied }))} unit="명" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-[13px]">지원 경로별 합격률</CardTitle>
          </CardHeader>
          <CardContent>
            <RankBar
              data={[...chan]
                .filter((c) => c.applied >= 3)
                .sort((a, b) => b.passRate - a.passRate)
                .map((c) => ({ label: c.key, value: Math.round(c.passRate * 10) / 10 }))}
              unit="%"
            />
          </CardContent>
        </Card>
      </div>

      {/* 불합격 분석 */}
      {rej.rows.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-[13px]">
              {rej.mode === "reason" ? "불합격 사유 분포" : "불합격 발생 단계 분포"}
            </CardTitle>
            {rej.mode === "stage" ? (
              <p className="text-[11px] text-muted-foreground">
                불합격 사유 컬럼이 없어, 탈락이 발생한 전형 단계로 집계했습니다.
              </p>
            ) : null}
          </CardHeader>
          <CardContent>
            <RankBar data={rej.rows} unit="명" />
          </CardContent>
        </Card>
      ) : null}

      {/* 포지션별 / 직군별 */}
      <div className="grid gap-4 lg:grid-cols-2">
        <GroupTable title="포지션별 현황" rows={pos} />
        {showFam ? <GroupTable title="직군별 현황" rows={fam} /> : null}
      </div>

      {/* 최근 지원자 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-[13px]">최근 지원자 접수</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto border-t">
            <table className="w-full text-[12px]">
              <thead className="bg-muted">
                <tr>
                  {["지원일", "지원자", "포지션", "경로", "단계", "상태"].map((h) => (
                    <th key={h} className="px-3 py-1.5 text-left font-semibold">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rec.map((a, i) => (
                  <tr key={i} className="border-b last:border-0">
                    <td className="px-3 py-1.5 text-muted-foreground">{a.applied_at}</td>
                    <td className="px-3 py-1.5 font-medium">{a.name}</td>
                    <td className="max-w-52 truncate px-3 py-1.5" title={a.position}>
                      {a.position}
                    </td>
                    <td className="px-3 py-1.5 text-muted-foreground">{a.channel}</td>
                    <td className="px-3 py-1.5">{a.stage || "-"}</td>
                    <td className="px-3 py-1.5">{a.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}

function Tile({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={`rounded-md border px-3 py-2 ${accent ? "bg-accent/50" : "bg-muted/30"}`}>
      <div className="text-[11px] font-semibold text-muted-foreground">{label}</div>
      <div className={`mt-0.5 text-[15px] font-extrabold tracking-tight ${accent ? "text-accent-foreground" : ""}`}>
        {value}
      </div>
    </div>
  );
}

function RankBar({ data, unit }: { data: { label: string; value: number }[]; unit: string }) {
  const config: ChartConfig = { value: { label: unit, color: "var(--chart-1)" } };
  if (data.length === 0)
    return <p className="text-[12px] text-muted-foreground">데이터가 없습니다.</p>;
  return (
    <ChartContainer config={config} className="h-56 w-full">
      <BarChart data={data} layout="vertical" margin={{ left: 8, right: 40 }}>
        <CartesianGrid horizontal={false} />
        <XAxis type="number" hide />
        <YAxis
          type="category"
          dataKey="label"
          width={100}
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: 11 }}
        />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Bar dataKey="value" fill="var(--color-value)" radius={4} />
      </BarChart>
    </ChartContainer>
  );
}

function GroupTable({
  title,
  rows,
}: {
  title: string;
  rows: {
    key: string;
    applied: number;
    passed: number;
    inProgress: number;
    passRate: number;
    avgDaysToHire: number | null;
  }[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-[13px]">{title}</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="max-h-80 overflow-auto border-t">
          <table className="w-full text-[12px]">
            <thead className="sticky top-0 bg-muted">
              <tr>
                {["구분", "지원", "평가중", "합격", "합격률"].map((h) => (
                  <th key={h} className="px-3 py-1.5 text-left font-semibold">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.key} className="border-b last:border-0">
                  <td className="max-w-48 truncate px-3 py-1.5 font-medium" title={r.key}>
                    {r.key}
                  </td>
                  <td className="px-3 py-1.5">{r.applied}</td>
                  <td className="px-3 py-1.5 text-muted-foreground">{r.inProgress}</td>
                  <td className="px-3 py-1.5">{r.passed}</td>
                  <td className="px-3 py-1.5">{r.passRate.toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
