"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type AuthState = { error?: string; notice?: string } | undefined;

export async function signInAction(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const redirectTo = String(formData.get("redirect") ?? "/summary") || "/summary";

  if (!email || !password) return { error: "이메일과 비밀번호를 입력해주세요." };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    if (error.message.toLowerCase().includes("email not confirmed")) {
      return { error: "이메일 인증이 완료되지 않았습니다. 받은 메일의 링크를 눌러주세요." };
    }
    return { error: "이메일 또는 비밀번호가 올바르지 않습니다." };
  }

  redirect(redirectTo.startsWith("/") ? redirectTo : "/summary");
}

export async function signUpAction(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const name = String(formData.get("name") ?? "").trim();

  if (!email || !password) return { error: "이메일과 비밀번호를 입력해주세요." };
  if (password.length < 8) return { error: "비밀번호는 8자 이상으로 설정해주세요." };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { name: name || email.split("@")[0] } },
  });

  if (error) return { error: error.message };

  if (data.session) {
    redirect("/summary");
  }

  return {
    notice:
      "가입 요청이 접수되었습니다. 이메일 인증이 켜져 있으면 받은 메일의 링크를 눌러 완료한 뒤 로그인해주세요.",
  };
}

export async function signOutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
