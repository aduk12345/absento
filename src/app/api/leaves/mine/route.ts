import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { getSession, isEmployeeSession } from "@/lib/session";
import { calculateLeaveDays } from "@/lib/leave";

// Halaman Izin karyawan: riwayat pengajuan izin milik sendiri (employeeId dari session,
// bukan query param — sama pola dengan /api/absences/mine).
export async function GET() {
  const session = await getSession();
  if (!session || !isEmployeeSession(session)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getAdminDb();
  const snap = await db
    .collection("leave_requests")
    .where("employeeId", "==", session.employeeId)
    .orderBy("createdAt", "desc")
    .get();

  const requests = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  return NextResponse.json({ requests });
}

// Ajukan izin baru — selalu masuk sebagai status "pending", butuh approval admin.
// totalDays dihitung ulang di server (jangan percaya nilai dari client).
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session || !isEmployeeSession(session)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { startDate, endDate, reason, attachmentUrl } = (await request.json()) as {
    startDate?: string;
    endDate?: string;
    reason?: string;
    attachmentUrl?: string | null;
  };

  if (!startDate || !endDate) {
    return NextResponse.json(
      { error: "Tanggal mulai dan tanggal akhir wajib diisi" },
      { status: 400 }
    );
  }
  if (endDate < startDate) {
    return NextResponse.json(
      { error: "Tanggal akhir harus setelah atau sama dengan tanggal mulai" },
      { status: 400 }
    );
  }
  if (!reason || !reason.trim()) {
    return NextResponse.json({ error: "Alasan wajib diisi" }, { status: 400 });
  }

  const db = getAdminDb();
  const now = new Date().toISOString();
  const data = {
    employeeId: session.employeeId,
    startDate,
    endDate,
    totalDays: calculateLeaveDays(startDate, endDate),
    reason: reason.trim(),
    attachmentUrl: attachmentUrl ?? null,
    status: "pending" as const,
    source: "employee" as const,
    reviewedBy: null,
    reviewedAt: null,
    reviewNote: null,
    createdAt: now,
    updatedAt: now,
  };

  const doc = await db.collection("leave_requests").add(data);
  return NextResponse.json({ id: doc.id, ...data }, { status: 201 });
}
