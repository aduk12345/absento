import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { getSession, isAdminSession } from "@/lib/session";
import { calculateLeaveDays } from "@/lib/leave";
import { jakartaMonthRangeUtc, jakartaDateString } from "@/lib/date";

// docs/features.md — Report Per Bulan (Seluruh Karyawan): ringkasan total hadir/izin
// per karyawan untuk satu bulan kalender WIB.
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session || !isAdminSession(session)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const month = request.nextUrl.searchParams.get("month"); // "YYYY-MM"
  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json({ error: "month wajib diisi (format YYYY-MM)" }, { status: 400 });
  }

  const [year, mon] = month.split("-").map(Number);
  const { start, end } = jakartaMonthRangeUtc(year, mon);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return NextResponse.json({ error: "Bulan tidak valid" }, { status: 400 });
  }
  const startDate = jakartaDateString(start);
  const endDate = jakartaDateString(end);

  const db = getAdminDb();

  const [employeesSnap, absencesSnap, leavesSnap] = await Promise.all([
    db.collection("employees").where("status", "==", "active").get(),
    db
      .collection("absences")
      .where("checkinTime", ">=", start.toISOString())
      .where("checkinTime", "<=", end.toISOString())
      .get(),
    db.collection("leave_requests").where("status", "==", "approved").get(),
  ]);

  type Agg = { totalHadir: number; totalIzin: number };
  const aggByEmployee = new Map<string, Agg>();
  const ensure = (employeeId: string): Agg => {
    let agg = aggByEmployee.get(employeeId);
    if (!agg) {
      agg = { totalHadir: 0, totalIzin: 0 };
      aggByEmployee.set(employeeId, agg);
    }
    return agg;
  };

  for (const doc of absencesSnap.docs) {
    const data = doc.data();
    ensure(data.employeeId).totalHadir += 1;
  }

  for (const doc of leavesSnap.docs) {
    const data = doc.data() as { employeeId: string; startDate: string; endDate: string };
    if (data.startDate > endDate || data.endDate < startDate) continue;
    const overlapStart = data.startDate > startDate ? data.startDate : startDate;
    const overlapEnd = data.endDate < endDate ? data.endDate : endDate;
    ensure(data.employeeId).totalIzin += calculateLeaveDays(overlapStart, overlapEnd);
  }

  const employees = employeesSnap.docs
    .map((doc) => {
      const agg = aggByEmployee.get(doc.id) ?? { totalHadir: 0, totalIzin: 0 };
      return {
        id: doc.id,
        name: doc.data().name as string,
        ...agg,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  return NextResponse.json({ month, startDate, endDate, employees });
}
