"use client";

import { LogOut } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useSession } from "@/components/session-provider";
import { signOutAction } from "@/app/login/actions";

const ROLE_LABEL: Record<string, string> = {
  admin: "관리자",
  editor: "편집자",
  viewer: "뷰어",
};

export function UserMenu() {
  const user = useSession();
  const initial = (user?.name ?? "?").trim().charAt(0).toUpperCase() || "?";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex items-center gap-2 rounded-md px-1.5 py-1 outline-none hover:bg-muted">
        <Avatar className="size-7">
          <AvatarFallback className="bg-primary text-[11px] font-bold text-primary-foreground">
            {initial}
          </AvatarFallback>
        </Avatar>
        <div className="hidden leading-tight sm:block">
          <div className="text-xs font-bold">{user?.name ?? "사용자"}</div>
          <div className="text-[10px] text-muted-foreground">
            {ROLE_LABEL[user?.role ?? "viewer"]}
          </div>
        </div>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <div className="px-2 py-1.5">
          <div className="text-[12px] font-bold">{user?.name}</div>
          <div className="text-[11px] text-muted-foreground">{user?.email}</div>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => {
            void signOutAction();
          }}
          className="text-destructive"
        >
          <LogOut className="size-3.5" />
          로그아웃
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
