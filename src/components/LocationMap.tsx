"use client";

import { useEffect, useMemo, useRef } from "react";
import "leaflet/dist/leaflet.css";
import L, { type Map as LeafletMap } from "leaflet";
import { MapContainer, TileLayer, CircleMarker, Circle, Marker, ZoomControl } from "react-leaflet";
import { LocateFixed } from "lucide-react";

// Warna sama seperti `src/components/ui/Avatar.tsx` (konsisten per-nama), tapi hex
// karena harus disuntik ke HTML string L.divIcon — Tailwind class tidak dievaluasi
// di dalamnya karena ini bukan render React biasa.
const AVATAR_PALETTE_HEX = [
  { bg: "#e0e7ff", text: "#4338ca" },
  { bg: "#d1fae5", text: "#047857" },
  { bg: "#fef3c7", text: "#b45309" },
  { bg: "#ffe4e6", text: "#be123c" },
  { bg: "#e0f2fe", text: "#0369a1" },
  { bg: "#ede9fe", text: "#6d28d9" },
];

function colorForAvatar(name: string): { bg: string; text: string } {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_PALETTE_HEX[Math.abs(hash) % AVATAR_PALETTE_HEX.length];
}

function buildAvatarIcon(name: string, photoUrl?: string | null): L.DivIcon {
  const initial = (name.trim()[0] ?? "?").toUpperCase();
  const { bg, text } = colorForAvatar(name || "?");
  const inner = photoUrl
    ? `<img src="${photoUrl}" style="width:100%;height:100%;object-fit:cover;" />`
    : `<span style="color:${text};font-weight:700;font-size:15px;line-height:1;">${initial}</span>`;

  const html = `
    <div style="display:flex;flex-direction:column;align-items:center;filter:drop-shadow(0 3px 6px rgba(15,23,42,0.35));">
      <div style="width:40px;height:40px;border-radius:9999px;background:${bg};display:flex;align-items:center;justify-content:center;overflow:hidden;border:3px solid white;">
        ${inner}
      </div>
      <div style="width:10px;height:10px;background:white;transform:rotate(45deg);margin-top:-6px;"></div>
    </div>
  `;

  // className kosong WAJIB — default Leaflet divIcon punya style border/background bawaan
  // (.leaflet-div-icon di leaflet.css) yang akan bentrok dengan pin custom ini.
  return L.divIcon({ html, className: "", iconSize: [44, 56], iconAnchor: [22, 50] });
}

// Tile CARTO Voyager — gratis tanpa API key, tapi WAJIB atribusi (attribution di
// TileLayer tidak boleh dihapus, itu syarat pemakaian gratisnya — cuma boleh
// diperkecil/disamarkan lewat CSS, lihat .leaflet-control-attribution di globals.css).
// Titik lokasi pakai pin avatar karyawan (foto profil `employees.photoUrl` atau
// inisial nama) via L.divIcon kalau `avatarName` diisi; fallback ke CircleMarker
// polos kalau tidak (mis. dipanggil dari konteks yang belum tahu identitas karyawan).
export function LocationMap({
  lat,
  lng,
  accuracy,
  className = "h-40 w-full",
  interactive = false,
  badgePosition = "right-2.5 top-2.5",
  showAccuracy = false,
  avatarName,
  avatarPhotoUrl,
}: {
  lat: number;
  lng: number;
  /** Radius akurasi dari `pos.coords.accuracy` (meter) — dari GPS device, bukan cuma WiFi/IP. Data tetap dikirim & disimpan terlepas dari `showAccuracy`, ini cuma kontrol tampilan. */
  accuracy?: number;
  className?: string;
  /** Izinkan geser/zoom peta + tombol kontrol — default false (dipakai preview kecil di AbsenPanel/HistoryList). */
  interactive?: boolean;
  /** Kelas posisi Tailwind untuk badge akurasi — default pojok kanan atas. Override kalau ada overlay lain yang menutupi (mis. panel info di halaman Absen). */
  badgePosition?: string;
  /** Tampilkan lingkaran radius + badge akurasi di peta — default false (dimatikan sementara atas permintaan user, data akurasi tetap dicapture & disimpan). */
  showAccuracy?: boolean;
  /** Nama karyawan — kalau diisi, titik lokasi jadi pin avatar (bukan CircleMarker polos). */
  avatarName?: string;
  /** URL foto profil karyawan (`employees.photoUrl`) — kalau kosong/null, pin pakai inisial nama berwarna. */
  avatarPhotoUrl?: string | null;
}) {
  const mapRef = useRef<LeafletMap | null>(null);
  const avatarIcon = useMemo(
    () => (avatarName ? buildAvatarIcon(avatarName, avatarPhotoUrl) : null),
    [avatarName, avatarPhotoUrl]
  );

  useEffect(() => {
    if (!interactive) return;
    // Peta dirender di dalam container `absolute inset-0` yang ukurannya baru
    // final setelah layout selesai — tanpa ini, gesture (terutama arah zoom-in)
    // bisa salah hitung titik pusat karena Leaflet sempat mengukur ukuran lama.
    const timer = setTimeout(() => mapRef.current?.invalidateSize(), 100);
    return () => clearTimeout(timer);
  }, [interactive]);

  return (
    <div className={`relative ${className}`}>
      <MapContainer
        ref={mapRef}
        center={[lat, lng]}
        zoom={16}
        minZoom={3}
        maxZoom={19}
        scrollWheelZoom={interactive}
        dragging={interactive}
        doubleClickZoom={interactive}
        touchZoom={interactive}
        zoomControl={false}
        className="h-full w-full"
      >
        {interactive && <ZoomControl position="bottomright" />}
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
          subdomains="abcd"
          maxZoom={19}
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
        />
        {showAccuracy && accuracy != null && accuracy > 0 && (
          <Circle
            center={[lat, lng]}
            radius={accuracy}
            pathOptions={{ color: "#4f46e5", fillColor: "#4f46e5", fillOpacity: 0.12, weight: 1 }}
          />
        )}
        {avatarIcon ? (
          <Marker position={[lat, lng]} icon={avatarIcon} />
        ) : (
          <CircleMarker
            center={[lat, lng]}
            radius={10}
            pathOptions={{ color: "#4f46e5", fillColor: "#4f46e5", fillOpacity: 0.9, weight: 3 }}
          />
        )}
      </MapContainer>

      {showAccuracy && accuracy != null && accuracy > 0 && (
        <span
          className={`absolute z-[1000] rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-semibold text-slate-600 shadow-sm ring-1 ring-black/5 ${badgePosition}`}
        >
          Akurasi ~{Math.round(accuracy)}m
        </span>
      )}

      {interactive && (
        <button
          type="button"
          onClick={() => mapRef.current?.flyTo([lat, lng], 16)}
          aria-label="Kembali ke lokasi saya"
          className="absolute bottom-[92px] right-2.5 z-[1000] flex h-9 w-9 items-center justify-center rounded-lg bg-white text-slate-700 shadow-md ring-1 ring-black/10 active:scale-95"
        >
          <LocateFixed size={18} strokeWidth={2.25} />
        </button>
      )}
    </div>
  );
}
