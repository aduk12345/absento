import { redirect } from "next/navigation";
import { getAdminDb } from "@/lib/firebase-admin";
import { getSession, isAdminSession } from "@/lib/session";
import { PageHeader } from "@/components/ui/Card";
import { AbsencesTable, type Absence } from "@/components/AbsencesTable";

// docs/features.md — Manage Absence: koreksi timestamp, tambah manual (wajib alasan), hapus.
// Foto & lokasi tidak bisa diedit. Setiap perubahan wajib tercatat di `absence_audit_logs`.
// Admin biasa & super_admin punya akses sama untuk Manage Absence (bedanya hanya di Manage Karyawan/Admin).
export default async function AdminAbsencesPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!isAdminSession(session)) redirect("/");

  const today = new Date().toISOString().slice(0, 10);
  const start = new Date(`${today}T00:00:00.000Z`);
  const end = new Date(`${today}T23:59:59.999Z`);

  const db = getAdminDb();
  const [absencesSnap, employeesSnap] = await Promise.all([
    db
      .collection("absences")
      .where("checkinTime", ">=", start.toISOString())
      .where("checkinTime", "<=", end.toISOString())
      .orderBy("checkinTime", "desc")
      .limit(500)
      .get(),
    db.collection("employees").orderBy("name").get(),
  ]);

  const employees = employeesSnap.docs.map((doc) => ({
    id: doc.id,
    name: doc.data().name as string,
  }));
  const employeeNameById = new Map(employees.map((e) => [e.id, e.name]));

  const absences: Absence[] = absencesSnap.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      employeeId: data.employeeId,
      employeeName: employeeNameById.get(data.employeeId) ?? "(tidak diketahui)",
      checkinTime: data.checkinTime ?? null,
      checkoutTime: data.checkoutTime ?? null,
      source: data.source,
      reason: data.reason ?? null,
    };
  });

  return (
    <div>
      <PageHeader
        title="Manage Absence"
        description="Koreksi waktu checkin/checkout, tambah absen manual, atau hapus record."
      />
      <AbsencesTable
        initialAbsences={absences}
        employees={employees}
        defaultStartDate={today}
        defaultEndDate={today}
      />
    </div>
  );
}
