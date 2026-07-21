"use client";

import { useState } from "react";
import { Download, Users, CalendarCheck2, CalendarOff, UserX } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";
import { Input } from "@/components/ui/Input";
import { StatCard } from "@/components/ui/StatCard";

type DailyStatus = "hadir" | "izin" | "alpha";

type DailyEmployee = {
  id: string;
  name: string;
  status: DailyStatus;
  checkinTime: string | null;
  checkoutTime: string | null;
  reason: string | null;
};

type DailyData = {
  date: string;
  employees: DailyEmployee[];
};

function todayISODate(): string {
  return new Date().toISOString().slice(0, 10);
}

function formatTime(iso: string | null): string {
  if (!iso) return "-";
  return new Date(iso).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
}

function statusBadge(status: DailyStatus) {
  if (status === "hadir") return <Badge tone="green">Hadir</Badge>;
  if (status === "izin") return <Badge tone="orange">Izin</Badge>;
  return <Badge tone="red">Alpha</Badge>;
}

export function DailyReportView() {
  const [date, setDate] = useState(todayISODate());
  const [data, setData] = useState<DailyData | null>(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleShow() {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/report/daily?date=${date}`);
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Gagal memuat report");
        setData(null);
        return;
      }
      setData(json);
    } finally {
      setLoading(false);
    }
  }

  async function handleExport() {
    setExporting(true);
    setError(null);
    try {
      const res = await fetch(`/api/report/daily/export?date=${date}`);
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        setError(json.error ?? "Gagal export Excel");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `report-harian-${date}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  }

  const totalHadir = data?.employees.filter((e) => e.status === "hadir").length ?? 0;
  const totalIzin = data?.employees.filter((e) => e.status === "izin").length ?? 0;
  const totalAlpha = data?.employees.filter((e) => e.status === "alpha").length ?? 0;

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end">
          <div className="min-w-[150px]">
            <label className="mb-1.5 block text-xs font-semibold text-slate-600">Tanggal</label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <Button type="button" onClick={handleShow} disabled={loading}>
            <Users size={16} />
            {loading ? "Memuat..." : "Tampilkan"}
          </Button>
        </div>
        {error && (
          <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
        )}
      </Card>

      {data && (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatCard label="Hadir" value={totalHadir} icon={CalendarCheck2} tone="emerald" />
            <StatCard label="Izin" value={totalIzin} icon={CalendarOff} tone="rose" />
            <StatCard label="Alpha" value={totalAlpha} icon={UserX} tone="amber" />
          </div>

          <div className="flex justify-end">
            <Button type="button" variant="secondary" onClick={handleExport} disabled={exporting}>
              <Download size={16} />
              {exporting ? "Menyiapkan..." : "Export Excel"}
            </Button>
          </div>

          <Card className="overflow-x-auto p-0">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
                  <th className="px-5 py-3">Karyawan</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Checkin</th>
                  <th className="px-5 py-3">Checkout</th>
                  <th className="px-5 py-3">Keterangan</th>
                </tr>
              </thead>
              <tbody>
                {data.employees.map((emp) => (
                  <tr key={emp.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar name={emp.name} size="sm" />
                        <span className="font-medium text-slate-900">{emp.name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3">{statusBadge(emp.status)}</td>
                    <td className="px-5 py-3 text-slate-600">{formatTime(emp.checkinTime)}</td>
                    <td className="px-5 py-3 text-slate-600">{formatTime(emp.checkoutTime)}</td>
                    <td className="px-5 py-3 text-slate-500">{emp.reason ?? "-"}</td>
                  </tr>
                ))}
                {data.employees.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-5 py-8 text-center text-sm text-slate-400">
                      Belum ada karyawan aktif.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </Card>
        </>
      )}
    </div>
  );
}
