import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { getSession, isEmployeeSession } from "@/lib/session";
import { isSameJakartaDay } from "@/lib/date";

// docs/database-schema.md — check-in = CREATE document baru di `absences`.
// Aturan: harus checkout dulu sebelum bisa checkin lagi.
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session || !isEmployeeSession(session)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { checkinPhotoUrl, checkinLocation } = (await request.json()) as {
    checkinPhotoUrl?: string;
    checkinLocation?: { lat: number; lng: number; accuracy?: number };
  };

  if (!checkinPhotoUrl || !checkinLocation) {
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

  const now = new Date();
  const nowIso = now.toISOString();

  if (!activeSession.empty) {
    const activeDoc = activeSession.docs[0];
    const activeData = activeDoc.data();
    const sameDay = isSameJakartaDay(new Date(activeData.checkinTime), now);

    if (sameDay) {
      return NextResponse.json(
        { error: "Masih ada sesi checkin yang belum checkout" },
        { status: 409 }
      );
    }

    // Sesi kemarin (atau lebih lama) belum di-checkout — tutup otomatis sebagai
    // "incomplete" (tanpa foto/lokasi, bukan checkout asli) supaya karyawan bisa
    // mulai sesi checkin baru hari ini.
    await activeDoc.ref.update({
      checkoutTime: nowIso,
      checkoutPhotoUrl: null,
      checkoutLocation: null,
      status: "incomplete",
      updatedAt: nowIso,
    });
  }

  const doc = await db.collection("absences").add({
    employeeId: session.employeeId,
    checkinTime: nowIso,
    checkinPhotoUrl,
    checkinLocation,
    checkoutTime: null,
    checkoutPhotoUrl: null,
    checkoutLocation: null,
    source: "employee",
    reason: null,
    createdAt: nowIso,
    updatedAt: nowIso,
  });

  return NextResponse.json({ id: doc.id }, { status: 201 });
}
