import { redirect } from "next/navigation";
import { getAdminDb } from "@/lib/firebase-admin";
import { getSession, isEmployeeSession } from "@/lib/session";
import { BottomNav } from "@/components/BottomNav";
import { EmployeeNav } from "@/components/EmployeeNav";
import { PageHeader } from "@/components/ui/Card";
import { HistoryList } from "@/components/HistoryList";

// docs/features.md — Halaman History: read-only, filter per bulan.
export default async function HistoryPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!isEmployeeSession(session)) redirect("/admin");

  const db = getAdminDb();
  const employeeDoc = await db.collection("employees").doc(session.employeeId).get();
  const avatarPhotoUrl: string | null = employeeDoc.data()?.photoUrl ?? null;

  const now = new Date();
  const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  return (
    <div className="flex h-dvh min-h-0 overflow-hidden">
      <EmployeeNav active="history" />
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-slate-50">
        <main className="flex min-h-0 flex-1 flex-col overflow-hidden p-5 lg:p-8">
          <div className="mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col overflow-hidden">
            <PageHeader
              title="Riwayat Absen"
              description="Riwayat check-in & check-out per bulan."
            />
            <HistoryList
              defaultMonth={defaultMonth}
              avatarName={session.name}
              avatarPhotoUrl={avatarPhotoUrl}
            />
          </div>
        </main>
        <BottomNav active="history" />
      </div>
    </div>
  );
}
