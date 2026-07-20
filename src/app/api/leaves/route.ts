import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { getSession, isAdminSession } from "@/lib/session";
import { calculateLeaveDays } from "@/lib/leave";

// Manage Izin (admin): list semua pengajuan, opsional filter ?status=pending|approved|rejected
// dan/atau ?employeeId=... Default (tanpa filter status) menampilkan semua.
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session || !isAdminSession(session)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const status = request.nextUrl.searchParams.get("status");
  const employeeId = request.nextUrl.searchParams.get("employeeId");

  const db = getAdminDb();
  let query: FirebaseFirestore.Query = db.collection("leave_requests");

  if (status) {
    query = query.where("status", "==", status);
  }
  if (employeeId) {
    query = query.where("employeeId", "==", employeeId);
  }

  query = query.orderBy("createdAt", "desc");

  let snap: FirebaseFirestore.QuerySnapshot;
  try {
    snap = await query.limit(500).get();
  } catch (error) {
    console.error("GET /api/leaves failed:", error);
    return NextResponse.json({ error: "Gagal memuat data izin" }, { status: 500 });
  }

  const requests = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  return NextResponse.json({ requests });
}

// Admin input izin langsung atas nama karyawan — otomatis approved (admin dianggap otoritatif,
// tidak lewat approval queue), sama pola dengan absen manual (source: "admin", reason wajib).
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session || !isAdminSession(session)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { employeeId, startDate, endDate, reason } = (await request.json()) as {
    employeeId?: string;
    startDate?: string;
    endDate?: string;
    reason?: string;
  };

  if (!employeeId) {
    return NextResponse.json({ error: "employeeId wajib diisi" }, { status: 400 });
  }
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
  const employeeDoc = await db.collection("employees").doc(employeeId).get();
  if (!employeeDoc.exists) {
    return NextResponse.json({ error: "Karyawan tidak ditemukan" }, { status: 404 });
  }

  const now = new Date().toISOString();
  const data = {
    employeeId,
    startDate,
    endDate,
    totalDays: calculateLeaveDays(startDate, endDate),
    reason: reason.trim(),
    attachmentUrl: null,
    status: "approved" as const,
    source: "admin" as const,
    reviewedBy: session.adminId,
    reviewedAt: now,
    reviewNote: null,
    createdAt: now,
    updatedAt: now,
  };

  const doc = await db.collection("leave_requests").add(data);
  return NextResponse.json({ id: doc.id, ...data }, { status: 201 });
}
