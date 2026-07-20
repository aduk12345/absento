import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { getAdminDb } from "@/lib/firebase-admin";
import { getSession, isAdminSession } from "@/lib/session";
import { startOfJakartaDayUtc, endOfJakartaDayUtc, formatJakartaTimeId } from "@/lib/date";

function formatDuration(minutes: number | null): string {
  if (minutes == null) return "-";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}j ${m}m`;
}

const STATUS_LABEL = { hadir: "Hadir", izin: "Izin", alpha: "Alpha" };

// docs/features.md — Export Excel untuk Report Per Hari (Seluruh Karyawan).
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session || !isAdminSession(session)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const date = request.nextUrl.searchParams.get("date");
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "date wajib diisi (format YYYY-MM-DD)" }, { status: 400 });
  }

  const start = startOfJakartaDayUtc(date);
  const end = endOfJakartaDayUtc(date);

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

  const absenceByEmployee = new Map<
    string,
    { checkinTime: string; checkoutTime: string | null; durationMinutes: number | null }
  >();
  for (const doc of absencesSnap.docs) {
    const data = doc.data();
    const checkinTime: string = data.checkinTime;
    const checkoutTime: string | null = data.checkoutTime ?? null;
    const durationMinutes =
      checkoutTime != null
        ? Math.round((new Date(checkoutTime).getTime() - new Date(checkinTime).getTime()) / 60000)
        : null;
    if (!absenceByEmployee.has(data.employeeId)) {
      absenceByEmployee.set(data.employeeId, { checkinTime, checkoutTime, durationMinutes });
    }
  }

  const leaveByEmployee = new Map<string, string>();
  for (const doc of leavesSnap.docs) {
    const data = doc.data() as { employeeId: string; startDate: string; endDate: string; reason: string };
    if (data.startDate <= date && data.endDate >= date) {
      leaveByEmployee.set(data.employeeId, data.reason);
    }
  }

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Report Harian");

  sheet.columns = [
    { header: "Karyawan", key: "nama", width: 28 },
    { header: "Status", key: "status", width: 12 },
    { header: "Checkin", key: "checkin", width: 12 },
    { header: "Checkout", key: "checkout", width: 12 },
    { header: "Durasi", key: "durasi", width: 12 },
    { header: "Keterangan", key: "keterangan", width: 24 },
  ];

  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true };
  headerRow.eachCell((cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE5E7EB" } };
  });

  const STATUS_RANK = { hadir: 0, izin: 1, alpha: 2 };
  const rows = employeesSnap.docs
    .map((doc) => {
      const name = doc.data().name as string;
      const absence = absenceByEmployee.get(doc.id);
      if (absence) {
        return { name, status: "hadir" as const, absence, reason: null as string | null };
      }
      const leaveReason = leaveByEmployee.get(doc.id) ?? null;
      if (leaveReason) {
        return { name, status: "izin" as const, absence: null, reason: leaveReason };
      }
      return { name, status: "alpha" as const, absence: null, reason: null as string | null };
    })
    .sort((a, b) => {
      const rankDiff = STATUS_RANK[a.status] - STATUS_RANK[b.status];
      if (rankDiff !== 0) return rankDiff;
      if (a.status === "hadir" && b.status === "hadir") {
        return a.absence!.checkinTime.localeCompare(b.absence!.checkinTime);
      }
      return a.name.localeCompare(b.name);
    });

  for (const row of rows) {
    if (row.status === "hadir") {
      sheet.addRow({
        nama: row.name,
        status: STATUS_LABEL.hadir,
        checkin: formatJakartaTimeId(new Date(row.absence!.checkinTime)),
        checkout: row.absence!.checkoutTime
          ? formatJakartaTimeId(new Date(row.absence!.checkoutTime))
          : "-",
        durasi: formatDuration(row.absence!.durationMinutes),
        keterangan: "-",
      });
    } else if (row.status === "izin") {
      sheet.addRow({
        nama: row.name,
        status: STATUS_LABEL.izin,
        checkin: "-",
        checkout: "-",
        durasi: "-",
        keterangan: row.reason,
      });
    } else {
      sheet.addRow({
        nama: row.name,
        status: STATUS_LABEL.alpha,
        checkin: "-",
        checkout: "-",
        durasi: "-",
        keterangan: "-",
      });
    }
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const filename = `report-harian-${date}.xlsx`;

  return new NextResponse(buffer as unknown as BodyInit, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
