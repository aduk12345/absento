"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldPlus, X, Pencil, Trash2, Check } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { Avatar } from "@/components/ui/Avatar";
import { Modal } from "@/components/ui/Modal";

export type AdminAccount = {
  id: string;
  username: string;
  name: string;
  role: "admin" | "super_admin";
};

const SELECT_CLASS =
  "w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 outline-none transition-colors focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-100";

export function AdminsTable({
  initialAdmins,
  role,
  currentAdminId,
}: {
  initialAdmins: AdminAccount[];
  role: "admin" | "super_admin";
  currentAdminId: string | null;
}) {
  const router = useRouter();
  const isSuperAdmin = role === "super_admin";
  const showAksiColumn = isSuperAdmin || initialAdmins.some((a) => a.id === currentAdminId);
  const [admins, setAdmins] = useState(initialAdmins);
  const [showAddModal, setShowAddModal] = useState(false);
  const [form, setForm] = useState({
    username: "",
    password: "",
    name: "",
    role: "admin" as "admin" | "super_admin",
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({
    name: "",
    role: "admin" as "admin" | "super_admin",
    password: "",
  });
  const [editError, setEditError] = useState<string | null>(null);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (form.password.length < 6) {
      setError("Password minimal 6 karakter");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/admins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Gagal menambah admin");
        return;
      }
      setAdmins((prev) => [
        ...prev,
        { id: data.id, username: form.username, name: form.name, role: form.role },
      ]);
      setForm({ username: "", password: "", name: "", role: "admin" });
      setShowAddModal(false);
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  function canEditRow(admin: AdminAccount) {
    return isSuperAdmin || admin.id === currentAdminId;
  }

  function startEdit(admin: AdminAccount) {
    setEditingId(admin.id);
    setEditForm({ name: admin.name, role: admin.role, password: "" });
    setEditError(null);
  }

  async function handleSaveEdit(admin: AdminAccount) {
    setEditError(null);
    if (editForm.password && editForm.password.length < 6) {
      setEditError("Password minimal 6 karakter");
      return;
    }
    if (!isSuperAdmin && !editForm.password) {
      setEditError("Isi password baru");
      return;
    }
    setLoading(true);
    try {
      const payload: Record<string, string> = isSuperAdmin
        ? { name: editForm.name, role: editForm.role }
        : {};
      if (editForm.password) payload.password = editForm.password;

      const res = await fetch(`/api/admins/${admin.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setEditError(data.error ?? "Gagal menyimpan perubahan");
        return;
      }
      setAdmins((prev) =>
        prev.map((a) =>
          a.id === admin.id && isSuperAdmin ? { ...a, name: editForm.name, role: editForm.role } : a
        )
      );
      setEditingId(null);
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(admin: AdminAccount) {
    if (!confirm(`Hapus admin "${admin.name}"? Tindakan ini tidak bisa dibatalkan.`)) return;
    const res = await fetch(`/api/admins/${admin.id}`, { method: "DELETE" });
    if (res.ok) {
      setAdmins((prev) => prev.filter((a) => a.id !== admin.id));
      router.refresh();
    }
  }

  return (
    <div className="space-y-4">
      {isSuperAdmin && (
        <div className="flex justify-end">
          <Button type="button" onClick={() => setShowAddModal(true)}>
            <ShieldPlus size={16} />
            Tambah Admin
          </Button>
        </div>
      )}

      {isSuperAdmin && showAddModal && (
        <Modal title="Tambah Admin" onClose={() => setShowAddModal(false)}>
          <form onSubmit={handleAdd} className="space-y-3">
            <Input
              type="text"
              placeholder="Username"
              autoComplete="off"
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
              required
            />
            <PasswordInput
              placeholder="Password"
              autoComplete="new-password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required
            />
            <Input
              type="text"
              placeholder="Nama"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
            <select
              className={SELECT_CLASS}
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value as "admin" | "super_admin" })}
            >
              <option value="admin">Admin</option>
              <option value="super_admin">Super Admin</option>
            </select>
            {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
            <Button type="submit" disabled={loading}>
              {loading ? "Menyimpan..." : "Simpan"}
            </Button>
          </form>
        </Modal>
      )}

      <div className="hidden lg:block">
        <Card className="overflow-x-auto p-0">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
                <th className="px-5 py-3">Admin</th>
                <th className="px-5 py-3">Role</th>
                {showAksiColumn && <th className="px-5 py-3">Aksi</th>}
              </tr>
            </thead>
            <tbody>
              {admins.map((admin) => (
                <tr key={admin.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <Avatar name={admin.name} size="sm" />
                      <div>
                        {editingId === admin.id ? (
                          <div className="space-y-1.5">
                            {isSuperAdmin ? (
                              <Input
                                className="max-w-[180px]"
                                value={editForm.name}
                                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                              />
                            ) : (
                              <p className="font-semibold text-slate-900">{admin.name}</p>
                            )}
                            <PasswordInput
                              className="max-w-[180px]"
                              placeholder="Password baru"
                              autoComplete="new-password"
                              value={editForm.password}
                              onChange={(e) => setEditForm({ ...editForm, password: e.target.value })}
                            />
                          </div>
                        ) : (
                          <p className="font-semibold text-slate-900">{admin.name}</p>
                        )}
                        <p className="text-xs text-slate-500">@{admin.username}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    {editingId === admin.id && isSuperAdmin ? (
                      <select
                        className={`${SELECT_CLASS} w-auto px-2.5 py-1.5`}
                        value={editForm.role}
                        onChange={(e) =>
                          setEditForm({ ...editForm, role: e.target.value as "admin" | "super_admin" })
                        }
                      >
                        <option value="admin">Admin</option>
                        <option value="super_admin">Super Admin</option>
                      </select>
                    ) : (
                      <Badge tone={admin.role === "super_admin" ? "blue" : "zinc"}>
                        {admin.role === "super_admin" ? "Super Admin" : "Admin"}
                      </Badge>
                    )}
                  </td>
                  {showAksiColumn && (
                    <td className="px-5 py-3">
                      {canEditRow(admin) ? (
                        <div className="flex flex-col gap-1.5">
                          <div className="flex items-center gap-3">
                            {editingId === admin.id ? (
                              <>
                                <button
                                  type="button"
                                  disabled={loading}
                                  onClick={() => handleSaveEdit(admin)}
                                  className="flex items-center gap-1 text-xs font-semibold text-emerald-600 hover:underline"
                                >
                                  <Check size={13} />
                                  Simpan
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setEditingId(null)}
                                  className="flex items-center gap-1 text-xs font-semibold text-slate-500 hover:underline"
                                >
                                  <X size={13} />
                                  Batal
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  type="button"
                                  onClick={() => startEdit(admin)}
                                  className="flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:underline"
                                >
                                  <Pencil size={13} />
                                  Edit
                                </button>
                                {isSuperAdmin && (
                                  <button
                                    type="button"
                                    disabled={admin.id === currentAdminId}
                                    onClick={() => handleDelete(admin)}
                                    className="flex items-center gap-1 text-xs font-semibold text-rose-600 hover:underline disabled:opacity-40"
                                  >
                                    <Trash2 size={13} />
                                    Hapus
                                  </button>
                                )}
                              </>
                            )}
                          </div>
                          {editingId === admin.id && editError && (
                            <p className="text-xs text-rose-600">{editError}</p>
                          )}
                        </div>
                      ) : null}
                    </td>
                  )}
                </tr>
              ))}
              {admins.length === 0 && (
                <tr>
                  <td
                    colSpan={showAksiColumn ? 3 : 2}
                    className="px-5 py-8 text-center text-sm text-slate-400"
                  >
                    Belum ada admin.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </Card>
      </div>

      <div className="flex flex-col gap-3 lg:hidden">
        {admins.map((admin) => (
          <Card key={admin.id} className="flex flex-col gap-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <Avatar name={admin.name} size="sm" />
                <div>
                  {editingId === admin.id ? (
                    <div className="space-y-1.5">
                      {isSuperAdmin ? (
                        <Input
                          className="max-w-[160px]"
                          value={editForm.name}
                          onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                        />
                      ) : (
                        <p className="font-semibold text-slate-900">{admin.name}</p>
                      )}
                      <PasswordInput
                        className="max-w-[160px]"
                        placeholder="Password baru"
                        autoComplete="new-password"
                        value={editForm.password}
                        onChange={(e) => setEditForm({ ...editForm, password: e.target.value })}
                      />
                    </div>
                  ) : (
                    <p className="font-semibold text-slate-900">{admin.name}</p>
                  )}
                  <p className="text-xs text-slate-500">@{admin.username}</p>
                </div>
              </div>
              {editingId === admin.id && isSuperAdmin ? (
                <select
                  className={`${SELECT_CLASS} w-auto px-2.5 py-1.5`}
                  value={editForm.role}
                  onChange={(e) =>
                    setEditForm({ ...editForm, role: e.target.value as "admin" | "super_admin" })
                  }
                >
                  <option value="admin">Admin</option>
                  <option value="super_admin">Super Admin</option>
                </select>
              ) : (
                <Badge tone={admin.role === "super_admin" ? "blue" : "zinc"}>
                  {admin.role === "super_admin" ? "Super Admin" : "Admin"}
                </Badge>
              )}
            </div>
            {canEditRow(admin) && (
              <div className="flex flex-col gap-1.5 border-t border-slate-100 pt-3">
                <div className="flex items-center gap-4">
                  {editingId === admin.id ? (
                    <>
                      <button
                        type="button"
                        disabled={loading}
                        onClick={() => handleSaveEdit(admin)}
                        className="flex items-center gap-1 text-xs font-semibold text-emerald-600"
                      >
                        <Check size={13} />
                        Simpan
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        className="flex items-center gap-1 text-xs font-semibold text-slate-500"
                      >
                        <X size={13} />
                        Batal
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => startEdit(admin)}
                        className="flex items-center gap-1 text-xs font-semibold text-indigo-600"
                      >
                        <Pencil size={13} />
                        Edit
                      </button>
                      {isSuperAdmin && (
                        <button
                          type="button"
                          disabled={admin.id === currentAdminId}
                          onClick={() => handleDelete(admin)}
                          className="flex items-center gap-1 text-xs font-semibold text-rose-600 disabled:opacity-40"
                        >
                          <Trash2 size={13} />
                          Hapus
                        </button>
                      )}
                    </>
                  )}
                </div>
                {editingId === admin.id && editError && (
                  <p className="text-xs text-rose-600">{editError}</p>
                )}
              </div>
            )}
          </Card>
        ))}
        {admins.length === 0 && (
          <Card className="py-8 text-center text-sm text-slate-400">Belum ada admin.</Card>
        )}
      </div>
    </div>
  );
}
