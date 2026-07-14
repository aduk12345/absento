import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { getSession, isEmployeeSession } from "@/lib/session";

const USERNAME_PATTERN = /^[a-zA-Z0-9]+$/;

// Karyawan edit profil sendiri (username/email/phone) — beda dari
// PATCH /api/employees/[id] yang khusus admin (bisa ubah field lain: name/status/password).
export async function PATCH(request: NextRequest) {
  const session = await getSession();
  if (!session || !isEmployeeSession(session)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as {
    email?: string;
    username?: string;
    phone?: string;
  };

  const db = getAdminDb();
  const ref = db.collection("employees").doc(session.employeeId);
  const doc = await ref.get();
  if (!doc.exists) {
    return NextResponse.json({ error: "Karyawan tidak ditemukan" }, { status: 404 });
  }
  const existingData = doc.data()!;

  const finalEmail = "email" in body ? body.email : existingData.email;
  const finalUsername = "username" in body ? body.username : existingData.username;
  const finalPhone = "phone" in body ? body.phone : existingData.phone;

  if (!finalEmail && !finalUsername && !finalPhone) {
    return NextResponse.json(
      { error: "Minimal salah satu dari username, email, atau no. HP wajib diisi" },
      { status: 400 }
    );
  }

  if (body.email) {
    const existingEmail = await db
      .collection("employees")
      .where("email", "==", body.email)
      .limit(1)
      .get();
    if (!existingEmail.empty && existingEmail.docs[0].id !== session.employeeId) {
      return NextResponse.json({ error: "Email sudah terdaftar" }, { status: 409 });
    }
  }

  if (body.username) {
    if (!USERNAME_PATTERN.test(body.username)) {
      return NextResponse.json(
        { error: "Username hanya boleh terdiri dari huruf dan angka" },
        { status: 400 }
      );
    }
    const existingUsername = await db
      .collection("employees")
      .where("username", "==", body.username)
      .limit(1)
      .get();
    if (!existingUsername.empty && existingUsername.docs[0].id !== session.employeeId) {
      return NextResponse.json({ error: "Username sudah terdaftar" }, { status: 409 });
    }
  }

  if (body.phone) {
    const existingPhone = await db
      .collection("employees")
      .where("phone", "==", body.phone)
      .limit(1)
      .get();
    if (!existingPhone.empty && existingPhone.docs[0].id !== session.employeeId) {
      return NextResponse.json({ error: "No. HP sudah terdaftar" }, { status: 409 });
    }
  }

  const update: Record<string, unknown> = { ...body, updatedAt: new Date().toISOString() };
  if ("email" in update) update.email = update.email || null;
  if ("username" in update) update.username = update.username || null;
  if ("phone" in update) update.phone = update.phone || null;

  await ref.update(update);
  return NextResponse.json({ ok: true });
}
