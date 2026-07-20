import { redirect } from "next/navigation";
import { getAdminDb } from "@/lib/firebase-admin";
import { getSession, isAdminSession } from "@/lib/session";
import { PageHeader } from "@/components/ui/Card";
import { LeavesTable, type LeaveRequest } from "@/components/LeavesTable";

// Manage Izin: approval queue pengajuan izin karyawan (default filter status pending).
export default async function AdminLeavesPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!isAdminSession(session)) redirect("/");

  const db = getAdminDb();
  const [requestsSnap, employeesSnap] = await Promise.all([
    db.collection("leave_requests").where("status", "==", "pending").orderBy("createdAt", "desc").get(),
    db.collection("employees").orderBy("name").get(),
  ]);

  const employees = employeesSnap.docs.map((doc) => ({
    id: doc.id,
    name: doc.data().name as string,
  }));
  const employeeNameById = new Map(employees.map((e) => [e.id, e.name]));

  const requests: LeaveRequest[] = requestsSnap.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      employeeId: data.employeeId,
      employeeName: employeeNameById.get(data.employeeId) ?? "(tidak diketahui)",
      startDate: data.startDate,
      endDate: data.endDate,
      totalDays: data.totalDays,
      reason: data.reason,
      status: data.status,
      source: data.source,
      reviewNote: data.reviewNote ?? null,
    };
  });

  return (
    <div>
      <PageHeader
        title="Manage Izin"
        description="Setujui atau tolak pengajuan izin karyawan."
      />
      <LeavesTable initialRequests={requests} employees={employees} />
    </div>
  );
}
