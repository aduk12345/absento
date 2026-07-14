import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { getSession, isAdminSession } from "@/lib/session";

// docs/features.md — Manage Admin: username, password, nama (tanpa email/no. HP/foto).
// Password disimpan plain text untuk versi awal (technical debt disengaja, lihat techContext.md).
export async function GET() {
  const session = await getSession();
  if (!session || !isAdminSession(session)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getAdminDb();
  const snap = await db.collection("admins").orderBy("name").get();
  const admins = snap.docs.map((doc) => {
    const { password: _password, ...rest } = doc.data();
    return { id: doc.id, ...rest };
  });

  return NextResponse.json({ admins });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session || !isAdminSession(session)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // docs/features.md — hanya Super Admin yang bisa menambah akun admin baru.
  if (session.role !== "super_admin") {
    return NextResponse.json(
      { error: "Hanya Super Admin yang bisa menambah akun admin baru" },
      { status: 403 }
    );
  }

  const { username, password, name, role } = (await request.json()) as {
    username?: string;
    password?: string;
    name?: string;
    role?: "admin" | "super_admin";
  };

  if (!username || !password || !name) {
    return NextResponse.json(
      { error: "Username, password, dan nama wajib diisi" },
      { status: 400 }
    );
  }

  if (password.length < 6) {
    return NextResponse.json({ error: "Password minimal 6 karakter" }, { status: 400 });
  }

  const finalRole: "admin" | "super_admin" = role === "super_admin" ? "super_admin" : "admin";

  const db = getAdminDb();

  const existing = await db.collection("admins").where("username", "==", username).limit(1).get();
  if (!existing.empty) {
    return NextResponse.json({ error: "Username sudah terdaftar" }, { status: 409 });
  }

  const now = new Date().toISOString();
  const doc = await db.collection("admins").add({
    username,
    password,
    name,
    role: finalRole,
    createdAt: now,
  });

  return NextResponse.json({ id: doc.id }, { status: 201 });
}
