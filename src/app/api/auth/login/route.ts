import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { createSession } from "@/lib/session";

// Custom login: query Firestore directly and compare password.
// Password is stored PLAIN TEXT for now — documented technical debt, see docs/database-schema.md.
export async function POST(request: NextRequest) {
  const { identifier, password } = (await request.json()) as {
    identifier?: string;
    password?: string;
  };

  if (!identifier || !password) {
    return NextResponse.json(
      { error: "Identifier dan password wajib diisi" },
      { status: 400 }
    );
  }

  const adminDb = getAdminDb();

  // Try employee first (login via email, username, atau no. HP), then admin (login via username).
  let employeeSnap = await adminDb
    .collection("employees")
    .where("email", "==", identifier)
    .where("status", "==", "active")
    .limit(1)
    .get();

  if (employeeSnap.empty) {
    employeeSnap = await adminDb
      .collection("employees")
      .where("username", "==", identifier)
      .where("status", "==", "active")
      .limit(1)
      .get();
  }

  if (employeeSnap.empty) {
    employeeSnap = await adminDb
      .collection("employees")
      .where("phone", "==", identifier)
      .where("status", "==", "active")
      .limit(1)
      .get();
  }

  if (!employeeSnap.empty) {
    const doc = employeeSnap.docs[0];
    const employee = doc.data();
    if (employee.password !== password) {
      return NextResponse.json({ error: "Password salah" }, { status: 401 });
    }
    await createSession({ role: "employee", employeeId: doc.id, name: employee.name });
    return NextResponse.json({ role: "employee" });
  }

  const adminSnap = await adminDb
    .collection("admins")
    .where("username", "==", identifier)
    .limit(1)
    .get();

  if (!adminSnap.empty) {
    const doc = adminSnap.docs[0];
    const admin = doc.data();
    if (admin.password !== password) {
      return NextResponse.json({ error: "Password salah" }, { status: 401 });
    }
    await createSession({ role: admin.role, adminId: doc.id, name: admin.name });
    return NextResponse.json({ role: admin.role });
  }

  return NextResponse.json({ error: "Akun tidak ditemukan" }, { status: 401 });
}
