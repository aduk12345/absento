"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarOff, Inbox, Plus } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";

type LeaveRequest = {
  id: string;
  startDate: string;
  endDate: string;
  totalDays: number;
  reason: string;
  status: "pending" | "approved" | "rejected";
  reviewNote: string | null;
  createdAt: string;
};

function statusBadge(status: LeaveRequest["status"]) {
  if (status === "approved") return <Badge tone="green">Disetujui</Badge>;
  if (status === "rejected") return <Badge tone="red">Ditolak</Badge>;
  return <Badge tone="orange">Menunggu</Badge>;
}

function formatDate(value: string): string {
  return new Date(`${value}T00:00:00`).toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function calculateDays(startDate: string, endDate: string): number {
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  return Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
}

export function LeaveList() {
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ startDate: "", endDate: "", reason: "" });
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function loadRequests() {
    setLoading(true);
    fetch("/api/leaves/mine")
      .then((res) => res.json())
      .then((data) => setRequests(data.requests ?? []))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch sekali saat mount, bukan sync-dari-props
    loadRequests();
  }, []);

  const totalDays = useMemo(() => {
    if (!form.startDate || !form.endDate || form.endDate < form.startDate) return null;
    return calculateDays(form.startDate, form.endDate);
  }, [form.startDate, form.endDate]);

  function openModal() {
    setForm({ startDate: "", endDate: "", reason: "" });
    setSubmitError(null);
    setShowModal(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);

    if (!form.startDate || !form.endDate) {
      setSubmitError("Tanggal mulai dan tanggal akhir wajib diisi");
      return;
    }
    if (form.endDate < form.startDate) {
      setSubmitError("Tanggal akhir harus setelah atau sama dengan tanggal mulai");
      return;
    }
    if (!form.reason.trim()) {
      setSubmitError("Alasan wajib diisi");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/leaves/mine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        setSubmitError(data.error ?? "Gagal mengajukan izin");
        return;
      }
      setShowModal(false);
      loadRequests();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Button type="button" onClick={openModal}>
          <Plus size={16} />
          Ajukan Izin
        </Button>
      </div>

      {loading && (
        <div className="flex flex-col gap-3">
          {[0, 1].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl border border-slate-200 bg-white" />
          ))}
        </div>
      )}

      {!loading && requests.length === 0 && (
        <Card className="flex flex-col items-center gap-3 py-10 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-50 text-slate-300">
            <Inbox size={22} strokeWidth={2} />
          </span>
          <p className="text-sm text-slate-400">Belum ada pengajuan izin.</p>
        </Card>
      )}

      {!loading && requests.length > 0 && (
        <div className="flex flex-col gap-3">
          {requests.map((r) => (
            <Card key={r.id} className="flex flex-col gap-2">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-bold text-slate-900">
                    {formatDate(r.startDate)}
                    {r.startDate !== r.endDate && <> &ndash; {formatDate(r.endDate)}</>}
                  </p>
                  <p className="text-xs text-slate-400">{r.totalDays} hari</p>
                </div>
                {statusBadge(r.status)}
              </div>
              <p className="text-xs text-slate-500">
                Alasan: <span className="text-slate-700">{r.reason}</span>
              </p>
              {r.status === "rejected" && r.reviewNote && (
                <p className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">
                  Catatan admin: {r.reviewNote}
                </p>
              )}
            </Card>
          ))}
        </div>
      )}

      {showModal && (
        <Modal title="Ajukan Izin" onClose={() => setShowModal(false)}>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600">
                  Tanggal Mulai
                </label>
                <Input
                  type="date"
                  value={form.startDate}
                  onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600">
                  Tanggal Akhir
                </label>
                <Input
                  type="date"
                  value={form.endDate}
                  min={form.startDate || undefined}
                  onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                  required
                />
              </div>
            </div>

            {totalDays != null && (
              <p className="flex items-center gap-1.5 rounded-xl bg-indigo-50 px-3 py-2 text-sm font-semibold text-indigo-700">
                <CalendarOff size={15} />
                Total: {totalDays} hari
              </p>
            )}

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">
                Alasan (wajib)
              </label>
              <Input
                type="text"
                placeholder="Mis. keperluan keluarga"
                value={form.reason}
                onChange={(e) => setForm({ ...form, reason: e.target.value })}
                required
              />
            </div>

            {submitError && (
              <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{submitError}</p>
            )}

            <Button type="submit" disabled={submitting}>
              {submitting ? "Mengirim..." : "Ajukan"}
            </Button>
          </form>
        </Modal>
      )}
    </div>
  );
}
