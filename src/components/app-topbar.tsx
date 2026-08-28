"use client";

import { usePathname } from "next/navigation";
import { getNavItem } from "@/lib/nav";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { UserMenu } from "@/components/user-menu";

export function AppTopbar() {
  const pathname = usePathname();
  const slug = pathname.split("/").filter(Boolean)[0] ?? "";
  const item = getNavItem(slug);

  return (
    <header className="sticky top-0 z-10 flex h-14 items-center gap-3 border-b bg-card px-4">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="h-5" />
      <div className="text-xs text-muted-foreground">
        아로마티카 <span className="mx-1">/</span>
        <span className="font-bold text-foreground">
          {item?.title ?? "대시보드"}
        </span>
      </div>
      <div className="ml-auto flex items-center gap-2">
        <span className="hidden rounded-md bg-muted px-2.5 py-1 font-mono text-[11px] text-muted-foreground sm:inline">
          {new Date().toISOString().slice(0, 10)} 기준
        </span>
        <UserMenu />
      </div>
    </header>
  );
}
