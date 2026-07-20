"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, X, CalendarOff, Plus } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import { Avatar } from "@/components/ui/Avatar";
import { Modal } from "@/components/ui/Modal";
import { Pagination } from "@/components/ui/Pagination";

const PAGE_SIZE = 10;

export type LeaveRequest = {
  id: string;
  employeeId: string;
  employeeName: string;
  startDate: string;
  endDate: string;
  totalDays: number;
  reason: string;
  status: "pending" | "approved" | "rejected";
  source: "employee" | "admin";
  reviewNote: string | null;
};

const SELECT_CLASS =
  "w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 outline-none transition-colors focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-100";

function formatDate(value: string): string {
  return new Date(`${value}T00:00:00`).toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function statusBadge(status: LeaveRequest["status"]) {
  if (status === "approved") return <Badge tone="green">Disetujui</Badge>;
  if (status === "rejected") return <Badge tone="red">Ditolak</Badge>;
  return <Badge tone="orange">Menunggu</Badge>;
}

export function LeavesTable({
  initialRequests,
  employees,
}: {
  initialRequests: LeaveRequest[];
  employees: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [requests, setRequests] = useState(initialRequests);
  const [statusFilter, setStatusFilter] = useState<"pending" | "all">("pending");
  const [filterLoading, setFilterLoading] = useState(false);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectNote, setRejectNote] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState({
    employeeId: employees[0]?.id ?? "",
    startDate: "",
    endDate: "",
    reason: "",
  });
  const [addError, setAddError] = useState<string | null>(null);
  const [addLoading, setAddLoading] = useState(false);

  const visible = statusFilter === "pending" ? requests.filter((r) => r.status === "pending") : requests;
  const totalPages = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paginated = visible.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  async function loadRequests(filter: "pending" | "all") {
    setFilterLoading(true);
    setPage(1);
    try {
      const params = filter === "pending" ? "?status=pending" : "";
      const res = await fetch(`/api/leaves${params}`);
      const data = await res.json();
      const employeeNameById = new Map(employees.map((emp) => [emp.id, emp.name]));
      setRequests(
        (data.requests ?? []).map((r: Omit<LeaveRequest, "employeeName">) => ({
          ...r,
          employeeName: employeeNameById.get(r.employeeId) ?? "(tidak diketahui)",
        }))
      );
    } finally {
      setFilterLoading(false);
    }
  }

  function handleFilterChange(filter: "pending" | "all") {
    setStatusFilter(filter);
    loadRequests(filter);
  }

  const addTotalDays =
    addForm.startDate && addForm.endDate && addForm.endDate >= addForm.startDate
      ? Math.round(
          (new Date(`${addForm.endDate}T00:00:00`).getTime() -
            new Date(`${addForm.startDate}T00:00:00`).getTime()) /
            (1000 * 60 * 60 * 24)
        ) + 1
      : null;

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setAddError(null);

    if (!addForm.startDate || !addForm.endDate) {
      setAddError("Tanggal mulai dan tanggal akhir wajib diisi");
      return;
    }
    if (addForm.endDate < addForm.startDate) {
      setAddError("Tanggal akhir harus setelah atau sama dengan tanggal mulai");
      return;
    }
    if (!addForm.reason.trim()) {
      setAddError("Alasan wajib diisi");
      return;
    }

    setAddLoading(true);
    try {
      const res = await fetch("/api/leaves", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(addForm),
      });
      const data = await res.json();
      if (!res.ok) {
        setAddError(data.error ?? "Gagal menambah izin");
        return;
      }
      setAddForm({ employeeId: employees[0]?.id ?? "", startDate: "", endDate: "", reason: "" });
      setShowAddModal(false);
      loadRequests(statusFilter);
      router.refresh();
    } finally {
      setAddLoading(false);
    }
  }

  async function handleApprove(id: string) {
    setActionError(null);
    const res = await fetch(`/api/leaves/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "approved" }),
    });
    if (!res.ok) {
      const data = await res.json();
      setActionError(data.error ?? "Gagal menyetujui izin");
      return;
    }
    setRequests((prev) => prev.map((r) => (r.id === id ? { ...r, status: "approved" } : r)));
    router.refresh();
  }

  async function handleReject(id: string) {
    setActionError(null);
    const res = await fetch(`/api/leaves/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "rejected", reviewNote: rejectNote || null }),
    });
    if (!res.ok) {
      const data = await res.json();
      setActionError(data.error ?? "Gagal menolak izin");
      return;
    }
    setRequests((prev) =>
      prev.map((r) => (r.id === id ? { ...r, status: "rejected", reviewNote: rejectNote || null } : r))
    );
    setRejectingId(null);
    setRejectNote("");
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button type="button" onClick={() => setShowAddModal(true)}>
          <CalendarOff size={16} />
          Tambah Izin
        </Button>
      </div>

      <Card>
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-slate-600">Status:</label>
          <select
            className={`${SELECT_CLASS} max-w-[180px]`}
            value={statusFilter}
            onChange={(e) => handleFilterChange(e.target.value as "pending" | "all")}
            disabled={filterLoading}
          >
            <option value="pending">Menunggu</option>
            <option value="all">Semua</option>
          </select>
        </div>
        {actionError && (
          <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{actionError}</p>
        )}
      </Card>

      {showAddModal && (
        <Modal title="Tambah Izin" onClose={() => setShowAddModal(false)}>
          <form onSubmit={handleAdd} className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">Karyawan</label>
              <select
                className={SELECT_CLASS}
                value={addForm.employeeId}
                onChange={(e) => setAddForm({ ...addForm, employeeId: e.target.value })}
                required
              >
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600">
                  Tanggal Mulai
                </label>
                <Input
                  type="date"
                  value={addForm.startDate}
                  onChange={(e) => setAddForm({ ...addForm, startDate: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600">
                  Tanggal Akhir
                </label>
                <Input
                  type="date"
                  value={addForm.endDate}
                  min={addForm.startDate || undefined}
                  onChange={(e) => setAddForm({ ...addForm, endDate: e.target.value })}
                  required
                />
              </div>
            </div>
            {addTotalDays != null && (
              <p className="flex items-center gap-1.5 rounded-xl bg-indigo-50 px-3 py-2 text-sm font-semibold text-indigo-700">
                <Plus size={15} />
                Total: {addTotalDays} hari
              </p>
            )}
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">
                Alasan (wajib)
              </label>
              <Input
                type="text"
                placeholder="Mis. keperluan keluarga"
                value={addForm.reason}
                onChange={(e) => setAddForm({ ...addForm, reason: e.target.value })}
                required
              />
            </div>
            {addError && (
              <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{addError}</p>
            )}
            <Button type="submit" disabled={addLoading}>
              {addLoading ? "Menyimpan..." : "Simpan"}
            </Button>
          </form>
        </Modal>
      )}

      <div className="hidden lg:block">
        <Card className="overflow-x-auto p-0">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
                <th className="px-5 py-3">Karyawan</th>
                <th className="px-5 py-3">Tanggal</th>
                <th className="px-5 py-3">Hari</th>
                <th className="px-5 py-3">Alasan</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {paginated.map((r) => (
                <tr key={r.id} className="border-b border-slate-50 align-top last:border-0 hover:bg-slate-50/60">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2.5">
                      <Avatar name={r.employeeName} size="sm" />
                      <span className="font-semibold text-slate-900">{r.employeeName}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-slate-600">
                    {formatDate(r.startDate)}
                    {r.startDate !== r.endDate && <> &ndash; {formatDate(r.endDate)}</>}
                  </td>
                  <td className="px-5 py-3 text-slate-600">{r.totalDays} hari</td>
                  <td className="px-5 py-3 text-slate-500">
                    {r.reason}
                    {r.status === "rejected" && r.reviewNote && (
                      <p className="mt-1 text-xs text-rose-600">Catatan tolak: {r.reviewNote}</p>
                    )}
                  </td>
                  <td className="px-5 py-3">{statusBadge(r.status)}</td>
                  <td className="px-5 py-3">
                    {r.status === "pending" ? (
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => handleApprove(r.id)}
                          className="flex items-center gap-1 text-xs font-semibold text-emerald-600 hover:underline"
                        >
                          <Check size={13} />
                          Setujui
                        </button>
                        <button
                          type="button"
                          onClick={() => setRejectingId(r.id)}
                          className="flex items-center gap-1 text-xs font-semibold text-rose-600 hover:underline"
                        >
                          <X size={13} />
                          Tolak
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-300">-</span>
                    )}
                  </td>
                </tr>
              ))}
              {visible.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-sm text-slate-400">
                    Tidak ada pengajuan izin.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </Card>
      </div>

      <div className="flex flex-col gap-3 lg:hidden">
        {paginated.map((r) => (
          <Card key={r.id} className="flex flex-col gap-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <Avatar name={r.employeeName} size="sm" />
                <span className="font-semibold text-slate-900">{r.employeeName}</span>
              </div>
              {statusBadge(r.status)}
            </div>
            <p className="text-xs text-slate-500">
              {formatDate(r.startDate)}
              {r.startDate !== r.endDate && <> &ndash; {formatDate(r.endDate)}</>} &middot; {r.totalDays} hari
            </p>
            <p className="text-xs text-slate-500">
              Alasan: <span className="text-slate-700">{r.reason}</span>
            </p>
            {r.status === "rejected" && r.reviewNote && (
              <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">
                Catatan tolak: {r.reviewNote}
              </p>
            )}
            {r.status === "pending" && (
              <div className="flex items-center gap-4 border-t border-slate-100 pt-3">
                <button
                  type="button"
                  onClick={() => handleApprove(r.id)}
                  className="flex items-center gap-1 text-xs font-semibold text-emerald-600"
                >
                  <Check size={13} />
                  Setujui
                </button>
                <button
                  type="button"
                  onClick={() => setRejectingId(r.id)}
                  className="flex items-center gap-1 text-xs font-semibold text-rose-600"
                >
                  <X size={13} />
                  Tolak
                </button>
              </div>
            )}
          </Card>
        ))}
        {visible.length === 0 && (
          <Card className="py-8 text-center text-sm text-slate-400">Tidak ada pengajuan izin.</Card>
        )}
      </div>

      <Pagination
        page={currentPage}
        totalPages={totalPages}
        totalItems={visible.length}
        pageSize={PAGE_SIZE}
        onChange={setPage}
      />

      {rejectingId && (
        <Modal
          title="Tolak Pengajuan Izin"
          onClose={() => {
            setRejectingId(null);
            setRejectNote("");
          }}
        >
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">
                Catatan (opsional)
              </label>
              <input
                type="text"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 outline-none focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-100"
                placeholder="Alasan penolakan"
                value={rejectNote}
                onChange={(e) => setRejectNote(e.target.value)}
              />
            </div>
            <Button type="button" variant="danger" onClick={() => handleReject(rejectingId)}>
              Tolak Pengajuan
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
