import { redirect } from "next/navigation";
import { Users, ShieldCheck, CalendarCheck2 } from "lucide-react";
import { getAdminDb } from "@/lib/firebase-admin";
import { getSession, isAdminSession } from "@/lib/session";
import { PageHeader } from "@/components/ui/Card";
import { StatCard } from "@/components/ui/StatCard";

// docs/features.md — Halaman Admin: dashboard ringkas, link ke 4 menu utama.
export default async function AdminDashboardPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!isAdminSession(session)) redirect("/");

  const db = getAdminDb();
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [employeesSnap, adminsSnap, todaySnap] = await Promise.all([
    db.collection("employees").where("status", "==", "active").get(),
    db.collection("admins").get(),
    db.collection("absences").where("checkinTime", ">=", todayStart.toISOString()).get(),
  ]);

  return (
    <div>
      <PageHeader title="Dashboard Admin" description="Ringkasan aktivitas absensi hari ini." />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Karyawan Aktif" value={employeesSnap.size} icon={Users} tone="indigo" />
        <StatCard
          label="Absen Hari Ini"
          value={todaySnap.size}
          icon={CalendarCheck2}
          tone="emerald"
        />
        <StatCard label="Total Admin" value={adminsSnap.size} icon={ShieldCheck} tone="amber" />
      </div>

      <p className="mt-6 text-sm text-slate-400">Pilih menu di sisi kiri untuk mengelola data.</p>
    </div>
  );
}
