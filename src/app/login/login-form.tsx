"use client";

import { useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { signInAction, signUpAction, type AuthState } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

function Message({ state }: { state: AuthState }) {
  if (!state) return null;
  if (state.error)
    return (
      <p className="rounded-md bg-destructive/10 px-3 py-2 text-[12px] text-destructive">
        {state.error}
      </p>
    );
  if (state.notice)
    return (
      <p className="rounded-md bg-accent px-3 py-2 text-[12px] text-accent-foreground">
        {state.notice}
      </p>
    );
  return null;
}

export function LoginForm() {
  const params = useSearchParams();
  const redirect = params.get("redirect") ?? "/summary";
  const [signInState, signIn, signInPending] = useActionState(
    signInAction,
    undefined,
  );
  const [signUpState, signUp, signUpPending] = useActionState(
    signUpAction,
    undefined,
  );

  return (
    <Card>
      <CardContent className="pt-6">
        <Tabs defaultValue="signin">
          <TabsList className="mb-4 w-full">
            <TabsTrigger value="signin" className="flex-1">
              로그인
            </TabsTrigger>
            <TabsTrigger value="signup" className="flex-1">
              첫 사용자 등록
            </TabsTrigger>
          </TabsList>

          <TabsContent value="signin">
            <form action={signIn} className="space-y-3">
              <input type="hidden" name="redirect" value={redirect} />
              <div className="space-y-1.5">
                <Label htmlFor="si-email">이메일</Label>
                <Input id="si-email" name="email" type="email" autoComplete="email" required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="si-pw">비밀번호</Label>
                <Input
                  id="si-pw"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                />
              </div>
              <Message state={signInState} />
              <Button type="submit" className="w-full" disabled={signInPending}>
                {signInPending ? "로그인 중…" : "로그인"}
              </Button>
            </form>
          </TabsContent>

          <TabsContent value="signup">
            <form action={signUp} className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="su-name">이름</Label>
                <Input id="su-name" name="name" type="text" autoComplete="name" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="su-email">이메일</Label>
                <Input id="su-email" name="email" type="email" autoComplete="email" required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="su-pw">비밀번호 (8자 이상)</Label>
                <Input
                  id="su-pw"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  minLength={8}
                  required
                />
              </div>
              <Message state={signUpState} />
              <Button type="submit" className="w-full" disabled={signUpPending}>
                {signUpPending ? "등록 중…" : "등록"}
              </Button>
            </form>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
