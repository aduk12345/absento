import { getAdminDb } from "@/lib/firebase-admin";

// docs/features.md — Izin: rentang tanggal dihitung inklusif (9-10 = 2 hari, 9-9 = 1 hari).
export function calculateLeaveDays(startDate: string, endDate: string): number {
  const start = new Date(`${startDate}T00:00:00.000Z`);
  const end = new Date(`${endDate}T00:00:00.000Z`);
  return Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
}

export type LeaveStatus = "pending" | "approved" | "rejected";

export type LeaveRequest = {
  id: string;
  employeeId: string;
  startDate: string;
  endDate: string;
  totalDays: number;
  reason: string;
  attachmentUrl: string | null;
  status: LeaveStatus;
  source: "employee" | "admin";
  reviewedBy: string | null;
  reviewedAt: string | null;
  reviewNote: string | null;
  createdAt: string;
  updatedAt: string;
};

// Jumlah hari cuti approved milik employeeId yang beririsan dengan [rangeStart, rangeEnd]
// (dipotong ke batas rentang) — dipakai untuk summary Report.
export function overlapDays(
  reqStart: string,
  reqEnd: string,
  rangeStart: string,
  rangeEnd: string
): number {
  const start = reqStart > rangeStart ? reqStart : rangeStart;
  const end = reqEnd < rangeEnd ? reqEnd : rangeEnd;
  if (start > end) return 0;
  return calculateLeaveDays(start, end);
}

export async function getApprovedLeavesInRange(
  employeeId: string,
  rangeStart: string,
  rangeEnd: string
): Promise<LeaveRequest[]> {
  const db = getAdminDb();
  const snap = await db
    .collection("leave_requests")
    .where("employeeId", "==", employeeId)
    .where("status", "==", "approved")
    .get();

  return snap.docs
    .map((doc) => ({ id: doc.id, ...doc.data() }) as LeaveRequest)
    .filter((leave) => leave.startDate <= rangeEnd && leave.endDate >= rangeStart);
}
