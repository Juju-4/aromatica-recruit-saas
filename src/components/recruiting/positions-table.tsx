"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, Loader2, Archive, RotateCcw, PauseCircle, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { listPositions, type Position } from "@/lib/positions";
import { useSession } from "@/components/session-provider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

const STATUS_TAB = { open: "진행중", hold: "보류", closed: "종료·보관" } as const;

const COLS: { key: keyof Position; label: string; w: string; num?: boolean }[] = [
  { key: "department", label: "부서", w: "min-w-24" },
  { key: "title", label: "포지션", w: "min-w-40" },
  { key: "channel", label: "채널", w: "min-w-20" },
  { key: "job_level", label: "직책", w: "w-14" },
  { key: "target_count", label: "TO", w: "w-12", num: true },
  { key: "stage1_note", label: "1차 면접", w: "min-w-44" },
  { key: "stage2_note", label: "2차 & 최종 면접", w: "min-w-44" },
  { key: "offer_note", label: "처우협상", w: "min-w-28" },
  { key: "note", label: "비고", w: "min-w-28" },
];

export function PositionsTable() {
  const me = useSession();
  const canEdit = me?.role === "admin" || me?.role === "editor";
  const [rows, setRows] = useState<Position[] | null>(null);
  const [tab, setTab] = useState<"open" | "hold" | "closed">("open");
  const [newOpen, setNewOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState({
    division: "",
    department: "",
    title: "",
    channel: "",
    job_level: "",
    target_count: "1",
  });

  const load = useCallback(async () => {
    try {
      setRows(await listPositions());
    } catch {
      toast.error("포지션을 불러오지 못했습니다.");
    }
  }, []);

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
    setRows((prev) => prev?.map((r) => (r.id === id ? { ...r, ...p } : r)) ?? prev);
    const supabase = createClient();
    const { error } = await supabase.from("positions").update(p).eq("id", id);
    if (error) {
      toast.error("저장 실패 (편집 권한 필요)");
      void load();
    }
  };

  const commit = (row: Position, key: keyof Position, raw: string) => {
    const value =
      key === "target_count" || key === "filled_count" ? Number(raw) || 0 : raw || null;
    if (String(row[key] ?? "") === String(value ?? "")) return;
    void patch(row.id, { [key]: value } as Partial<Position>);
  };

  const setStatus = async (row: Position, status: Position["status"]) => {
    await patch(row.id, {
      status,
      closed_at: status === "closed" ? new Date().toISOString().slice(0, 10) : null,
    });
    void load();
  };

  const remove = async (row: Position) => {
    if (!confirm(`"${row.title}" 포지션을 삭제할까요? (보관은 '종료·보관'을 쓰세요)`))
      return;
    const supabase = createClient();
    const { error } = await supabase.from("positions").delete().eq("id", row.id);
    if (error) toast.error("삭제 실패");
    else void load();
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
        division: draft.division || null,
        department: draft.department || null,
        title: draft.title.trim(),
        channel: draft.channel || null,
        job_level: draft.job_level || null,
        target_count: Number(draft.target_count) || 1,
        opened_at: new Date().toISOString().slice(0, 10),
        sort_key: (rows?.length ?? 0) + 1,
      });
      if (error) throw error;
      toast.success("포지션이 생성되었습니다.");
      void load();
      setNewOpen(false);
      setDraft({ division: "", department: "", title: "", channel: "", job_level: "", target_count: "1" });
    } catch {
      toast.error("생성 실패 (편집 권한 필요)");
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

  // 본부별 그룹핑 (원본 정렬 순서 유지)
  const groups = useMemo(() => {
    const m = new Map<string, Position[]>();
    for (const r of visible) {
      const g = r.division?.trim() || "(본부 미지정)";
      (m.get(g) ?? m.set(g, []).get(g)!).push(r);
    }
    return [...m.entries()];
  }, [visible]);

  const openRows = rows?.filter((r) => r.status === "open") ?? [];
  const totalTO = openRows.reduce((s, r) => s + (r.target_count || 0), 0);

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-3">
        <div>
          <CardTitle className="text-[13px]">채용 포지션 현황</CardTitle>
          <p className="mt-1 text-[11.5px] text-muted-foreground">
            진행중 {counts.open}건 · TO 합계 {totalTO}명 · 본부별 · 셀 클릭해 바로
            수정 · 종료하면 &lsquo;종료·보관&rsquo; 탭으로 이동
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
            {(["open", "hold", "closed"] as const).map((kk) => (
              <TabsTrigger key={kk} value={kk}>
                {STATUS_TAB[kk]} ({counts[kk]})
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        {rows === null ? (
          <Skeleton className="h-32 w-full" />
        ) : visible.length === 0 ? (
          <div className="rounded-md border border-dashed bg-muted/20 px-4 py-8 text-center text-[12.5px] text-muted-foreground">
            {tab === "open"
              ? "진행 중인 포지션이 없습니다. ‘신규 포지션’으로 추가하거나, 우측 상단 ‘데이터 업로드’로 포지션 현황표를 올려보세요."
              : `${STATUS_TAB[tab]} 포지션이 없습니다.`}
          </div>
        ) : (
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-[11.5px]">
              <thead className="bg-muted">
                <tr>
                  <th className="px-2.5 py-2 text-left font-semibold">본부</th>
                  {COLS.map((c) => (
                    <th key={String(c.key)} className="px-2.5 py-2 text-left font-semibold whitespace-nowrap">
                      {c.label}
                    </th>
                  ))}
                  {canEdit ? <th className="w-16 px-2 py-2" /> : null}
                </tr>
              </thead>
              <tbody>
                {groups.map(([division, list]) =>
                  list.map((row, idx) => (
                    <tr key={row.id} className="border-t hover:bg-muted/30">
                      {idx === 0 ? (
                        <td
                          rowSpan={list.length}
                          className="border-r bg-muted/40 px-2.5 py-1.5 align-top font-bold whitespace-nowrap"
                        >
                          {division}
                        </td>
                      ) : null}
                      {COLS.map((c) => (
                        <td key={String(c.key)} className={`p-0 ${c.w}`}>
                          <input
                            defaultValue={String(row[c.key] ?? "")}
                            readOnly={!canEdit}
                            inputMode={c.num ? "numeric" : undefined}
                            className={`w-full bg-transparent px-2.5 py-1.5 outline-none focus:bg-accent/40 read-only:cursor-default ${
                              c.key === "title" ? "font-semibold" : ""
                            }`}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") e.currentTarget.blur();
                            }}
                            onBlur={(e) => canEdit && commit(row, c.key, e.target.value)}
                          />
                        </td>
                      ))}
                      {canEdit ? (
                        <td className="px-1 py-1 whitespace-nowrap">
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
                            <IconBtn title="삭제" onClick={() => remove(row)}>
                              <Trash2 className="size-3.5 text-destructive" />
                            </IconBtn>
                          </div>
                        </td>
                      ) : null}
                    </tr>
                  )),
                )}
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
            <Field label="본부">
              <Input value={draft.division} onChange={(e) => setDraft({ ...draft, division: e.target.value })} />
            </Field>
            <Field label="부서">
              <Input value={draft.department} onChange={(e) => setDraft({ ...draft, department: e.target.value })} />
            </Field>
            <Field label="포지션명 *" span2>
              <Input
                value={draft.title}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                placeholder="예: 원료구매담당자"
              />
            </Field>
            <Field label="채널">
              <Input value={draft.channel} onChange={(e) => setDraft({ ...draft, channel: e.target.value })} placeholder="사람인 / 잡코리아…" />
            </Field>
            <Field label="직책">
              <Input value={draft.job_level} onChange={(e) => setDraft({ ...draft, job_level: e.target.value })} placeholder="L / M / D" />
            </Field>
            <Field label="TO (목표 인원)">
              <Input type="number" value={draft.target_count} onChange={(e) => setDraft({ ...draft, target_count: e.target.value })} />
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
      <label className="text-[11px] font-semibold text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}
