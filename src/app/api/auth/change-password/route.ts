import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { getSession, isEmployeeSession } from "@/lib/session";

// docs/features.md — Ganti password: perlu re-authentication dengan password lama.
// Password disimpan plain text (technical debt terdokumentasi, lihat docs/techContext.md).
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session || !isEmployeeSession(session)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { oldPassword, newPassword } = (await request.json()) as {
    oldPassword?: string;
    newPassword?: string;
  };

  if (!oldPassword || !newPassword) {
    return NextResponse.json(
      { error: "Password lama dan password baru wajib diisi" },
      { status: 400 }
    );
  }

  if (newPassword.length < 6) {
    return NextResponse.json(
      { error: "Password baru minimal 6 karakter" },
      { status: 400 }
    );
  }

  const db = getAdminDb();
  const docRef = db.collection("employees").doc(session.employeeId);
  const doc = await docRef.get();

  if (!doc.exists) {
    return NextResponse.json({ error: "Akun tidak ditemukan" }, { status: 404 });
  }

  const employee = doc.data()!;
  if (employee.password !== oldPassword) {
    return NextResponse.json({ error: "Password lama salah" }, { status: 401 });
  }

  await docRef.update({
    password: newPassword,
    updatedAt: new Date().toISOString(),
  });

  return NextResponse.json({ ok: true });
}
