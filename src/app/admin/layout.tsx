import { redirect } from "next/navigation";
import { getSession, isAdminSession } from "@/lib/session";
import { AdminNav } from "@/components/AdminNav";
import { AdminMobileNav } from "@/components/AdminMobileNav";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!isAdminSession(session)) redirect("/");

  return (
    <div className="flex min-h-dvh flex-1 flex-col bg-slate-50 lg:flex-row">
      <AdminNav />
      <div className="flex flex-1 flex-col">
        <AdminMobileNav />
        <main className="flex-1 overflow-y-auto p-4 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
