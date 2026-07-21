"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import {
  Download,
  Users,
  CalendarCheck2,
  CalendarOff,
  UserX,
  MapPin,
  Image as ImageIcon,
  ExternalLink,
  X,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";
import { Input } from "@/components/ui/Input";
import { StatCard } from "@/components/ui/StatCard";
import { Modal } from "@/components/ui/Modal";

// Leaflet butuh `window` — matikan SSR supaya tidak crash saat render di server.
const LocationMap = dynamic(() => import("./LocationMap").then((m) => m.LocationMap), {
  ssr: false,
});

type DailyStatus = "hadir" | "izin" | "alpha";

type DailyEmployee = {
  id: string;
  name: string;
  status: DailyStatus;
  checkinTime: string | null;
  checkinLocation: { lat: number; lng: number } | null;
  checkinPhotoUrl: string | null;
  checkoutTime: string | null;
  checkoutLocation: { lat: number; lng: number } | null;
  checkoutPhotoUrl: string | null;
  reason: string | null;
};

function mapsLink(loc: { lat: number; lng: number } | null): string | null {
  if (!loc) return null;
  return `https://www.google.com/maps?q=${loc.lat},${loc.lng}`;
}

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
  const [zoomPhoto, setZoomPhoto] = useState<string | null>(null);
  const [mapModal, setMapModal] = useState<{ lat: number; lng: number; label: string } | null>(null);

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
                  <th className="px-5 py-3">Lokasi</th>
                  <th className="px-5 py-3">Foto</th>
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
                    <td className="px-5 py-3">
                      <div className="flex gap-3">
                        {emp.checkinLocation && (
                          <button
                            type="button"
                            onClick={() =>
                              setMapModal({ ...emp.checkinLocation!, label: `Lokasi Check-in — ${emp.name}` })
                            }
                            className="flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:underline"
                          >
                            <MapPin size={12} /> In
                          </button>
                        )}
                        {emp.checkoutLocation && (
                          <button
                            type="button"
                            onClick={() =>
                              setMapModal({ ...emp.checkoutLocation!, label: `Lokasi Checkout — ${emp.name}` })
                            }
                            className="flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:underline"
                          >
                            <MapPin size={12} /> Out
                          </button>
                        )}
                        {!emp.checkinLocation && !emp.checkoutLocation && (
                          <span className="text-slate-300">-</span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex gap-3">
                        {emp.checkinPhotoUrl && (
                          <button
                            type="button"
                            onClick={() => setZoomPhoto(emp.checkinPhotoUrl)}
                            className="flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:underline"
                          >
                            <ImageIcon size={12} /> In
                          </button>
                        )}
                        {emp.checkoutPhotoUrl && (
                          <button
                            type="button"
                            onClick={() => setZoomPhoto(emp.checkoutPhotoUrl)}
                            className="flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:underline"
                          >
                            <ImageIcon size={12} /> Out
                          </button>
                        )}
                        {!emp.checkinPhotoUrl && !emp.checkoutPhotoUrl && (
                          <span className="text-slate-300">-</span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-3 text-slate-500">{emp.reason ?? "-"}</td>
                  </tr>
                ))}
                {data.employees.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-5 py-8 text-center text-sm text-slate-400">
                      Belum ada karyawan aktif.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </Card>
        </>
      )}

      {mapModal && (
        <Modal title={mapModal.label} onClose={() => setMapModal(null)}>
          <div className="flex flex-col gap-3">
            <div className="overflow-hidden rounded-xl ring-1 ring-slate-200">
              <LocationMap lat={mapModal.lat} lng={mapModal.lng} className="h-64 w-full" />
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
