"use client";

import type { GroupStat } from "@/lib/salary-stats";
import { won } from "@/lib/salary-stats";

/**
 * 수평 box plot (잡플래닛 리포트의 시그니처 차트).
 * 그룹별로 min·25%ile·중위·평균(×)·75%ile·max 를 한 줄에 표시.
 */
export function BoxPlot({
  groups,
  height = 260,
}: {
  groups: GroupStat[];
  height?: number;
}) {
  const rows = groups.filter((g) => g.n > 0);
  if (rows.length === 0) return null;

  const lo = Math.min(...rows.map((g) => g.whiskerLow));
  const hi = Math.max(...rows.map((g) => g.whiskerHigh));
  const pad = (hi - lo) * 0.08 || 1;
  const domainLo = Math.max(0, lo - pad);
  const domainHi = hi + pad;
  const W = 1000;
  const labelW = 150;
  const plotW = W - labelW - 70;
  const rowH = Math.max(34, (height - 30) / rows.length);
  const H = rows.length * rowH + 30;

  const x = (v: number) =>
    labelW + ((v - domainLo) / (domainHi - domainLo || 1)) * plotW;

  const ticks = 4;
  const tickVals = Array.from(
    { length: ticks + 1 },
    (_, i) => domainLo + ((domainHi - domainLo) / ticks) * i,
  );

  return (
    <div className="overflow-x-auto">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full min-w-[640px]"
        style={{ height: H * 0.55 }}
      >
        {tickVals.map((t, i) => (
          <g key={i}>
            <line
              x1={x(t)}
              x2={x(t)}
              y1={16}
              y2={H - 16}
              stroke="var(--border)"
              strokeWidth={1}
            />
            <text
              x={x(t)}
              y={12}
              fontSize={11}
              textAnchor="middle"
              fill="var(--muted-foreground)"
            >
              {Math.round(t).toLocaleString("ko-KR")}
            </text>
          </g>
        ))}

        {rows.map((g, i) => {
          const cy = 24 + i * rowH + rowH / 2;
          const boxTop = cy - 10;
          const boxH = 20;
          return (
            <g key={g.key}>
              <text
                x={labelW - 10}
                y={cy + 4}
                fontSize={12}
                textAnchor="end"
                fill="var(--foreground)"
                fontWeight={600}
              >
                {g.label}
              </text>
              {/* whisker */}
              <line
                x1={x(g.whiskerLow)}
                x2={x(g.whiskerHigh)}
                y1={cy}
                y2={cy}
                stroke="var(--chart-1)"
                strokeWidth={1.5}
              />
              <line x1={x(g.whiskerLow)} x2={x(g.whiskerLow)} y1={cy - 6} y2={cy + 6} stroke="var(--chart-1)" strokeWidth={1.5} />
              <line x1={x(g.whiskerHigh)} x2={x(g.whiskerHigh)} y1={cy - 6} y2={cy + 6} stroke="var(--chart-1)" strokeWidth={1.5} />
              {/* IQR box */}
              <rect
                x={x(g.p25)}
                y={boxTop}
                width={Math.max(2, x(g.p75) - x(g.p25))}
                height={boxH}
                fill="var(--chart-1)"
                fillOpacity={0.18}
                stroke="var(--chart-1)"
                strokeWidth={1.5}
                rx={2}
              />
              {/* median */}
              <line
                x1={x(g.median)}
                x2={x(g.median)}
                y1={boxTop}
                y2={boxTop + boxH}
                stroke="var(--chart-1)"
                strokeWidth={2.5}
              />
              {/* mean × */}
              <text
                x={x(g.mean)}
                y={cy + 4}
                fontSize={12}
                textAnchor="middle"
                fill="var(--muted-foreground)"
              >
                ×
              </text>
              <text
                x={x(g.p75) + 8}
                y={cy + 4}
                fontSize={10.5}
                fill="var(--muted-foreground)"
              >
                중위 {won(g.median)} · n={g.n}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="mt-1 flex flex-wrap gap-3 text-[10.5px] text-muted-foreground">
        <span>■ 상자 = 연봉 범위(25~75%ile)</span>
        <span>│ 굵은 선 = 중위연봉</span>
        <span>× = 평균</span>
        <span>├─┤ = 1.5×IQR 수염(이상치 제외)</span>
      </div>
    </div>
  );
}
