"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { createClient } from "@/lib/supabase/client";
import { loadActiveRows } from "@/lib/analytics";
import {
  parseChecks,
  byPerson,
  byPhase,
  satisfactionDist,
  onbKpi,
  type CheckRow,
} from "@/lib/onboarding-stats";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";

export function OnboardingTracker() {
  const [rows, setRows] = useState<CheckRow[] | null>(null);

  const load = useCallback(async () => {
    const data = await loadActiveRows(["onboarding_checks"]);
    setRows(parseChecks(data.onboarding_checks ?? []));
  }, []);

  useEffect(() => {
    void load();
    const supabase = createClient();
    const ch = supabase
      .channel("onboarding-tracker")
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

  const people = useMemo(() => (rows ? byPerson(rows) : []), [rows]);
  const phases = useMemo(() => (rows ? byPhase(rows) : []), [rows]);
  const sat = useMemo(() => (rows ? satisfactionDist(rows) : []), [rows]);
  const k = useMemo(() => onbKpi(people), [people]);

  if (rows === null) return <Skeleton className="h-64 w-full" />;
  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-dashed bg-muted/20 px-4 py-10 text-center text-[12.5px] text-muted-foreground">
        <b>온보딩 체크</b> 데이터를 업로드하면 입사자별 진행률·단계별 완료율·만족도
        분석이 표시됩니다. (상단 <b>데이터 업로드</b>)
      </div>
    );
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-2">
        <h2 className="text-[13px] font-extrabold">온보딩 추적</h2>
        <span className="text-[11px] text-muted-foreground">
          D-7 ~ D+90 체크리스트 기준 · 실시간 갱신
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Tile label="온보딩 대상" value={`${k.people}명`} />
        <Tile label="평균 진행률" value={`${k.avgProgress.toFixed(0)}%`} accent />
        <Tile
          label="평균 만족도"
          value={k.avgSatisfaction != null ? `${k.avgSatisfaction.toFixed(1)}점` : "—"}
        />
        <Tile label="멘토 매칭률" value={`${k.mentorRate.toFixed(0)}%`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-[13px]">단계별 완료율</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {phases.map((p) => (
              <div key={p.label} className="grid grid-cols-[70px_1fr_70px] items-center gap-2">
                <span className="text-[11.5px] font-semibold">{p.label}</span>
                <div className="h-5 rounded bg-muted">
                  <div
                    className="h-5 rounded bg-[color:var(--chart-1)]"
                    style={{ width: `${p.rate}%` }}
                  />
                </div>
                <span className="text-[10.5px] text-muted-foreground">
                  {p.done}/{p.total} ({p.rate.toFixed(0)}%)
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-[13px]">만족도 분포</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer
              config={{ value: { label: "건수", color: "var(--chart-1)" } }}
              className="h-48 w-full"
            >
              <BarChart data={sat} margin={{ left: 4, right: 8 }}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
                <YAxis width={26} tickLine={false} axisLine={false} tick={{ fontSize: 10 }} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="value" fill="var(--color-value)" radius={4} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-[13px]">입사자별 진행 현황</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto border-t">
            <table className="w-full text-[12px]">
              <thead className="bg-muted">
                <tr>
                  {["입사자", "입사일", "멘토", "진행률", "만족도"].map((h) => (
                    <th key={h} className="px-3 py-1.5 text-left font-semibold">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {people.map((p) => (
                  <tr key={p.key} className="border-b last:border-0">
                    <td className="px-3 py-1.5 font-medium">{p.name}</td>
                    <td className="px-3 py-1.5 text-muted-foreground">{p.hire_date}</td>
                    <td className="px-3 py-1.5 text-muted-foreground">{p.mentor || "—"}</td>
                    <td className="px-3 py-1.5">
                      <div className="flex items-center gap-1.5">
                        <div className="h-1.5 w-20 overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-[color:var(--chart-1)]"
                            style={{ width: `${p.progress}%` }}
                          />
                        </div>
                        <span className="text-[10.5px] text-muted-foreground">
                          {p.done}/{p.total}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-1.5">
                      {p.satisfaction != null ? `${p.satisfaction.toFixed(1)}점` : "—"}
                    </td>
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
    <div className={`rounded-md border px-3 py-2 ${accent ? "bg-accent/50" : "bg-muted/30"}`}>
      <div className="text-[11px] font-semibold text-muted-foreground">{label}</div>
      <div className={`mt-0.5 text-[15px] font-extrabold tracking-tight ${accent ? "text-accent-foreground" : ""}`}>
        {value}
      </div>
    </div>
  );
}
