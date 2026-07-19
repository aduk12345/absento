import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { getSession, isAdminSession } from "@/lib/session";
import { logAbsenceAudit } from "@/lib/audit";

// docs/features.md — Manage Absence: list semua absen (untuk admin) + tambah absen manual.
// GET: opsional filter ?employeeId=... dan/atau ?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
// (rentang berdasarkan checkinTime, sama pola dengan /api/report) untuk mempersempit hasil.
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session || !isAdminSession(session)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const employeeId = request.nextUrl.searchParams.get("employeeId");
  const startDate = request.nextUrl.searchParams.get("startDate");
  const endDate = request.nextUrl.searchParams.get("endDate");

  const db = getAdminDb();
  let query: FirebaseFirestore.Query = db.collection("absences");

  if (employeeId) {
    query = query.where("employeeId", "==", employeeId);
  }

  if (startDate || endDate) {
    const start = new Date(`${startDate ?? endDate}T00:00:00.000Z`);
    const end = new Date(`${endDate ?? startDate}T23:59:59.999Z`);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) {
      return NextResponse.json({ error: "Rentang tanggal tidak valid" }, { status: 400 });
    }
    query = query
      .where("checkinTime", ">=", start.toISOString())
      .where("checkinTime", "<=", end.toISOString());
  }

  query = query.orderBy("checkinTime", "desc");

  let snap: FirebaseFirestore.QuerySnapshot;
  try {
    snap = await query.limit(500).get();
  } catch (error) {
    console.error("GET /api/absences failed:", error);
    return NextResponse.json({ error: "Gagal memuat data absen" }, { status: 500 });
  }
  const absences = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

  return NextResponse.json({ absences });
}

// docs/database-schema.md — absen manual dari admin: source = 'admin', reason wajib diisi,
// foto & lokasi tidak boleh diisi manual (selalu null).
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session || !isAdminSession(session)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { employeeId, checkinTime, checkoutTime, reason } = (await request.json()) as {
    employeeId?: string;
    checkinTime?: string;
    checkoutTime?: string;
    reason?: string;
  };

  if (!employeeId) {
    return NextResponse.json({ error: "employeeId wajib diisi" }, { status: 400 });
  }

  if (!reason || !reason.trim()) {
    return NextResponse.json(
      { error: "Alasan wajib diisi untuk absen manual" },
      { status: 400 }
    );
  }

  if (!checkinTime && !checkoutTime) {
    return NextResponse.json(
      { error: "Minimal salah satu dari checkinTime atau checkoutTime wajib diisi" },
      { status: 400 }
    );
  }

  const db = getAdminDb();

  const employeeDoc = await db.collection("employees").doc(employeeId).get();
  if (!employeeDoc.exists) {
    return NextResponse.json({ error: "Karyawan tidak ditemukan" }, { status: 404 });
  }

  const now = new Date().toISOString();
  const data = {
    employeeId,
    checkinTime: checkinTime ?? null,
    checkinPhotoUrl: null,
    checkinLocation: null,
    checkoutTime: checkoutTime ?? null,
    checkoutPhotoUrl: null,
    checkoutLocation: null,
    source: "admin" as const,
    reason,
    createdAt: now,
    updatedAt: now,
  };

  const doc = await db.collection("absences").add(data);

  await logAbsenceAudit({
    absenceId: doc.id,
    adminId: session.adminId,
    action: "create",
    beforeData: null,
    afterData: data,
  });

  return NextResponse.json({ id: doc.id }, { status: 201 });
}
