import { redirect } from "next/navigation";
import { getAdminDb } from "@/lib/firebase-admin";
import { getSession, isEmployeeSession } from "@/lib/session";
import { BottomNav } from "@/components/BottomNav";
import { EmployeeNav } from "@/components/EmployeeNav";
import { PageHeader } from "@/components/ui/Card";
import { ProfileForm, type EmployeeProfile } from "@/components/ProfileForm";

// docs/features.md — Halaman Profile: detail read-only, ganti password, logout.
export default async function ProfilePage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!isEmployeeSession(session)) redirect("/admin");

  const db = getAdminDb();
  const doc = await db.collection("employees").doc(session.employeeId).get();
  const data = doc.data();

  const employee: EmployeeProfile = {
    name: data?.name ?? session.name,
    username: data?.username ?? "-",
    email: data?.email ?? "-",
    phone: data?.phone ?? "-",
    photoUrl: data?.photoUrl ?? null,
  };

  return (
    <div className="flex h-dvh min-h-0 overflow-hidden">
      <EmployeeNav active="profile" />
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-slate-50">
        <main className="flex min-h-0 flex-1 flex-col overflow-hidden p-5 lg:p-8">
          <div className="mx-auto flex min-h-0 w-full max-w-2xl flex-1 flex-col overflow-hidden">
            <PageHeader title="Profile" description="Detail akun & pengaturan" />
            <div className="-mx-1 min-h-0 flex-1 overflow-y-auto px-1">
              <ProfileForm employee={employee} />
            </div>
          </div>
        </main>
        <BottomNav active="profile" />
      </div>
    </div>
  );
}
