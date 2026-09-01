"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Upload,
  FileSpreadsheet,
  Trash2,
  Table2,
  CheckCircle2,
  Loader2,
  Star,
  Eye,
  EyeOff,
} from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { getCategory } from "@/lib/data-catalog";
import { parseUpload, type ParseResult } from "@/lib/xlsx";
import {
  listDatasets,
  createDataset,
  deleteDataset,
  setActive,
  updateDataset,
  type DatasetRecord,
} from "@/lib/datasets";
import { useSession } from "@/components/session-provider";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { TemplateDownloadButton } from "./template-download-button";
import { RawDataGrid } from "./raw-data-grid";

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

export function DatasetManager({ categoryKey }: { categoryKey: string }) {
  const cat = getCategory(categoryKey);
  const session = useSession();
  const canEdit = session?.role === "admin" || session?.role === "editor";

  const [datasets, setDatasets] = useState<DatasetRecord[] | null>(null);
  const [openGrid, setOpenGrid] = useState<string | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [pending, setPending] = useState<{
    file: File;
    parse: ParseResult;
    name: string;
    period: string;
  } | null>(null);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      setDatasets(await listDatasets(categoryKey));
    } catch (e) {
      console.error(e);
      toast.error("데이터셋 목록을 불러오지 못했습니다.");
    }
  }, [categoryKey]);

  useEffect(() => {
    void load();
    const supabase = createClient();
    const channel = supabase
      .channel(`datasets-${categoryKey}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "datasets",
          filter: `category_key=eq.${categoryKey}`,
        },
        () => void load(),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [categoryKey, load]);

  if (!cat) return null;

  const onPickFile = async (file: File) => {
    const parse = await parseUpload(file, cat);
    const base = file.name.replace(/\.(xlsx|xls|csv)$/i, "");
    setPending({ file, parse, name: base, period: "" });
    setUploadOpen(true);
  };

  const onConfirmSave = async () => {
    if (!pending) return;
    setSaving(true);
    try {
      await createDataset({
        categoryKey,
        name: pending.name.trim() || cat.label,
        periodLabel: pending.period.trim(),
        rows: pending.parse.rows,
        file: pending.file,
        uploadedByName: session?.name ?? null,
      });
      toast.success(`"${pending.name}" 업로드 완료 · ${pending.parse.rows.length}행`);
      setUploadOpen(false);
      setPending(null);
      void load();
    } catch (e) {
      console.error(e);
      toast.error("업로드 저장에 실패했습니다. (편집 권한이 필요할 수 있습니다)");
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async (ds: DatasetRecord) => {
    if (!confirm(`"${ds.name}" 데이터셋과 모든 행을 삭제합니다. 계속할까요?`)) return;
    try {
      await deleteDataset(ds.id, ds.file_path);
      toast.success("삭제되었습니다.");
      if (openGrid === ds.id) setOpenGrid(null);
      void load();
    } catch (e) {
      console.error(e);
      toast.error("삭제에 실패했습니다.");
    }
  };

  const onToggleActive = async (ds: DatasetRecord) => {
    try {
      await setActive(categoryKey, ds.id);
      void load();
    } catch (e) {
      console.error(e);
      toast.error("대표 데이터셋 설정에 실패했습니다.");
    }
  };

  const onToggleHidden = async (ds: DatasetRecord) => {
    try {
      await updateDataset(ds.id, { hidden: !ds.hidden });
      toast.success(ds.hidden ? "다시 표시됩니다." : "숨김 처리했습니다. 분석·표에서 제외됩니다.");
      void load();
    } catch (e) {
      console.error(e);
      toast.error("숨김 설정에 실패했습니다.");
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <TemplateDownloadButton categoryKey={categoryKey} />
        <input
          ref={fileRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f) void onPickFile(f);
          }}
        />
        <Button
          size="sm"
          onClick={() => fileRef.current?.click()}
          disabled={!canEdit}
        >
          <Upload />
          파일 업로드
        </Button>
        {!canEdit ? (
          <span className="text-[11px] text-muted-foreground">
            (뷰어 권한은 열람만 가능합니다)
          </span>
        ) : null}
      </div>

      {datasets === null ? (
        <div className="space-y-2">
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
        </div>
      ) : datasets.length === 0 ? (
        <div className="rounded-md border border-dashed bg-muted/30 px-4 py-8 text-center text-[12.5px] text-muted-foreground">
          <FileSpreadsheet className="mx-auto mb-2 size-6 opacity-40" />
          아직 업로드된 데이터가 없습니다. 위에서 <b>양식</b>을 받아 채운 뒤{" "}
          <b>파일 업로드</b>를 눌러주세요.
        </div>
      ) : (
        <div className="space-y-2">
          {datasets.map((ds) => (
            <div
              key={ds.id}
              className={`rounded-md border ${ds.hidden ? "opacity-60" : ""}`}
            >
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2.5">
                <button
                  onClick={() => canEdit && onToggleActive(ds)}
                  title={ds.is_active ? "대표 데이터셋" : "대표로 설정"}
                  className={
                    ds.is_active
                      ? "text-chart-2"
                      : "text-muted-foreground/40 hover:text-muted-foreground"
                  }
                >
                  <Star
                    className="size-4"
                    fill={ds.is_active ? "currentColor" : "none"}
                  />
                </button>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-bold">{ds.name}</span>
                    {ds.period_label ? (
                      <Badge variant="outline" className="text-[10px]">
                        {ds.period_label}
                      </Badge>
                    ) : null}
                    {ds.hidden ? (
                      <Badge variant="outline" className="text-[10px] text-muted-foreground">
                        <EyeOff className="size-3" /> 숨김
                      </Badge>
                    ) : ds.status === "review" ? (
                      <Badge className="bg-[color:var(--warning)]/15 text-[10px] text-[color:var(--warning)]">
                        검토 필요
                      </Badge>
                    ) : (
                      <Badge className="bg-[color:var(--good)]/12 text-[10px] text-[color:var(--good)]">
                        <CheckCircle2 className="size-3" /> 완료
                      </Badge>
                    )}
                  </div>
                  <div className="mt-0.5 text-[11px] text-muted-foreground">
                    {ds.row_count.toLocaleString("ko-KR")}행 · {fmtDate(ds.created_at)}
                    {ds.uploaded_by_name ? ` · ${ds.uploaded_by_name}` : ""}
                    {ds.original_filename ? ` · ${ds.original_filename}` : ""}
                  </div>
                </div>
                <Button
                  size="xs"
                  variant="outline"
                  onClick={() =>
                    setOpenGrid((cur) => (cur === ds.id ? null : ds.id))
                  }
                >
                  <Table2 />
                  {openGrid === ds.id ? "닫기" : "원본 보기 · 수정"}
                </Button>
                {canEdit ? (
                  <>
                    <Button
                      size="xs"
                      variant="ghost"
                      title={ds.hidden ? "다시 표시" : "숨기기 (분석·표에서 제외)"}
                      onClick={() => onToggleHidden(ds)}
                    >
                      {ds.hidden ? <Eye /> : <EyeOff />}
                    </Button>
                    <Button
                      size="xs"
                      variant="ghost"
                      className="text-destructive"
                      onClick={() => onDelete(ds)}
                    >
                      <Trash2 />
                    </Button>
                  </>
                ) : null}
              </div>
              {openGrid === ds.id ? (
                <div className="border-t p-2">
                  <RawDataGrid
                    datasetId={ds.id}
                    categoryKey={categoryKey}
                    canEdit={canEdit}
                  />
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}

      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{cat.label} · 업로드 미리보기</DialogTitle>
          </DialogHeader>
          {pending ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-muted-foreground">
                    데이터셋 이름
                  </label>
                  <Input
                    value={pending.name}
                    onChange={(e) =>
                      setPending({ ...pending, name: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-muted-foreground">
                    기간 라벨 (선택 · 예: 2026-Q2)
                  </label>
                  <Input
                    value={pending.period}
                    onChange={(e) =>
                      setPending({ ...pending, period: e.target.value })
                    }
                  />
                </div>
              </div>

              {pending.parse.errors.length > 0 ? (
                <div className="rounded-md bg-destructive/10 px-3 py-2 text-[12px] text-destructive">
                  {pending.parse.errors.map((er, i) => (
                    <div key={i}>• {er}</div>
                  ))}
                </div>
              ) : (
                <div className="rounded-md bg-[color:var(--good)]/10 px-3 py-2 text-[12px] text-[color:var(--good)]">
                  {pending.parse.rows.length.toLocaleString("ko-KR")}행 인식 · 매칭된 컬럼{" "}
                  {pending.parse.matchedColumns.length}개
                </div>
              )}

              <div className="max-h-64 overflow-auto rounded-md border">
                <table className="w-full text-[11.5px]">
                  <thead className="sticky top-0 bg-muted">
                    <tr>
                      {cat.columns.map((c) => (
                        <th
                          key={c.key}
                          className="border-b px-2 py-1 text-left font-semibold whitespace-nowrap"
                        >
                          {c.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {pending.parse.rows.slice(0, 20).map((r, i) => (
                      <tr key={i}>
                        {cat.columns.map((c) => (
                          <td
                            key={c.key}
                            className="border-b px-2 py-1 whitespace-nowrap"
                          >
                            {String(r[c.key] ?? "")}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {pending.parse.rows.length > 20 ? (
                <div className="text-[11px] text-muted-foreground">
                  미리보기는 상위 20행만 표시합니다.
                </div>
              ) : null}
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setUploadOpen(false)}>
              취소
            </Button>
            <Button
              onClick={onConfirmSave}
              disabled={
                saving ||
                !pending ||
                pending.parse.errors.length > 0 ||
                pending.parse.rows.length === 0
              }
            >
              {saving ? <Loader2 className="animate-spin" /> : null}
              저장
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
