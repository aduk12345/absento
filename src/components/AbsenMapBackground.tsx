"use client";

import { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { RotateCw } from "lucide-react";
import { getGeolocationErrorMessage } from "@/lib/geolocation";

// Leaflet butuh `window` — matikan SSR supaya tidak crash saat render di server.
const LocationMap = dynamic(() => import("./LocationMap").then((m) => m.LocationMap), {
  ssr: false,
});

type Status = "loading" | "error" | "success";

// Fallback saat izin lokasi belum diberikan/gagal — pusat Kota Surabaya, cuma
// supaya peta tetap ada tampilan (bukan koordinat asli user, TIDAK dipakai untuk
// data checkin/checkout — itu proses terpisah di AbsenPanel.tsx dengan lokasi asli).
const SURABAYA_FALLBACK = { lat: -7.2575, lng: 112.7521 };

// Background peta full-screen untuk halaman Absen — menampilkan lokasi user saat ini.
// Terpisah dari AbsenPanel.tsx (yang punya fungsi lokasi sendiri untuk proses check-in/out).
export function AbsenMapBackground({
  avatarName,
  avatarPhotoUrl,
}: {
  avatarName: string;
  avatarPhotoUrl?: string | null;
}) {
  const [status, setStatus] = useState<Status>("loading");
  const [coords, setCoords] = useState<{ lat: number; lng: number; accuracy?: number } | null>(
    null
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fetchLocation = useCallback(() => {
    if (!("geolocation" in navigator)) {
      setCoords(SURABAYA_FALLBACK);
      setErrorMessage("Perangkat tidak mendukung lokasi (GPS).");
      setStatus("error");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        });
        setStatus("success");
      },
      (err) => {
        // Izin ditolak/gagal — peta tetap tampil, arahkan ke Surabaya sebagai fallback.
        setCoords(SURABAYA_FALLBACK);
        setErrorMessage(getGeolocationErrorMessage(err));
        setStatus("error");
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch lokasi saat mount, state awal sudah "loading"
    fetchLocation();
  }, [fetchLocation]);

  // Sekali user "Never allow", browser tidak akan prompt izin lagi lewat getCurrentPosition() —
  // satu-satunya cara pulih adalah user ubah izin manual lewat setting browser. Pasang listener
  // di sini supaya begitu izin itu diubah (mis. dari "blocked" jadi "allowed"), map auto-refetch
  // tanpa perlu reload halaman.
  useEffect(() => {
    if (!("permissions" in navigator)) return;
    let cancelled = false;
    let status: PermissionStatus | undefined;

    navigator.permissions
      .query({ name: "geolocation" as PermissionName })
      .then((result) => {
        if (cancelled) return;
        status = result;
        status.onchange = () => {
          if (status?.state !== "denied") fetchLocation();
        };
      })
      .catch(() => { });

    return () => {
      cancelled = true;
      if (status) status.onchange = null;
    };
  }, [fetchLocation]);

  // Dipakai tombol "Coba Lagi" — event handler biasa, boleh setState sinkron di sini.
  function handleRetry() {
    setStatus("loading");
    setErrorMessage(null);
    fetchLocation();
  }

  if (status === "loading") {
    return <div className="absolute inset-0 z-0 animate-pulse bg-slate-200" />;
  }

  // status "error" (izin ditolak/gagal) tetap merender map di bawah — pakai
  // fallback SURABAYA_FALLBACK yang sudah di-set ke `coords` — cuma tanpa pin
  // avatar (posisinya bukan lokasi asli user) + notice kecil non-blocking untuk retry.
  return (
    <div className="absolute inset-0 z-0">
      {coords && (
        <LocationMap
          lat={coords.lat}
          lng={coords.lng}
          accuracy={status === "success" ? coords.accuracy : undefined}
          className="h-full w-full"
          interactive
          // Default (kanan atas) ketutup panel greeting/status di page.tsx (absolute left-4 top-4) —
          // taruh di bawah panel itu, lurus dengan tepi kirinya.
          badgePosition="left-4 top-[168px]"
          avatarName={status === "success" ? avatarName : undefined}
          avatarPhotoUrl={status === "success" ? avatarPhotoUrl : undefined}
        />
      )}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/15 via-transparent to-black/20" />

    </div>
  );
}
