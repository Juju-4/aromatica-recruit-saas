"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, Loader2, Archive, RotateCcw, PauseCircle } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { useSession } from "@/components/session-provider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

export interface Position {
  id: string;
  title: string;
  department: string | null;
  job_family: string | null;
  employment_type: string | null;
  target_count: number;
  filled_count: number;
  opened_at: string | null;
  target_close_at: string | null;
  status: "open" | "hold" | "closed";
  owner_name: string | null;
  priority: "high" | "normal" | "low";
  note: string | null;
  closed_at: string | null;
}

const STATUS_TAB = { open: "진행중", hold: "보류", closed: "종료·보관" } as const;

function dday(target: string | null): string {
  if (!target) return "—";
  const t = Date.parse(target);
  if (Number.isNaN(t)) return "—";
  const diff = Math.ceil((t - Date.now()) / 86400000);
  return diff === 0 ? "D-DAY" : diff > 0 ? `D-${diff}` : `D+${-diff}`;
}

export function PositionsTable({
  onPositions,
}: {
  onPositions?: (p: Position[]) => void;
}) {
  const me = useSession();
  const canEdit = me?.role === "admin" || me?.role === "editor";
  const [rows, setRows] = useState<Position[] | null>(null);
  const [tab, setTab] = useState<"open" | "hold" | "closed">("open");
  const [newOpen, setNewOpen] = useState(false);
  const [draft, setDraft] = useState({
    title: "",
    department: "",
    job_family: "",
    employment_type: "정규직",
    target_count: "1",
    target_close_at: "",
    owner_name: "",
  });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("positions")
      .select("*")
      .order("opened_at", { ascending: false });
    if (error) {
      toast.error("포지션을 불러오지 못했습니다.");
      return;
    }
    const list = (data ?? []) as Position[];
    setRows(list);
    onPositions?.(list);
  }, [onPositions]);

  useEffect(() => {
    void load();
    const supabase = createClient();
    const ch = supabase
      .channel("positions")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "positions" },
        () => void load(),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
  }, [load]);

  const patch = async (id: string, p: Partial<Position>) => {
    const supabase = createClient();
    const { error } = await supabase.from("positions").update(p).eq("id", id);
    if (error) {
      toast.error("저장에 실패했습니다. (편집 권한 필요)");
      void load();
    }
  };

  const commitCell = (row: Position, key: keyof Position, raw: string) => {
    const value =
      key === "target_count" || key === "filled_count"
        ? Number(raw) || 0
        : raw || null;
    if (String(row[key] ?? "") === String(value ?? "")) return;
    setRows((prev) =>
      prev ? prev.map((r) => (r.id === row.id ? { ...r, [key]: value } : r)) : prev,
    );
    void patch(row.id, { [key]: value } as Partial<Position>);
  };

  const setStatus = async (row: Position, status: Position["status"]) => {
    setRows((prev) =>
      prev ? prev.map((r) => (r.id === row.id ? { ...r, status } : r)) : prev,
    );
    await patch(row.id, {
      status,
      closed_at: status === "closed" ? new Date().toISOString().slice(0, 10) : null,
    });
    void load();
  };

  const createPosition = async () => {
    if (!draft.title.trim()) {
      toast.error("포지션명을 입력해주세요.");
      return;
    }
    setSaving(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.from("positions").insert({
        title: draft.title.trim(),
        department: draft.department || null,
        job_family: draft.job_family || null,
        employment_type: draft.employment_type || null,
        target_count: Number(draft.target_count) || 1,
        target_close_at: draft.target_close_at || null,
        owner_name: draft.owner_name || null,
        opened_at: new Date().toISOString().slice(0, 10),
      });
      if (error) throw error;
      toast.success("포지션이 생성되었습니다.");
      void load();
      setNewOpen(false);
      setDraft({
        title: "",
        department: "",
        job_family: "",
        employment_type: "정규직",
        target_count: "1",
        target_close_at: "",
        owner_name: "",
      });
    } catch (e) {
      console.error(e);
      toast.error("생성에 실패했습니다. (편집 권한 필요)");
    } finally {
      setSaving(false);
    }
  };

  const counts = {
    open: rows?.filter((r) => r.status === "open").length ?? 0,
    hold: rows?.filter((r) => r.status === "hold").length ?? 0,
    closed: rows?.filter((r) => r.status === "closed").length ?? 0,
  };
  const visible = (rows ?? []).filter((r) => r.status === tab);
  const openRows = rows?.filter((r) => r.status === "open") ?? [];
  const totalTO = openRows.reduce((s, r) => s + r.target_count, 0);
  const totalFilled = openRows.reduce((s, r) => s + r.filled_count, 0);

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-3">
        <div>
          <CardTitle className="text-[13px]">채용 포지션 현황</CardTitle>
          <p className="mt-1 text-[11.5px] text-muted-foreground">
            진행중 {counts.open}건 · TO 합계 {totalTO}명 · 확정 {totalFilled}명 ·
            잔여 {Math.max(0, totalTO - totalFilled)}명
          </p>
        </div>
        {canEdit ? (
          <Button size="xs" onClick={() => setNewOpen(true)}>
            <Plus />
            신규 포지션
          </Button>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-3">
        <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
          <TabsList>
            {(["open", "hold", "closed"] as const).map((k) => (
              <TabsTrigger key={k} value={k}>
                {STATUS_TAB[k]} ({counts[k]})
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        {rows === null ? (
          <Skeleton className="h-32 w-full" />
        ) : visible.length === 0 ? (
          <div className="rounded-md border border-dashed bg-muted/20 px-4 py-8 text-center text-[12.5px] text-muted-foreground">
            {tab === "open"
              ? canEdit
                ? "진행 중인 포지션이 없습니다. ‘신규 포지션’으로 추가하세요."
                : "진행 중인 포지션이 없습니다."
              : `${STATUS_TAB[tab]} 포지션이 없습니다.`}
          </div>
        ) : (
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-[12px]">
              <thead className="bg-muted">
                <tr>
                  {["포지션", "부서", "직군", "고용형태", "TO", "확정", "진행률", "오픈일", "마감목표", "담당", ""].map(
                    (h) => (
                      <th key={h} className="px-2.5 py-2 text-left font-semibold whitespace-nowrap">
                        {h}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {visible.map((row) => {
                  const prog =
                    row.target_count > 0
                      ? Math.min(100, (row.filled_count / row.target_count) * 100)
                      : 0;
                  return (
                    <tr key={row.id} className="border-t hover:bg-muted/30">
                      <Cell row={row} k="title" w="min-w-36" bold edit={canEdit} onCommit={commitCell} />
                      <Cell row={row} k="department" w="min-w-20" edit={canEdit} onCommit={commitCell} />
                      <Cell row={row} k="job_family" w="min-w-20" edit={canEdit} onCommit={commitCell} />
                      <Cell row={row} k="employment_type" w="min-w-20" edit={canEdit} onCommit={commitCell} />
                      <Cell row={row} k="target_count" w="w-14" num edit={canEdit} onCommit={commitCell} />
                      <Cell row={row} k="filled_count" w="w-14" num edit={canEdit} onCommit={commitCell} />
                      <td className="px-2.5 py-1.5">
                        <div className="flex items-center gap-1.5">
                          <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
                            <div
                              className="h-full rounded-full bg-[color:var(--chart-1)]"
                              style={{ width: `${prog}%` }}
                            />
                          </div>
                          <span className="text-[10.5px] text-muted-foreground">
                            {Math.round(prog)}%
                          </span>
                        </div>
                      </td>
                      <Cell row={row} k="opened_at" w="min-w-24" edit={canEdit} onCommit={commitCell} />
                      <td className="px-2.5 py-1.5 whitespace-nowrap">
                        <input
                          defaultValue={row.target_close_at ?? ""}
                          readOnly={!canEdit}
                          placeholder="YYYY-MM-DD"
                          className="w-24 bg-transparent outline-none focus:bg-accent/40"
                          onBlur={(e) => canEdit && commitCell(row, "target_close_at", e.target.value)}
                        />
                        <span
                          className={`ml-1 text-[10px] font-bold ${
                            dday(row.target_close_at).startsWith("D+")
                              ? "text-destructive"
                              : "text-muted-foreground"
                          }`}
                        >
                          {dday(row.target_close_at)}
                        </span>
                      </td>
                      <Cell row={row} k="owner_name" w="min-w-16" edit={canEdit} onCommit={commitCell} />
                      <td className="px-1.5 py-1.5 whitespace-nowrap">
                        {canEdit ? (
                          <div className="flex gap-0.5">
                            {row.status !== "closed" ? (
                              <IconBtn title="종료·보관" onClick={() => setStatus(row, "closed")}>
                                <Archive className="size-3.5" />
                              </IconBtn>
                            ) : (
                              <IconBtn title="다시 진행" onClick={() => setStatus(row, "open")}>
                                <RotateCcw className="size-3.5" />
                              </IconBtn>
                            )}
                            {row.status === "open" ? (
                              <IconBtn title="보류" onClick={() => setStatus(row, "hold")}>
                                <PauseCircle className="size-3.5" />
                              </IconBtn>
                            ) : row.status === "hold" ? (
                              <IconBtn title="다시 진행" onClick={() => setStatus(row, "open")}>
                                <RotateCcw className="size-3.5" />
                              </IconBtn>
                            ) : null}
                          </div>
                        ) : (
                          <Badge variant="outline" className="text-[10px]">
                            {STATUS_TAB[row.status]}
                          </Badge>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>

      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>신규 포지션</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <Field label="포지션명 *" span2>
              <Input
                value={draft.title}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                placeholder="예: 백엔드 개발자"
              />
            </Field>
            <Field label="부서">
              <Input value={draft.department} onChange={(e) => setDraft({ ...draft, department: e.target.value })} />
            </Field>
            <Field label="직군">
              <Input value={draft.job_family} onChange={(e) => setDraft({ ...draft, job_family: e.target.value })} placeholder="개발/마케팅/영업…" />
            </Field>
            <Field label="고용형태">
              <Input value={draft.employment_type} onChange={(e) => setDraft({ ...draft, employment_type: e.target.value })} />
            </Field>
            <Field label="TO (목표 인원)">
              <Input type="number" value={draft.target_count} onChange={(e) => setDraft({ ...draft, target_count: e.target.value })} />
            </Field>
            <Field label="마감 목표일">
              <Input placeholder="YYYY-MM-DD" value={draft.target_close_at} onChange={(e) => setDraft({ ...draft, target_close_at: e.target.value })} />
            </Field>
            <Field label="채용 담당">
              <Input value={draft.owner_name} onChange={(e) => setDraft({ ...draft, owner_name: e.target.value })} />
            </Field>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewOpen(false)}>
              취소
            </Button>
            <Button onClick={createPosition} disabled={saving}>
              {saving ? <Loader2 className="animate-spin" /> : null}생성
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function Cell({
  row,
  k,
  w,
  num,
  bold,
  edit,
  onCommit,
}: {
  row: Position;
  k: keyof Position;
  w?: string;
  num?: boolean;
  bold?: boolean;
  edit: boolean;
  onCommit: (row: Position, k: keyof Position, v: string) => void;
}) {
  return (
    <td className={`p-0 ${w ?? ""}`}>
      <input
        defaultValue={String(row[k] ?? "")}
        readOnly={!edit}
        inputMode={num ? "numeric" : undefined}
        className={`w-full bg-transparent px-2.5 py-1.5 outline-none focus:bg-accent/40 read-only:cursor-default ${
          bold ? "font-semibold" : ""
        }`}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
        }}
        onBlur={(e) => edit && onCommit(row, k, e.target.value)}
      />
    </td>
  );
}

function IconBtn({
  title,
  onClick,
  children,
}: {
  title: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
    >
      {children}
    </button>
  );
}

function Field({
  label,
  span2,
  children,
}: {
  label: string;
  span2?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={`space-y-1 ${span2 ? "col-span-2" : ""}`}>
      <label className="text-[11px] font-semibold text-muted-foreground">
        {label}
      </label>
      {children}
    </div>
  );
}
