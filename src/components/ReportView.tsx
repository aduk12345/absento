"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import {
  CalendarRange,
  CalendarOff,
  Download,
  MapPin,
  Image as ImageIcon,
  Users,
  ExternalLink,
  X,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import { StatCard } from "@/components/ui/StatCard";
import { Modal } from "@/components/ui/Modal";

// Leaflet butuh `window` — matikan SSR supaya tidak crash saat render di server.
const LocationMap = dynamic(() => import("./LocationMap").then((m) => m.LocationMap), {
  ssr: false,
});

export type ReportEmployee = {
  id: string;
  name: string;
};

type ReportRecord = {
  id: string;
  checkinTime: string;
  checkinLocation: { lat: number; lng: number } | null;
  checkinPhotoUrl: string | null;
  checkoutTime: string | null;
  checkoutLocation: { lat: number; lng: number } | null;
  checkoutPhotoUrl: string | null;
  durationMinutes: number | null;
  status: "complete" | "incomplete";
};

type ReportLeave = {
  id: string;
  startDate: string;
  endDate: string;
  reason: string;
};

type ReportData = {
  employee: { id: string; name: string };
  records: ReportRecord[];
  leaves: ReportLeave[];
  summary: { totalHadir: number; totalWorkMinutes: number; totalIzin: number };
};

type MergedRow =
  | { type: "absence"; date: string; record: ReportRecord }
  | { type: "leave"; date: string; reason: string };

// Setiap leave request beririsan rentang query di-expand jadi baris per-hari (dipotong ke
// batas rentang query) supaya tampil sejajar dengan record absen di tabel yang sama.
function buildMergedRows(data: ReportData, queryStart: string, queryEnd: string): MergedRow[] {
  const absenceRows: MergedRow[] = data.records.map((r) => ({
    type: "absence",
    date: r.checkinTime.slice(0, 10),
    record: r,
  }));

  const leaveRows: MergedRow[] = [];
  for (const leave of data.leaves) {
    const start = leave.startDate > queryStart ? leave.startDate : queryStart;
    const end = leave.endDate < queryEnd ? leave.endDate : queryEnd;
    if (start > end) continue;
    const cursor = new Date(`${start}T00:00:00.000Z`);
    const endDateObj = new Date(`${end}T00:00:00.000Z`);
    while (cursor <= endDateObj) {
      leaveRows.push({
        type: "leave",
        date: cursor.toISOString().slice(0, 10),
        reason: leave.reason,
      });
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
  }

  return [...absenceRows, ...leaveRows].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}

const MAX_RANGE_DAYS = 31;
const SELECT_CLASS =
  "w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 outline-none transition-colors focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-100";

function todayISODate(): string {
  return new Date().toISOString().slice(0, 10);
}

function firstOfMonthISODate(): string {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
}

function formatDuration(minutes: number | null): string {
  if (minutes == null) return "-";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}j ${m}m`;
}

function formatTime(iso: string | null): string {
  if (!iso) return "-";
  return new Date(iso).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function mapsLink(loc: { lat: number; lng: number } | null): string | null {
  if (!loc) return null;
  return `https://www.google.com/maps?q=${loc.lat},${loc.lng}`;
}

export function ReportView({ employees }: { employees: ReportEmployee[] }) {
  const [employeeId, setEmployeeId] = useState(employees[0]?.id ?? "");
  const [startDate, setStartDate] = useState(firstOfMonthISODate());
  const [endDate, setEndDate] = useState(todayISODate());
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [zoomPhoto, setZoomPhoto] = useState<string | null>(null);
  const [mapModal, setMapModal] = useState<{ lat: number; lng: number; label: string } | null>(null);

  const rangeDays = useMemo(() => {
    const start = new Date(`${startDate}T00:00:00`);
    const end = new Date(`${endDate}T00:00:00`);
    return Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  }, [startDate, endDate]);

  const rangeInvalid = rangeDays > MAX_RANGE_DAYS || rangeDays < 1;

  const mergedRows = useMemo(
    () => (data ? buildMergedRows(data, startDate, endDate) : []),
    [data, startDate, endDate]
  );

  async function handleShow() {
    setError(null);

    if (!employeeId) {
      setError("Pilih karyawan terlebih dahulu");
      return;
    }
    if (rangeInvalid) {
      setError(
        rangeDays < 1
          ? "Tanggal akhir harus setelah tanggal awal"
          : `Rentang tanggal maksimal ${MAX_RANGE_DAYS} hari`
      );
      return;
    }

    setLoading(true);
    try {
      const params = new URLSearchParams({ employeeId, startDate, endDate });
      const res = await fetch(`/api/report?${params.toString()}`);
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
    if (!employeeId || rangeInvalid) return;
    setExporting(true);
    setError(null);
    try {
      const params = new URLSearchParams({ employeeId, startDate, endDate });
      const res = await fetch(`/api/report/export?${params.toString()}`);
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        setError(json.error ?? "Gagal export Excel");
        return;
      }
      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition") ?? "";
      const match = disposition.match(/filename="(.+)"/);
      const filename = match?.[1] ?? "report.xlsx";

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end">
          <div className="min-w-[180px] flex-1">
            <label className="mb-1.5 block text-xs font-semibold text-slate-600">Karyawan</label>
            <select
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
              className={SELECT_CLASS}
            >
              {employees.length === 0 && <option value="">Belum ada karyawan</option>}
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.name}
                </option>
              ))}
            </select>
          </div>

          <div className="min-w-[150px]">
            <label className="mb-1.5 block text-xs font-semibold text-slate-600">
              Tanggal Mulai
            </label>
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>

          <div className="min-w-[150px]">
            <label className="mb-1.5 block text-xs font-semibold text-slate-600">
              Tanggal Akhir
            </label>
            <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>

          <Button type="button" onClick={handleShow} disabled={loading}>
            <CalendarRange size={16} />
            {loading ? "Memuat..." : "Tampilkan"}
          </Button>
        </div>

        {rangeInvalid && (
          <p className="mt-3 text-xs font-medium text-amber-600">
            Rentang tanggal maksimal {MAX_RANGE_DAYS} hari.
          </p>
        )}
        {error && (
          <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
        )}
      </Card>

      {data && (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatCard label="Karyawan" value={data.employee.name} icon={Users} tone="indigo" />
            <StatCard
              label="Total Hadir"
              value={`${data.summary.totalHadir} hari`}
              icon={CalendarRange}
              tone="emerald"
            />
            <StatCard
              label="Total Izin"
              value={`${data.summary.totalIzin} hari`}
              icon={CalendarOff}
              tone="rose"
            />
          </div>

          <div className="flex justify-end">
            <Button type="button" variant="secondary" onClick={handleExport} disabled={exporting}>
              <Download size={16} />
              {exporting ? "Menyiapkan..." : "Export Excel"}
            </Button>
          </div>

          <div className="hidden lg:block">
            <Card className="overflow-x-auto p-0">
              <table className="w-full min-w-[720px] text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
                    <th className="px-5 py-3">Tanggal</th>
                    <th className="px-5 py-3">Checkin</th>
                    <th className="px-5 py-3">Checkout</th>
                    <th className="px-5 py-3">Durasi</th>
                    <th className="px-5 py-3">Lokasi</th>
                    <th className="px-5 py-3">Foto</th>
                  </tr>
                </thead>
                <tbody>
                  {mergedRows.map((row) => {
                    if (row.type === "leave") {
                      return (
                        <tr key={`leave-${row.date}`} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60">
                          <td className="px-5 py-3 font-medium text-slate-900">
                            {formatDate(`${row.date}T00:00:00`)}
                          </td>
                          <td className="px-5 py-3" colSpan={2}>
                            <Badge tone="orange">Izin</Badge>
                          </td>
                          <td className="px-5 py-3 text-slate-500" colSpan={3}>
                            {row.reason}
                          </td>
                        </tr>
                      );
                    }

                    const r = row.record;
                    const checkinMapsLink = mapsLink(r.checkinLocation);
                    const checkoutMapsLink = mapsLink(r.checkoutLocation);
                    return (
                      <tr key={r.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60">
                        <td className="px-5 py-3 font-medium text-slate-900">{formatDate(r.checkinTime)}</td>
                        <td className="px-5 py-3 text-slate-600">{formatTime(r.checkinTime)}</td>
                        <td className="px-5 py-3 text-slate-600">
                          {r.status === "incomplete" ? (
                            <Badge tone="orange">Tidak Lengkap</Badge>
                          ) : r.checkoutTime ? (
                            formatTime(r.checkoutTime)
                          ) : (
                            <Badge tone="orange">Belum checkout</Badge>
                          )}
                        </td>
                        <td className="px-5 py-3 text-slate-600">{formatDuration(r.durationMinutes)}</td>
                        <td className="px-5 py-3">
                          <div className="flex gap-3">
                            {r.checkinLocation && (
                              <button
                                type="button"
                                onClick={() =>
                                  setMapModal({ ...r.checkinLocation!, label: "Lokasi Check-in" })
                                }
                                className="flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:underline"
                              >
                                <MapPin size={12} /> In
                              </button>
                            )}
                            {r.checkoutLocation && (
                              <button
                                type="button"
                                onClick={() =>
                                  setMapModal({ ...r.checkoutLocation!, label: "Lokasi Checkout" })
                                }
                                className="flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:underline"
                              >
                                <MapPin size={12} /> Out
                              </button>
                            )}
                            {!checkinMapsLink && !checkoutMapsLink && (
                              <span className="text-slate-300">-</span>
                            )}
                          </div>
                        </td>
                        <td className="px-5 py-3">
                          <div className="flex gap-3">
                            {r.checkinPhotoUrl && (
                              <button
                                type="button"
                                onClick={() => setZoomPhoto(r.checkinPhotoUrl)}
                                className="flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:underline"
                              >
                                <ImageIcon size={12} /> In
                              </button>
                            )}
                            {r.checkoutPhotoUrl && (
                              <button
                                type="button"
                                onClick={() => setZoomPhoto(r.checkoutPhotoUrl)}
                                className="flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:underline"
                              >
                                <ImageIcon size={12} /> Out
                              </button>
                            )}
                            {!r.checkinPhotoUrl && !r.checkoutPhotoUrl && (
                              <span className="text-slate-300">-</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {mergedRows.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-5 py-8 text-center text-sm text-slate-400">
                        Tidak ada data absen pada rentang tanggal ini.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </Card>
          </div>

          <div className="flex flex-col gap-3 lg:hidden">
            {mergedRows.map((row) => {
              if (row.type === "leave") {
                return (
                  <Card key={`leave-${row.date}`} className="flex flex-col gap-3">
                    <div className="flex items-start justify-between gap-3">
                      <p className="font-semibold text-slate-900">{formatDate(`${row.date}T00:00:00`)}</p>
                      <Badge tone="orange">Izin</Badge>
                    </div>
                    <p className="text-xs text-slate-500">
                      Alasan: <span className="text-slate-700">{row.reason}</span>
                    </p>
                  </Card>
                );
              }

              const r = row.record;
              return (
                <Card key={r.id} className="flex flex-col gap-3">
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-semibold text-slate-900">{formatDate(r.checkinTime)}</p>
                    {r.status === "incomplete" ? (
                      <Badge tone="orange">Tidak Lengkap</Badge>
                    ) : r.checkoutTime ? (
                      <Badge tone="green">Selesai</Badge>
                    ) : (
                      <Badge tone="orange">Belum checkout</Badge>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-3 rounded-xl bg-slate-50 px-3 py-2.5 text-xs">
                    <div>
                      <p className="text-slate-400">Checkin</p>
                      <p className="mt-0.5 font-medium text-slate-700">{formatTime(r.checkinTime)}</p>
                    </div>
                    <div>
                      <p className="text-slate-400">Checkout</p>
                      <p className="mt-0.5 font-medium text-slate-700">{formatTime(r.checkoutTime)}</p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-slate-400">Durasi</p>
                      <p className="mt-0.5 font-medium text-slate-700">{formatDuration(r.durationMinutes)}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-4 border-t border-slate-100 pt-3">
                    {r.checkinLocation && (
                      <button
                        type="button"
                        onClick={() => setMapModal({ ...r.checkinLocation!, label: "Lokasi Check-in" })}
                        className="flex items-center gap-1 text-xs font-semibold text-indigo-600"
                      >
                        <MapPin size={12} /> Lokasi In
                      </button>
                    )}
                    {r.checkoutLocation && (
                      <button
                        type="button"
                        onClick={() => setMapModal({ ...r.checkoutLocation!, label: "Lokasi Checkout" })}
                        className="flex items-center gap-1 text-xs font-semibold text-indigo-600"
                      >
                        <MapPin size={12} /> Lokasi Out
                      </button>
                    )}
                    {r.checkinPhotoUrl && (
                      <button
                        type="button"
                        onClick={() => setZoomPhoto(r.checkinPhotoUrl)}
                        className="flex items-center gap-1 text-xs font-semibold text-indigo-600"
                      >
                        <ImageIcon size={12} /> Foto In
                      </button>
                    )}
                    {r.checkoutPhotoUrl && (
                      <button
                        type="button"
                        onClick={() => setZoomPhoto(r.checkoutPhotoUrl)}
                        className="flex items-center gap-1 text-xs font-semibold text-indigo-600"
                      >
                        <ImageIcon size={12} /> Foto Out
                      </button>
                    )}
                  </div>
                </Card>
              );
            })}
            {mergedRows.length === 0 && (
              <Card className="py-8 text-center text-sm text-slate-400">
                Tidak ada data absen pada rentang tanggal ini.
              </Card>
            )}
          </div>
        </>
      )}

      {mapModal && (
        <Modal title={mapModal.label} onClose={() => setMapModal(null)}>
          <div className="flex flex-col gap-3">
            <div className="overflow-hidden rounded-xl ring-1 ring-slate-200">
              <LocationMap
                lat={mapModal.lat}
                lng={mapModal.lng}
                avatarName={data?.employee.name}
                className="h-64 w-full"
              />
            </div>
            <a
              href={mapsLink({ lat: mapModal.lat, lng: mapModal.lng })!}
              target="_blank"
              rel="noreferrer"
              className="flex w-fit items-center gap-1 text-xs font-medium text-indigo-600 hover:underline"
            >
              <ExternalLink size={12} /> Buka di Google Maps
            </a>
          </div>
        </Modal>
      )}

      {zoomPhoto && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/80 p-6"
          onClick={() => setZoomPhoto(null)}
        >
          <button
            type="button"
            onClick={() => setZoomPhoto(null)}
            className="absolute right-5 top-5 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
          >
            <X size={22} />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={zoomPhoto}
            alt="Foto absen"
            className="max-h-full max-w-full rounded-xl object-contain"
          />
        </div>
      )}
    </div>
  );
}
