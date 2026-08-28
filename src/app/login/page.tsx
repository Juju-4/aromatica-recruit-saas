import { Suspense } from "react";
import { LoginForm } from "./login-form";

export const metadata = { title: "로그인 · Recruit SaaS" };

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex size-10 items-center justify-center rounded-lg bg-primary text-primary-foreground text-lg font-extrabold">
            R
          </div>
          <h1 className="text-lg font-extrabold tracking-tight">RECRUIT SaaS</h1>
          <p className="text-[12px] text-muted-foreground">
            아로마티카 HR 분석 플랫폼
          </p>
        </div>
        <Suspense>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
