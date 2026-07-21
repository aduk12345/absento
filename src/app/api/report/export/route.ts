import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { getAdminDb } from "@/lib/firebase-admin";
import { getSession, isAdminSession } from "@/lib/session";
import { getApprovedLeavesInRange } from "@/lib/leave";
import {
  startOfJakartaDayUtc,
  endOfJakartaDayUtc,
  jakartaDateString,
  formatJakartaDateId,
  formatJakartaTimeId,
} from "@/lib/date";

const MAX_RANGE_DAYS = 31;

// docs/features.md — Report: tombol Export Excel, format .xlsx.
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session || !isAdminSession(session)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const employeeId = searchParams.get("employeeId");
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");

  if (!employeeId || !startDate || !endDate) {
    return NextResponse.json(
      { error: "employeeId, startDate, dan endDate wajib diisi" },
      { status: 400 }
    );
  }

  const start = startOfJakartaDayUtc(startDate);
  const end = endOfJakartaDayUtc(endDate);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) {
    return NextResponse.json({ error: "Rentang tanggal tidak valid" }, { status: 400 });
  }

  const rangeDays = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
  if (rangeDays > MAX_RANGE_DAYS) {
    return NextResponse.json(
      { error: `Rentang tanggal maksimal ${MAX_RANGE_DAYS} hari` },
      { status: 400 }
    );
  }

  const db = getAdminDb();

  const employeeDoc = await db.collection("employees").doc(employeeId).get();
  if (!employeeDoc.exists) {
    return NextResponse.json({ error: "Karyawan tidak ditemukan" }, { status: 404 });
  }
  const employeeName: string = employeeDoc.data()?.name ?? "karyawan";

  const snap = await db
    .collection("absences")
    .where("employeeId", "==", employeeId)
    .where("checkinTime", ">=", start.toISOString())
    .where("checkinTime", "<=", end.toISOString())
    .orderBy("checkinTime", "asc")
    .get();

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Report Absensi");

  sheet.columns = [
    { header: "Tanggal", key: "tanggal", width: 14 },
    { header: "Status", key: "status", width: 12 },
    { header: "Checkin", key: "checkin", width: 12 },
    { header: "Checkout", key: "checkout", width: 12 },
    { header: "Keterangan", key: "keterangan", width: 24 },
  ];

  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true };
  headerRow.eachCell((cell) => {
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFE5E7EB" },
    };
  });

  type ExportRow = { date: string; tanggal: string; status: string; checkin: string; checkout: string; keterangan: string };
  const rows: ExportRow[] = [];

  snap.docs.forEach((doc) => {
    const data = doc.data();
    const checkinTime: string = data.checkinTime;
    const checkoutTime: string | null = data.checkoutTime ?? null;

    const checkinDate = new Date(checkinTime);
    rows.push({
      date: jakartaDateString(checkinDate),
      tanggal: formatJakartaDateId(checkinDate),
      status: "Hadir",
      checkin: formatJakartaTimeId(checkinDate),
      checkout: checkoutTime ? formatJakartaTimeId(new Date(checkoutTime)) : "-",
      keterangan: data.reason ?? "-",
    });
  });

  const leaves = await getApprovedLeavesInRange(employeeId, startDate, endDate);
  for (const leave of leaves) {
    const rangeStart = leave.startDate > startDate ? leave.startDate : startDate;
    const rangeEnd = leave.endDate < endDate ? leave.endDate : endDate;
    if (rangeStart > rangeEnd) continue;
    const cursor = startOfJakartaDayUtc(rangeStart);
    const endDateObj = startOfJakartaDayUtc(rangeEnd);
    while (cursor <= endDateObj) {
      rows.push({
        date: jakartaDateString(cursor),
        tanggal: formatJakartaDateId(cursor),
        status: "Izin",
        checkin: "-",
        checkout: "-",
        keterangan: leave.reason,
      });
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
  }

  rows.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  rows.forEach((row) => sheet.addRow(row));

  const buffer = await workbook.xlsx.writeBuffer();
  const filename = `report-${employeeName.replace(/[^a-zA-Z0-9]+/g, "_")}-${startDate}-${endDate}.xlsx`;

  return new NextResponse(buffer as unknown as BodyInit, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
