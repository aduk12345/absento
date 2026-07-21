import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { getAdminDb } from "@/lib/firebase-admin";
import { getSession, isAdminSession } from "@/lib/session";
import { startOfJakartaDayUtc, endOfJakartaDayUtc, formatJakartaTimeId } from "@/lib/date";

const STATUS_LABEL = { hadir: "Hadir", izin: "Izin", alpha: "Alpha" };

function mapsLink(loc: { lat: number; lng: number } | null | undefined): string | null {
  if (!loc) return null;
  return `https://www.google.com/maps?q=${loc.lat},${loc.lng}`;
}

const HYPERLINK_FONT = { color: { argb: "FF2563EB" }, underline: true };

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
    {
      checkinTime: string;
      checkinLocation: { lat: number; lng: number } | null;
      checkinPhotoUrl: string | null;
      checkoutTime: string | null;
      checkoutLocation: { lat: number; lng: number } | null;
      checkoutPhotoUrl: string | null;
    }
  >();
  for (const doc of absencesSnap.docs) {
    const data = doc.data();
    const checkinTime: string = data.checkinTime;
    const checkoutTime: string | null = data.checkoutTime ?? null;
    if (!absenceByEmployee.has(data.employeeId)) {
      absenceByEmployee.set(data.employeeId, {
        checkinTime,
        checkinLocation: data.checkinLocation ?? null,
        checkinPhotoUrl: data.checkinPhotoUrl ?? null,
        checkoutTime,
        checkoutLocation: data.checkoutLocation ?? null,
        checkoutPhotoUrl: data.checkoutPhotoUrl ?? null,
      });
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
    { header: "Foto Checkin", key: "fotoCheckin", width: 16 },
    { header: "Foto Checkout", key: "fotoCheckout", width: 16 },
    { header: "Lokasi Checkin", key: "lokasiCheckin", width: 16 },
    { header: "Lokasi Checkout", key: "lokasiCheckout", width: 16 },
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

  const LINK_KEYS = ["fotoCheckin", "fotoCheckout", "lokasiCheckin", "lokasiCheckout"] as const;

  for (const row of rows) {
    let excelRow;
    if (row.status === "hadir") {
      const absence = row.absence!;
      excelRow = sheet.addRow({
        nama: row.name,
        status: STATUS_LABEL.hadir,
        checkin: formatJakartaTimeId(new Date(absence.checkinTime)),
        checkout: absence.checkoutTime ? formatJakartaTimeId(new Date(absence.checkoutTime)) : "-",
        fotoCheckin: absence.checkinPhotoUrl
          ? { text: "Lihat Foto", hyperlink: absence.checkinPhotoUrl }
          : "-",
        fotoCheckout: absence.checkoutPhotoUrl
          ? { text: "Lihat Foto", hyperlink: absence.checkoutPhotoUrl }
          : "-",
        lokasiCheckin: mapsLink(absence.checkinLocation)
          ? { text: "Lihat Lokasi", hyperlink: mapsLink(absence.checkinLocation)! }
          : "-",
        lokasiCheckout: mapsLink(absence.checkoutLocation)
          ? { text: "Lihat Lokasi", hyperlink: mapsLink(absence.checkoutLocation)! }
          : "-",
        keterangan: "-",
      });
    } else if (row.status === "izin") {
      excelRow = sheet.addRow({
        nama: row.name,
        status: STATUS_LABEL.izin,
        checkin: "-",
        checkout: "-",
        fotoCheckin: "-",
        fotoCheckout: "-",
        lokasiCheckin: "-",
        lokasiCheckout: "-",
        keterangan: row.reason,
      });
    } else {
      excelRow = sheet.addRow({
        nama: row.name,
        status: STATUS_LABEL.alpha,
        checkin: "-",
        checkout: "-",
        fotoCheckin: "-",
        fotoCheckout: "-",
        lokasiCheckin: "-",
        lokasiCheckout: "-",
        keterangan: "-",
      });
    }

    for (const key of LINK_KEYS) {
      const cell = excelRow.getCell(key);
      if (cell.value && typeof cell.value === "object" && "hyperlink" in cell.value) {
        cell.font = HYPERLINK_FONT;
      }
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
