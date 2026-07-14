import { redirect } from "next/navigation";
import { getAdminDb } from "@/lib/firebase-admin";
import { getSession, isAdminSession } from "@/lib/session";
import { PageHeader } from "@/components/ui/Card";
import { AdminsTable, type AdminAccount } from "@/components/AdminsTable";

// docs/features.md — Manage Admin: role admin/super_admin, hanya super_admin bisa tambah admin baru.
export default async function AdminAdminsPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!isAdminSession(session)) redirect("/");
  const role = session.role;
  const currentAdminId = session.adminId;

  const db = getAdminDb();
  const snap = await db.collection("admins").orderBy("name").get();
  const admins: AdminAccount[] = snap.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      username: data.username,
      name: data.name,
      role: data.role,
    };
  });

  return (
    <div>
      <PageHeader
        title="Manage Admin"
        description="Kelola akun admin dan super admin yang bisa mengakses dashboard ini."
      />
      <AdminsTable initialAdmins={admins} role={role} currentAdminId={currentAdminId} />
    </div>
  );
}
