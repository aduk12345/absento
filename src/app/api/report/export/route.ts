import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { getAdminDb } from "@/lib/firebase-admin";
import { getSession, isAdminSession } from "@/lib/session";

const MAX_RANGE_DAYS = 31;

function formatDuration(minutes: number | null): string {
  if (minutes == null) return "-";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}j ${m}m`;
}

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

  const start = new Date(`${startDate}T00:00:00.000Z`);
  const end = new Date(`${endDate}T23:59:59.999Z`);

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
    { header: "Checkin", key: "checkin", width: 12 },
    { header: "Checkout", key: "checkout", width: 12 },
    { header: "Durasi", key: "durasi", width: 12 },
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

  snap.docs.forEach((doc) => {
    const data = doc.data();
    const checkinTime: string = data.checkinTime;
    const checkoutTime: string | null = data.checkoutTime ?? null;
    const durationMinutes =
      checkoutTime != null
        ? Math.round(
            (new Date(checkoutTime).getTime() - new Date(checkinTime).getTime()) / 60000
          )
        : null;

    const checkinDate = new Date(checkinTime);
    sheet.addRow({
      tanggal: checkinDate.toLocaleDateString("id-ID"),
      checkin: checkinDate.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }),
      checkout: checkoutTime
        ? new Date(checkoutTime).toLocaleTimeString("id-ID", {
            hour: "2-digit",
            minute: "2-digit",
          })
        : "-",
      durasi: formatDuration(durationMinutes),
    });
  });

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
