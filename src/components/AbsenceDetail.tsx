"use client";

import dynamic from "next/dynamic";
import { ExternalLink, ImageOff } from "lucide-react";

// Leaflet butuh `window` — matikan SSR supaya tidak crash saat render di server.
const LocationMap = dynamic(() => import("./LocationMap").then((m) => m.LocationMap), {
  ssr: false,
});

export type AbsenceLocation = { lat: number; lng: number; accuracy?: number };

/**
 * Isi modal "detail absen" — dipakai bersama oleh History karyawan (`HistoryList.tsx`)
 * dan Manage Absence admin (`AbsencesTable.tsx`) supaya tampilannya identik.
 * Jangan duplikasi/reinvent blok foto+peta ini di tempat lain; pakai komponen ini.
 */
export type AbsenceDetailRecord = {
  checkinTime: string | null;
  checkinLocation: AbsenceLocation | null;
  checkinPhotoUrl: string | null;
  checkoutTime: string | null;
  checkoutLocation: AbsenceLocation | null;
  checkoutPhotoUrl: string | null;
};

export function mapsLink(loc: AbsenceLocation | null): string | null {
  if (!loc) return null;
  return `https://www.google.com/maps?q=${loc.lat},${loc.lng}`;
}

function formatTime(iso: string | null): string {
  if (!iso) return "-";
  return new Date(iso).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
}

export function AbsenceDetailContent({
  record: r,
  onZoom,
  avatarName,
  avatarPhotoUrl,
}: {
  record: AbsenceDetailRecord;
  onZoom: (url: string) => void;
  avatarName: string;
  avatarPhotoUrl?: string | null;
}) {
  return (
    <div className="flex flex-col gap-5">
      <LocationSection
        label="Check-in"
        time={formatTime(r.checkinTime)}
        photoUrl={r.checkinPhotoUrl}
        location={r.checkinLocation}
        mapsUrl={mapsLink(r.checkinLocation)}
        onZoom={onZoom}
        avatarName={avatarName}
        avatarPhotoUrl={avatarPhotoUrl}
      />
      <LocationSection
        label="Checkout"
        time={formatTime(r.checkoutTime)}
        photoUrl={r.checkoutPhotoUrl}
        location={r.checkoutLocation}
        mapsUrl={mapsLink(r.checkoutLocation)}
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
  location: AbsenceLocation | null;
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
