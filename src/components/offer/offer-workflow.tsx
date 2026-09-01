"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Plus,
  FolderOpen,
  Save,
  Download,
  Copy,
  Send,
  Sparkles,
  Loader2,
  Trash2,
  Mail,
  Check,
  Archive,
} from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { loadActiveRows } from "@/lib/analytics";
import { useSession } from "@/components/session-provider";
import {
  listOfferCases,
  createOfferCase,
  updateOfferCase,
  deleteOfferCase,
  listReferenceChecks,
  addReferenceCheck,
  deleteReferenceCheck,
  type OfferCase,
  type OfferPayload,
  type ReferenceCheck,
} from "@/lib/offer-cases";
import { computeCareer, raisePct, AR_BENEFIT_TOTAL, type CareerRow } from "@/lib/career-calc";
import { buildOfferXlsx, buildTeamsMessage } from "@/lib/offer-xlsx";
import { downloadBlob } from "@/lib/xlsx";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

const STATUS_LABEL = { draft: "작성중", review: "검토요청", sent: "전송완료", archived: "보관" } as const;
const won = (v: unknown) => {
  const n = Number(String(v ?? "").replace(/[, ]/g, ""));
  return Number.isFinite(n) ? n : 0;
};
const fmtWon = (n: number) => `${Math.round(n).toLocaleString("ko-KR")}원`;

export function OfferWorkflow() {
  const me = useSession();
  const canEdit = me?.role === "admin" || me?.role === "editor";
  const [cases, setCases] = useState<OfferCase[] | null>(null);
  const [selId, setSelId] = useState<string | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const [draft, setDraft] = useState({ division: "", department: "", position: "", candidate: "" });
  const [employees, setEmployees] = useState<Record<string, unknown>[]>([]);

  const load = useCallback(async () => {
    try {
      const list = await listOfferCases();
      setCases(list);
      if (!selId && list.length) setSelId(list[0].id);
    } catch {
      toast.error("처우 케이스를 불러오지 못했습니다.");
    }
  }, [selId]);

  useEffect(() => {
    void load();
    void loadActiveRows(["employees"]).then((d) => setEmployees(d.employees ?? []));
    const supabase = createClient();
    const ch = supabase
      .channel("offer-cases")
      .on("postgres_changes", { event: "*", schema: "public", table: "offer_cases" }, () => void load())
      .on("postgres_changes", { event: "*", schema: "public", table: "dataset_rows" }, () =>
        loadActiveRows(["employees"]).then((d) => setEmployees(d.employees ?? [])),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
  }, [load]);

  const groups = useMemo(() => {
    const m = new Map<string, OfferCase[]>();
    for (const c of cases ?? []) {
      const g = c.division?.trim() || "(본부 미지정)";
      (m.get(g) ?? m.set(g, []).get(g)!).push(c);
    }
    return [...m.entries()];
  }, [cases]);

  const selected = cases?.find((c) => c.id === selId) ?? null;

  const create = async () => {
    if (!draft.position.trim() || !draft.candidate.trim()) {
      toast.error("포지션과 이름을 입력해주세요.");
      return;
    }
    try {
      const oc = await createOfferCase({
        division: draft.division,
        department: draft.department,
        position: draft.position.trim(),
        candidate_name: draft.candidate.trim(),
        created_by_name: me?.name ?? null,
      });
      toast.success("처우 케이스가 생성되었습니다.");
      setNewOpen(false);
      setDraft({ division: "", department: "", position: "", candidate: "" });
      setSelId(oc.id);
      void load();
    } catch {
      toast.error("생성 실패 (편집 권한 필요)");
    }
  };

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-2">
        <h2 className="text-[13px] font-extrabold">처우 확인사항</h2>
        <span className="text-[11px] text-muted-foreground">
          제안 연봉 산정 · 담당자 의견 · 레퍼런스 체크 · 본부별 아카이브
        </span>
        {canEdit ? (
          <Button size="xs" className="ml-auto" onClick={() => setNewOpen(true)}>
            <Plus />
            신규 케이스
          </Button>
        ) : null}
      </div>

      <div className="grid gap-4 lg:grid-cols-[240px_1fr]">
        {/* 케이스 트리 (본부별) */}
        <Card className="h-fit">
          <CardHeader className="py-3">
            <CardTitle className="text-[12px]">아카이브</CardTitle>
          </CardHeader>
          <CardContent className="p-2">
            {cases === null ? (
              <Skeleton className="h-24 w-full" />
            ) : cases.length === 0 ? (
              <p className="px-2 py-4 text-[11.5px] text-muted-foreground">
                케이스가 없습니다.
              </p>
            ) : (
              <div className="space-y-2 text-[12px]">
                {groups.map(([div, list]) => (
                  <div key={div}>
                    <div className="flex items-center gap-1 px-1 font-bold text-muted-foreground">
                      <FolderOpen className="size-3.5" />
                      {div}
                    </div>
                    <div className="mt-0.5 space-y-0.5">
                      {list.map((c) => (
                        <button
                          key={c.id}
                          onClick={() => setSelId(c.id)}
                          className={`block w-full rounded px-2 py-1 text-left ${
                            c.id === selId ? "bg-accent font-semibold" : "hover:bg-muted"
                          }`}
                        >
                          <div className="truncate">
                            {c.position} · {c.candidate_name}
                          </div>
                          <div className="text-[10px] text-muted-foreground">
                            {c.created_at.slice(0, 10)} · {STATUS_LABEL[c.status]}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {selected ? (
          <CaseEditor
            key={selected.id}
            oc={selected}
            canEdit={canEdit}
            employees={employees}
            meName={me?.name ?? null}
            onChanged={load}
            onDeleted={() => {
              setSelId(null);
              void load();
            }}
          />
        ) : (
          <Card>
            <CardContent className="py-12 text-center text-[12.5px] text-muted-foreground">
              왼쪽에서 케이스를 선택하거나 <b>신규 케이스</b>를 만드세요.
            </CardContent>
          </Card>
        )}
      </div>

      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>신규 처우 케이스</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <L label="본부">
              <Input value={draft.division} onChange={(e) => setDraft({ ...draft, division: e.target.value })} placeholder="예: 생산본부" />
            </L>
            <L label="부서">
              <Input value={draft.department} onChange={(e) => setDraft({ ...draft, department: e.target.value })} placeholder="예: SCM팀" />
            </L>
            <L label="포지션 *">
              <Input value={draft.position} onChange={(e) => setDraft({ ...draft, position: e.target.value })} placeholder="예: 품질담당자" />
            </L>
            <L label="이름 *">
              <Input value={draft.candidate} onChange={(e) => setDraft({ ...draft, candidate: e.target.value })} />
            </L>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewOpen(false)}>취소</Button>
            <Button onClick={create}>생성</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

function L({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-[11px] font-semibold text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}

function CaseEditor({
  oc,
  canEdit,
  employees,
  meName,
  onChanged,
  onDeleted,
}: {
  oc: OfferCase;
  canEdit: boolean;
  employees: Record<string, unknown>[];
  meName: string | null;
  onChanged: () => void;
  onDeleted: () => void;
}) {
  const [p, setP] = useState<OfferPayload>(oc.payload ?? {});
  const [career, setCareer] = useState<CareerRow[]>(
    oc.career_rows?.length ? oc.career_rows : [{ company: "", start: "", end: "" }],
  );
  const [notes, setNotes] = useState(oc.interviewer_notes ?? "");
  const [jdText, setJdText] = useState(oc.jd_text ?? "");
  const [jdUrl, setJdUrl] = useState(oc.jd_url ?? "");
  const [opinion, setOpinion] = useState(oc.opinion_draft ?? "");
  const [busy, setBusy] = useState<string | null>(null);
  const [refs, setRefs] = useState<ReferenceCheck[]>([]);
  const [refDraft, setRefDraft] = useState({ name: "", email: "", relationship: "" });

  useEffect(() => {
    void listReferenceChecks(oc.id).then(setRefs).catch(() => {});
  }, [oc.id]);

  const careerResult = useMemo(() => computeCareer(career), [career]);
  useEffect(() => {
    setP((x) => ({ ...x, total_career_label: careerResult.label }));
  }, [careerResult.label]);

  const teamRows = useMemo(() => {
    const dept = oc.department?.trim();
    const div = oc.division?.trim();
    return employees
      .filter((e) => {
        const ed = String(e.department ?? "").trim();
        const ev = String(e.division ?? "").trim();
        if (dept) return ed === dept;
        if (div) return ev === div;
        return true;
      })
      .map((e) => ({
        division: String(e.division ?? ""),
        department: String(e.department ?? ""),
        grade: String(e.grade ?? ""),
        salary: won(e.annual_salary),
        career: String(e.career_years ?? ""),
      }))
      .slice(0, 30);
  }, [employees, oc.department, oc.division]);

  const prev = won(p.prev_salary);
  const base = won(p.proposed_base);
  const laborCost = won(p.labor_cost_total) || AR_BENEFIT_TOTAL;

  const save = async (extra?: Partial<Parameters<typeof updateOfferCase>[1]>) => {
    setBusy("save");
    try {
      await updateOfferCase(oc.id, {
        payload: { ...p, total_career_label: careerResult.label },
        career_rows: career,
        interviewer_notes: notes,
        jd_text: jdText,
        jd_url: jdUrl,
        opinion_draft: opinion,
        ...extra,
      });
      toast.success("저장되었습니다.");
      onChanged();
    } catch {
      toast.error("저장 실패");
    } finally {
      setBusy(null);
    }
  };

  const genOpinion = async () => {
    setBusy("opinion");
    try {
      const res = await fetch("/api/opinion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          candidate: oc.candidate_name,
          position: oc.position,
          proposedGrade: p.proposed_grade,
          prevSalary: prev,
          proposedBase: base,
          interviewerNotes: notes,
          jdText,
          careerLabel: careerResult.label,
        }),
      });
      const json = await res.json();
      setOpinion(json.text ?? "");
      toast[json.mode === "ai" ? "success" : "message"](
        json.mode === "ai" ? "AI 초안 생성 완료" : json.hint ?? "규칙 기반 초안 생성",
      );
    } catch {
      toast.error("의견 초안 생성 실패");
    } finally {
      setBusy(null);
    }
  };

  const doXlsx = async () => {
    const { blob, fileName } = await buildOfferXlsx(
      { ...oc, payload: p, career_rows: career, opinion_draft: opinion },
      teamRows,
    );
    downloadBlob(blob, fileName);
  };

  const copyTeams = async () => {
    const msg = buildTeamsMessage({ ...oc, payload: p, opinion_draft: opinion });
    await navigator.clipboard?.writeText(msg);
    await updateOfferCase(oc.id, { teams_message: msg });
    toast.success("팀즈 메시지를 복사했습니다. 채팅에 붙여넣으세요.");
  };

  const sendOneDrive = async () => {
    setBusy("send");
    try {
      const { base64, fileName } = await buildOfferXlsx(
        { ...oc, payload: p, career_rows: career, opinion_draft: opinion },
        teamRows,
      );
      const res = await fetch("/api/ms/onedrive-save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          division: oc.division,
          position: oc.position,
          candidate: oc.candidate_name,
          fileBase64: base64,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? "전송 실패");
        return;
      }
      await save({
        status: "sent",
        sent_at: new Date().toISOString(),
        onedrive_file_url: json.fileUrl,
        onedrive_folder: json.folderPath,
      });
      toast.success(`OneDrive 저장 완료: ${json.folderPath}/${fileName}`);
    } catch (e) {
      toast.error(String(e));
    } finally {
      setBusy(null);
    }
  };

  const draftReference = async (r: ReferenceCheck) => {
    setBusy("ref-" + r.id);
    try {
      // 레퍼런스 양식 첨부 (public 의 기본 양식)
      let attachmentBase64: string | undefined;
      try {
        const f = await fetch("/reference-check-form.xlsx");
        if (f.ok) {
          const buf = new Uint8Array(await f.arrayBuffer());
          let s = "";
          buf.forEach((b) => (s += String.fromCharCode(b)));
          attachmentBase64 = btoa(s);
        }
      } catch {}
      const res = await fetch("/api/ms/reference-draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          refereeEmail: r.referee_email,
          refereeName: r.referee_name,
          candidate: oc.candidate_name,
          position: oc.position,
          attachmentBase64,
          attachmentName: attachmentBase64 ? "AR_Reference_check_양식.xlsx" : undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        // MS365 미설정 → mailto 폴백
        const subject = encodeURIComponent(
          `[아로마티카] ${oc.candidate_name} 님 레퍼런스 체크 요청`,
        );
        const body = encodeURIComponent(
          `안녕하세요, 아로마티카 인사팀입니다.\n\n${oc.candidate_name} 님 레퍼런스 체크를 요청드립니다.\n첨부 양식 참고 부탁드립니다.\n\n감사합니다.`,
        );
        window.open(`mailto:${r.referee_email}?subject=${subject}&body=${body}`);
        toast.message(
          json.needsSetup
            ? "MS365 미설정 — 기본 메일 앱으로 열었습니다. (첨부는 수동)"
            : json.error ?? "메일 앱으로 열었습니다.",
        );
        return;
      }
      toast.success("Outlook에 초안이 생성되었습니다.");
      void listReferenceChecks(oc.id).then(setRefs);
    } catch (e) {
      toast.error(String(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="text-[13px]">
            {oc.position} · {oc.candidate_name}
            <Badge variant="outline" className="ml-2 text-[10px]">
              {STATUS_LABEL[oc.status]}
            </Badge>
          </CardTitle>
          {canEdit ? (
            <Button
              size="xs"
              variant="ghost"
              className="text-destructive"
              onClick={async () => {
                if (confirm("이 케이스를 삭제할까요?")) {
                  await deleteOfferCase(oc.id);
                  onDeleted();
                }
              }}
            >
              <Trash2 />
            </Button>
          ) : null}
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 기본정보 */}
          <Section title="기본 정보">
            <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
              <F label="지원부문" v={p.applied_field} on={(v) => setP({ ...p, applied_field: v })} ro={!canEdit} />
              <F label="출생연도" v={p.birth_year} on={(v) => setP({ ...p, birth_year: v })} ro={!canEdit} />
              <F label="성별" v={p.gender} on={(v) => setP({ ...p, gender: v })} ro={!canEdit} />
              <F label="최종 직장" v={p.last_company} on={(v) => setP({ ...p, last_company: v })} ro={!canEdit} />
              <F label="직전연봉(원)" v={p.prev_salary} on={(v) => setP({ ...p, prev_salary: won(v) })} ro={!canEdit} num />
              <F label="입사희망일" v={p.desired_join_date} on={(v) => setP({ ...p, desired_join_date: v })} ro={!canEdit} />
              <F label="제안직급" v={p.proposed_grade} on={(v) => setP({ ...p, proposed_grade: v })} ro={!canEdit} />
              <F label="인정경력" v={careerResult.label} on={() => {}} ro />
            </div>
          </Section>

          {/* 경력산정 */}
          <Section title="경력 산정 (15일 미만 절사 · 인턴 제외)">
            <table className="w-full text-[11.5px]">
              <thead className="bg-muted">
                <tr>
                  {["기업명", "입사일", "퇴사일", "인턴", ""].map((h) => (
                    <th key={h} className="px-2 py-1 text-left font-semibold">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {career.map((c, i) => (
                  <tr key={i} className="border-b">
                    <td className="p-0">
                      <input className="w-full bg-transparent px-2 py-1 outline-none focus:bg-accent/40" value={c.company} readOnly={!canEdit}
                        onChange={(e) => setCareer(career.map((x, j) => (j === i ? { ...x, company: e.target.value } : x)))} />
                    </td>
                    <td className="p-0">
                      <input className="w-full bg-transparent px-2 py-1 outline-none focus:bg-accent/40" placeholder="YYYY-MM-DD" value={c.start} readOnly={!canEdit}
                        onChange={(e) => setCareer(career.map((x, j) => (j === i ? { ...x, start: e.target.value } : x)))} />
                    </td>
                    <td className="p-0">
                      <input className="w-full bg-transparent px-2 py-1 outline-none focus:bg-accent/40" placeholder="YYYY-MM-DD" value={c.end} readOnly={!canEdit}
                        onChange={(e) => setCareer(career.map((x, j) => (j === i ? { ...x, end: e.target.value } : x)))} />
                    </td>
                    <td className="px-2 py-1 text-center">
                      <input type="checkbox" checked={!!c.isIntern} disabled={!canEdit}
                        onChange={(e) => setCareer(career.map((x, j) => (j === i ? { ...x, isIntern: e.target.checked } : x)))} />
                    </td>
                    <td className="px-1 py-1 text-center">
                      {canEdit ? (
                        <button className="text-muted-foreground hover:text-destructive" onClick={() => setCareer(career.filter((_, j) => j !== i))}>
                          <Trash2 className="size-3" />
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-1.5 flex items-center gap-2">
              {canEdit ? (
                <Button size="xs" variant="secondary" onClick={() => setCareer([...career, { company: "", start: "", end: "" }])}>
                  <Plus />행 추가
                </Button>
              ) : null}
              <span className="text-[11.5px] font-bold">
                총 인정경력: {careerResult.label} ({careerResult.totalMonths}개월)
              </span>
            </div>
          </Section>

          {/* 산정내역 + 제안 상세 */}
          <Section title="제안 연봉 상세">
            <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
              <F label="제안연봉(기본급, 원)" v={p.proposed_base} on={(v) => setP({ ...p, proposed_base: won(v) })} ro={!canEdit} num />
              <F label="제안월급(원)" v={p.proposed_monthly} on={(v) => setP({ ...p, proposed_monthly: won(v) })} ro={!canEdit} num />
              <F label="인건비(식대·복지 포함, 원)" v={p.labor_cost_total} on={(v) => setP({ ...p, labor_cost_total: won(v) })} ro={!canEdit} num />
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2 rounded-md bg-muted/40 p-2 text-[11.5px] md:grid-cols-4">
              <KV k="직전연봉" v={fmtWon(prev)} />
              <KV k="제안(기본급)" v={fmtWon(base)} />
              <KV k="인상률(기본급)" v={`${raisePct(prev, base).toFixed(1)}%`} accent />
              <KV k="인상률(복지포함)" v={`${raisePct(prev, base + laborCost).toFixed(1)}%`} accent />
            </div>
          </Section>

          {/* 팀원 연봉 현황 */}
          <Section title={`팀원 연봉 현황 (${oc.department || oc.division || "전체"})`}>
            {teamRows.length === 0 ? (
              <p className="text-[11.5px] text-muted-foreground">
                <b>전 직원 연봉·조직</b> 데이터를 업로드하면 같은 본부/부서 팀원 연봉이 여기에 표시됩니다.
              </p>
            ) : (
              <div className="max-h-56 overflow-auto rounded border">
                <table className="w-full text-[11.5px]">
                  <thead className="sticky top-0 bg-muted">
                    <tr>{["본부", "부서", "직급", "연봉", "경력"].map((h) => <th key={h} className="px-2 py-1 text-left font-semibold">{h}</th>)}</tr>
                  </thead>
                  <tbody>
                    {teamRows.map((t, i) => (
                      <tr key={i} className="border-b last:border-0">
                        <td className="px-2 py-1">{t.division}</td>
                        <td className="px-2 py-1">{t.department}</td>
                        <td className="px-2 py-1">{t.grade}</td>
                        <td className="px-2 py-1">{t.salary ? fmtWon(t.salary) : "-"}</td>
                        <td className="px-2 py-1 text-muted-foreground">{t.career}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Section>

          {/* 면접관 의견 + JD + 담당자 의견 */}
          <Section title="담당자 의견 (면접관 의견 + JD 반영)">
            <div className="grid gap-2 md:grid-cols-2">
              <div>
                <label className="text-[11px] font-semibold text-muted-foreground">면접관 의견 (붙여넣기)</label>
                <Textarea rows={5} value={notes} readOnly={!canEdit} onChange={(e) => setNotes(e.target.value)} placeholder="면접관들의 코멘트를 붙여넣으세요." />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-muted-foreground">채용공고 JD (텍스트)</label>
                <Textarea rows={5} value={jdText} readOnly={!canEdit} onChange={(e) => setJdText(e.target.value)} placeholder="JD 전문을 붙여넣거나 아래에 링크를 넣으세요." />
              </div>
            </div>
            <div className="mt-2">
              <F label="JD 링크 (선택)" v={jdUrl} on={setJdUrl} ro={!canEdit} />
            </div>
            <div className="mt-2 flex items-center gap-2">
              {canEdit ? (
                <Button size="xs" variant="secondary" onClick={genOpinion} disabled={busy === "opinion"}>
                  {busy === "opinion" ? <Loader2 className="animate-spin" /> : <Sparkles />}
                  의견 초안 생성
                </Button>
              ) : null}
              <span className="text-[10.5px] text-muted-foreground">
                면접관 의견·JD를 반영해 초안을 만들고, 아래에서 다듬어 확정하세요.
              </span>
            </div>
            <Textarea
              className="mt-2"
              rows={8}
              value={opinion}
              readOnly={!canEdit}
              onChange={(e) => setOpinion(e.target.value)}
              placeholder="담당자 의견 (엑셀·팀즈 메시지에 반영됩니다)"
            />
          </Section>

          {/* 레퍼런스 체크 */}
          <Section title="레퍼런스 체크">
            <div className="space-y-1.5">
              {refs.map((r) => (
                <div key={r.id} className="flex flex-wrap items-center gap-2 rounded border bg-muted/30 px-2 py-1.5 text-[11.5px]">
                  <span className="font-medium">{r.referee_name || r.referee_email}</span>
                  <span className="text-muted-foreground">{r.referee_email}</span>
                  {r.relationship ? <span className="text-muted-foreground">· {r.relationship}</span> : null}
                  <Badge variant="outline" className="text-[9px]">{r.status}</Badge>
                  {canEdit ? (
                    <>
                      <Button size="xs" variant="outline" className="ml-auto" disabled={busy === "ref-" + r.id} onClick={() => draftReference(r)}>
                        {busy === "ref-" + r.id ? <Loader2 className="animate-spin" /> : <Mail />}
                        Outlook 초안
                      </Button>
                      <Button size="xs" variant="ghost" className="text-destructive" onClick={async () => { await deleteReferenceCheck(r.id); void listReferenceChecks(oc.id).then(setRefs); }}>
                        <Trash2 />
                      </Button>
                    </>
                  ) : null}
                </div>
              ))}
            </div>
            {canEdit ? (
              <div className="mt-2 grid grid-cols-2 gap-2 md:grid-cols-4">
                <Input className="h-8 text-[12px]" placeholder="레퍼리 이름" value={refDraft.name} onChange={(e) => setRefDraft({ ...refDraft, name: e.target.value })} />
                <Input className="h-8 text-[12px]" placeholder="이메일" value={refDraft.email} onChange={(e) => setRefDraft({ ...refDraft, email: e.target.value })} />
                <Input className="h-8 text-[12px]" placeholder="관계 (전 상사 등)" value={refDraft.relationship} onChange={(e) => setRefDraft({ ...refDraft, relationship: e.target.value })} />
                <Button size="sm" onClick={async () => {
                  if (!refDraft.email.trim()) return toast.error("이메일을 입력해주세요.");
                  await addReferenceCheck({ offer_case_id: oc.id, referee_name: refDraft.name, referee_email: refDraft.email.trim(), relationship: refDraft.relationship, created_by_name: meName });
                  setRefDraft({ name: "", email: "", relationship: "" });
                  void listReferenceChecks(oc.id).then(setRefs);
                }}>
                  <Plus />추가
                </Button>
              </div>
            ) : null}
          </Section>

          {/* 액션 */}
          {canEdit ? (
            <div className="flex flex-wrap gap-2 border-t pt-3">
              <Button size="sm" onClick={() => save()} disabled={busy === "save"}>
                {busy === "save" ? <Loader2 className="animate-spin" /> : <Save />}저장
              </Button>
              <Button size="sm" variant="outline" onClick={doXlsx}>
                <Download />엑셀 다운로드
              </Button>
              <Button size="sm" variant="outline" onClick={copyTeams}>
                <Copy />팀즈 메시지 복사
              </Button>
              <Button size="sm" variant="outline" onClick={sendOneDrive} disabled={busy === "send"}>
                {busy === "send" ? <Loader2 className="animate-spin" /> : <Send />}
                전송 (OneDrive 저장)
              </Button>
              <Button size="sm" variant="outline" onClick={() => save({ status: "archived", archived_at: new Date().toISOString() })}>
                <Archive />아카이브
              </Button>
              {oc.onedrive_file_url ? (
                <a href={oc.onedrive_file_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[11.5px] text-[color:var(--good)]">
                  <Check className="size-3.5" />저장된 파일 열기
                </a>
              ) : null}
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-md border p-3">
      <div className="mb-2 text-[12px] font-extrabold">{title}</div>
      {children}
    </div>
  );
}
function F({
  label,
  v,
  on,
  ro,
  num,
}: {
  label: string;
  v: unknown;
  on: (v: string) => void;
  ro?: boolean;
  num?: boolean;
}) {
  return (
    <div className="space-y-1">
      <label className="text-[10.5px] font-semibold text-muted-foreground">{label}</label>
      <Input
        className="h-8 text-[12px]"
        value={String(v ?? "")}
        readOnly={ro}
        inputMode={num ? "numeric" : undefined}
        onChange={(e) => on(e.target.value)}
      />
    </div>
  );
}
function KV({ k, v, accent }: { k: string; v: string; accent?: boolean }) {
  return (
    <div>
      <div className="text-[10px] text-muted-foreground">{k}</div>
      <div className={`font-bold ${accent ? "text-accent-foreground" : ""}`}>{v}</div>
    </div>
  );
}
