"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AtSign, KeyRound, LogOut, Mail, Pencil, Phone, type LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { Avatar } from "@/components/ui/Avatar";
import { Modal } from "@/components/ui/Modal";

export type EmployeeProfile = {
  name: string;
  username: string;
  email: string;
  phone: string;
  photoUrl: string | null;
};

export function ProfileForm({ employee }: { employee: EmployeeProfile }) {
  const router = useRouter();

  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);

  const [showEditModal, setShowEditModal] = useState(false);
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [editError, setEditError] = useState<string | null>(null);
  const [editSaving, setEditSaving] = useState(false);

  function closePasswordModal() {
    setShowPasswordModal(false);
    setOldPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setError(null);
    setSuccess(null);
  }

  function openEditModal() {
    setUsername(employee.username === "-" ? "" : employee.username);
    setEmail(employee.email === "-" ? "" : employee.email);
    setPhone(employee.phone === "-" ? "" : employee.phone);
    setEditError(null);
    setShowEditModal(true);
  }

  function closeEditModal() {
    setShowEditModal(false);
    setEditError(null);
  }

  async function handleEditProfile(e: React.FormEvent) {
    e.preventDefault();
    setEditError(null);

    setEditSaving(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, email, phone }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setEditError(data.error ?? "Gagal menyimpan profil");
        return;
      }
      setShowEditModal(false);
      router.refresh();
    } finally {
      setEditSaving(false);
    }
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (newPassword !== confirmPassword) {
      setError("Konfirmasi password baru tidak cocok");
      return;
    }
    if (newPassword.length < 6) {
      setError("Password baru minimal 6 karakter");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ oldPassword, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Gagal mengganti password");
        return;
      }
      setSuccess("Password berhasil diganti");
      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } finally {
      setSaving(false);
    }
  }

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/login");
      router.refresh();
    } finally {
      setLoggingOut(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_-12px_rgba(15,23,42,0.12)]">
        <div className="h-16 bg-gradient-to-r from-indigo-500 to-violet-600" />
        <div className="-mt-8 flex flex-col items-center px-5 pb-5">
          <Avatar name={employee.name} photoUrl={employee.photoUrl} size="lg" />
          <p className="mt-3 text-base font-bold text-slate-900">{employee.name}</p>
        </div>
      </div>

      <Card>
        <div className="flex flex-col divide-y divide-slate-100">
          <ProfileField icon={AtSign} label="Username" value={employee.username} />
          <ProfileField icon={Mail} label="Email" value={employee.email} />
          <ProfileField icon={Phone} label="Telepon" value={employee.phone} />
        </div>

        <div className="mt-5 flex flex-col gap-2 sm:flex-row">
          <Button type="button" variant="secondary" onClick={openEditModal}>
            <Pencil size={16} />
            Edit Profil
          </Button>
          <Button type="button" variant="secondary" onClick={() => setShowPasswordModal(true)}>
            <KeyRound size={16} />
            Ubah Password
          </Button>
        </div>
      </Card>

      <Button type="button" variant="danger" onClick={handleLogout} disabled={loggingOut}>
        <LogOut size={16} />
        {loggingOut ? "Logout..." : "Logout"}
      </Button>

      {showEditModal && (
        <Modal title="Edit Profil" onClose={closeEditModal}>
          <form onSubmit={handleEditProfile} className="flex flex-col gap-3">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-600">
                Username
              </label>
              <Input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-600">Email</label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-600">
                No. Telepon
              </label>
              <Input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>

            {editError && (
              <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{editError}</p>
            )}

            <Button type="submit" disabled={editSaving} className="mt-1">
              {editSaving ? "Menyimpan..." : "Simpan Profil"}
            </Button>
          </form>
        </Modal>
      )}

      {showPasswordModal && (
        <Modal title="Ubah Password" onClose={closePasswordModal}>
          <form onSubmit={handleChangePassword} className="flex flex-col gap-3">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-600">
                Password Lama
              </label>
              <PasswordInput
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-600">
                Password Baru
              </label>
              <PasswordInput
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-600">
                Konfirmasi Password Baru
              </label>
              <PasswordInput
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </div>

            {error && (
              <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
            )}
            {success && (
              <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                {success}
              </p>
            )}

            <Button type="submit" disabled={saving} className="mt-1">
              {saving ? "Menyimpan..." : "Simpan Password"}
            </Button>
          </form>
        </Modal>
      )}
    </div>
  );
}

function ProfileField({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-500">
        <Icon size={16} />
      </span>
      <div className="flex min-w-0 flex-col">
        <span className="text-xs font-medium text-slate-400">{label}</span>
        <span className="truncate text-sm font-semibold text-slate-800">{value}</span>
      </div>
    </div>
  );
}
