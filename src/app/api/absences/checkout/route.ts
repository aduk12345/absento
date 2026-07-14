import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { getSession, isEmployeeSession } from "@/lib/session";

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
  await doc.ref.update({
    checkoutTime: new Date().toISOString(),
    checkoutPhotoUrl,
    checkoutLocation,
    updatedAt: new Date().toISOString(),
  });

  return NextResponse.json({ id: doc.id });
}
