"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { UserPlus, Power, Trash2, Pencil, RefreshCw } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { Badge } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";
import { Modal } from "@/components/ui/Modal";
import { Pagination } from "@/components/ui/Pagination";

const PAGE_SIZE = 10;

export type Employee = {
  id: string;
  name: string;
  email: string | null;
  username: string | null;
  phone: string | null;
  status: "active" | "inactive";
  password: string;
};

type EditForm = {
  name: string;
  email: string;
  username: string;
  phone: string;
  password: string;
};

// Saran username otomatis dari kata terakhir nama + suffix angka acak — bisa di-generate ulang atau diubah manual.
function buildUsernameSuggestion(name: string): string {
  const lastWord = name.trim().split(/\s+/).pop() ?? "";
  const base = lastWord.toLowerCase().replace(/[^a-z0-9]/g, "") || "user";
  const suffix = Math.floor(1000 + Math.random() * 9000);
  return `${base}${suffix}`;
}

export function EmployeesTable({
  initialEmployees,
  role,
}: {
  initialEmployees: Employee[];
  role: "admin" | "super_admin";
}) {
  const router = useRouter();
  const [employees, setEmployees] = useState(initialEmployees);
  const [showAddModal, setShowAddModal] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", username: "", phone: "" });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<EditForm>({
    name: "",
    email: "",
    username: "",
    phone: "",
    password: "",
  });
  const [editError, setEditError] = useState<string | null>(null);
  const [editLoading, setEditLoading] = useState(false);

  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(employees.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paginatedEmployees = employees.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.name.trim()) {
      setError("Nama wajib diisi");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/employees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Gagal menambah karyawan");
        return;
      }
      setEmployees((prev) => [
        ...prev,
        {
          id: data.id,
          name: form.name,
          email: form.email || null,
          username: data.username,
          phone: form.phone || null,
          status: "active",
          password: "123456789",
        },
      ]);
      setForm({ name: "", email: "", username: "", phone: "" });
      setShowAddModal(false);
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  function openAddModal() {
    setError(null);
    setForm({ name: "", email: "", username: buildUsernameSuggestion(""), phone: "" });
    setShowAddModal(true);
  }

  function regenerateUsername() {
    setForm((prev) => ({ ...prev, username: buildUsernameSuggestion(prev.name) }));
  }

  function handleNameBlur() {
    if (form.name.trim()) regenerateUsername();
  }

  async function handleToggleStatus(employee: Employee) {
    const newStatus = employee.status === "active" ? "inactive" : "active";
    await fetch(`/api/employees/${employee.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    setEmployees((prev) =>
      prev.map((e) => (e.id === employee.id ? { ...e, status: newStatus } : e))
    );
  }

  async function handleDelete(employee: Employee) {
    if (!confirm(`Hapus karyawan "${employee.name}"? Tindakan ini tidak bisa dibatalkan.`)) return;
    await fetch(`/api/employees/${employee.id}`, { method: "DELETE" });
    setEmployees((prev) => prev.filter((e) => e.id !== employee.id));
  }

  function openEdit(employee: Employee) {
    setEditingId(employee.id);
    setEditError(null);
    setEditForm({
      name: employee.name,
      email: employee.email ?? "",
      username: employee.username ?? "",
      phone: employee.phone ?? "",
      password: employee.password,
    });
  }

  function closeEdit() {
    setEditingId(null);
    setEditError(null);
  }

  function handleEditNameBlur() {
    if (editForm.name.trim()) {
      setEditForm((prev) => ({ ...prev, username: buildUsernameSuggestion(prev.name) }));
    }
  }

  async function handleEditSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingId) return;
    setEditError(null);
    if (!editForm.name.trim()) {
      setEditError("Nama wajib diisi");
      return;
    }
    if (!editForm.email && !editForm.username && !editForm.phone) {
      setEditError("Minimal salah satu dari username, email, atau no. HP wajib diisi");
      return;
    }
    if (editForm.password && editForm.password.length < 6) {
      setEditError("Password minimal 6 karakter");
      return;
    }
    setEditLoading(true);
    try {
      const res = await fetch(`/api/employees/${editingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });
      const data = await res.json();
      if (!res.ok) {
        setEditError(data.error ?? "Gagal menyimpan perubahan");
        return;
      }
      setEmployees((prev) =>
        prev.map((e) => (e.id === editingId ? { ...e, ...editForm } : e))
      );
      setEditingId(null);
      router.refresh();
    } finally {
      setEditLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Button type="button" onClick={openAddModal}>
          <UserPlus size={16} />
          Tambah Karyawan
        </Button>
      </div>

      <div className="hidden lg:block">
        <Card className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
                <th className="px-5 py-3">Karyawan</th>
                <th className="px-5 py-3">Username</th>
                <th className="px-5 py-3">No. HP</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {paginatedEmployees.map((employee) => (
                <tr key={employee.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <Avatar name={employee.name} size="sm" />
                      <div>
                        <p className="font-semibold text-slate-900">{employee.name}</p>
                        <p className="text-xs text-slate-500">{employee.email ?? "-"}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-slate-600">{employee.username ?? "-"}</td>
                  <td className="px-5 py-3 text-slate-600">{employee.phone ?? "-"}</td>
                  <td className="px-5 py-3">
                    <Badge tone={employee.status === "active" ? "green" : "zinc"}>
                      {employee.status === "active" ? "Aktif" : "Nonaktif"}
                    </Badge>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => openEdit(employee)}
                        className="flex items-center gap-1 text-xs font-semibold text-slate-600 hover:underline"
                      >
                        <Pencil size={13} />
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleToggleStatus(employee)}
                        className="flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:underline"
                      >
                        <Power size={13} />
                        {employee.status === "active" ? "Nonaktifkan" : "Aktifkan"}
                      </button>
                      {role === "super_admin" && (
                        <button
                          type="button"
                          onClick={() => handleDelete(employee)}
                          className="flex items-center gap-1 text-xs font-semibold text-rose-600 hover:underline"
                        >
                          <Trash2 size={13} />
                          Hapus
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {employees.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-sm text-slate-400">
                    Belum ada karyawan.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </Card>
      </div>

      <div className="flex flex-col gap-3 lg:hidden">
        {paginatedEmployees.map((employee) => (
          <Card key={employee.id} className="flex flex-col gap-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <Avatar name={employee.name} size="sm" />
                <div>
                  <p className="font-semibold text-slate-900">{employee.name}</p>
                  <p className="text-xs text-slate-500">{employee.email ?? "-"}</p>
                </div>
              </div>
              <Badge tone={employee.status === "active" ? "green" : "zinc"}>
                {employee.status === "active" ? "Aktif" : "Nonaktif"}
              </Badge>
            </div>
            <div className="grid grid-cols-2 gap-3 rounded-xl bg-slate-50 px-3 py-2.5 text-xs">
              <div>
                <p className="text-slate-400">Username</p>
                <p className="mt-0.5 font-medium text-slate-700">{employee.username ?? "-"}</p>
              </div>
              <div>
                <p className="text-slate-400">No. HP</p>
                <p className="mt-0.5 font-medium text-slate-700">{employee.phone ?? "-"}</p>
              </div>
            </div>
            <div className="flex items-center gap-4 border-t border-slate-100 pt-3">
              <button
                type="button"
                onClick={() => openEdit(employee)}
                className="flex items-center gap-1 text-xs font-semibold text-slate-600"
              >
                <Pencil size={13} />
                Edit
              </button>
              <button
                type="button"
                onClick={() => handleToggleStatus(employee)}
                className="flex items-center gap-1 text-xs font-semibold text-indigo-600"
              >
                <Power size={13} />
                {employee.status === "active" ? "Nonaktifkan" : "Aktifkan"}
              </button>
              {role === "super_admin" && (
                <button
                  type="button"
                  onClick={() => handleDelete(employee)}
                  className="flex items-center gap-1 text-xs font-semibold text-rose-600"
                >
                  <Trash2 size={13} />
                  Hapus
                </button>
              )}
            </div>
          </Card>
        ))}
        {employees.length === 0 && (
          <Card className="py-8 text-center text-sm text-slate-400">Belum ada karyawan.</Card>
        )}
      </div>

      <Pagination
        page={currentPage}
        totalPages={totalPages}
        totalItems={employees.length}
        pageSize={PAGE_SIZE}
        onChange={setPage}
      />

      {showAddModal && (
        <Modal title="Tambah Karyawan" onClose={() => setShowAddModal(false)}>
          <form onSubmit={handleAdd} className="space-y-3">
            <Input
              type="text"
              placeholder="Nama"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              onBlur={handleNameBlur}
              required
            />
            <Input
              type="email"
              placeholder="Email (opsional)"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
            <Input
              type="text"
              placeholder="No. HP (opsional)"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-600">
                Username <span className="font-normal text-slate-400">(otomatis mengikuti nama, bisa diubah manual)</span>
              </label>
              <div className="flex gap-2">
                <Input
                  type="text"
                  placeholder="Username"
                  value={form.username}
                  onChange={(e) => setForm({ ...form, username: e.target.value })}
                  pattern="[a-zA-Z0-9]+"
                  title="Username hanya boleh terdiri dari huruf dan angka"
                  required
                />
                <button
                  type="button"
                  onClick={regenerateUsername}
                  title="Buat ulang username acak"
                  className="flex shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 px-3 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
                >
                  <RefreshCw size={16} />
                </button>
              </div>
            </div>
            <p className="text-xs text-slate-500">Password default: 123456789</p>
            {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
            <Button type="submit" disabled={loading}>
              {loading ? "Menyimpan..." : "Simpan"}
            </Button>
          </form>
        </Modal>
      )}

      {editingId && (
        <Modal title="Edit Karyawan" onClose={closeEdit}>
          <form onSubmit={handleEditSubmit} className="space-y-3">
            <Input
              type="text"
              placeholder="Nama"
              value={editForm.name}
              onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
              onBlur={handleEditNameBlur}
              required
            />
            <Input
              type="email"
              placeholder="Email"
              value={editForm.email}
              onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
            />
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-600">
                Username <span className="font-normal text-slate-400">(otomatis mengikuti nama, bisa diubah manual)</span>
              </label>
              <Input
                type="text"
                placeholder="Username"
                value={editForm.username}
                onChange={(e) => setEditForm({ ...editForm, username: e.target.value })}
                pattern="[a-zA-Z0-9]+"
                title="Username hanya boleh terdiri dari huruf dan angka"
              />
            </div>
            <Input
              type="text"
              placeholder="No. HP"
              value={editForm.phone}
              onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
            />
            <p className="text-xs text-slate-500">Minimal salah satu dari username, email, atau no. HP wajib diisi.</p>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-600">Password</label>
              <PasswordInput
                placeholder="Password"
                autoComplete="off"
                value={editForm.password}
                onChange={(e) => setEditForm({ ...editForm, password: e.target.value })}
                required
              />
            </div>
            {editError && (
              <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{editError}</p>
            )}
            <div className="flex gap-2">
              <Button type="submit" disabled={editLoading}>
                {editLoading ? "Menyimpan..." : "Simpan"}
              </Button>
              <Button type="button" variant="secondary" onClick={closeEdit}>
                Batal
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
