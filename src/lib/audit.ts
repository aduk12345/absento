import { getAdminDb } from "@/lib/firebase-admin";

// docs/features.md — Manage Absence: setiap perubahan (create/update/delete) pada `absences`
// lewat halaman admin wajib tercatat di `absence_audit_logs` (before/after snapshot, adminId, timestamp).
export type AbsenceAuditAction = "create" | "update" | "delete";

export async function logAbsenceAudit({
  absenceId,
  adminId,
  action,
  beforeData,
  afterData,
}: {
  absenceId: string;
  adminId: string;
  action: AbsenceAuditAction;
  beforeData: Record<string, unknown> | null;
  afterData: Record<string, unknown> | null;
}): Promise<void> {
  const db = getAdminDb();
  await db.collection("absence_audit_logs").add({
    absenceId,
    adminId,
    action,
    beforeData,
    afterData,
    timestamp: new Date().toISOString(),
  });
}
