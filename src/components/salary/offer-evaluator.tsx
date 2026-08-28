"use client";

import { useMemo, useState } from "react";
import {
  quantile,
  computeStats,
  percentileRank,
  tenureLabel,
  won,
  type SalaryRow,
} from "@/lib/salary-stats";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";

const GRADE_BANDS: Record<string, { lo: number; hi: number; note: string }> = {
  "매우 우수": { lo: 0.72, hi: 0.82, note: "Peer 상위 20~28% 수준 · 매우 경쟁력 있는 처우" },
  우수: { lo: 0.47, hi: 0.57, note: "Peer 상위 45~55% 수준 · 적당히 경쟁력 있는 처우" },
  보통: { lo: 0.22, hi: 0.32, note: "Peer 상위 70~78% 수준 · 시장 대비 낮지 않은 수준" },
};

export function OfferEvaluator({ rows }: { rows: SalaryRow[] }) {
  const jobFamilies = useMemo(
    () => [...new Set(rows.map((r) => r.job_family))].sort(),
    [rows],
  );

  const [jobFamily, setJobFamily] = useState<string>(jobFamilies[0] ?? "");
  const [years, setYears] = useState<string>("5");
  const [grade, setGrade] = useState<string>("우수");
  const [offer, setOffer] = useState<string>("");

  const yearsNum = Number(years) || 0;
  const bucket = tenureLabel(yearsNum);

  const segment = useMemo(() => {
    const seg = rows.filter(
      (r) =>
        (!jobFamily || r.job_family === jobFamily) &&
        tenureLabel(r.years) === bucket,
    );
    return seg.map((r) => r.annual_salary).sort((a, b) => a - b);
  }, [rows, jobFamily, bucket]);

  const stats = useMemo(() => computeStats(segment, false), [segment]);
  const offerNum = Number(offer.replace(/[, ]/g, "")) || 0;
  const rank = offerNum > 0 ? percentileRank(segment, offerNum) : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-[13px]">처우 적절성 시뮬레이터</CardTitle>
        <p className="text-[11.5px] text-muted-foreground">
          직종·연차·평가등급을 고르고 제안 연봉을 입력하면, 같은 세그먼트 분포에서의
          위치와 권장 범위를 보여줍니다.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <div className="space-y-1">
            <Label className="text-[11px]">직종</Label>
            <Select value={jobFamily} onValueChange={(v) => setJobFamily(String(v ?? ""))}>
              <SelectTrigger>
                <SelectValue>{(v) => String(v) || "선택"}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {jobFamilies.map((f) => (
                  <SelectItem key={f} value={f}>
                    {f}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-[11px]">연차</Label>
            <Input
              type="number"
              value={years}
              onChange={(e) => setYears(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-[11px]">평가등급</Label>
            <Select value={grade} onValueChange={(v) => setGrade(String(v ?? "우수"))}>
              <SelectTrigger>
                <SelectValue>{(v) => String(v)}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {Object.keys(GRADE_BANDS).map((g) => (
                  <SelectItem key={g} value={g}>
                    {g}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-[11px]">제안 연봉(만원)</Label>
            <Input
              inputMode="numeric"
              value={offer}
              onChange={(e) => setOffer(e.target.value)}
              placeholder="예: 6000"
            />
          </div>
        </div>

        {stats.n < 3 ? (
          <div className="rounded-md bg-muted/50 px-3 py-2 text-[12px] text-muted-foreground">
            해당 세그먼트({jobFamily || "전체"} · {bucket})의 표본이 {stats.n}건으로
            적어 통계가 불안정합니다. 데이터를 더 채워주세요.
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
              <MiniTile label="표본" value={`${stats.n}명`} />
              <MiniTile label="25%ile" value={won(stats.p25)} />
              <MiniTile label="중위" value={won(stats.median)} accent />
              <MiniTile label="75%ile" value={won(stats.p75)} />
              <MiniTile label="평균" value={won(stats.mean)} />
            </div>

            <PositionBar
              lo={stats.whiskerLow}
              hi={stats.whiskerHigh}
              p25={stats.p25}
              median={stats.median}
              p75={stats.p75}
              marker={offerNum > 0 ? offerNum : null}
            />

            {rank != null ? (
              <div className="rounded-md bg-accent/50 px-3 py-2 text-[12.5px] text-accent-foreground">
                제안 연봉 <b>{won(offerNum)}</b> 은 이 세그먼트에서{" "}
                <b>상위 {(100 - rank).toFixed(0)}%</b> (하위 {rank.toFixed(0)}%ile)
                위치입니다.
              </div>
            ) : null}

            <div className="rounded-md border px-3 py-3">
              <div className="mb-1.5 text-[12px] font-bold">
                평가등급 &lsquo;{grade}&rsquo; 기준 권장 연봉 범위
              </div>
              <div className="text-lg font-extrabold text-[color:var(--good)]">
                {won(quantile(segment, GRADE_BANDS[grade].lo))} ~{" "}
                {won(quantile(segment, GRADE_BANDS[grade].hi))}
              </div>
              <div className="mt-1 text-[11px] text-muted-foreground">
                {GRADE_BANDS[grade].note}
              </div>
              {offerNum > 0 ? (
                <div className="mt-2 text-[11.5px]">
                  {offerNum >= quantile(segment, GRADE_BANDS[grade].lo) &&
                  offerNum <= quantile(segment, GRADE_BANDS[grade].hi) ? (
                    <span className="text-[color:var(--good)]">
                      ✓ 제안 연봉이 권장 범위 안에 있습니다.
                    </span>
                  ) : offerNum < quantile(segment, GRADE_BANDS[grade].lo) ? (
                    <span className="text-[color:var(--warning)]">
                      ▲ 권장 범위보다 낮습니다. 경쟁력 확보를 위해 상향을 검토하세요.
                    </span>
                  ) : (
                    <span className="text-muted-foreground">
                      ● 권장 범위보다 높습니다. 내부 형평성·예산을 함께 검토하세요.
                    </span>
                  )}
                </div>
              ) : null}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function MiniTile({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className={`rounded-md border px-2.5 py-1.5 ${accent ? "bg-accent/50" : "bg-muted/30"}`}>
      <div className="text-[10px] font-semibold text-muted-foreground">{label}</div>
      <div className="text-[12.5px] font-extrabold">{value}</div>
    </div>
  );
}

function PositionBar({
  lo,
  hi,
  p25,
  median,
  p75,
  marker,
}: {
  lo: number;
  hi: number;
  p25: number;
  median: number;
  p75: number;
  marker: number | null;
}) {
  const span = hi - lo || 1;
  const pct = (v: number) => `${Math.min(100, Math.max(0, ((v - lo) / span) * 100))}%`;
  return (
    <div className="pt-6">
      <div className="relative h-3 rounded-full bg-muted">
        <div
          className="absolute inset-y-0 rounded-full bg-[color:var(--chart-1)]/25"
          style={{ left: pct(p25), right: `calc(100% - ${pct(p75)})` }}
        />
        <div
          className="absolute inset-y-[-3px] w-0.5 bg-[color:var(--chart-1)]"
          style={{ left: pct(median) }}
        />
        {marker != null ? (
          <div
            className="absolute inset-y-[-8px] w-1 rounded bg-destructive"
            style={{ left: pct(marker) }}
            title={won(marker)}
          />
        ) : null}
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
        <span>{won(lo)}</span>
        <span>중위 {won(median)}</span>
        <span>{won(hi)}</span>
      </div>
      {marker != null ? (
        <div className="mt-0.5 text-[10.5px] font-semibold text-destructive">
          ▎ 제안 연봉 {won(marker)}
        </div>
      ) : null}
    </div>
  );
}
