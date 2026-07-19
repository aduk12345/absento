import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { getSession, isEmployeeSession } from "@/lib/session";

const MAX_RANGE_DAYS = 31;

// docs/features.md — Halaman History: read-only, filter per bulan atau rentang tanggal custom.
// employeeId WAJIB dari session, bukan query param, supaya karyawan tidak bisa lihat data karyawan lain.
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session || !isEmployeeSession(session)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const month = searchParams.get("month"); // format "yyyy-MM"
  const startDate = searchParams.get("startDate"); // format "yyyy-MM-dd"
  const endDate = searchParams.get("endDate");

  let start: Date;
  let end: Date;

  if (startDate && endDate) {
    start = new Date(`${startDate}T00:00:00.000Z`);
    end = new Date(`${endDate}T23:59:59.999Z`);

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
  } else {
    const now = new Date();
    const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const targetMonth = month && /^\d{4}-\d{2}$/.test(month) ? month : defaultMonth;

    const [year, monthNum] = targetMonth.split("-").map(Number);
    start = new Date(Date.UTC(year, monthNum - 1, 1, 0, 0, 0, 0));
    end = new Date(Date.UTC(year, monthNum, 0, 23, 59, 59, 999));
  }

  const db = getAdminDb();
  let snap: FirebaseFirestore.QuerySnapshot;
  try {
    snap = await db
      .collection("absences")
      .where("employeeId", "==", session.employeeId)
      .where("checkinTime", ">=", start.toISOString())
      .where("checkinTime", "<=", end.toISOString())
      .orderBy("checkinTime", "desc")
      .get();
  } catch (error) {
    console.error("GET /api/absences/mine failed:", error);
    return NextResponse.json({ error: "Gagal memuat riwayat absen" }, { status: 500 });
  }

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
    };
  });

  return NextResponse.json({ records });
}
