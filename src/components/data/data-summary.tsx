"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
} from "recharts";
import { createClient } from "@/lib/supabase/client";
import { getCategory } from "@/lib/data-catalog";
import {
  loadActiveRows,
  sum,
  avg,
  countBy,
  sumBy,
  pickGroupColumn,
  numericColumns,
  type Rows,
} from "@/lib/analytics";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";

function nf(n: number) {
  return n.toLocaleString("ko-KR", { maximumFractionDigits: 1 });
}

export function DataSummary({
  categories,
  predictive,
}: {
  categories: string[];
  predictive?: boolean;
}) {
  const [data, setData] = useState<Record<string, Rows> | null>(null);

  const load = useCallback(async () => {
    setData(await loadActiveRows(categories));
  }, [categories]);

  useEffect(() => {
    void load();
    if (categories.length === 0) return;
    const supabase = createClient();
    const ch = supabase
      .channel(`summary-${categories.join("-")}`)
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
  }, [categories, load]);

  if (categories.length === 0) return null;

  if (data === null) {
    return <Skeleton className="h-48 w-full" />;
  }

  const anyData = categories.some((k) => (data[k]?.length ?? 0) > 0);
  if (!anyData) {
    return (
      <div className="rounded-lg border border-dashed bg-muted/20 px-4 py-10 text-center text-[12.5px] text-muted-foreground">
        위에서 데이터를 업로드하면 이 자리에 요약 지표와 차트가 표시됩니다.
      </div>
    );
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-2">
        <h2 className="text-[13px] font-extrabold">분석 결과</h2>
        <span className="text-[11px] text-muted-foreground">
          업로드된 실데이터 기준 · 데이터 변경 시 자동 갱신
        </span>
      </div>

      {predictive ? (
        <div className="rounded-md border border-dashed border-accent-foreground/30 bg-accent/30 px-3 py-2 text-[11.5px] text-accent-foreground">
          아래는 실데이터 <b>집계 지표</b>입니다. 예측 모델 점수는 데이터가 축적되면
          활성화됩니다.
        </div>
      ) : null}

      {categories.map((key) => (
        <CategorySummary key={key} categoryKey={key} rows={data[key] ?? []} />
      ))}
    </section>
  );
}

function CategorySummary({
  categoryKey,
  rows,
}: {
  categoryKey: string;
  rows: Rows;
}) {
  const cat = getCategory(categoryKey);
  const groupCol = useMemo(() => pickGroupColumn(categoryKey), [categoryKey]);
  const numCols = useMemo(() => numericColumns(categoryKey), [categoryKey]);

  if (!cat || rows.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-[13px]">{cat?.label ?? categoryKey}</CardTitle>
        </CardHeader>
        <CardContent className="text-[12px] text-muted-foreground">
          업로드된 데이터가 없습니다.
        </CardContent>
      </Card>
    );
  }

  const primaryNum = numCols[0];
  const chartData = primaryNum && groupCol
    ? sumBy(rows, groupCol.key, primaryNum.key).slice(0, 8)
    : groupCol
      ? countBy(rows, groupCol.key).slice(0, 8)
      : [];

  const chartConfig: ChartConfig = {
    value: {
      label: primaryNum ? primaryNum.label : "건수",
      color: "var(--chart-1)",
    },
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-[13px]">{cat.label}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Tile label="행 수" value={nf(rows.length)} />
          {numCols.slice(0, 3).map((c) => {
            const isRate = /율|점수|수준|만족도|지수/.test(c.label);
            return (
              <Tile
                key={c.key}
                label={`${c.label} ${isRate ? "평균" : "합계"}`}
                value={nf(isRate ? avg(rows, c.key) : sum(rows, c.key))}
              />
            );
          })}
        </div>

        {chartData.length > 0 ? (
          <div>
            <div className="mb-1 text-[11px] font-semibold text-muted-foreground">
              {groupCol?.label}별{" "}
              {primaryNum ? `${primaryNum.label} 합계` : "건수"}
            </div>
            <ChartContainer config={chartConfig} className="h-56 w-full">
              <BarChart
                data={chartData}
                layout="vertical"
                margin={{ left: 8, right: 16 }}
              >
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
                <Bar dataKey="value" fill="var(--color-value)" radius={4} />
              </BarChart>
            </ChartContainer>
          </div>
        ) : null}

        <PreviewTable categoryKey={categoryKey} rows={rows} />
      </CardContent>
    </Card>
  );
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border bg-muted/30 px-3 py-2">
      <div className="text-[11px] font-semibold text-muted-foreground">
        {label}
      </div>
      <div className="mt-0.5 text-base font-extrabold tracking-tight">
        {value}
      </div>
    </div>
  );
}

function PreviewTable({
  categoryKey,
  rows,
}: {
  categoryKey: string;
  rows: Rows;
}) {
  const cat = getCategory(categoryKey);
  if (!cat) return null;
  const cols = cat.columns.slice(0, 6);
  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="w-full text-[11.5px]">
        <thead className="bg-muted">
          <tr>
            {cols.map((c) => (
              <th
                key={c.key}
                className="px-2 py-1.5 text-left font-semibold whitespace-nowrap"
              >
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, 10).map((r, i) => (
            <tr key={i} className="border-t">
              {cols.map((c) => (
                <td key={c.key} className="px-2 py-1.5 whitespace-nowrap">
                  {String(r[c.key] ?? "")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length > 10 ? (
        <div className="border-t px-2 py-1 text-[10.5px] text-muted-foreground">
          상위 10행 표시 · 전체 {rows.length.toLocaleString("ko-KR")}행은 위 ‘원본
          보기 · 수정’에서 확인
        </div>
      ) : null}
    </div>
  );
}
