import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { AppTopbar } from "@/components/app-topbar";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <AppTopbar />
        <main className="mx-auto w-full max-w-[1400px] flex-1 px-5 py-6 md:px-7">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
