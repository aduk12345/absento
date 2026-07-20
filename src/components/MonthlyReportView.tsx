"use client";

import { useState } from "react";
import { Download, CalendarRange, CalendarOff } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { StatCard } from "@/components/ui/StatCard";

type MonthlyEmployee = {
  id: string;
  name: string;
  totalHadir: number;
  totalIzin: number;
};

type MonthlyData = {
  month: string;
  employees: MonthlyEmployee[];
};

function currentYearMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export function MonthlyReportView() {
  const [month, setMonth] = useState(currentYearMonth());
  const [data, setData] = useState<MonthlyData | null>(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleShow() {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/report/monthly?month=${month}`);
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
      const res = await fetch(`/api/report/monthly/export?month=${month}`);
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        setError(json.error ?? "Gagal export Excel");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `report-bulanan-${month}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  }

  const totalHadir = data?.employees.reduce((s, e) => s + e.totalHadir, 0) ?? 0;
  const totalIzin = data?.employees.reduce((s, e) => s + e.totalIzin, 0) ?? 0;

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end">
          <div className="min-w-[150px]">
            <label className="mb-1.5 block text-xs font-semibold text-slate-600">Bulan</label>
            <input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 outline-none transition-colors focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-100"
            />
          </div>
          <Button type="button" onClick={handleShow} disabled={loading}>
            <CalendarRange size={16} />
            {loading ? "Memuat..." : "Tampilkan"}
          </Button>
        </div>
        {error && (
          <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
        )}
      </Card>

      {data && (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <StatCard label="Total Hadir" value={`${totalHadir} hari`} icon={CalendarRange} tone="emerald" />
            <StatCard label="Total Izin" value={`${totalIzin} hari`} icon={CalendarOff} tone="rose" />
          </div>

          <div className="flex justify-end">
            <Button type="button" variant="secondary" onClick={handleExport} disabled={exporting}>
              <Download size={16} />
              {exporting ? "Menyiapkan..." : "Export Excel"}
            </Button>
          </div>

          <Card className="overflow-x-auto p-0">
            <table className="w-full min-w-[480px] text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
                  <th className="px-5 py-3">Karyawan</th>
                  <th className="px-5 py-3">Total Hadir</th>
                  <th className="px-5 py-3">Total Izin</th>
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
                    <td className="px-5 py-3 text-slate-600">{emp.totalHadir} hari</td>
                    <td className="px-5 py-3 text-slate-600">{emp.totalIzin} hari</td>
                  </tr>
                ))}
                {data.employees.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-5 py-8 text-center text-sm text-slate-400">
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
