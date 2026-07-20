import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { getSession, isAdminSession } from "@/lib/session";
import { getApprovedLeavesInRange, overlapDays } from "@/lib/leave";
import { startOfJakartaDayUtc, endOfJakartaDayUtc } from "@/lib/date";

const MAX_RANGE_DAYS = 31;

// docs/features.md — Report / History Absence Karyawan: filter per karyawan + range tanggal
// (maks 1 bulan), ringkasan total hadir & total jam kerja.
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
  const employee = employeeDoc.data()!;

  const snap = await db
    .collection("absences")
    .where("employeeId", "==", employeeId)
    .where("checkinTime", ">=", start.toISOString())
    .where("checkinTime", "<=", end.toISOString())
    .orderBy("checkinTime", "desc")
    .get();

  const records = snap.docs.map((doc) => {
    const data = doc.data();
    const checkinTime: string = data.checkinTime;
    const checkoutTime: string | null = data.checkoutTime ?? null;
    const durationMinutes =
      checkoutTime != null
        ? Math.round(
            (new Date(checkoutTime).getTime() - new Date(checkinTime).getTime()) / 60000
          )
        : null;

    return {
      id: doc.id,
      checkinTime,
      checkinLocation: data.checkinLocation ?? null,
      checkinPhotoUrl: data.checkinPhotoUrl ?? null,
      checkoutTime,
      checkoutLocation: data.checkoutLocation ?? null,
      checkoutPhotoUrl: data.checkoutPhotoUrl ?? null,
      durationMinutes,
      status: data.status ?? "complete",
    };
  });

  const totalHadir = records.length;
  const totalWorkMinutes = records.reduce(
    (sum, r) => sum + (r.durationMinutes ?? 0),
    0
  );

  const leaves = await getApprovedLeavesInRange(employeeId, startDate, endDate);
  const totalIzin = leaves.reduce(
    (sum, l) => sum + overlapDays(l.startDate, l.endDate, startDate, endDate),
    0
  );

  return NextResponse.json({
    employee: { id: employeeDoc.id, name: employee.name },
    records,
    leaves: leaves.map((l) => ({
      id: l.id,
      startDate: l.startDate,
      endDate: l.endDate,
      reason: l.reason,
    })),
    summary: {
      totalHadir,
      totalWorkMinutes,
      totalIzin,
    },
  });
}
