import { redirect } from "next/navigation";
import Image from "next/image";
import { CalendarDays, Sparkles } from "lucide-react";
import { getAdminDb } from "@/lib/firebase-admin";
import { getSession, isEmployeeSession } from "@/lib/session";
import { isSameJakartaDay } from "@/lib/date";
import { BottomNav } from "@/components/BottomNav";
import { EmployeeNav } from "@/components/EmployeeNav";
import { AbsenPanel } from "@/components/AbsenPanel";
import { AbsenMapBackground } from "@/components/AbsenMapBackground";
import { Avatar } from "@/components/ui/Avatar";

// docs/features.md — Halaman Absen: auth guard, redirect ke /login kalau belum login.
export default async function AbsenPage() {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }
  if (!isEmployeeSession(session)) {
    redirect("/admin");
  }

  const db = getAdminDb();
  const [activeSnap, employeeDoc] = await Promise.all([
    db
      .collection("absences")
      .where("employeeId", "==", session.employeeId)
      .where("checkoutTime", "==", null)
      .limit(1)
      .get(),
    db.collection("employees").doc(session.employeeId).get(),
  ]);
  const activeSessionCheckinTime: string | null = activeSnap.empty
    ? null
    : activeSnap.docs[0].data().checkinTime;
  // Sesi aktif cuma dianggap "sedang berjalan" kalau checkin-nya hari ini —
  // sesi dari hari sebelumnya yang belum checkout ditutup otomatis saat
  // karyawan menekan Checkin/Checkout (lihat /api/absences/checkin & checkout).
  const hasActiveSession =
    activeSessionCheckinTime != null &&
    isSameJakartaDay(new Date(activeSessionCheckinTime), new Date());
  const avatarPhotoUrl: string | null = employeeDoc.data()?.photoUrl ?? null;

  const today = new Date().toLocaleDateString("id-ID", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="flex flex-1">
      <EmployeeNav active="absen" />
      <div className="flex flex-1 flex-col bg-slate-50">
        <header className="relative z-20 flex items-center justify-between bg-white/95 px-5 py-4 shadow-sm backdrop-blur-sm lg:px-8">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 ring-2 ring-indigo-50">
              <Image src="/logo.png" alt="SJB Attendance" width={28} height={28} />
            </span>
            <span className="text-lg font-extrabold tracking-tight text-slate-900 lg:text-xl">
              SJB Attendance
            </span>
          </div>
          <Avatar name={session.name} size="md" />
        </header>

        <main className="relative flex-1 overflow-hidden">
          <AbsenMapBackground avatarName={session.name} avatarPhotoUrl={avatarPhotoUrl} />

          <div className="absolute left-4 right-4 top-4 z-10 overflow-hidden rounded-[28px] bg-white/90 shadow-2xl shadow-slate-900/10 ring-1 ring-white/60 backdrop-blur-xl sm:right-auto sm:w-80">
            <div className="pointer-events-none absolute -right-8 -top-10 h-28 w-28 rounded-full bg-gradient-to-br from-indigo-400/30 to-violet-500/30 blur-2xl" />

            <div className="relative flex items-center gap-3 px-5 pb-3 pt-4">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-md shadow-indigo-500/25">
                <Sparkles size={16} strokeWidth={2.25} />
              </span>
              <div className="min-w-0">
                <h1 className="truncate text-lg font-extrabold leading-tight tracking-tight text-slate-900">
                  Halo, {session.name.split(" ")[0]} 👋
                </h1>
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-400">
                  <CalendarDays size={11} strokeWidth={2.5} />
                  {today}
                </span>
              </div>
            </div>

            <div
              className={`relative flex items-center gap-2 border-t px-5 py-3 text-xs font-semibold ${
                hasActiveSession
                  ? "border-emerald-100 bg-gradient-to-r from-emerald-50 to-teal-50/60 text-emerald-700"
                  : "border-slate-100 bg-slate-50/60 text-slate-500"
              }`}
            >
              <span className="relative flex h-2 w-2">
                {hasActiveSession && (
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                )}
                <span
                  className={`relative inline-flex h-2 w-2 rounded-full ${
                    hasActiveSession ? "bg-emerald-500" : "bg-slate-400"
                  }`}
                />
              </span>
              {hasActiveSession ? "Sedang Bekerja" : "Belum Absen Hari Ini"}
            </div>
          </div>

          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center p-4">
            <div className="pointer-events-auto">
              <AbsenPanel
                hasActiveSession={hasActiveSession}
                activeSessionCheckinTime={hasActiveSession ? activeSessionCheckinTime : null}
                avatarName={session.name}
                avatarPhotoUrl={avatarPhotoUrl}
              />
            </div>
          </div>
        </main>

        <BottomNav active="absen" />
      </div>
    </div>
  );
}
