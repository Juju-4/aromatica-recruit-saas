"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { useSession } from "@/components/session-provider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

interface Dept {
  id: string;
  name: string;
  parent_id: string | null;
  head_name: string | null;
  headcount: number | null;
  level_scheme: string | null;
  approval_policy: string | null;
  sort_order: number;
}

const FIELDS: { key: keyof Dept; label: string; type?: string; w: string }[] = [
  { key: "name", label: "부서", w: "min-w-32" },
  { key: "head_name", label: "부서장", w: "min-w-24" },
  { key: "headcount", label: "인원", type: "number", w: "w-16" },
  { key: "level_scheme", label: "레벨체계", w: "min-w-24" },
  { key: "approval_policy", label: "채용 승인 정책", w: "min-w-48" },
];

export function DepartmentsAdmin() {
  const me = useSession();
  const isAdmin = me?.role === "admin";
  const [rows, setRows] = useState<Dept[] | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("departments")
      .select("*")
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });
    if (error) {
      toast.error("부서 목록을 불러오지 못했습니다.");
      return;
    }
    setRows((data ?? []) as Dept[]);
  }, []);

  useEffect(() => {
    void load();
    const supabase = createClient();
    const ch = supabase
      .channel("departments")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "departments" },
        () => void load(),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
  }, [load]);

  const addDept = async () => {
    setBusy(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.from("departments").insert({
        name: "새 부서",
        sort_order: (rows?.length ?? 0) + 1,
      });
      if (error) throw error;
      void load();
    } catch (e) {
      console.error(e);
      toast.error("부서 추가에 실패했습니다. (관리자 전용)");
    } finally {
      setBusy(false);
    }
  };

  const commit = async (row: Dept, key: keyof Dept, raw: string) => {
    const value =
      key === "headcount" ? (raw === "" ? null : Number(raw)) : raw || null;
    if (String(row[key] ?? "") === String(value ?? "")) return;
    setRows(
      (prev) =>
        prev?.map((r) => (r.id === row.id ? { ...r, [key]: value } : r)) ?? prev,
    );
    const supabase = createClient();
    const { error } = await supabase
      .from("departments")
      .update({ [key]: value })
      .eq("id", row.id);
    if (error) {
      toast.error("저장에 실패했습니다.");
      void load();
    }
  };

  const remove = async (row: Dept) => {
    if (!confirm(`"${row.name}" 부서를 삭제할까요?`)) return;
    const supabase = createClient();
    const { error } = await supabase
      .from("departments")
      .delete()
      .eq("id", row.id);
    if (error) {
      toast.error("삭제에 실패했습니다.");
      return;
    }
    void load();
  };

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle className="text-[13px]">부서 목록</CardTitle>
        {isAdmin ? (
          <Button size="xs" onClick={addDept} disabled={busy}>
            {busy ? <Loader2 className="animate-spin" /> : <Plus />}부서 추가
          </Button>
        ) : null}
      </CardHeader>
      <CardContent className="p-0">
        {rows === null ? (
          <div className="space-y-2 p-4">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        ) : rows.length === 0 ? (
          <div className="border-t px-4 py-10 text-center text-[12.5px] text-muted-foreground">
            등록된 부서가 없습니다.
            {isAdmin ? " ‘부서 추가’로 시작하거나, 데이터 입력 → 조직도 양식을 업로드하세요." : ""}
          </div>
        ) : (
          <div className="overflow-x-auto border-t">
            <table className="w-full text-[12px]">
              <thead className="bg-muted">
                <tr>
                  {FIELDS.map((f) => (
                    <th
                      key={String(f.key)}
                      className="px-3 py-2 text-left font-semibold whitespace-nowrap"
                    >
                      {f.label}
                    </th>
                  ))}
                  {isAdmin ? <th className="w-10 px-2 py-2" /> : null}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-b last:border-0">
                    {FIELDS.map((f) => (
                      <td key={String(f.key)} className={`p-0 ${f.w}`}>
                        <input
                          defaultValue={String(row[f.key] ?? "")}
                          readOnly={!isAdmin}
                          inputMode={f.type === "number" ? "numeric" : undefined}
                          className="w-full bg-transparent px-3 py-2 outline-none focus:bg-accent/40 read-only:cursor-default"
                          onKeyDown={(e) => {
                            if (e.key === "Enter") e.currentTarget.blur();
                          }}
                          onBlur={(e) =>
                            isAdmin && commit(row, f.key, e.target.value)
                          }
                        />
                      </td>
                    ))}
                    {isAdmin ? (
                      <td className="px-2 py-1 text-center">
                        <button
                          onClick={() => remove(row)}
                          className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                          aria-label="부서 삭제"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
