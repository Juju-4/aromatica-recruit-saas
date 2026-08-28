"use client";

import { useCallback, useEffect, useState } from "react";
import { UserPlus, Copy, Check, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { useSession } from "@/components/session-provider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

interface Profile {
  id: string;
  email: string;
  name: string | null;
  role: "admin" | "editor" | "viewer";
  department: string | null;
  status: "active" | "invited" | "disabled";
  created_at: string;
}
interface Invite {
  email: string;
  role: string;
  invited_by_name: string | null;
  created_at: string;
}

const ROLE_LABEL: Record<string, string> = {
  admin: "관리자",
  editor: "편집자",
  viewer: "뷰어",
};
const STATUS_LABEL: Record<string, string> = {
  active: "활성",
  invited: "초대됨",
  disabled: "비활성",
};

export function UsersAdmin() {
  const me = useSession();
  const isAdmin = me?.role === "admin";
  const [profiles, setProfiles] = useState<Profile[] | null>(null);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("viewer");
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    const supabase = createClient();
    const { data: profs } = await supabase
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: true });
    setProfiles((profs ?? []) as Profile[]);
    if (isAdmin) {
      const { data: inv } = await supabase
        .from("pending_invites")
        .select("*")
        .order("created_at", { ascending: false });
      setInvites((inv ?? []) as Invite[]);
    }
  }, [isAdmin]);

  useEffect(() => {
    void load();
  }, [load]);

  const changeRole = async (id: string, role: string) => {
    const supabase = createClient();
    const { error } = await supabase
      .from("profiles")
      .update({ role })
      .eq("id", id);
    if (error) {
      toast.error("역할 변경에 실패했습니다.");
      return;
    }
    toast.success("역할이 변경되었습니다.");
    void load();
  };

  const changeStatus = async (id: string, status: string) => {
    const supabase = createClient();
    const { error } = await supabase
      .from("profiles")
      .update({ status })
      .eq("id", id);
    if (error) {
      toast.error("상태 변경에 실패했습니다.");
      return;
    }
    void load();
  };

  const sendInvite = async () => {
    const email = inviteEmail.trim().toLowerCase();
    if (!email) return;
    setSaving(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.from("pending_invites").upsert({
        email,
        role: inviteRole,
        invited_by: me?.id ?? null,
        invited_by_name: me?.name ?? null,
      });
      if (error) throw error;
      toast.success("초대가 등록되었습니다. 아래 링크를 전달하세요.");
      setInviteEmail("");
      void load();
    } catch (e) {
      console.error(e);
      toast.error("초대 등록에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  };

  const cancelInvite = async (email: string) => {
    const supabase = createClient();
    await supabase.from("pending_invites").delete().eq("email", email);
    void load();
  };

  const signupUrl =
    typeof window !== "undefined" ? `${window.location.origin}/login` : "/login";

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="text-[13px]">사용자 목록</CardTitle>
          {isAdmin ? (
            <Button size="xs" onClick={() => setInviteOpen(true)}>
              <UserPlus />
              사용자 초대
            </Button>
          ) : null}
        </CardHeader>
        <CardContent className="p-0">
          {profiles === null ? (
            <div className="space-y-2 p-4">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          ) : (
            <div className="overflow-x-auto border-t">
              <table className="w-full text-[12px]">
                <thead className="bg-muted">
                  <tr>
                    <th className="px-3 py-2 text-left font-semibold">이름</th>
                    <th className="px-3 py-2 text-left font-semibold">이메일</th>
                    <th className="px-3 py-2 text-left font-semibold">역할</th>
                    <th className="px-3 py-2 text-left font-semibold">부서</th>
                    <th className="px-3 py-2 text-left font-semibold">상태</th>
                    <th className="px-3 py-2 text-left font-semibold">가입일</th>
                  </tr>
                </thead>
                <tbody>
                  {profiles.map((p) => (
                    <tr key={p.id} className="border-b last:border-0">
                      <td className="px-3 py-2 font-medium">
                        {p.name}
                        {p.id === me?.id ? (
                          <span className="ml-1 text-[10px] text-muted-foreground">
                            (나)
                          </span>
                        ) : null}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {p.email}
                      </td>
                      <td className="px-3 py-2">
                        {isAdmin && p.id !== me?.id ? (
                          <Select
                            value={p.role}
                            onValueChange={(v) => v && changeRole(p.id, String(v))}
                          >
                            <SelectTrigger className="h-7 w-28 text-[12px]">
                              <SelectValue>{(v) => ROLE_LABEL[String(v)] ?? String(v)}</SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="admin">관리자</SelectItem>
                              <SelectItem value="editor">편집자</SelectItem>
                              <SelectItem value="viewer">뷰어</SelectItem>
                            </SelectContent>
                          </Select>
                        ) : (
                          <Badge variant="outline" className="text-[10px]">
                            {ROLE_LABEL[p.role]}
                          </Badge>
                        )}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {p.department ?? "—"}
                      </td>
                      <td className="px-3 py-2">
                        {isAdmin && p.id !== me?.id ? (
                          <Select
                            value={p.status}
                            onValueChange={(v) => v && changeStatus(p.id, String(v))}
                          >
                            <SelectTrigger className="h-7 w-24 text-[12px]">
                              <SelectValue>{(v) => STATUS_LABEL[String(v)] ?? String(v)}</SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="active">활성</SelectItem>
                              <SelectItem value="disabled">비활성</SelectItem>
                            </SelectContent>
                          </Select>
                        ) : (
                          <span className="text-muted-foreground">
                            {STATUS_LABEL[p.status]}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {new Date(p.created_at).toLocaleDateString("ko-KR")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {isAdmin && invites.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-[13px]">대기 중인 초대</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {invites.map((iv) => (
              <div
                key={iv.email}
                className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2 text-[12px]"
              >
                <span>
                  {iv.email} · <b>{ROLE_LABEL[iv.role]}</b>
                </span>
                <Button
                  size="xs"
                  variant="ghost"
                  className="text-destructive"
                  onClick={() => cancelInvite(iv.email)}
                >
                  <X /> 취소
                </Button>
              </div>
            ))}
            <p className="text-[11px] text-muted-foreground">
              초대한 이메일로 본인이 아래 링크에서 &lsquo;첫 사용자 등록&rsquo;을 하면
              지정한 역할로 자동 연결됩니다.
            </p>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-[13px]">역할 안내</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1.5 text-[12px]">
          <div>
            <b>관리자</b> — 모든 데이터 + 사용자·권한·조직 관리
          </div>
          <div>
            <b>편집자</b> — 데이터 업로드 · 원본 수정 · 삭제 (설정 변경 불가)
          </div>
          <div>
            <b>뷰어</b> — 분석 결과 및 원본 데이터 열람만 가능
          </div>
        </CardContent>
      </Card>

      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>사용자 초대</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-muted-foreground">
                이메일
              </label>
              <Input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="name@company.com"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-muted-foreground">
                역할
              </label>
              <Select value={inviteRole} onValueChange={(v) => setInviteRole(String(v ?? "viewer"))}>
                <SelectTrigger>
                  <SelectValue>{(v) => ROLE_LABEL[String(v)] ?? String(v)}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">관리자</SelectItem>
                  <SelectItem value="editor">편집자</SelectItem>
                  <SelectItem value="viewer">뷰어</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="rounded-md bg-muted/50 px-3 py-2 text-[11.5px]">
              <div className="mb-1 font-semibold">전달할 등록 링크</div>
              <div className="flex items-center gap-2">
                <code className="flex-1 truncate rounded bg-background px-2 py-1">
                  {signupUrl}
                </code>
                <Button
                  size="xs"
                  variant="outline"
                  onClick={() => {
                    void navigator.clipboard?.writeText(signupUrl);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 1500);
                  }}
                >
                  {copied ? <Check /> : <Copy />}
                </Button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInviteOpen(false)}>
              닫기
            </Button>
            <Button onClick={sendInvite} disabled={saving || !inviteEmail.trim()}>
              {saving ? <Loader2 className="animate-spin" /> : null}
              초대 등록
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
