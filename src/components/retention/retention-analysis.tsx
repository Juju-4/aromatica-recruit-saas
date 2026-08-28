"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { loadActiveRows } from "@/lib/analytics";
import { parseChecks, byPerson } from "@/lib/onboarding-stats";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

type Raw = Record<string, unknown>;
const s = (v: unknown) => (v == null ? "" : String(v).trim());
function daysBetween(a: string, b: string): number | null {
  const da = Date.parse(a);
  const db = Date.parse(b);
  if (Number.isNaN(da) || Number.isNaN(db)) return null;
  return Math.round((db - da) / 86400000);
}

interface Hire {
  name: string;
  position: string;
  job_family: string;
  joined_at: string;
  cohort: string;
  retained90: boolean | null; // null = 판정 불가(아직 90일 미만 등)
  earlyAttrition: boolean;
  onbProgress: number | null;
  satisfaction: number | null;
}

export function RetentionAnalysis() {
  const [data, setData] = useState<Record<string, Raw[]> | null>(null);

  const load = useCallback(async () => {
    setData(
      await loadActiveRows(["recruiting", "onboarding_checks", "headcount_roster"]),
    );
  }, []);

  useEffect(() => {
    void load();
    const supabase = createClient();
    const ch = supabase
      .channel("retention")
      .on("postgres_changes", { event: "*", schema: "public", table: "dataset_rows" }, () => void load())
      .on("postgres_changes", { event: "*", schema: "public", table: "datasets" }, () => void load())
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
  }, [load]);

  const hires = useMemo<Hire[]>(() => {
    if (!data) return [];
    const recruiting = data.recruiting ?? [];
    const roster = data.headcount_roster ?? [];
    const checks = parseChecks(data.onboarding_checks ?? []);
    const persons = byPerson(checks);
    const personByName = new Map(persons.map((p) => [p.name, p]));

    const rosterByName = new Map(
      roster.map((r) => [
        s(r.name),
        { status: s(r.status), leave_date: s(r.leave_date), hire_date: s(r.hire_date) },
      ]),
    );

    const today = new Date().toISOString().slice(0, 10);

    return recruiting
      .map((r) => {
        const joined = s(r.joined_at);
        if (!joined) return null;
        const name = s(r.name);
        const rr = rosterByName.get(name);
        const pp = personByName.get(name);
        const ageDays = daysBetween(joined, today) ?? 0;

        let retained90: boolean | null = null;
        let early = false;
        if (rr) {
          if (rr.leave_date) {
            const tenure = daysBetween(rr.hire_date || joined, rr.leave_date);
            if (tenure != null && tenure <= 90) {
              retained90 = false;
              early = true;
            } else {
              retained90 = true;
            }
          } else if (/재직|active/i.test(rr.status) || rr.status === "") {
            retained90 = ageDays >= 90 ? true : null;
          }
        } else if (ageDays >= 90 && pp) {
          // roster 없고 온보딩만 있을 때: 진행률로 근사
          retained90 = pp.progress >= 50 ? true : null;
        }

        return {
          name,
          position: s(r.position),
          job_family: s(r.job_family) || "(미분류)",
          joined_at: joined,
          cohort: joined.slice(0, 7),
          retained90,
          earlyAttrition: early,
          onbProgress: pp?.progress ?? null,
          satisfaction: pp?.satisfaction ?? null,
        } as Hire;
      })
      .filter((h): h is Hire => h != null)
      .sort((a, b) => b.joined_at.localeCompare(a.joined_at));
  }, [data]);

  if (data === null) return <Skeleton className="h-64 w-full" />;

  if (hires.length === 0) {
    return (
      <div className="rounded-lg border border-dashed bg-muted/20 px-4 py-10 text-center text-[12.5px] text-muted-foreground">
        <b>채용 · 지원자 데이터</b>(입사일 포함)와 <b>온보딩 체크</b> / <b>인원현황</b>
        을 업로드하면 신규 입사자의 90일 정착률 코호트 분석이 표시됩니다.
      </div>
    );
  }

  const cohorts = new Map<string, Hire[]>();
  for (const h of hires) {
    (cohorts.get(h.cohort) ?? cohorts.set(h.cohort, []).get(h.cohort)!).push(h);
  }
  const cohortRows = [...cohorts.entries()]
    .map(([cohort, list]) => {
      const judged = list.filter((h) => h.retained90 != null);
      const retained = judged.filter((h) => h.retained90).length;
      return {
        cohort,
        total: list.length,
        judged: judged.length,
        retained,
        rate: judged.length ? (retained / judged.length) * 100 : null,
      };
    })
    .sort((a, b) => b.cohort.localeCompare(a.cohort));

  const totalJudged = hires.filter((h) => h.retained90 != null);
  const overallRate = totalJudged.length
    ? (totalJudged.filter((h) => h.retained90).length / totalJudged.length) * 100
    : null;
  const early = hires.filter((h) => h.earlyAttrition).length;

  const watch = hires.filter(
    (h) =>
      h.retained90 == null &&
      ((h.onbProgress != null && h.onbProgress < 40) ||
        (h.satisfaction != null && h.satisfaction <= 2.5)),
  );

  return (
    <section className="space-y-4">
      <div className="rounded-md border border-dashed border-accent-foreground/30 bg-accent/30 px-3 py-2 text-[11.5px] text-accent-foreground">
        아래는 실데이터 기반 <b>90일 정착 코호트 집계</b>입니다. 개인별 정착 확률
        예측 모델은 입사 코호트가 더 쌓이면 활성화됩니다.
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Tile
          label="전체 90일 정착률"
          value={overallRate != null ? `${overallRate.toFixed(0)}%` : "판정 대기"}
          accent
        />
        <Tile label="판정 가능 인원" value={`${totalJudged.length}명`} />
        <Tile label="90일 내 조기 이탈" value={`${early}명`} />
        <Tile label="관찰 필요" value={`${watch.length}명`} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-[13px]">입사 코호트별 90일 정착률</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto border-t">
            <table className="w-full text-[12px]">
              <thead className="bg-muted">
                <tr>
                  {["입사월", "입사자", "판정가능", "정착", "정착률"].map((h) => (
                    <th key={h} className="px-3 py-1.5 text-left font-semibold">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {cohortRows.map((c) => (
                  <tr key={c.cohort} className="border-b last:border-0">
                    <td className="px-3 py-1.5 font-medium">{c.cohort}</td>
                    <td className="px-3 py-1.5">{c.total}</td>
                    <td className="px-3 py-1.5 text-muted-foreground">{c.judged}</td>
                    <td className="px-3 py-1.5">{c.retained}</td>
                    <td className="px-3 py-1.5 font-bold">
                      {c.rate != null ? `${c.rate.toFixed(0)}%` : "판정 대기"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {watch.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-[13px]">관찰 필요 입사자</CardTitle>
            <p className="text-[11px] text-muted-foreground">
              온보딩 진행률 40% 미만 또는 만족도 2.5점 이하 · 아직 90일 미도달
            </p>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto border-t">
              <table className="w-full text-[12px]">
                <thead className="bg-muted">
                  <tr>
                    {["입사자", "포지션", "입사일", "온보딩 진행률", "만족도"].map((h) => (
                      <th key={h} className="px-3 py-1.5 text-left font-semibold">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {watch.map((h, i) => (
                    <tr key={i} className="border-b last:border-0">
                      <td className="px-3 py-1.5 font-medium">{h.name}</td>
                      <td className="px-3 py-1.5">{h.position}</td>
                      <td className="px-3 py-1.5 text-muted-foreground">{h.joined_at}</td>
                      <td className="px-3 py-1.5">
                        {h.onbProgress != null ? `${h.onbProgress.toFixed(0)}%` : "—"}
                      </td>
                      <td className="px-3 py-1.5">
                        {h.satisfaction != null ? (
                          <Badge variant="outline" className="text-[10px] text-destructive">
                            {h.satisfaction.toFixed(1)}점
                          </Badge>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      ) : null}
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
