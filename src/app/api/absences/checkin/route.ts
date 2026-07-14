import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { getSession, isEmployeeSession } from "@/lib/session";

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

  if (!activeSession.empty) {
    return NextResponse.json(
      { error: "Masih ada sesi checkin yang belum checkout" },
      { status: 409 }
    );
  }

  const now = new Date().toISOString();
  const doc = await db.collection("absences").add({
    employeeId: session.employeeId,
    checkinTime: now,
    checkinPhotoUrl,
    checkinLocation,
    checkoutTime: null,
    checkoutPhotoUrl: null,
    checkoutLocation: null,
    source: "employee",
    reason: null,
    createdAt: now,
    updatedAt: now,
  });

  return NextResponse.json({ id: doc.id }, { status: 201 });
}
