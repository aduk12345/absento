import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { getSession, isAdminSession } from "@/lib/session";
import { logAbsenceAudit } from "@/lib/audit";
import { deletePhotoByUrl } from "@/lib/cloudinary";

// docs/features.md — Manage Absence (Koreksi): hanya timestamp checkin/checkout & reason yang
// boleh diedit. Foto & lokasi tidak bisa diedit oleh admin sama sekali — field tsb ditolak di sini.
const FORBIDDEN_FIELDS = [
  "checkinPhotoUrl",
  "checkinLocation",
  "checkoutPhotoUrl",
  "checkoutLocation",
];

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session || !isAdminSession(session)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = (await request.json()) as Record<string, unknown>;

  const forbidden = FORBIDDEN_FIELDS.filter((field) => field in body);
  if (forbidden.length > 0) {
    return NextResponse.json(
      {
        error: `Field berikut tidak boleh diubah oleh admin: ${forbidden.join(", ")}`,
      },
      { status: 400 }
    );
  }

  const update: Record<string, unknown> = {};
  if (typeof body.checkinTime === "string" || body.checkinTime === null) {
    update.checkinTime = body.checkinTime;
  }
  if (typeof body.checkoutTime === "string" || body.checkoutTime === null) {
    update.checkoutTime = body.checkoutTime;
  }
  if (typeof body.reason === "string" || body.reason === null) {
    update.reason = body.reason;
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "Tidak ada perubahan yang valid" }, { status: 400 });
  }

  const db = getAdminDb();
  const ref = db.collection("absences").doc(id);
  const doc = await ref.get();
  if (!doc.exists) {
    return NextResponse.json({ error: "Record absen tidak ditemukan" }, { status: 404 });
  }

  const beforeData = doc.data() ?? null;
  update.updatedAt = new Date().toISOString();
  await ref.update(update);
  const afterDoc = await ref.get();

  await logAbsenceAudit({
    absenceId: id,
    adminId: session.adminId,
    action: "update",
    beforeData,
    afterData: afterDoc.data() ?? null,
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
  const ref = db.collection("absences").doc(id);
  const doc = await ref.get();
  if (!doc.exists) {
    return NextResponse.json({ error: "Record absen tidak ditemukan" }, { status: 404 });
  }

  const beforeData = doc.data() ?? null;

  await Promise.all([
    deletePhotoByUrl(beforeData?.checkinPhotoUrl as string | null | undefined),
    deletePhotoByUrl(beforeData?.checkoutPhotoUrl as string | null | undefined),
  ]);

  await ref.delete();

  await logAbsenceAudit({
    absenceId: id,
    adminId: session.adminId,
    action: "delete",
    beforeData,
    afterData: null,
  });

  return NextResponse.json({ ok: true });
}
