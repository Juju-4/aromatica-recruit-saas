import { redirect } from "next/navigation";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { AppTopbar } from "@/components/app-topbar";
import { SessionProvider } from "@/components/session-provider";
import { getSessionUser } from "@/lib/auth";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  return (
    <SessionProvider user={user}>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <AppTopbar />
          <main className="mx-auto w-full max-w-[1400px] flex-1 px-5 py-6 md:px-7">
            {children}
          </main>
        </SidebarInset>
      </SidebarProvider>
    </SessionProvider>
  );
}
