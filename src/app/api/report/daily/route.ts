import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase-admin";
import { getSession, isAdminSession } from "@/lib/session";
import { startOfJakartaDayUtc, endOfJakartaDayUtc } from "@/lib/date";

// docs/features.md — Report Per Hari (Seluruh Karyawan): status semua karyawan aktif pada
// satu tanggal (hadir/izin/alpha).
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session || !isAdminSession(session)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const date = request.nextUrl.searchParams.get("date"); // "YYYY-MM-DD"
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "date wajib diisi (format YYYY-MM-DD)" }, { status: 400 });
  }

  const start = startOfJakartaDayUtc(date);
  const end = endOfJakartaDayUtc(date);
  if (Number.isNaN(start.getTime())) {
    return NextResponse.json({ error: "Tanggal tidak valid" }, { status: 400 });
  }

  const db = getAdminDb();

  const [employeesSnap, absencesSnap, leavesSnap] = await Promise.all([
    db.collection("employees").where("status", "==", "active").get(),
    db
      .collection("absences")
      .where("checkinTime", ">=", start.toISOString())
      .where("checkinTime", "<=", end.toISOString())
      .get(),
    db.collection("leave_requests").where("status", "==", "approved").get(),
  ]);

  const absenceByEmployee = new Map<
    string,
    { checkinTime: string; checkoutTime: string | null }
  >();
  for (const doc of absencesSnap.docs) {
    const data = doc.data();
    const checkinTime: string = data.checkinTime;
    const checkoutTime: string | null = data.checkoutTime ?? null;
    // Karyawan seharusnya cuma punya 1 siklus checkin/checkout per hari — kalau ada lebih,
    // pakai yang paling awal (record pertama ditemukan cukup untuk ringkasan status per-hari).
    if (!absenceByEmployee.has(data.employeeId)) {
      absenceByEmployee.set(data.employeeId, { checkinTime, checkoutTime });
    }
  }

  const leaveByEmployee = new Map<string, string>(); // employeeId -> reason
  for (const doc of leavesSnap.docs) {
    const data = doc.data() as { employeeId: string; startDate: string; endDate: string; reason: string };
    if (data.startDate <= date && data.endDate >= date) {
      leaveByEmployee.set(data.employeeId, data.reason);
    }
  }

  const employees = employeesSnap.docs.map((doc) => {
    const name = doc.data().name as string;
    const absence = absenceByEmployee.get(doc.id);
    if (absence) {
      return {
        id: doc.id,
        name,
        status: "hadir" as const,
        checkinTime: absence.checkinTime,
        checkoutTime: absence.checkoutTime,
        reason: null,
      };
    }
    const leaveReason = leaveByEmployee.get(doc.id);
    if (leaveReason) {
      return {
        id: doc.id,
        name,
        status: "izin" as const,
        checkinTime: null,
        checkoutTime: null,
        reason: leaveReason,
      };
    }
    return {
      id: doc.id,
      name,
      status: "alpha" as const,
      checkinTime: null,
      checkoutTime: null,
      reason: null,
    };
  });

  const STATUS_RANK = { hadir: 0, izin: 1, alpha: 2 };
  employees.sort((a, b) => {
    const rankDiff = STATUS_RANK[a.status] - STATUS_RANK[b.status];
    if (rankDiff !== 0) return rankDiff;
    if (a.status === "hadir" && b.status === "hadir") {
      return a.checkinTime!.localeCompare(b.checkinTime!);
    }
    return a.name.localeCompare(b.name);
  });

  return NextResponse.json({ date, employees });
}
