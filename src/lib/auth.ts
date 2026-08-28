import { createClient } from "@/lib/supabase/server";

export type AppRole = "admin" | "editor" | "viewer";

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: AppRole;
  department: string | null;
}

/**
 * 서버 컴포넌트/액션에서 현재 로그인 사용자 + 역할을 조회.
 * 미들웨어가 미로그인 접근을 이미 차단하므로 (app) 레이아웃에서는 항상 값이 있다.
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("name, role, department, email")
    .eq("id", user.id)
    .single();

  return {
    id: user.id,
    email: profile?.email ?? user.email ?? "",
    name: profile?.name ?? (user.email ?? "").split("@")[0],
    role: (profile?.role as AppRole) ?? "viewer",
    department: profile?.department ?? null,
  };
}

export function canEdit(role: AppRole | undefined): boolean {
  return role === "admin" || role === "editor";
}

export function isAdmin(role: AppRole | undefined): boolean {
  return role === "admin";
}
