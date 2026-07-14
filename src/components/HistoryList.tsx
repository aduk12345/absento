"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { MapPin, ExternalLink, X, CalendarDays, Inbox, ImageOff } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";

// Leaflet butuh `window` — matikan SSR supaya tidak crash saat render di server.
const LocationMap = dynamic(() => import("./LocationMap").then((m) => m.LocationMap), {
  ssr: false,
});

type HistoryRecord = {
  id: string;
  checkinTime: string;
  checkinLocation: { lat: number; lng: number; accuracy?: number } | null;
  checkinPhotoUrl: string | null;
  checkoutTime: string | null;
  checkoutLocation: { lat: number; lng: number; accuracy?: number } | null;
  checkoutPhotoUrl: string | null;
  durationMinutes: number | null;
};

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
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function formatDayNum(iso: string): string {
  return String(new Date(iso).getDate()).padStart(2, "0");
}

function formatWeekdayShort(iso: string): string {
  return new Date(iso).toLocaleDateString("id-ID", { weekday: "short" });
}

function formatMonthShort(iso: string): string {
  return new Date(iso).toLocaleDateString("id-ID", { month: "short", year: "numeric" });
}

function mapsLink(loc: { lat: number; lng: number; accuracy?: number } | null): string | null {
  if (!loc) return null;
  return `https://www.google.com/maps?q=${loc.lat},${loc.lng}`;
}

function toDateInputValue(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

function monthOptions(): { value: string; label: string }[] {
  const now = new Date();
  const options: { value: string; label: string }[] = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = d.toLocaleDateString("id-ID", { month: "long", year: "numeric" });
    options.push({ value, label });
  }
  return options;
}

export function HistoryList({
  defaultMonth,
  avatarName,
  avatarPhotoUrl,
}: {
  defaultMonth: string;
  avatarName: string;
  avatarPhotoUrl?: string | null;
}) {
  const [filterMode, setFilterMode] = useState<"month" | "custom">("month");
  const [month, setMonth] = useState(defaultMonth);
  const today = new Date();
  const [startDate, setStartDate] = useState(() =>
    toDateInputValue(new Date(today.getFullYear(), today.getMonth(), 1))
  );
  const [endDate, setEndDate] = useState(() => toDateInputValue(today));
  const [records, setRecords] = useState<HistoryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<HistoryRecord | null>(null);
  const [zoomPhoto, setZoomPhoto] = useState<string | null>(null);

  const isCustomRangeValid =
    filterMode !== "custom" ||
    (startDate <= endDate &&
      (new Date(`${endDate}T00:00:00.000Z`).getTime() -
        new Date(`${startDate}T00:00:00.000Z`).getTime()) /
        (1000 * 60 * 60 * 24) <=
        31);

  useEffect(() => {
    if (!isCustomRangeValid) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- validasi rentang custom sebelum fetch, bukan sync-dari-props
      setLoading(false);
      setError("Rentang tanggal tidak valid (maksimal 31 hari, tanggal awal ≤ tanggal akhir).");
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    const query =
      filterMode === "custom"
        ? `startDate=${startDate}&endDate=${endDate}`
        : `month=${month}`;

    fetch(`/api/absences/mine?${query}`)
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Gagal memuat riwayat");
        if (!cancelled) setRecords(json.records);
      })
      .catch((e) => {
        if (!cancelled) setError((e as Error).message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- isCustomRangeValid derived dari startDate/endDate/filterMode, sudah tercakup
  }, [filterMode, month, startDate, endDate]);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden">
      <div className="flex shrink-0 flex-wrap items-center gap-3">
        <div className="flex shrink-0 rounded-2xl border border-slate-200 bg-white p-1 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_-12px_rgba(15,23,42,0.12)]">
          <button
            type="button"
            onClick={() => setFilterMode("month")}
            className={`rounded-xl px-3.5 py-1.5 text-xs font-semibold transition-colors ${
              filterMode === "month"
                ? "bg-indigo-600 text-white"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            Bulan
          </button>
          <button
            type="button"
            onClick={() => setFilterMode("custom")}
            className={`rounded-xl px-3.5 py-1.5 text-xs font-semibold transition-colors ${
              filterMode === "custom"
                ? "bg-indigo-600 text-white"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            Custom
          </button>
        </div>

        {filterMode === "month" ? (
          <div className="relative max-w-xs shrink-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_-12px_rgba(15,23,42,0.12)]">
            <CalendarDays
              size={16}
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-indigo-400"
            />
            <select
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="w-full appearance-none bg-transparent py-2.5 pl-10 pr-3.5 text-sm font-semibold text-slate-900 outline-none"
            >
              {monthOptions().map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={startDate}
              max={endDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="rounded-2xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-900 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_-12px_rgba(15,23,42,0.12)] outline-none"
            />
            <span className="text-sm text-slate-400">—</span>
            <input
              type="date"
              value={endDate}
              min={startDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="rounded-2xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-900 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_-12px_rgba(15,23,42,0.12)] outline-none"
            />
          </div>
        )}
      </div>

      {error && (
        <p className="shrink-0 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
      )}

      <div className="-mx-1 min-h-0 flex-1 overflow-y-auto px-1">
        {loading && (
          <div className="flex flex-col gap-3">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-28 animate-pulse rounded-3xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_-12px_rgba(15,23,42,0.12)]"
              />
            ))}
          </div>
        )}

        {!loading && records.length === 0 && !error && (
          <div className="flex flex-col items-center gap-3 rounded-3xl border border-slate-200 bg-white px-6 py-10 text-center shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_-12px_rgba(15,23,42,0.12)]">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-50 text-slate-300">
              <Inbox size={22} strokeWidth={2} />
            </span>
            <p className="text-sm text-slate-400">
              Belum ada data absen {filterMode === "month" ? "bulan ini" : "pada rentang ini"}.
            </p>
          </div>
        )}

        {!loading && (
          <div className="flex flex-col gap-3 pb-1">
            {records.map((r) => (
              <RecordCard
                key={r.id}
                record={r}
                onDetail={() => setSelected(r)}
                onZoom={setZoomPhoto}
              />
            ))}
          </div>
        )}
      </div>

      {selected && (
        <Modal title={formatDate(selected.checkinTime)} onClose={() => setSelected(null)}>
          <DetailContent
            record={selected}
            onZoom={setZoomPhoto}
            avatarName={avatarName}
            avatarPhotoUrl={avatarPhotoUrl}
          />
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

function RecordCard({
  record: r,
  onDetail,
  onZoom,
}: {
  record: HistoryRecord;
  onDetail: () => void;
  onZoom: (url: string) => void;
}) {
  const isDone = Boolean(r.checkoutTime);

  return (
    <div className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_-12px_rgba(15,23,42,0.12)] transition-shadow hover:shadow-lg">
      <div className="pointer-events-none absolute -right-8 -top-10 h-28 w-28 rounded-full bg-gradient-to-br from-indigo-400/10 to-violet-500/10 blur-2xl" />
      <div
        className={`absolute inset-y-0 left-0 w-1.5 ${
          isDone
            ? "bg-gradient-to-b from-indigo-500 to-violet-500"
            : "bg-gradient-to-b from-amber-400 to-orange-500"
        }`}
      />

      <div className="relative p-5 pl-6">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-50 to-violet-50 text-indigo-600 ring-1 ring-indigo-100">
              <span className="text-[10px] font-bold uppercase leading-none">
                {formatWeekdayShort(r.checkinTime)}
              </span>
              <span className="mt-0.5 text-base font-extrabold leading-none">
                {formatDayNum(r.checkinTime)}
              </span>
            </div>
            <div>
              <p className="text-sm font-bold text-slate-900">{formatMonthShort(r.checkinTime)}</p>
              <p className="text-xs text-slate-400">
                Durasi{" "}
                <span className="font-semibold text-slate-600">
                  {formatDuration(r.durationMinutes)}
                </span>
              </p>
            </div>
          </div>

          {isDone ? (
            <Badge tone="green">Selesai</Badge>
          ) : (
            <Badge tone="orange">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-amber-500" />
              </span>
              Belum checkout
            </Badge>
          )}
        </div>

        <div className="mt-4 flex items-center gap-3 rounded-2xl bg-slate-50 px-4 py-3 ring-1 ring-slate-100">
          <TimeStop time={formatTime(r.checkinTime)} label="Masuk" tone="indigo" />
          <div className={`h-px flex-1 ${isDone ? "bg-indigo-200" : "bg-slate-200"}`} />
          <TimeStop
            time={isDone ? formatTime(r.checkoutTime) : "—"}
            label="Keluar"
            tone={isDone ? "violet" : "pending"}
          />
        </div>

        <div className="mt-4 flex items-center justify-between gap-3">
          <div className="flex gap-2">
            <PhotoThumb url={r.checkinPhotoUrl} label="In" onZoom={onZoom} />
            <PhotoThumb url={r.checkoutPhotoUrl} label="Out" onZoom={onZoom} />
          </div>
          <button
            type="button"
            onClick={onDetail}
            className="flex items-center gap-1.5 rounded-full bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-600 transition-colors hover:bg-indigo-100"
          >
            <MapPin size={13} /> Detail & Lokasi
          </button>
        </div>
      </div>
    </div>
  );
}

function TimeStop({
  time,
  label,
  tone,
}: {
  time: string;
  label: string;
  tone: "indigo" | "violet" | "pending";
}) {
  const dotClass =
    tone === "indigo" ? "bg-indigo-500" : tone === "violet" ? "bg-violet-500" : "bg-slate-300";

  return (
    <div className="flex shrink-0 flex-col items-center gap-1 px-1">
      <span className={`h-2 w-2 rounded-full ${dotClass}`} />
      <span className="text-sm font-bold text-slate-800">{time}</span>
      <span className="text-[10px] font-medium uppercase tracking-wide text-slate-400">
        {label}
      </span>
    </div>
  );
}

function PhotoThumb({
  url,
  label,
  onZoom,
}: {
  url: string | null;
  label: string;
  onZoom: (url: string) => void;
}) {
  if (!url) {
    return (
      <div className="flex h-14 w-14 flex-col items-center justify-center gap-0.5 rounded-2xl bg-slate-100 text-slate-300">
        <ImageOff size={16} strokeWidth={2} />
        <span className="text-[8px] font-bold uppercase tracking-wide">{label}</span>
      </div>
    );
  }
  return (
    <button
      type="button"
      onClick={() => onZoom(url)}
      className="relative h-14 w-14 overflow-hidden rounded-2xl ring-1 ring-slate-200 transition-transform active:scale-95"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt={`Foto ${label}`} className="h-full w-full object-cover" />
      <span className="absolute bottom-0 left-0 right-0 bg-slate-900/60 py-0.5 text-center text-[9px] font-bold uppercase tracking-wide text-white">
        {label}
      </span>
    </button>
  );
}

function DetailContent({
  record: r,
  onZoom,
  avatarName,
  avatarPhotoUrl,
}: {
  record: HistoryRecord;
  onZoom: (url: string) => void;
  avatarName: string;
  avatarPhotoUrl?: string | null;
}) {
  const checkinMaps = mapsLink(r.checkinLocation);
  const checkoutMaps = mapsLink(r.checkoutLocation);

  return (
    <div className="flex flex-col gap-5">
      <LocationSection
        label="Check-in"
        time={formatTime(r.checkinTime)}
        photoUrl={r.checkinPhotoUrl}
        location={r.checkinLocation}
        mapsUrl={checkinMaps}
        onZoom={onZoom}
        avatarName={avatarName}
        avatarPhotoUrl={avatarPhotoUrl}
      />
      <LocationSection
        label="Checkout"
        time={formatTime(r.checkoutTime)}
        photoUrl={r.checkoutPhotoUrl}
        location={r.checkoutLocation}
        mapsUrl={checkoutMaps}
        onZoom={onZoom}
        avatarName={avatarName}
        avatarPhotoUrl={avatarPhotoUrl}
      />
    </div>
  );
}

function LocationSection({
  label,
  time,
  photoUrl,
  location,
  mapsUrl,
  onZoom,
  avatarName,
  avatarPhotoUrl,
}: {
  label: string;
  time: string;
  photoUrl: string | null;
  location: { lat: number; lng: number; accuracy?: number } | null;
  mapsUrl: string | null;
  onZoom: (url: string) => void;
  avatarName: string;
  avatarPhotoUrl?: string | null;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm font-bold text-slate-900">
          {label} <span className="font-normal text-slate-400">· {time}</span>
        </p>
        {photoUrl ? (
          <button type="button" onClick={() => onZoom(photoUrl)} className="active:scale-95">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photoUrl}
              alt={`Foto ${label}`}
              className="h-10 w-10 rounded-lg object-cover ring-1 ring-slate-200"
            />
          </button>
        ) : (
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-slate-300">
            <ImageOff size={15} strokeWidth={2} />
          </div>
        )}
      </div>

      {location ? (
        <div className="flex flex-col gap-2">
          <div className="overflow-hidden rounded-xl ring-1 ring-slate-200">
            <LocationMap
              lat={location.lat}
              lng={location.lng}
              accuracy={location.accuracy}
              avatarName={avatarName}
              avatarPhotoUrl={avatarPhotoUrl}
            />
          </div>
          {mapsUrl && (
            <a
              href={mapsUrl}
              target="_blank"
              rel="noreferrer"
              className="flex w-fit items-center gap-1 text-xs font-medium text-indigo-600 hover:underline"
            >
              <ExternalLink size={12} /> Buka di Google Maps
            </a>
          )}
        </div>
      ) : (
        <p className="text-xs text-slate-400">Belum ada data ({label.toLowerCase()} belum dilakukan).</p>
      )}
    </div>
  );
}
