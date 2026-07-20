import { redirect } from "next/navigation";
import { getAdminDb } from "@/lib/firebase-admin";
import { getSession, isAdminSession } from "@/lib/session";
import { PageHeader } from "@/components/ui/Card";
import { type ReportEmployee } from "@/components/ReportView";
import { ReportTabs } from "@/components/ReportTabs";

// docs/features.md — Report: filter per karyawan + range tanggal (maks 1 bulan), export Excel.
export default async function AdminReportPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!isAdminSession(session)) redirect("/");

  const db = getAdminDb();
  const snap = await db.collection("employees").orderBy("name").get();
  const employees: ReportEmployee[] = snap.docs.map((doc) => ({
    id: doc.id,
    name: doc.data().name,
  }));

  return (
    <div>
      <PageHeader
        title="Report Absensi"
        description="Lihat riwayat absen per karyawan, ringkasan bulanan, atau ringkasan harian seluruh karyawan."
      />
      <ReportTabs employees={employees} />
    </div>
  );
}
