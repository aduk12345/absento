"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ClipboardPlus, Pencil, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import { Avatar } from "@/components/ui/Avatar";
import { Modal } from "@/components/ui/Modal";
import { Pagination } from "@/components/ui/Pagination";

const PAGE_SIZE = 10;

export type Absence = {
  id: string;
  employeeId: string;
  employeeName: string;
  checkinTime: string | null;
  checkoutTime: string | null;
  source: "employee" | "admin";
  reason: string | null;
  status?: "complete" | "incomplete";
};

const SELECT_CLASS =
  "w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 outline-none transition-colors focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-100";

// ISO string <-> value untuk <input type="datetime-local"> (butuh format lokal tanpa timezone offset).
function isoToLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

function localInputToIso(value: string): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function formatDateTime(iso: string | null): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function AbsencesTable({
  initialAbsences,
  employees,
  defaultStartDate,
  defaultEndDate,
}: {
  initialAbsences: Absence[];
  employees: { id: string; name: string }[];
  defaultStartDate: string;
  defaultEndDate: string;
}) {
  const router = useRouter();
  const [absences, setAbsences] = useState(initialAbsences);
  const [startDate, setStartDate] = useState(defaultStartDate);
  const [endDate, setEndDate] = useState(defaultEndDate);
  const [filterLoading, setFilterLoading] = useState(false);
  const [filterError, setFilterError] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState({
    employeeId: employees[0]?.id ?? "",
    checkinTime: "",
    checkoutTime: "",
    reason: "",
  });
  const [addError, setAddError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ checkinTime: "", checkoutTime: "", reason: "" });
  const [editError, setEditError] = useState<string | null>(null);

  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(absences.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paginatedAbsences = absences.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  async function fetchAbsences(rangeStart: string, rangeEnd: string) {
    setFilterLoading(true);
    setFilterError(null);
    setPage(1);
    try {
      const params = new URLSearchParams({ startDate: rangeStart, endDate: rangeEnd });
      const res = await fetch(`/api/absences?${params.toString()}`);
      const data = await res.json();
      if (!res.ok) {
        setFilterError(data.error ?? "Gagal memuat data absen");
        return;
      }
      const employeeNameById = new Map(employees.map((emp) => [emp.id, emp.name]));
      setAbsences(
        data.absences.map((a: Omit<Absence, "employeeName"> & { employeeId: string }) => ({
          ...a,
          employeeName: employeeNameById.get(a.employeeId) ?? "(tidak diketahui)",
        }))
      );
    } finally {
      setFilterLoading(false);
    }
  }

  function handleApplyFilter() {
    if (startDate > endDate) {
      setFilterError("Tanggal akhir harus setelah tanggal awal");
      return;
    }
    fetchAbsences(startDate, endDate);
  }

  function handleResetToday() {
    setStartDate(defaultStartDate);
    setEndDate(defaultEndDate);
    fetchAbsences(defaultStartDate, defaultEndDate);
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setAddError(null);

    if (!addForm.reason.trim()) {
      setAddError("Alasan wajib diisi untuk absen manual");
      return;
    }
    if (!addForm.checkinTime && !addForm.checkoutTime) {
      setAddError("Minimal salah satu dari waktu checkin atau checkout wajib diisi");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/absences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId: addForm.employeeId,
          checkinTime: localInputToIso(addForm.checkinTime),
          checkoutTime: localInputToIso(addForm.checkoutTime),
          reason: addForm.reason,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setAddError(data.error ?? "Gagal menambah absen");
        return;
      }
      const employeeName =
        employees.find((e) => e.id === addForm.employeeId)?.name ?? "(tidak diketahui)";
      setAbsences((prev) => [
        {
          id: data.id,
          employeeId: addForm.employeeId,
          employeeName,
          checkinTime: localInputToIso(addForm.checkinTime),
          checkoutTime: localInputToIso(addForm.checkoutTime),
          source: "admin",
          reason: addForm.reason,
        },
        ...prev,
      ]);
      setAddForm({ employeeId: employees[0]?.id ?? "", checkinTime: "", checkoutTime: "", reason: "" });
      setShowAddModal(false);
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  function startEdit(absence: Absence) {
    setEditingId(absence.id);
    setEditError(null);
    setEditForm({
      checkinTime: isoToLocalInput(absence.checkinTime),
      checkoutTime: isoToLocalInput(absence.checkoutTime),
      reason: absence.reason ?? "",
    });
  }

  async function handleSaveEdit(absence: Absence) {
    setEditError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/absences/${absence.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          checkinTime: localInputToIso(editForm.checkinTime),
          checkoutTime: localInputToIso(editForm.checkoutTime),
          reason: editForm.reason || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setEditError(data.error ?? "Gagal menyimpan perubahan");
        return;
      }
      setAbsences((prev) =>
        prev.map((a) =>
          a.id === absence.id
            ? {
                ...a,
                checkinTime: localInputToIso(editForm.checkinTime),
                checkoutTime: localInputToIso(editForm.checkoutTime),
                reason: editForm.reason || null,
              }
            : a
        )
      );
      setEditingId(null);
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(absence: Absence) {
    if (
      !confirm(
        `Hapus record absen "${absence.employeeName}" (${formatDateTime(absence.checkinTime)})? Tindakan ini tidak bisa dibatalkan.`
      )
    )
      return;
    const res = await fetch(`/api/absences/${absence.id}`, { method: "DELETE" });
    if (res.ok) {
      setAbsences((prev) => prev.filter((a) => a.id !== absence.id));
      router.refresh();
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button type="button" onClick={() => setShowAddModal(true)}>
          <ClipboardPlus size={16} />
          Tambah Absen Manual
        </Button>
      </div>

      <Card>
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
          <div className="min-w-[150px]">
            <label className="mb-1.5 block text-xs font-semibold text-slate-600">
              Tanggal Mulai
            </label>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              disabled={filterLoading}
            />
          </div>
          <div className="min-w-[150px]">
            <label className="mb-1.5 block text-xs font-semibold text-slate-600">
              Tanggal Akhir
            </label>
            <Input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              disabled={filterLoading}
            />
          </div>
          <Button type="button" variant="secondary" onClick={handleApplyFilter} disabled={filterLoading}>
            {filterLoading ? "Memuat..." : "Terapkan"}
          </Button>
          {(startDate !== defaultStartDate || endDate !== defaultEndDate) && (
            <Button type="button" variant="ghost" onClick={handleResetToday} disabled={filterLoading}>
              Hari Ini
            </Button>
          )}
        </div>
        {filterError && (
          <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{filterError}</p>
        )}
      </Card>

      {showAddModal && (
        <Modal title="Tambah Absen Manual" onClose={() => setShowAddModal(false)}>
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
                <label className="mb-1 block text-xs font-semibold text-slate-600">Checkin</label>
                <Input
                  type="datetime-local"
                  value={addForm.checkinTime}
                  onChange={(e) => setAddForm({ ...addForm, checkinTime: e.target.value })}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600">Checkout</label>
                <Input
                  type="datetime-local"
                  value={addForm.checkoutTime}
                  onChange={(e) => setAddForm({ ...addForm, checkoutTime: e.target.value })}
                />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">
                Alasan (wajib)
              </label>
              <Input
                type="text"
                placeholder="Mis. karyawan lupa absen"
                value={addForm.reason}
                onChange={(e) => setAddForm({ ...addForm, reason: e.target.value })}
                required
              />
            </div>
            {addError && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{addError}</p>}
            <Button type="submit" disabled={loading}>
              {loading ? "Menyimpan..." : "Simpan"}
            </Button>
          </form>
        </Modal>
      )}

      <div className="hidden lg:block">
        <Card className="overflow-x-auto p-0">
          <table className="w-full min-w-[820px] text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
                <th className="px-5 py-3">Karyawan</th>
                <th className="px-5 py-3">Checkin</th>
                <th className="px-5 py-3">Checkout</th>
                <th className="px-5 py-3">Sumber</th>
                <th className="px-5 py-3">Alasan</th>
                <th className="px-5 py-3">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {paginatedAbsences.map((absence) => (
                <tr
                  key={absence.id}
                  className="border-b border-slate-50 align-top last:border-0 hover:bg-slate-50/60"
                >
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2.5">
                      <Avatar name={absence.employeeName} size="sm" />
                      <span className="font-semibold text-slate-900">{absence.employeeName}</span>
                    </div>
                  </td>
                  {editingId === absence.id ? (
                    <>
                      <td className="px-5 py-3">
                        <Input
                          type="datetime-local"
                          className="min-w-[190px]"
                          value={editForm.checkinTime}
                          onChange={(e) =>
                            setEditForm({ ...editForm, checkinTime: e.target.value })
                          }
                        />
                      </td>
                      <td className="px-5 py-3">
                        <Input
                          type="datetime-local"
                          className="min-w-[190px]"
                          value={editForm.checkoutTime}
                          onChange={(e) =>
                            setEditForm({ ...editForm, checkoutTime: e.target.value })
                          }
                        />
                      </td>
                      <td className="px-5 py-3">
                        <Badge tone={absence.source === "admin" ? "orange" : "green"}>
                          {absence.source === "admin" ? "Admin" : "Karyawan"}
                        </Badge>
                      </td>
                      <td className="px-5 py-3">
                        <Input
                          type="text"
                          className="min-w-[160px]"
                          value={editForm.reason}
                          onChange={(e) => setEditForm({ ...editForm, reason: e.target.value })}
                        />
                      </td>
                      <td className="space-y-2 px-5 py-3">
                        {editError && (
                          <p className="rounded-lg bg-rose-50 px-2 py-1 text-xs text-rose-700">
                            {editError}
                          </p>
                        )}
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            variant="primary"
                            className="px-3 py-1.5 text-xs"
                            disabled={loading}
                            onClick={() => handleSaveEdit(absence)}
                          >
                            Simpan
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            className="px-3 py-1.5 text-xs"
                            onClick={() => setEditingId(null)}
                          >
                            Batal
                          </Button>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="px-5 py-3 text-slate-600">{formatDateTime(absence.checkinTime)}</td>
                      <td className="px-5 py-3 text-slate-600">
                        {formatDateTime(absence.checkoutTime)}
                        {absence.status === "incomplete" && (
                          <span className="ml-2 inline-block">
                            <Badge tone="orange">Tidak Lengkap</Badge>
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        <Badge tone={absence.source === "admin" ? "orange" : "green"}>
                          {absence.source === "admin" ? "Admin" : "Karyawan"}
                        </Badge>
                      </td>
                      <td className="px-5 py-3 text-slate-500">{absence.reason ?? "-"}</td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => startEdit(absence)}
                            className="flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:underline"
                          >
                            <Pencil size={13} />
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(absence)}
                            className="flex items-center gap-1 text-xs font-semibold text-rose-600 hover:underline"
                          >
                            <Trash2 size={13} />
                            Hapus
                          </button>
                        </div>
                      </td>
                    </>
                  )}
                </tr>
              ))}
              {absences.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-sm text-slate-400">
                    Belum ada record absen.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </Card>
      </div>

      <div className="flex flex-col gap-3 lg:hidden">
        {paginatedAbsences.map((absence) => (
          <Card key={absence.id} className="flex flex-col gap-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <Avatar name={absence.employeeName} size="sm" />
                <span className="font-semibold text-slate-900">{absence.employeeName}</span>
              </div>
              <Badge tone={absence.source === "admin" ? "orange" : "green"}>
                {absence.source === "admin" ? "Admin" : "Karyawan"}
              </Badge>
            </div>

            {editingId === absence.id ? (
              <>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-600">Checkin</label>
                    <Input
                      type="datetime-local"
                      value={editForm.checkinTime}
                      onChange={(e) => setEditForm({ ...editForm, checkinTime: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-600">Checkout</label>
                    <Input
                      type="datetime-local"
                      value={editForm.checkoutTime}
                      onChange={(e) => setEditForm({ ...editForm, checkoutTime: e.target.value })}
                    />
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-600">Alasan</label>
                  <Input
                    type="text"
                    value={editForm.reason}
                    onChange={(e) => setEditForm({ ...editForm, reason: e.target.value })}
                  />
                </div>
                {editError && (
                  <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">{editError}</p>
                )}
                <div className="flex gap-2 border-t border-slate-100 pt-3">
                  <Button
                    type="button"
                    variant="primary"
                    className="px-3 py-1.5 text-xs"
                    disabled={loading}
                    onClick={() => handleSaveEdit(absence)}
                  >
                    Simpan
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    className="px-3 py-1.5 text-xs"
                    onClick={() => setEditingId(null)}
                  >
                    Batal
                  </Button>
                </div>
              </>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3 rounded-xl bg-slate-50 px-3 py-2.5 text-xs">
                  <div>
                    <p className="text-slate-400">Checkin</p>
                    <p className="mt-0.5 font-medium text-slate-700">{formatDateTime(absence.checkinTime)}</p>
                  </div>
                  <div>
                    <p className="text-slate-400">Checkout</p>
                    <p className="mt-0.5 font-medium text-slate-700">
                      {formatDateTime(absence.checkoutTime)}
                      {absence.status === "incomplete" && (
                        <span className="ml-2 inline-block">
                          <Badge tone="orange">Tidak Lengkap</Badge>
                        </span>
                      )}
                    </p>
                  </div>
                </div>
                <p className="text-xs text-slate-500">
                  Alasan: <span className="text-slate-700">{absence.reason ?? "-"}</span>
                </p>
                <div className="flex items-center gap-4 border-t border-slate-100 pt-3">
                  <button
                    type="button"
                    onClick={() => startEdit(absence)}
                    className="flex items-center gap-1 text-xs font-semibold text-indigo-600"
                  >
                    <Pencil size={13} />
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(absence)}
                    className="flex items-center gap-1 text-xs font-semibold text-rose-600"
                  >
                    <Trash2 size={13} />
                    Hapus
                  </button>
                </div>
              </>
            )}
          </Card>
        ))}
        {absences.length === 0 && (
          <Card className="py-8 text-center text-sm text-slate-400">Belum ada record absen.</Card>
        )}
      </div>

      <Pagination
        page={currentPage}
        totalPages={totalPages}
        totalItems={absences.length}
        pageSize={PAGE_SIZE}
        onChange={setPage}
      />
    </div>
  );
}
