import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { getSession, isAdminSession } from "@/lib/session";

const DEFAULT_PASSWORD = "123456789";
const USERNAME_PATTERN = /^[a-zA-Z0-9]+$/;

// Username otomatis dari kata terakhir nama + suffix angka acak, dipakai sebagai saran default (tetap bisa diubah manual).
function buildUsernameCandidate(name: string): string {
  const lastWord = name.trim().split(/\s+/).pop() ?? "";
  const base = lastWord.toLowerCase().replace(/[^a-z0-9]/g, "") || "user";
  const suffix = Math.floor(1000 + Math.random() * 9000);
  return `${base}${suffix}`;
}

async function generateUniqueUsername(
  db: FirebaseFirestore.Firestore,
  name: string
): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const candidate = buildUsernameCandidate(name);
    const existing = await db.collection("employees").where("username", "==", candidate).limit(1).get();
    if (existing.empty) return candidate;
  }
  throw new Error("Gagal membuat username unik, coba lagi");
}

export async function GET() {
  const session = await getSession();
  if (!session || !isAdminSession(session)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getAdminDb();
  const snap = await db.collection("employees").orderBy("name").get();
  const employees = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

  return NextResponse.json({ employees });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session || !isAdminSession(session)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { name, email, username: requestedUsername, phone, photoUrl } = (await request.json()) as {
    name?: string;
    email?: string;
    username?: string;
    phone?: string;
    photoUrl?: string | null;
  };

  if (!name) {
    return NextResponse.json({ error: "Nama wajib diisi" }, { status: 400 });
  }

  if (requestedUsername && !USERNAME_PATTERN.test(requestedUsername)) {
    return NextResponse.json(
      { error: "Username hanya boleh terdiri dari huruf dan angka" },
      { status: 400 }
    );
  }

  const db = getAdminDb();

  if (email) {
    const existingEmail = await db.collection("employees").where("email", "==", email).limit(1).get();
    if (!existingEmail.empty) {
      return NextResponse.json({ error: "Email sudah terdaftar" }, { status: 409 });
    }
  }

  if (phone) {
    const existingPhone = await db.collection("employees").where("phone", "==", phone).limit(1).get();
    if (!existingPhone.empty) {
      return NextResponse.json({ error: "No. HP sudah terdaftar" }, { status: 409 });
    }
  }

  let username: string;
  if (requestedUsername) {
    const existingUsername = await db
      .collection("employees")
      .where("username", "==", requestedUsername)
      .limit(1)
      .get();
    if (!existingUsername.empty) {
      return NextResponse.json({ error: "Username sudah terdaftar" }, { status: 409 });
    }
    username = requestedUsername;
  } else {
    username = await generateUniqueUsername(db, name);
  }

  const now = new Date().toISOString();
  const doc = await db.collection("employees").add({
    name,
    email: email ?? null,
    username,
    phone: phone ?? null,
    photoUrl: photoUrl ?? null,
    password: DEFAULT_PASSWORD,
    status: "active",
    createdAt: now,
    updatedAt: now,
  });

  return NextResponse.json({ id: doc.id, username }, { status: 201 });
}
