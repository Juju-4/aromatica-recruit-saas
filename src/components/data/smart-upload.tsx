"use client";

import { useRef, useState } from "react";
import { UploadCloud, Loader2, Check, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import {
  analyzeFile,
  mapRowsToCategory,
  ALL_CATS,
  POSITIONS_PSEUDO,
  type SheetDetection,
} from "@/lib/smart-import";
import { createDataset } from "@/lib/datasets";
import { bulkInsertPositions } from "@/lib/positions";
import { useSession } from "@/components/session-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";

interface Plan {
  det: SheetDetection;
  include: boolean;
  categoryKey: string;
  name: string;
}

function catLabel(key: string): string {
  return ALL_CATS.find((c) => c.key === key)?.label ?? "";
}

export function SmartUpload({
  onDone,
  compact,
}: {
  onDone?: () => void;
  compact?: boolean;
}) {
  const session = useSession();
  const canEdit = session?.role === "admin" || session?.role === "editor";
  const fileRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [saving, setSaving] = useState(false);

  const onFile = async (f: File) => {
    setFile(f);
    setOpen(true);
    setAnalyzing(true);
    setPlans([]);
    try {
      const dets = await analyzeFile(f);
      const base = f.name.replace(/\.(xlsx|xls|csv)$/i, "");
      setPlans(
        dets.map((det) => ({
          det,
          // 확신 있는 것만 자동 선택. 불확실하면 사용자가 종류 고른 뒤 체크
          include: !!det.best,
          categoryKey:
            det.best?.categoryKey ?? det.candidates[0]?.categoryKey ?? "",
          name: dets.length > 1 ? `${base} · ${det.sheetName}` : base,
        })),
      );
    } catch (e) {
      console.error(e);
      toast.error("파일을 분석하지 못했습니다. 엑셀/CSV 형식인지 확인해주세요.");
      setOpen(false);
    } finally {
      setAnalyzing(false);
    }
  };

  const save = async () => {
    if (!file) return;
    const chosen = plans.filter((p) => p.include && p.categoryKey);
    if (chosen.length === 0) {
      toast.error("저장할 항목의 종류를 선택해주세요.");
      return;
    }
    setSaving(true);
    try {
      const summary: string[] = [];
      for (const p of chosen) {
        const cat = ALL_CATS.find((c) => c.key === p.categoryKey);
        const rows =
          p.categoryKey === p.det.best?.categoryKey || !cat
            ? p.det.rows
            : mapRowsToCategory(p.det.rawRows, p.det.headers, cat);

        if (p.categoryKey === POSITIONS_PSEUDO.key) {
          const n = await bulkInsertPositions(rows);
          summary.push(`채용 포지션 ${n}건`);
        } else {
          await createDataset({
            categoryKey: p.categoryKey,
            name: p.name.trim() || p.det.sheetName,
            rows,
            file: chosen.length === 1 ? file : null,
            uploadedByName: session?.name ?? null,
          });
          summary.push(`${catLabel(p.categoryKey)} ${rows.length}행`);
        }
      }
      toast.success(`저장 완료 — ${summary.join(", ")}`);
      setOpen(false);
      setFile(null);
      setPlans([]);
      onDone?.();
    } catch (e) {
      console.error(e);
      toast.error("저장에 실패했습니다. (편집 권한이 필요할 수 있습니다)");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <input
        ref={fileRef}
        type="file"
        accept=".xlsx,.xls,.csv"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) void onFile(f);
        }}
      />
      <Button
        size={compact ? "sm" : "default"}
        onClick={() => fileRef.current?.click()}
        disabled={!canEdit}
      >
        <UploadCloud />
        데이터 업로드 {compact ? "" : "(자동 분류)"}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>업로드 파일 분석</DialogTitle>
          </DialogHeader>

          {analyzing ? (
            <div className="flex items-center gap-2 py-8 text-[13px] text-muted-foreground">
              <Loader2 className="animate-spin" />
              파일을 읽고 어떤 데이터인지 판별하는 중…
            </div>
          ) : plans.length === 0 ? (
            <div className="py-8 text-center text-[13px] text-muted-foreground">
              데이터가 있는 표를 찾지 못했습니다. 엑셀/CSV에 헤더 행과 데이터 행이
              있는지 확인해주세요.
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-[12px] text-muted-foreground">
                파일에서 {plans.length}개 시트를 확인했습니다. 자동 분류 결과를
                확인하고, 틀렸거나 &lsquo;직접 선택&rsquo;이면 종류를 골라주세요.
                (양식과 컬럼명이 달라도 최대한 맞춰 넣습니다.)
              </p>
              {plans.map((p, i) => (
                <div key={p.det.sheetName} className="rounded-md border px-3 py-2.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      type="checkbox"
                      checked={p.include}
                      onChange={(e) =>
                        setPlans((prev) =>
                          prev.map((x, j) =>
                            j === i ? { ...x, include: e.target.checked } : x,
                          ),
                        )
                      }
                    />
                    <span className="text-[12.5px] font-bold">
                      시트 &ldquo;{p.det.sheetName}&rdquo;
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      {p.det.rowCount}행
                    </span>
                    {p.det.best ? (
                      <span className="inline-flex items-center gap-1 text-[10.5px] text-[color:var(--good)]">
                        <Check className="size-3" />
                        자동 인식됨
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10.5px] text-[color:var(--warning)]">
                        <AlertTriangle className="size-3" />
                        종류 확인 필요{" "}
                        {p.det.candidates[0]
                          ? `(추정: ${p.det.candidates[0].label})`
                          : ""}
                      </span>
                    )}
                  </div>

                  {p.include ? (
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10.5px] font-semibold text-muted-foreground">
                          데이터 종류
                        </label>
                        <Select
                          value={p.categoryKey}
                          onValueChange={(v) =>
                            setPlans((prev) =>
                              prev.map((x, j) =>
                                j === i ? { ...x, categoryKey: String(v ?? "") } : x,
                              ),
                            )
                          }
                        >
                          <SelectTrigger className="h-8 text-[12px]">
                            <SelectValue>
                              {(v) => catLabel(String(v)) || "선택하세요"}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            {ALL_CATS.map((c) => (
                              <SelectItem key={c.key} value={c.key}>
                                {c.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <label className="text-[10.5px] font-semibold text-muted-foreground">
                          데이터셋 이름
                        </label>
                        <Input
                          className="h-8 text-[12px]"
                          value={p.name}
                          onChange={(e) =>
                            setPlans((prev) =>
                              prev.map((x, j) =>
                                j === i ? { ...x, name: e.target.value } : x,
                              ),
                            )
                          }
                        />
                      </div>
                      <div className="col-span-2 text-[10.5px] text-muted-foreground">
                        {p.det.best
                          ? `매칭된 컬럼: ${p.det.best.matched.join(", ")}`
                          : `읽은 컬럼: ${p.det.headers.slice(0, 12).join(", ")}`}
                      </div>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              취소
            </Button>
            <Button
              onClick={save}
              disabled={saving || analyzing || plans.every((p) => !p.include)}
            >
              {saving ? <Loader2 className="animate-spin" /> : null}저장
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
