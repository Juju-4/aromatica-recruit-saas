"use client";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";

/**
 * P1 단계에서는 정적 표시. P3(인증)에서 Supabase 세션·로그아웃과 연결된다.
 */
export function UserMenu() {
  return (
    <div className="flex items-center gap-2 rounded-md px-1.5 py-1">
      <Avatar className="size-7">
        <AvatarFallback className="bg-primary text-[11px] font-bold text-primary-foreground">
          A
        </AvatarFallback>
      </Avatar>
      <div className="hidden leading-tight sm:block">
        <div className="text-xs font-bold">게스트</div>
        <div className="text-[10px] text-muted-foreground">로그인 준비 중</div>
      </div>
    </div>
  );
}
