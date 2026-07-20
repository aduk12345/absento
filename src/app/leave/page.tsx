import { redirect } from "next/navigation";
import { getSession, isEmployeeSession } from "@/lib/session";
import { BottomNav } from "@/components/BottomNav";
import { EmployeeNav } from "@/components/EmployeeNav";
import { PageHeader } from "@/components/ui/Card";
import { LeaveList } from "@/components/LeaveList";

// Halaman Izin karyawan: ajukan izin (tanggal + alasan wajib) & lihat riwayat pengajuan
// sendiri (status pending/approved/rejected).
export default async function LeavePage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!isEmployeeSession(session)) redirect("/admin");

  return (
    <div className="flex h-dvh min-h-0 overflow-hidden">
      <EmployeeNav active="izin" />
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-slate-50">
        <main className="flex min-h-0 flex-1 flex-col overflow-y-auto p-5 lg:p-8">
          <div className="mx-auto w-full max-w-3xl">
            <PageHeader title="Izin" description="Ajukan izin dan lihat riwayat pengajuan." />
            <LeaveList />
          </div>
        </main>
        <BottomNav active="izin" />
      </div>
    </div>
  );
}
