"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { TrendingUp, TrendingDown } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { loadActiveRows } from "@/lib/analytics";
import {
  parseSalaryRows,
  computeStats,
  byJobFamily,
  byGrade,
  byTenure,
  computeTrend,
  won,
  type SalaryRow,
} from "@/lib/salary-stats";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, LabelList } from "recharts";
import { BoxPlot } from "./box-plot";
import { OfferEvaluator } from "./offer-evaluator";

export function SalaryAnalytics({
  showOfferEvaluator = false,
}: {
  showOfferEvaluator?: boolean;
}) {
  const [rows, setRows] = useState<SalaryRow[] | null>(null);

  const load = useCallback(async () => {
    const data = await loadActiveRows(["salary"]);
    setRows(parseSalaryRows(data.salary ?? []));
  }, []);

  useEffect(() => {
    void load();
    const supabase = createClient();
    const ch = supabase
      .channel("salary-analytics")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "dataset_rows" },
        () => void load(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "datasets" },
        () => void load(),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
  }, [load]);

  const stats = useMemo(
    () => (rows ? computeStats(rows.map((r) => r.annual_salary)) : null),
    [rows],
  );
  const famStats = useMemo(() => (rows ? byJobFamily(rows) : []), [rows]);
  const gradeStats = useMemo(() => (rows ? byGrade(rows) : []), [rows]);
  const tenureStats = useMemo(() => (rows ? byTenure(rows) : []), [rows]);
  const trend = useMemo(() => (rows ? computeTrend(rows) : null), [rows]);

  if (rows === null) return <Skeleton className="h-64 w-full" />;

  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-dashed bg-muted/20 px-4 py-10 text-center text-[12.5px] text-muted-foreground">
        위 <b>임직원 연봉 데이터</b> 양식을 받아 채운 뒤 업로드하면 연봉 분포·페이밴드·
        인상 동향 분석이 여기에 표시됩니다.
      </div>
    );
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-2">
        <h2 className="text-[13px] font-extrabold">연봉 벤치마크 분석</h2>
        <span className="text-[11px] text-muted-foreground">
          중위연봉(50%ile) 기준 · 연봉 범위 = 25~75%ile(IQR) · 이상치 제외
        </span>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        <Tile label="표본 수" value={`${stats!.n.toLocaleString("ko-KR")}명`} />
        <Tile label="중위연봉" value={won(stats!.median)} accent />
        <Tile label="평균연봉" value={won(stats!.mean)} />
        <Tile label="25%ile" value={won(stats!.p25)} />
        <Tile label="75%ile" value={won(stats!.p75)} />
        <Tile label="연봉 범위(IQR)" value={won(stats!.iqr)} />
      </div>

      {/* Trend */}
      {trend && trend.hasPrev ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-[13px]">
              연봉 인상 동향 · {trend.prevMonth} → {trend.latestMonth}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-baseline gap-3">
              <span className="text-2xl font-extrabold">
                {won(trend.latestMedian)}
              </span>
              <span
                className={`inline-flex items-center gap-1 text-[12px] font-bold ${
                  trend.deltaAmount >= 0 ? "text-[color:var(--good)]" : "text-destructive"
                }`}
              >
                {trend.deltaAmount >= 0 ? (
                  <TrendingUp className="size-3.5" />
                ) : (
                  <TrendingDown className="size-3.5" />
                )}
                {won(Math.abs(trend.deltaAmount))} ({trend.deltaPct >= 0 ? "+" : ""}
                {trend.deltaPct.toFixed(1)}%p)
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
              {trend.byTenure.map((t) => (
                <div
                  key={t.label}
                  className="rounded-md border bg-muted/30 px-3 py-2"
                >
                  <div className="text-[11px] font-semibold text-muted-foreground">
                    {t.label}
                  </div>
                  <div className="text-[13px] font-bold">
                    {won(t.latestMedian)}
                  </div>
                  <div
                    className={`text-[10.5px] font-semibold ${
                      t.deltaPct >= 0 ? "text-[color:var(--good)]" : "text-destructive"
                    }`}
                  >
                    {t.deltaPct >= 0 ? "+" : ""}
                    {t.deltaPct.toFixed(1)}%p
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {/* Box plot by job family */}
      <Card>
        <CardHeader>
          <CardTitle className="text-[13px]">직종별 연봉 분포</CardTitle>
        </CardHeader>
        <CardContent>
          <BoxPlot groups={famStats} />
        </CardContent>
      </Card>

      {/* Pay band by tenure */}
      <Card>
        <CardHeader>
          <CardTitle className="text-[13px]">연차그룹별 페이밴드</CardTitle>
        </CardHeader>
        <CardContent>
          <BoxPlot groups={tenureStats} height={200} />
        </CardContent>
      </Card>

      {/* Median ranking by job family */}
      {famStats.length > 1 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-[13px]">직종별 중위연봉 순위</CardTitle>
          </CardHeader>
          <CardContent>
            <RankBar
              data={famStats.map((g) => ({ label: g.label, value: Math.round(g.median) }))}
            />
          </CardContent>
        </Card>
      ) : null}

      {/* Grade table */}
      {gradeStats.length > 1 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-[13px]">직급별 요약</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto border-t">
              <table className="w-full text-[12px]">
                <thead className="bg-muted">
                  <tr>
                    {["직급", "표본", "25%ile", "중위", "평균", "75%ile"].map((h) => (
                      <th key={h} className="px-3 py-2 text-left font-semibold">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {gradeStats.map((g) => (
                    <tr key={g.key} className="border-b last:border-0">
                      <td className="px-3 py-1.5 font-medium">{g.label}</td>
                      <td className="px-3 py-1.5">{g.n}</td>
                      <td className="px-3 py-1.5">{won(g.p25)}</td>
                      <td className="px-3 py-1.5 font-bold">{won(g.median)}</td>
                      <td className="px-3 py-1.5 text-muted-foreground">
                        {won(g.mean)}
                      </td>
                      <td className="px-3 py-1.5">{won(g.p75)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {showOfferEvaluator ? <OfferEvaluator rows={rows} /> : null}
    </section>
  );
}

function Tile({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-md border px-3 py-2 ${
        accent ? "bg-accent/50" : "bg-muted/30"
      }`}
    >
      <div className="text-[11px] font-semibold text-muted-foreground">
        {label}
      </div>
      <div
        className={`mt-0.5 text-[15px] font-extrabold tracking-tight ${
          accent ? "text-accent-foreground" : ""
        }`}
      >
        {value}
      </div>
    </div>
  );
}

function RankBar({ data }: { data: { label: string; value: number }[] }) {
  const config: ChartConfig = {
    value: { label: "중위연봉(만원)", color: "var(--chart-1)" },
  };
  return (
    <ChartContainer config={config} className="h-64 w-full">
      <BarChart data={data} layout="vertical" margin={{ left: 8, right: 48 }}>
        <CartesianGrid horizontal={false} />
        <XAxis type="number" hide />
        <YAxis
          type="category"
          dataKey="label"
          width={90}
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: 11 }}
        />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Bar dataKey="value" fill="var(--color-value)" radius={4}>
          <LabelList
            dataKey="value"
            position="right"
            className="fill-foreground"
            fontSize={11}
            formatter={(v: React.ReactNode) =>
              Number(v).toLocaleString("ko-KR")
            }
          />
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}
