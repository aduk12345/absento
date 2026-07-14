"use client";

import { useState } from "react";
import { RefreshCw, Trash2, AlertTriangle } from "lucide-react";
import { Card, PageHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

type Usage = {
  plan: string | null;
  credits: { usage: number | null; limit: number | null; usedPercent: number | null } | null;
  storageBytes: number | null;
  bandwidthBytes: number | null;
  objects: number | null;
  lastUpdated: string | null;
};

function formatBytes(bytes: number | null): string {
  if (bytes === null) return "-";
  const gb = bytes / 1024 ** 3;
  if (gb >= 1) return `${gb.toFixed(2)} GB`;
  const mb = bytes / 1024 ** 2;
  return `${mb.toFixed(1)} MB`;
}

function barTone(percent: number): string {
  if (percent >= 90) return "bg-rose-500";
  if (percent >= 70) return "bg-amber-500";
  return "bg-indigo-500";
}

function UsageBar({ label, percent, detail }: { label: string; percent: number; detail: string }) {
  const clamped = Math.min(100, Math.max(0, percent));
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between text-sm">
        <span className="font-medium text-slate-700">{label}</span>
        <span className="text-slate-500">{detail}</span>
      </div>
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          className={`h-full rounded-full transition-all ${barTone(clamped)}`}
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  );
}

const MONTHS = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

export function StorageUsagePanel({ initialUsage }: { initialUsage: Usage | null }) {
  const [usage, setUsage] = useState(initialUsage);
  const [loadingUsage, setLoadingUsage] = useState(false);

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 6 }, (_, i) => currentYear - i);

  const [mode, setMode] = useState<"month" | "year">("month");
  const [year, setYear] = useState(currentYear);
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [previewCount, setPreviewCount] = useState<number | null>(null);
  const [checking, setChecking] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultMessage, setResultMessage] = useState<string | null>(null);

  async function refreshUsage() {
    setLoadingUsage(true);
    try {
      const res = await fetch("/api/admin/storage-usage");
      if (res.ok) setUsage(await res.json());
    } finally {
      setLoadingUsage(false);
    }
  }

  function resetCleanupState() {
    setPreviewCount(null);
    setError(null);
    setResultMessage(null);
  }

  async function handleCheck() {
    resetCleanupState();
    setChecking(true);
    try {
      const res = await fetch("/api/admin/absences-cleanup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, year, month: mode === "month" ? month : undefined, dryRun: true }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Gagal mengecek jumlah data");
        return;
      }
      setPreviewCount(data.count);
    } finally {
      setChecking(false);
    }
  }

  async function handleDelete() {
    if (previewCount === null) return;
    const periodLabel = mode === "month" ? `${MONTHS[month - 1]} ${year}` : `tahun ${year}`;
    if (
      !confirm(
        `Hapus ${previewCount} data absensi (${periodLabel}) beserta foto-fotonya? Tindakan ini tidak bisa dibatalkan.`
      )
    ) {
      return;
    }
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/absences-cleanup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode, year, month: mode === "month" ? month : undefined, dryRun: false }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Gagal menghapus data");
        return;
      }
      setResultMessage(`Berhasil menghapus ${data.deletedCount} data absensi (${periodLabel}).`);
      setPreviewCount(null);
      refreshUsage();
    } finally {
      setDeleting(false);
    }
  }

  const usedPercent = usage?.credits?.usedPercent ?? null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Storage"
        description="Pantau pemakaian Cloudinary dan hapus data absensi lama untuk menjaga tetap di free tier."
        action={
          <Button type="button" variant="secondary" onClick={refreshUsage} disabled={loadingUsage}>
            <RefreshCw size={16} className={loadingUsage ? "animate-spin" : ""} />
            Refresh
          </Button>
        }
      />

      <Card>
        <h2 className="mb-4 text-sm font-bold text-slate-900">Pemakaian Cloudinary</h2>
        {!usage ? (
          <p className="text-sm text-slate-500">Data pemakaian tidak tersedia.</p>
        ) : (
          <div className="space-y-4">
            {usedPercent !== null && (
              <UsageBar
                label="Credit Plan (Free Tier)"
                percent={usedPercent}
                detail={`${usedPercent.toFixed(1)}% terpakai${
                  usage.credits?.limit ? ` dari ${usage.credits.limit} credits/bulan` : ""
                }`}
              />
            )}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="rounded-xl bg-slate-50 p-3">
                <p className="text-xs font-medium text-slate-500">Storage Terpakai</p>
                <p className="mt-1 text-base font-bold text-slate-900">{formatBytes(usage.storageBytes)}</p>
              </div>
              <div className="rounded-xl bg-slate-50 p-3">
                <p className="text-xs font-medium text-slate-500">Bandwidth Bulan Ini</p>
                <p className="mt-1 text-base font-bold text-slate-900">{formatBytes(usage.bandwidthBytes)}</p>
              </div>
              <div className="rounded-xl bg-slate-50 p-3">
                <p className="text-xs font-medium text-slate-500">Jumlah Foto</p>
                <p className="mt-1 text-base font-bold text-slate-900">{usage.objects ?? "-"}</p>
              </div>
            </div>
            {usage.lastUpdated && (
              <p className="text-xs text-slate-400">Terakhir diperbarui: {usage.lastUpdated}</p>
            )}
          </div>
        )}
      </Card>

      <Card>
        <h2 className="mb-1 text-sm font-bold text-slate-900">Hapus Data Absensi Lama</h2>
        <p className="mb-4 text-xs text-slate-500">
          Menghapus record absen beserta foto check-in/check-out di Cloudinary untuk periode yang dipilih.
          Hanya periode yang sudah lewat yang bisa dihapus.
        </p>

        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Mode</label>
            <select
              value={mode}
              onChange={(e) => {
                setMode(e.target.value as "month" | "year");
                resetCleanupState();
              }}
              className="rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 outline-none focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-100"
            >
              <option value="month">Per Bulan</option>
              <option value="year">Per Tahun</option>
            </select>
          </div>

          {mode === "month" && (
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Bulan</label>
              <select
                value={month}
                onChange={(e) => {
                  setMonth(Number(e.target.value));
                  resetCleanupState();
                }}
                className="rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 outline-none focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-100"
              >
                {MONTHS.map((m, i) => (
                  <option key={m} value={i + 1}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Tahun</label>
            <select
              value={year}
              onChange={(e) => {
                setYear(Number(e.target.value));
                resetCleanupState();
              }}
              className="rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 outline-none focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-100"
            >
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>

          <Button type="button" variant="secondary" onClick={handleCheck} disabled={checking}>
            {checking ? "Mengecek..." : "Cek Jumlah Data"}
          </Button>
        </div>

        {error && (
          <p className="mt-3 flex items-center gap-1.5 text-sm text-rose-600">
            <AlertTriangle size={14} /> {error}
          </p>
        )}

        {resultMessage && <p className="mt-3 text-sm text-emerald-600">{resultMessage}</p>}

        {previewCount !== null && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3.5">
            <p className="text-sm text-amber-800">
              Ditemukan <strong>{previewCount}</strong> data absensi pada periode ini.
            </p>
            <Button type="button" variant="danger" onClick={handleDelete} disabled={deleting || previewCount === 0}>
              <Trash2 size={16} />
              {deleting ? "Menghapus..." : "Hapus Data"}
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}
