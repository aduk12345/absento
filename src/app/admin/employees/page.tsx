import { redirect } from "next/navigation";
import { getAdminDb } from "@/lib/firebase-admin";
import { getSession, isAdminSession } from "@/lib/session";
import { EmployeesTable, type Employee } from "@/components/EmployeesTable";

// docs/features.md — Manage Karyawan: CRUD, delete hanya super_admin, nonaktif oleh admin biasa juga.
export default async function AdminEmployeesPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!isAdminSession(session)) redirect("/");
  const role = session.role;

  const db = getAdminDb();
  const snap = await db.collection("employees").orderBy("name").get();
  const employees: Employee[] = snap.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      name: data.name,
      email: data.email,
      username: data.username,
      phone: data.phone,
      status: data.status,
      password: data.password,
    };
  });

  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold">Manage Karyawan</h1>
      <EmployeesTable initialEmployees={employees} role={role} />
    </div>
  );
}
