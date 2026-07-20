import { redirect } from "next/navigation";
import Link from "next/link";
import { Users, ShieldCheck, CalendarCheck2, FileClock, ChevronRight } from "lucide-react";
import { getAdminDb } from "@/lib/firebase-admin";
import { getSession, isAdminSession } from "@/lib/session";
import { PageHeader } from "@/components/ui/Card";
import { StatCard } from "@/components/ui/StatCard";
import { ADMIN_NAV_ITEMS } from "@/lib/adminNav";

// docs/features.md — Halaman Admin: dashboard ringkas, link ke semua menu utama.
export default async function AdminDashboardPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!isAdminSession(session)) redirect("/");

  const db = getAdminDb();
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayIso = todayStart.toISOString().slice(0, 10);

  const [employeesSnap, adminsSnap, todaySnap, approvedLeavesSnap] = await Promise.all([
    db.collection("employees").where("status", "==", "active").get(),
    db.collection("admins").get(),
    db.collection("absences").where("checkinTime", ">=", todayStart.toISOString()).get(),
    db.collection("leave_requests").where("status", "==", "approved").get(),
  ]);

  const leavesTodayCount = approvedLeavesSnap.docs.filter((doc) => {
    const data = doc.data() as { startDate: string; endDate: string };
    return data.startDate <= todayIso && data.endDate >= todayIso;
  }).length;

  const quickMenuItems = ADMIN_NAV_ITEMS.filter(
    (item) => item.href !== "/admin" && (!item.superAdminOnly || session.role === "super_admin")
  );

  return (
    <div>
      <PageHeader title="Dashboard Admin" description="Ringkasan aktivitas absensi hari ini." />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Karyawan Aktif" value={employeesSnap.size} icon={Users} tone="indigo" />
        <StatCard
          label="Absen Hari Ini"
          value={todaySnap.size}
          icon={CalendarCheck2}
          tone="emerald"
        />
        <StatCard label="Izin Hari Ini" value={leavesTodayCount} icon={FileClock} tone="rose" />
        <StatCard label="Total Admin" value={adminsSnap.size} icon={ShieldCheck} tone="amber" />
      </div>

      <h2 className="mt-8 mb-3 text-sm font-semibold text-slate-700">Menu Cepat</h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {quickMenuItems.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_-12px_rgba(15,23,42,0.12)] transition-colors hover:border-indigo-200 hover:bg-indigo-50/50"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                <Icon size={18} strokeWidth={2.25} />
              </span>
              <span className="flex-1 text-sm font-medium text-slate-800">{item.label}</span>
              <ChevronRight size={16} className="text-slate-400" />
            </Link>
          );
        })}
      </div>
    </div>
  );
}
