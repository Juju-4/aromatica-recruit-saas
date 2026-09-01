"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, Trash2, Loader2, EyeOff, Eye } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { getCategory } from "@/lib/data-catalog";
import {
  getRows,
  updateRow,
  addRow,
  deleteRow,
  setRowHidden,
  type RowRecord,
} from "@/lib/datasets";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export function RawDataGrid({
  datasetId,
  categoryKey,
  canEdit,
}: {
  datasetId: string;
  categoryKey: string;
  canEdit: boolean;
}) {
  const cat = getCategory(categoryKey);
  const [rows, setRows] = useState<RowRecord[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [showHidden, setShowHidden] = useState(false);

  const load = useCallback(async () => {
    try {
      setRows(await getRows(datasetId));
    } catch (e) {
      toast.error("원본 데이터를 불러오지 못했습니다.");
      console.error(e);
    }
  }, [datasetId]);

  useEffect(() => {
    void load();
    const supabase = createClient();
    const channel = supabase
      .channel(`rows-${datasetId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "dataset_rows",
          filter: `dataset_id=eq.${datasetId}`,
        },
        () => void load(),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [datasetId, load]);

  const hiddenCount = useMemo(
    () => (rows ?? []).filter((r) => r.hidden).length,
    [rows],
  );
  const visibleRows = useMemo(
    () => (rows ?? []).filter((r) => showHidden || !r.hidden),
    [rows, showHidden],
  );

  if (!cat) return null;

  if (rows === null) {
    return (
      <div className="space-y-2 p-3">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
      </div>
    );
  }

  const commitCell = async (row: RowRecord, key: string, value: string) => {
    const current = String(row.values?.[key] ?? "");
    if (current === value) return;
    const nextValues = { ...row.values, [key]: value };
    setRows(
      (prev) =>
        prev?.map((r) => (r.id === row.id ? { ...r, values: nextValues } : r)) ??
        prev,
    );
    try {
      await updateRow(row.id, nextValues);
    } catch (e) {
      toast.error("셀 수정 저장에 실패했습니다.");
      console.error(e);
      void load();
    }
  };

  const onAddRow = async () => {
    setBusy(true);
    try {
      const lastNo = rows.length ? rows[rows.length - 1].row_no : 0;
      await addRow(datasetId, lastNo);
    } catch (e) {
      toast.error("행 추가에 실패했습니다. (편집 권한이 필요합니다)");
      console.error(e);
    } finally {
      setBusy(false);
    }
  };

  const onDeleteRow = async (row: RowRecord) => {
    setBusy(true);
    try {
      await deleteRow(row.id, datasetId);
    } catch (e) {
      toast.error("행 삭제에 실패했습니다.");
      console.error(e);
    } finally {
      setBusy(false);
    }
  };

  const onToggleRowHidden = async (row: RowRecord) => {
    setRows((prev) =>
      prev?.map((r) => (r.id === row.id ? { ...r, hidden: !r.hidden } : r)) ?? prev,
    );
    try {
      await setRowHidden(row.id, !row.hidden);
    } catch (e) {
      toast.error("행 숨김 처리에 실패했습니다.");
      console.error(e);
      void load();
    }
  };

  return (
    <div className="rounded-md border">
      <div className="max-h-[420px] overflow-auto">
        <table className="w-full text-[12px]">
          <thead className="sticky top-0 z-10 bg-muted">
            <tr>
              <th className="w-10 border-b px-2 py-1.5 text-left font-semibold text-muted-foreground">
                #
              </th>
              {cat.columns.map((c) => (
                <th
                  key={c.key}
                  className="min-w-28 border-b px-2 py-1.5 text-left font-semibold whitespace-nowrap"
                >
                  {c.label}
                  {c.required ? (
                    <span className="ml-0.5 text-destructive">*</span>
                  ) : null}
                </th>
              ))}
              {canEdit ? (
                <th className="w-16 border-b px-2 py-1.5" />
              ) : null}
            </tr>
          </thead>
          <tbody>
            {visibleRows.length === 0 ? (
              <tr>
                <td
                  colSpan={cat.columns.length + (canEdit ? 2 : 1)}
                  className="px-3 py-6 text-center text-muted-foreground"
                >
                  {rows.length === 0
                    ? canEdit
                      ? "행이 없습니다. 아래 ‘행 추가’로 직접 입력할 수 있습니다."
                      : "행이 없습니다."
                    : "표시할 행이 없습니다. (숨긴 행만 있음)"}
                </td>
              </tr>
            ) : (
              visibleRows.map((row) => (
                <tr
                  key={row.id}
                  className={`hover:bg-muted/40 ${row.hidden ? "opacity-50" : ""}`}
                >
                  <td className="border-b px-2 py-1 text-muted-foreground tabular-nums">
                    {row.row_no}
                  </td>
                  {cat.columns.map((c) => (
                    <td key={c.key} className="border-b p-0">
                      <input
                        defaultValue={String(row.values?.[c.key] ?? "")}
                        readOnly={!canEdit}
                        inputMode={c.type === "number" ? "decimal" : undefined}
                        className="w-full bg-transparent px-2 py-1 outline-none focus:bg-accent/40 read-only:cursor-default"
                        onKeyDown={(e) => {
                          if (e.key === "Enter") e.currentTarget.blur();
                        }}
                        onBlur={(e) =>
                          canEdit && commitCell(row, c.key, e.target.value)
                        }
                      />
                    </td>
                  ))}
                  {canEdit ? (
                    <td className="border-b px-1 py-1 whitespace-nowrap text-center">
                      <button
                        onClick={() => onToggleRowHidden(row)}
                        disabled={busy}
                        title={row.hidden ? "다시 표시" : "이 행 보관(숨김)"}
                        className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                      >
                        {row.hidden ? (
                          <Eye className="size-3.5" />
                        ) : (
                          <EyeOff className="size-3.5" />
                        )}
                      </button>
                      <button
                        onClick={() => onDeleteRow(row)}
                        disabled={busy}
                        className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                        aria-label="행 삭제"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </td>
                  ) : null}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {canEdit ? (
        <div className="flex flex-wrap items-center gap-2 border-t px-3 py-2">
          <Button size="xs" variant="secondary" onClick={onAddRow} disabled={busy}>
            {busy ? <Loader2 className="animate-spin" /> : <Plus />}행 추가
          </Button>
          {hiddenCount > 0 ? (
            <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <input
                type="checkbox"
                checked={showHidden}
                onChange={(e) => setShowHidden(e.target.checked)}
              />
              보관(숨긴) 행 {hiddenCount}개 표시
            </label>
          ) : null}
          <span className="text-[11px] text-muted-foreground">
            셀 클릭해 수정 · 자동 저장 · 눈 아이콘으로 개별 행 보관(분석에서 제외)
          </span>
        </div>
      ) : null}
    </div>
  );
}
