import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { getSession, isEmployeeSession } from "@/lib/session";
import { isSameJakartaDay } from "@/lib/date";

// docs/database-schema.md — check-out = UPDATE document `absences` yang checkoutTime masih null.
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session || !isEmployeeSession(session)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { checkoutPhotoUrl, checkoutLocation } = (await request.json()) as {
    checkoutPhotoUrl?: string;
    checkoutLocation?: { lat: number; lng: number; accuracy?: number };
  };

  if (!checkoutPhotoUrl || !checkoutLocation) {
    return NextResponse.json(
      { error: "Foto dan lokasi wajib diisi" },
      { status: 400 }
    );
  }

  const db = getAdminDb();
  const activeSession = await db
    .collection("absences")
    .where("employeeId", "==", session.employeeId)
    .where("checkoutTime", "==", null)
    .limit(1)
    .get();

  if (activeSession.empty) {
    return NextResponse.json(
      { error: "Tidak ada sesi checkin yang aktif" },
      { status: 409 }
    );
  }

  const doc = activeSession.docs[0];
  const data = doc.data();
  const now = new Date();
  const nowIso = now.toISOString();

  // Halaman bisa saja masih terbuka dari hari sebelumnya (belum sempat refresh) —
  // kalau sesi aktifnya ternyata bukan dari hari ini, foto/lokasi yang baru diambil
  // bukan milik sesi lama itu. Tutup sesi lama sebagai "incomplete" (bukan checkout
  // asli), jangan pakai foto/lokasi yang dikirim.
  if (!isSameJakartaDay(new Date(data.checkinTime), now)) {
    await doc.ref.update({
      checkoutTime: nowIso,
      checkoutPhotoUrl: null,
      checkoutLocation: null,
      status: "incomplete",
      updatedAt: nowIso,
    });

    return NextResponse.json({
      id: doc.id,
      autoClosed: true,
      note: "Sesi kemarin sudah melewati hari dan otomatis ditutup sebagai tidak lengkap. Silakan tekan Check-in untuk mulai sesi baru.",
    });
  }

  await doc.ref.update({
    checkoutTime: nowIso,
    checkoutPhotoUrl,
    checkoutLocation,
    updatedAt: nowIso,
  });

  return NextResponse.json({ id: doc.id });
}
