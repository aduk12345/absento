import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { getAdminDb } from "@/lib/firebase-admin";
import { getSession, isAdminSession } from "@/lib/session";
import { calculateLeaveDays } from "@/lib/leave";
import { jakartaMonthRangeUtc, jakartaDateString } from "@/lib/date";

// docs/features.md — Export Excel untuk Report Per Bulan (Seluruh Karyawan).
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session || !isAdminSession(session)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const month = request.nextUrl.searchParams.get("month");
  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json({ error: "month wajib diisi (format YYYY-MM)" }, { status: 400 });
  }

  const [year, mon] = month.split("-").map(Number);
  const { start, end } = jakartaMonthRangeUtc(year, mon);
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

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Report Bulanan");

  sheet.columns = [
    { header: "Karyawan", key: "nama", width: 28 },
    { header: "Total Hadir", key: "hadir", width: 14 },
    { header: "Total Izin", key: "izin", width: 14 },
  ];

  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true };
  headerRow.eachCell((cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE5E7EB" } };
  });

  const sortedEmployeeDocs = [...employeesSnap.docs].sort((a, b) =>
    (a.data().name as string).localeCompare(b.data().name as string)
  );

  for (const doc of sortedEmployeeDocs) {
    const agg = aggByEmployee.get(doc.id) ?? { totalHadir: 0, totalIzin: 0 };
    sheet.addRow({
      nama: doc.data().name,
      hadir: `${agg.totalHadir} hari`,
      izin: `${agg.totalIzin} hari`,
    });
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const filename = `report-bulanan-${month}.xlsx`;

  return new NextResponse(buffer as unknown as BodyInit, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
