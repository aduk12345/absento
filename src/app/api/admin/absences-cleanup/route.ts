import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { getSession, isAdminSession } from "@/lib/session";
import { deletePhotoByUrl } from "@/lib/cloudinary";

type CleanupBody = {
  mode: "month" | "year";
  year: number;
  month?: number; // 1-12, wajib kalau mode "month"
  dryRun?: boolean;
};

function getRange(body: CleanupBody): { start: Date; end: Date } | null {
  const { mode, year, month } = body;
  if (!Number.isInteger(year) || year < 2000 || year > 2100) return null;

  if (mode === "month") {
    if (!Number.isInteger(month) || month! < 1 || month! > 12) return null;
    const start = new Date(year, month! - 1, 1, 0, 0, 0, 0);
    const end = new Date(year, month!, 0, 23, 59, 59, 999);
    return { start, end };
  }

  if (mode === "year") {
    const start = new Date(year, 0, 1, 0, 0, 0, 0);
    const end = new Date(year, 11, 31, 23, 59, 59, 999);
    return { start, end };
  }

  return null;
}

// Hapus record `absences` (+ foto Cloudinary terkait) dalam rentang bulan/tahun tertentu —
// dipakai super_admin untuk menjaga pemakaian Firestore/Cloudinary tetap di free tier.
// docs/cloudinary-schema.md — kebijakan retensi foto lama.
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session || !isAdminSession(session) || session.role !== "super_admin") {
    return NextResponse.json(
      { error: "Hanya Super Admin yang bisa menghapus data absensi lama" },
      { status: 403 }
    );
  }

  let body: CleanupBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Body request tidak valid" }, { status: 400 });
  }

  const range = getRange(body);
  if (!range) {
    return NextResponse.json({ error: "Parameter mode/tahun/bulan tidak valid" }, { status: 400 });
  }

  const now = new Date();
  if (range.end >= now) {
    return NextResponse.json(
      { error: "Periode yang dipilih belum selesai — hanya bisa hapus periode yang sudah lewat" },
      { status: 400 }
    );
  }

  const db = getAdminDb();
  const snap = await db
    .collection("absences")
    .where("checkinTime", ">=", range.start.toISOString())
    .where("checkinTime", "<=", range.end.toISOString())
    .get();

  if (body.dryRun) {
    return NextResponse.json({ count: snap.size });
  }

  if (snap.empty) {
    return NextResponse.json({ deletedCount: 0 });
  }

  const docs = snap.docs;

  // Hapus foto Cloudinary dulu (best-effort, tidak boleh menggagalkan penghapusan Firestore) —
  // dibatasi per-chunk supaya tidak mengirim ratusan request paralel sekaligus.
  const CHUNK_SIZE = 20;
  for (let i = 0; i < docs.length; i += CHUNK_SIZE) {
    const chunk = docs.slice(i, i + CHUNK_SIZE);
    await Promise.all(
      chunk.flatMap((doc) => {
        const data = doc.data();
        return [deletePhotoByUrl(data.checkinPhotoUrl), deletePhotoByUrl(data.checkoutPhotoUrl)];
      })
    );
  }

  // Firestore batch write dibatasi 500 operasi — chunk kalau data lebih dari itu.
  const BATCH_LIMIT = 500;
  for (let i = 0; i < docs.length; i += BATCH_LIMIT) {
    const batch = db.batch();
    for (const doc of docs.slice(i, i + BATCH_LIMIT)) {
      batch.delete(doc.ref);
    }
    await batch.commit();
  }

  // Satu entry audit log ringkasan (bukan per-record) — bulk delete bisa ratusan/ribuan record,
  // audit log per-record akan terlalu berat. Deviasi disengaja dari pola logAbsenceAudit() biasa.
  await db.collection("absence_audit_logs").add({
    absenceId: null,
    adminId: session.adminId,
    action: "bulk_delete",
    beforeData: { mode: body.mode, year: body.year, month: body.month ?? null, deletedCount: docs.length },
    afterData: null,
    timestamp: new Date().toISOString(),
  });

  return NextResponse.json({ deletedCount: docs.length });
}
