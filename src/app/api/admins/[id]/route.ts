import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { getSession, isAdminSession } from "@/lib/session";

// docs/features.md tidak eksplisit soal edit/delete admin — dibatasi ke Super Admin saja
// sebagai default aman (konsisten dengan aturan "hanya Super Admin bisa menambah admin baru").
// Pengecualian: update password — Super Admin bisa update password admin manapun,
// admin biasa hanya boleh update password miliknya sendiri (tidak bisa mengubah admin lain).
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session || !isAdminSession(session)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const isSuperAdmin = session.role === "super_admin";
  const isSelf = id === session.adminId;

  if (!isSuperAdmin && !isSelf) {
    return NextResponse.json(
      { error: "Tidak punya izin mengubah akun admin ini" },
      { status: 403 }
    );
  }

  const { name, role, password } = (await request.json()) as {
    name?: string;
    role?: "admin" | "super_admin";
    password?: string;
  };

  const update: Record<string, unknown> = {};

  if (isSuperAdmin) {
    if (typeof name === "string" && name.trim()) update.name = name;
    if (role === "admin" || role === "super_admin") update.role = role;
  }

  if (typeof password === "string" && password) {
    if (password.length < 6) {
      return NextResponse.json({ error: "Password minimal 6 karakter" }, { status: 400 });
    }
    update.password = password;
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "Tidak ada perubahan" }, { status: 400 });
  }

  const db = getAdminDb();
  const ref = db.collection("admins").doc(id);
  const doc = await ref.get();
  if (!doc.exists) {
    return NextResponse.json({ error: "Admin tidak ditemukan" }, { status: 404 });
  }

  // Cegah super_admin terakhir men-demote dirinya/admin lain jadi role "admin" biasa,
  // supaya tidak ada momen 0 super_admin di sistem (butuh minimal 1 untuk kelola akun admin lain).
  if (update.role === "admin" && doc.data()?.role === "super_admin") {
    const superAdmins = await db.collection("admins").where("role", "==", "super_admin").get();
    if (superAdmins.size <= 1) {
      return NextResponse.json(
        { error: "Tidak bisa mengubah role Super Admin terakhir" },
        { status: 400 }
      );
    }
  }

  await ref.update(update);
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session || !isAdminSession(session) || session.role !== "super_admin") {
    return NextResponse.json(
      { error: "Hanya Super Admin yang bisa menghapus akun admin" },
      { status: 403 }
    );
  }

  const { id } = await params;

  if (id === session.adminId) {
    return NextResponse.json(
      { error: "Tidak bisa menghapus akun sendiri" },
      { status: 400 }
    );
  }

  const db = getAdminDb();
  const ref = db.collection("admins").doc(id);
  const doc = await ref.get();
  if (!doc.exists) {
    return NextResponse.json({ error: "Admin tidak ditemukan" }, { status: 404 });
  }

  // Cegah super_admin terakhir terhapus, supaya selalu ada minimal 1 akun yang bisa
  // mengelola akun admin lain (mis. kalau ada 2 super_admin dan salah satu menghapus yang lain).
  if (doc.data()?.role === "super_admin") {
    const superAdmins = await db.collection("admins").where("role", "==", "super_admin").get();
    if (superAdmins.size <= 1) {
      return NextResponse.json(
        { error: "Tidak bisa menghapus Super Admin terakhir" },
        { status: 400 }
      );
    }
  }

  await ref.delete();
  return NextResponse.json({ ok: true });
}
