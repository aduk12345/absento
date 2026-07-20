import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { getSession, isAdminSession } from "@/lib/session";

// Manage Izin (admin): approve/reject pengajuan pending. reviewedBy/reviewedAt/reviewNote
// jadi jejak akuntabilitas (siapa memutuskan, kapan, kenapa) — cukup sebagai audit trail,
// tidak perlu collection log terpisah seperti absence_audit_logs.
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session || !isAdminSession(session)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const { status, reviewNote } = (await request.json()) as {
    status?: "approved" | "rejected";
    reviewNote?: string | null;
  };

  if (status !== "approved" && status !== "rejected") {
    return NextResponse.json(
      { error: "status wajib 'approved' atau 'rejected'" },
      { status: 400 }
    );
  }

  const db = getAdminDb();
  const ref = db.collection("leave_requests").doc(id);
  const doc = await ref.get();
  if (!doc.exists) {
    return NextResponse.json({ error: "Pengajuan izin tidak ditemukan" }, { status: 404 });
  }
  if (doc.data()?.status !== "pending") {
    return NextResponse.json(
      { error: "Pengajuan ini sudah diproses sebelumnya" },
      { status: 400 }
    );
  }

  const now = new Date().toISOString();
  await ref.update({
    status,
    reviewedBy: session.adminId,
    reviewedAt: now,
    reviewNote: reviewNote ?? null,
    updatedAt: now,
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session || !isAdminSession(session)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const db = getAdminDb();
  const ref = db.collection("leave_requests").doc(id);
  const doc = await ref.get();
  if (!doc.exists) {
    return NextResponse.json({ error: "Pengajuan izin tidak ditemukan" }, { status: 404 });
  }

  await ref.delete();
  return NextResponse.json({ ok: true });
}
