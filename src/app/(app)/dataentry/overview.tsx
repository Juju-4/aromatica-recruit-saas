"use client";

import { useCallback, useEffect, useState } from "react";
import { RotateCcw, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { DATA_CATEGORIES, getCategory } from "@/lib/data-catalog";
import { useSession } from "@/components/session-provider";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

interface Row {
  id: string;
  category_key: string;
  name: string;
  row_count: number;
  created_at: string;
  uploaded_by_name: string | null;
  original_filename: string | null;
  status: string;
  file_path: string | null;
}

export function DataEntryOverview() {
  const session = useSession();
  const isAdmin = session?.role === "admin";
  const [rows, setRows] = useState<Row[] | null>(null);
  const [resetOpen, setResetOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [resetting, setResetting] = useState(false);

  const load = useCallback(async () => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("datasets")
      .select(
        "id,category_key,name,row_count,created_at,uploaded_by_name,original_filename,status,file_path",
      )
      .order("created_at", { ascending: false });
    if (error) {
      console.error(error);
      return;
    }
    setRows((data ?? []) as Row[]);
  }, []);

  useEffect(() => {
    void load();
    const supabase = createClient();
    const ch = supabase
      .channel("datasets-all")
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

  const doReset = async () => {
    setResetting(true);
    try {
      const supabase = createClient();
      // 모든 데이터셋 삭제 → dataset_rows 는 ON DELETE CASCADE
      const { error } = await supabase
        .from("datasets")
        .delete()
        .not("id", "is", null);
      if (error) throw error;
      // 스토리지 파일 정리
      const paths = (rows ?? [])
        .map((r) => r.file_path)
        .filter((p): p is string => !!p);
      if (paths.length) await supabase.storage.from("originals").remove(paths);
      toast.success("모든 업로드 데이터가 삭제되었습니다.");
      setResetOpen(false);
      setConfirmText("");
      void load();
    } catch (e) {
      console.error(e);
      toast.error("초기화에 실패했습니다. (관리자 권한 필요)");
    } finally {
      setResetting(false);
    }
  };

  if (rows === null) {
    return <Skeleton className="h-28 w-full" />;
  }

  const totalRows = rows.reduce((s, r) => s + (r.row_count ?? 0), 0);
  const coveredCats = new Set(rows.map((r) => r.category_key)).size;
  const last = rows[0];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="총 데이터셋" value={`${rows.length}건`} />
        <Stat
          label="카테고리 커버리지"
          value={`${coveredCats} / ${DATA_CATEGORIES.length}`}
        />
        <Stat label="총 행 수" value={totalRows.toLocaleString("ko-KR")} />
        <Stat
          label="최근 업로드"
          value={
            last
              ? new Date(last.created_at).toLocaleDateString("ko-KR", {
                  month: "2-digit",
                  day: "2-digit",
                })
              : "—"
          }
        />
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="flex items-center justify-between px-4 py-3">
            <div className="text-[13px] font-bold">업로드 이력</div>
            {isAdmin ? (
              <Button
                size="xs"
                variant="destructive"
                onClick={() => setResetOpen(true)}
              >
                <RotateCcw />
                전체 초기화
              </Button>
            ) : null}
          </div>
          <div className="max-h-80 overflow-auto border-t">
            <table className="w-full text-[12px]">
              <thead className="sticky top-0 bg-muted">
                <tr>
                  <th className="px-3 py-1.5 text-left font-semibold">이름</th>
                  <th className="px-3 py-1.5 text-left font-semibold">유형</th>
                  <th className="px-3 py-1.5 text-right font-semibold">행</th>
                  <th className="px-3 py-1.5 text-left font-semibold">업로드일</th>
                  <th className="px-3 py-1.5 text-left font-semibold">업로더</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-3 py-8 text-center text-muted-foreground"
                    >
                      업로드 이력이 없습니다.
                    </td>
                  </tr>
                ) : (
                  rows.map((r) => (
                    <tr key={r.id} className="border-b last:border-0">
                      <td className="px-3 py-1.5">{r.name}</td>
                      <td className="px-3 py-1.5 text-muted-foreground">
                        {getCategory(r.category_key)?.label ?? r.category_key}
                      </td>
                      <td className="px-3 py-1.5 text-right tabular-nums">
                        {r.row_count.toLocaleString("ko-KR")}
                      </td>
                      <td className="px-3 py-1.5 text-muted-foreground">
                        {new Date(r.created_at).toLocaleDateString("ko-KR")}
                      </td>
                      <td className="px-3 py-1.5 text-muted-foreground">
                        {r.uploaded_by_name ?? "—"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>전체 데이터 초기화</DialogTitle>
          </DialogHeader>
          <p className="text-[12.5px] text-muted-foreground">
            모든 카테고리의 업로드 데이터셋과 원본 행, 저장된 파일이 <b>영구 삭제</b>
            됩니다. 사용자·권한·조직 정보는 유지됩니다. 계속하려면 아래에{" "}
            <b>초기화</b> 를 입력하세요.
          </p>
          <Input
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder="초기화"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetOpen(false)}>
              취소
            </Button>
            <Button
              variant="destructive"
              disabled={confirmText !== "초기화" || resetting}
              onClick={doReset}
            >
              {resetting ? <Loader2 className="animate-spin" /> : null}
              영구 삭제
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="px-4 py-3">
        <div className="text-[11px] font-semibold text-muted-foreground">
          {label}
        </div>
        <div className="mt-1 text-lg font-extrabold tracking-tight">{value}</div>
      </CardContent>
    </Card>
  );
}
