"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_GROUPS } from "@/lib/nav";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarHeader,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuBadge,
} from "@/components/ui/sidebar";

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <Sidebar>
      <SidebarHeader className="gap-3 px-3 pt-4">
        <div className="flex items-center gap-2.5">
          <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground text-[13px] font-extrabold">
            R
          </div>
          <div className="leading-tight">
            <div className="text-sm font-extrabold tracking-tight text-white">
              RECRUIT SaaS
            </div>
            <div className="text-[10px] font-medium text-sidebar-foreground/70">
              HR ANALYTICS PLATFORM
            </div>
          </div>
        </div>
        <div className="rounded-lg bg-sidebar-accent px-3 py-2.5">
          <div className="text-[12.5px] font-bold text-white">아로마티카</div>
          <div className="mt-0.5 text-[10.5px] text-sidebar-foreground/70">인사팀</div>
          <span className="mt-1.5 inline-block rounded-full bg-sidebar-primary/20 px-2 py-0.5 text-[9.5px] font-extrabold tracking-wider text-sidebar-primary">
            PROFESSIONAL
          </span>
        </div>
      </SidebarHeader>

      <SidebarContent className="px-1">
        {NAV_GROUPS.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel className="text-sidebar-foreground/50">
              {group.label}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => {
                  const href = `/${item.slug}`;
                  const active = pathname === href;
                  return (
                    <SidebarMenuItem key={item.slug}>
                      <SidebarMenuButton
                        isActive={active}
                        render={<Link href={href} />}
                      >
                        <span>{item.title}</span>
                      </SidebarMenuButton>
                      {item.tag && item.tag.startsWith("Tier") ? (
                        <SidebarMenuBadge className="text-sidebar-foreground/60">
                          {item.tag.replace("Tier ", "T").split(" ")[0]}
                        </SidebarMenuBadge>
                      ) : null}
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter className="px-3 pb-4">
        <div className="text-[10px] text-sidebar-foreground/40">
          Powered by AROMATICA
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
