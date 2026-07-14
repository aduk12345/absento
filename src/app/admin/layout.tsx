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
      <AdminNav role={session.role} />
      <div className="flex flex-1 flex-col">
        <AdminMobileNav role={session.role} />
        <main className="flex-1 overflow-y-auto p-4 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
