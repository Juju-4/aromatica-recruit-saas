"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, LabelList } from "recharts";
import { createClient } from "@/lib/supabase/client";
import { loadActiveRows } from "@/lib/analytics";
import { parseApplicants, kpi, type Applicant } from "@/lib/recruiting-stats";
import {
  parseChannelMeta,
  channelPerformance,
  overallFunnel,
  positionStageMatrix,
  FUNNEL_LABELS,
  dropoffBreakdown,
  costTimeToHire,
  wonM,
} from "@/lib/sourcing-stats";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

const BENEFIT_KEY = "recruitsaas.channel_benefit_manwon";

export function SourcingFunnelDashboard() {
  const [data, setData] = useState<Record<string, Record<string, unknown>[]> | null>(null);
  const [benefit, setBenefit] = useState(3000);

  useEffect(() => {
    try {
      const v = Number(localStorage.getItem(BENEFIT_KEY));
      if (v > 0) setBenefit(v);
    } catch {}
  }, []);

  const load = useCallback(async () => {
    setData(await loadActiveRows(["recruiting", "sourcing_channels"]));
  }, []);

  useEffect(() => {
    void load();
    const supabase = createClient();
    const ch = supabase
      .channel("sourcing-dash")
      .on("postgres_changes", { event: "*", schema: "public", table: "dataset_rows" }, () => void load())
      .on("postgres_changes", { event: "*", schema: "public", table: "datasets" }, () => void load())
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
  }, [load]);

  const apps = useMemo<Applicant[]>(
    () => (data ? parseApplicants(data.recruiting ?? []) : []),
    [data],
  );
  const meta = useMemo(
    () => parseChannelMeta(data?.sourcing_channels ?? []),
    [data],
  );
  const k = useMemo(() => kpi(apps), [apps]);
  const fun = useMemo(() => overallFunnel(apps), [apps]);
  const matrix = useMemo(() => positionStageMatrix(apps), [apps]);
  const drop = useMemo(() => dropoffBreakdown(apps), [apps]);
  const chan = useMemo(
    () => channelPerformance(apps, meta, benefit),
    [apps, meta, benefit],
  );
  const ct = useMemo(() => costTimeToHire(apps, meta), [apps, meta]);

  if (data === null) return <Skeleton className="h-64 w-full" />;

  if (apps.length === 0) {
    return (
      <div className="rounded-lg border border-dashed bg-muted/20 px-4 py-10 text-center text-[12.5px] text-muted-foreground">
        <b>채용 · 지원자 데이터</b> 를 업로드하면 전형 퍼널·Drop-off 진단이 표시됩니다.
        <br />
        <b>소싱 채널</b> 데이터(월 비용·계약·연동)를 추가로 올리면 채널 ROI·Yield·
        Cost per Hire 분석까지 켜집니다.
      </div>
    );
  }

  const hasChannelMeta = meta.size > 0;

  return (
    <div className="space-y-6">
      {/* ───────── ① 퍼널 개요 ───────── */}
      <Section n={1} title="퍼널 개요" sub="전사 전형 단계별 전환 · Drop-off" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Tile label="총 지원자" value={`${k.total.toLocaleString("ko-KR")}명`} />
        <Tile
          label="1차 통과율"
          value={fun[1] ? `${fun[1].conv.toFixed(1)}%` : "—"}
        />
        <Tile
          label="합격률"
          value={`${k.passRate.toFixed(1)}%`}
          accent
        />
        <Tile
          label="평균 결과 소요일"
          value={ct.avgTimeToResult != null ? `${ct.avgTimeToResult}일` : "—"}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-[13px]">단계별 전환 퍼널 (전사)</CardTitle>
          <p className="text-[11px] text-muted-foreground">
            현재 단계 기준 해당 단계 이상 도달자 수 · 전형 이력이 없어 근사치입니다
          </p>
        </CardHeader>
        <CardContent className="space-y-1.5">
          {fun.map((s, i) => {
            const max = fun[0]?.reached || 1;
            const hi = s.label === "지원" || s.label === "오퍼" || s.label === "합격";
            return (
              <div key={s.label} className="grid grid-cols-[80px_1fr_150px] items-center gap-2">
                <span className="text-[11.5px] font-semibold">{s.label}</span>
                <div className="h-6 rounded bg-muted">
                  <div
                    className={`flex h-6 items-center rounded px-2 text-[11px] font-bold text-white ${
                      hi ? "bg-[color:var(--chart-2)]" : "bg-[color:var(--chart-3)]"
                    }`}
                    style={{ width: `${Math.max(5, (s.reached / max) * 100)}%` }}
                  >
                    {s.reached.toLocaleString("ko-KR")}명
                  </div>
                </div>
                <span className="text-right text-[10.5px] text-muted-foreground">
                  {i === 0 ? "100.0%" : `${s.conv.toFixed(1)}%`}
                  {i > 0 ? (
                    <span className="ml-2 text-destructive">-{s.drop.toFixed(1)}%</span>
                  ) : null}
                </span>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-[13px]">
              {drop.mode === "reason" ? "Drop-off 사유 분포" : "Drop-off 발생 단계 분포"}
            </CardTitle>
            <p className="text-[11px] text-muted-foreground">
              {drop.mode === "reason"
                ? "단계 이탈 시 기록된 주요 사유"
                : "불합격 사유 컬럼이 없어 탈락이 발생한 단계로 집계"}
            </p>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {drop.rows.slice(0, 8).map((r) => (
              <div key={r.label} className="flex items-center justify-between text-[12px]">
                <span className="flex items-center gap-2">
                  <span className="inline-block size-2 rounded-full bg-[color:var(--chart-3)]" />
                  {r.label}
                </span>
                <span className="font-mono font-bold">
                  {r.value}명 · {r.pct.toFixed(0)}%
                </span>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-[13px]">단계별 전환율</CardTitle>
            <p className="text-[11px] text-muted-foreground">직전 단계 대비 통과 비율</p>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {fun.slice(1).map((s) => (
              <div key={s.label} className="grid grid-cols-[70px_1fr_44px] items-center gap-2">
                <span className="text-[11.5px] font-semibold">{s.label}</span>
                <div className="h-3.5 rounded bg-muted">
                  <div
                    className="h-3.5 rounded bg-[color:var(--chart-2)]"
                    style={{ width: `${Math.min(100, s.conv)}%` }}
                  />
                </div>
                <span className="text-right font-mono text-[11px] font-bold">
                  {s.conv.toFixed(0)}%
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-[13px]">포지션 × 단계 전환 테이블</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="max-h-96 overflow-auto border-t">
            <table className="w-full text-[12px]">
              <thead className="sticky top-0 bg-muted">
                <tr>
                  <th className="px-3 py-1.5 text-left font-semibold">포지션</th>
                  {FUNNEL_LABELS.map((l) => (
                    <th key={l} className="px-2 py-1.5 text-right font-semibold">
                      {l}
                    </th>
                  ))}
                  <th className="px-3 py-1.5 text-right font-semibold">최종 전환율</th>
                </tr>
              </thead>
              <tbody>
                {matrix.map((row) => (
                  <tr key={row.position} className="border-b last:border-0">
                    <td className="max-w-56 truncate px-3 py-1.5 font-medium" title={row.position}>
                      {row.position}
                    </td>
                    {row.cells.map((c, i) => (
                      <td key={i} className="px-2 py-1.5 text-right font-mono">
                        {c}
                      </td>
                    ))}
                    <td className="px-3 py-1.5 text-right">
                      <Badge
                        variant="outline"
                        className={`text-[10px] ${
                          row.finalConv >= 5
                            ? "text-[color:var(--good)]"
                            : row.finalConv >= 3
                              ? "text-[color:var(--warning)]"
                              : "text-muted-foreground"
                        }`}
                      >
                        {row.finalConv.toFixed(1)}%
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* ───────── ② 소싱 채널 ───────── */}
      <Section n={2} title="소싱 채널" sub="채널 관리 · ROI · Yield" />

      {!hasChannelMeta ? (
        <div className="rounded-md border border-dashed bg-muted/20 px-4 py-6 text-[12px] text-muted-foreground">
          <b>소싱 채널</b> 데이터(채널명 · 유형 · 월 비용 · 계약 만료 · 연동 상태)를
          업로드하면 채널별 비용·ROI·계약 현황이 채워집니다. 아래는 지원자 데이터로
          계산한 채널별 지원·합격·Yield 입니다.
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Tile label="활성 채널" value={`${chan.filter((c) => c.applied > 0).length}개`} />
        <Tile
          label="최고 ROI 채널"
          value={
            chan.find((c) => c.roi != null)
              ? `${chan.find((c) => c.roi != null)!.channel} ${chan
                  .find((c) => c.roi != null)!
                  .roi!.toFixed(1)}×`
              : "—"
          }
          accent
        />
        <Tile
          label="채널당 평균 지원"
          value={`${Math.round(
            chan.reduce((s, c) => s + c.applied, 0) / Math.max(1, chan.length),
          )}명`}
        />
        <Tile
          label="채널 평균 Yield"
          value={`${(
            chan.reduce((s, c) => s + c.yield, 0) / Math.max(1, chan.length)
          ).toFixed(1)}%`}
        />
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between gap-3">
          <div>
            <CardTitle className="text-[13px]">채널 KPI 테이블</CardTitle>
            <p className="mt-1 text-[11px] text-muted-foreground">
              ROI = (채널 합격자 수 × 1인당 편익 가정) ÷ 채널 연 비용
            </p>
          </div>
          <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            1인당 편익 가정
            <Input
              className="h-7 w-24 text-[12px]"
              inputMode="numeric"
              value={benefit}
              onChange={(e) => {
                const v = Number(e.target.value) || 0;
                setBenefit(v);
                try {
                  localStorage.setItem(BENEFIT_KEY, String(v));
                } catch {}
              }}
            />
            만원
          </label>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto border-t">
            <table className="w-full text-[12px]">
              <thead className="bg-muted">
                <tr>
                  {["채널", "유형", "지원", "합격", "Yield", "월 비용", "계약 만료", "연동", "ROI", "추천 액션"].map((h) => (
                    <th key={h} className="px-3 py-1.5 text-left font-semibold whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {chan.map((c) => (
                  <tr key={c.channel} className="border-b last:border-0">
                    <td className="px-3 py-1.5 font-medium">{c.channel}</td>
                    <td className="px-3 py-1.5 text-muted-foreground">{c.type || "—"}</td>
                    <td className="px-3 py-1.5">{c.applied}</td>
                    <td className="px-3 py-1.5">{c.hires}</td>
                    <td className="px-3 py-1.5">{c.yield.toFixed(1)}%</td>
                    <td className="px-3 py-1.5">
                      {c.monthlyCost ? wonM(c.monthlyCost) : "무료"}
                    </td>
                    <td className="px-3 py-1.5 text-muted-foreground">{c.contractEnd || "—"}</td>
                    <td className="px-3 py-1.5 text-muted-foreground">{c.integration}</td>
                    <td className="px-3 py-1.5 font-bold">
                      {c.roi != null ? `${c.roi.toFixed(1)}×` : "—"}
                    </td>
                    <td className="px-3 py-1.5">
                      <Badge
                        variant="outline"
                        className={`text-[10px] ${
                          c.action === "확대"
                            ? "text-[color:var(--good)]"
                            : c.action === "축소"
                              ? "text-destructive"
                              : "text-muted-foreground"
                        }`}
                      >
                        {c.action}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-[13px]">채널별 Yield</CardTitle>
            <p className="text-[11px] text-muted-foreground">
              Yield = (채널 합격자 ÷ 채널 지원자) × 100
            </p>
          </CardHeader>
          <CardContent>
            <MiniBar
              data={[...chan]
                .filter((c) => c.applied >= 3)
                .sort((a, b) => b.yield - a.yield)
                .map((c) => ({ label: c.channel, value: Math.round(c.yield * 10) / 10 }))}
              unit="%"
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-[13px]">채널별 ROI</CardTitle>
          </CardHeader>
          <CardContent>
            <MiniBar
              data={chan
                .filter((c) => c.roi != null)
                .map((c) => ({ label: c.channel, value: Math.round(c.roi! * 10) / 10 }))}
              unit="×"
            />
          </CardContent>
        </Card>
      </div>

      {/* ───────── ③ Cost / Time to Hire ───────── */}
      <Section n={3} title="Cost / Time to Hire" sub="채용 비용·기간 구조" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Tile
          label="Cost per Hire"
          value={ct.costPerHire != null ? wonM(ct.costPerHire) : "데이터 필요"}
          accent
        />
        <Tile label="연 채널 비용" value={ct.annualChannelCost ? wonM(ct.annualChannelCost) : "—"} />
        <Tile label="총 합격자" value={`${ct.totalHires}명`} />
        <Tile
          label="평균 Time to Hire"
          value={ct.avgTimeToHire != null ? `${ct.avgTimeToHire}일` : "데이터 필요"}
        />
      </div>
      {ct.costPerHire == null || ct.avgTimeToHire == null ? (
        <div className="rounded-md border border-dashed bg-muted/20 px-4 py-3 text-[11.5px] text-muted-foreground">
          {ct.costPerHire == null
            ? "Cost per Hire 는 소싱 채널 데이터(월 비용)와 합격자가 있어야 계산됩니다. "
            : ""}
          {ct.avgTimeToHire == null
            ? "Time to Hire 는 지원자 데이터에 입사일이 있어야 계산됩니다."
            : ""}
        </div>
      ) : null}
    </div>
  );
}

function Section({ n, title, sub }: { n: number; title: string; sub: string }) {
  return (
    <div className="flex items-center gap-2 border-b pb-1.5">
      <span className="flex size-5 items-center justify-center rounded bg-primary text-[10px] font-extrabold text-primary-foreground">
        {n}
      </span>
      <span className="text-[13px] font-extrabold">{title}</span>
      <span className="text-[11px] text-muted-foreground">{sub}</span>
    </div>
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

function MiniBar({ data, unit }: { data: { label: string; value: number }[]; unit: string }) {
  const config: ChartConfig = { value: { label: unit, color: "var(--chart-1)" } };
  if (data.length === 0)
    return <p className="text-[12px] text-muted-foreground">데이터가 없습니다.</p>;
  return (
    <ChartContainer config={config} className="h-56 w-full">
      <BarChart data={data} layout="vertical" margin={{ left: 8, right: 44 }}>
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
        <Bar dataKey="value" fill="var(--color-value)" radius={4}>
          <LabelList
            dataKey="value"
            position="right"
            className="fill-foreground"
            fontSize={11}
            formatter={(v: React.ReactNode) => `${v}${unit}`}
          />
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}
