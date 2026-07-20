"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { Camera, Loader2, X, RotateCcw, MapPin, Send } from "lucide-react";
import { getGeolocationErrorMessage } from "@/lib/geolocation";
import { isSameJakartaDay } from "@/lib/date";
import { drawAbsenceWatermark } from "@/lib/watermark";
import { Modal } from "@/components/ui/Modal";

// Leaflet butuh `window` — matikan SSR supaya tidak crash saat render di server.
const LocationMap = dynamic(() => import("./LocationMap").then((m) => m.LocationMap), {
  ssr: false,
});

type Mode = "checkin" | "checkout";
type Step = "idle" | "camera" | "preview" | "submitting";

export function AbsenPanel({
  hasActiveSession,
  activeSessionCheckinTime,
  avatarName,
  avatarPhotoUrl,
}: {
  hasActiveSession: boolean;
  activeSessionCheckinTime?: string | null;
  avatarName: string;
  avatarPhotoUrl?: string | null;
}) {
  const router = useRouter();

  // Halaman bisa tetap terbuka melewati pergantian hari (tab dibiarkan aktif,
  // atau HP dikunci lalu dibuka lagi) — `hasActiveSession` dari server jadi stale.
  // Watch tanggal di client supaya tombol otomatis balik ke "Check-in" tanpa reload.
  const [staleSession, setStaleSession] = useState(false);
  const effectiveHasActiveSession = hasActiveSession && !staleSession;
  const mode: Mode = effectiveHasActiveSession ? "checkout" : "checkin";

  useEffect(() => {
    function checkStale() {
      const stale =
        activeSessionCheckinTime != null &&
        !isSameJakartaDay(new Date(activeSessionCheckinTime), new Date());
      setStaleSession(stale);
    }

    checkStale();

    if (!activeSessionCheckinTime) return;

    const nextMidnight = new Date();
    nextMidnight.setHours(24, 0, 5, 0);
    const timer = setTimeout(checkStale, nextMidnight.getTime() - Date.now());

    document.addEventListener("visibilitychange", checkStale);
    window.addEventListener("focus", checkStale);

    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", checkStale);
      window.removeEventListener("focus", checkStale);
    };
  }, [activeSessionCheckinTime]);

  const [step, setStep] = useState<Step>("idle");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [location, setLocation] = useState<{ lat: number; lng: number; accuracy: number } | null>(
    null
  );
  const [address, setAddress] = useState<{ shortLabel: string | null; displayName: string | null } | null>(
    null
  );
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [capturedBlob, setCapturedBlob] = useState<Blob | null>(null);
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [cameraLoading, setCameraLoading] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const previewUrlRef = useRef<string | null>(null);
  // Cancellation token — setiap startCamera() bikin token baru; hasil async yang
  // "kadaluarsa" (kalah dari klik retake/cancel berikutnya) dibuang, bukan dipakai,
  // supaya tidak ada race stream lama menimpa stream baru (penyebab layar blank/kamera hitam).
  const startTokenRef = useRef(0);

  function stopCamera() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }

  function clearPreview() {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    previewUrlRef.current = null;
    setPreviewUrl(null);
    setCapturedBlob(null);
  }

  useEffect(() => {
    return () => {
      stopCamera();
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    };
  }, []);

  async function startCamera() {
    // Invalidate panggilan startCamera() sebelumnya yang mungkin masih in-flight
    // (mis. user klik retake dua kali cepat) — hasilnya nanti dibuang, bukan dipakai.
    const token = ++startTokenRef.current;

    // Lepas stream lama (kalau ada sisa) SEBELUM minta stream baru — di beberapa
    // browser/OS, kamera yang belum benar-benar dilepas bikin request stream baru
    // gagal diam-diam atau balik frame hitam.
    stopCamera();
    clearPreview();
    setError(null);
    setInfo(null);
    setCameraLoading(true);
    // Tampilkan overlay kamera SEKARANG (sebelum getUserMedia selesai) supaya tidak
    // ada jeda "blank" antara preview hilang dan kamera baru siap — spinner loading
    // yang mengisi jeda itu, bukan layar kosong.
    setStep("camera");

    // docs/features.md — cek GPS aktif & izin lokasi SEBELUM lanjut, tanpa ini tidak bisa absen.
    if (!("geolocation" in navigator)) {
      if (startTokenRef.current === token) {
        setError("Perangkat tidak mendukung lokasi (GPS).");
        setStep("idle");
        setCameraLoading(false);
      }
      return;
    }

    try {
      const [stream, currentLocation] = await Promise.all([
        navigator.mediaDevices.getUserMedia({
          // Minta orientasi potret ke device — beberapa browser/webcam desktop tetap
          // kirim landscape terlepas dari ini, makanya hasil capture tetap di-crop
          // paksa ke rasio potret di handleCapture() (lihat cropToPortrait()).
          video: { facingMode: "user", width: { ideal: 720 }, height: { ideal: 1280 } },
        }),
        getLocation(),
      ]);

      if (startTokenRef.current !== token) {
        // Kalah dari panggilan startCamera() berikutnya (atau user sudah batal) —
        // lepas stream ini langsung, jangan disentuh state apa pun.
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      streamRef.current = stream;
      setLocation(currentLocation);
      setAddress(null);
      if (videoRef.current) videoRef.current.srcObject = stream;
      setCameraLoading(false);
      // Best-effort — dipakai untuk watermark foto, kalau gagal watermark tetap
      // tampil dengan koordinat saja (lihat drawAbsenceWatermark).
      fetchAddress(currentLocation.lat, currentLocation.lng).then(setAddress);
    } catch (e) {
      if (startTokenRef.current !== token) return;
      setError((e as Error).message ?? "Gagal mengakses kamera. Berikan izin kamera untuk melanjutkan.");
      setStep("idle");
      setCameraLoading(false);
    }
  }

  function handleCancel() {
    startTokenRef.current++; // buang hasil startCamera() yang mungkin masih in-flight
    stopCamera();
    clearPreview();
    setStep("idle");
    setLocation(null);
    setAddress(null);
    setError(null);
    setCameraLoading(false);
  }

  async function handleCapture() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !location) return;

    // Foto absen selalu potret (3:4), terlepas dari orientasi native kamera —
    // crop tengah dari frame video, mirip CSS object-fit:cover tapi diterapkan ke canvas.
    const { sx, sy, sw, sh } = cropToPortrait(video.videoWidth, video.videoHeight);
    canvas.width = sw;
    canvas.height = sh;
    canvas.getContext("2d")?.drawImage(video, sx, sy, sw, sh, 0, 0, sw, sh);
    stopCamera();

    // Bake watermark lokasi + tanggal/jam permanen ke foto (mirip GPS Map Camera),
    // HARUS sebelum toBlob supaya ikut ter-capture di file yang di-upload.
    await drawAbsenceWatermark(canvas, {
      lat: location.lat,
      lng: location.lng,
      shortLabel: address?.shortLabel ?? null,
      displayName: address?.displayName ?? null,
      date: new Date(),
    });

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.85)
    );
    if (!blob) {
      setError("Gagal memproses foto.");
      return;
    }

    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    const url = URL.createObjectURL(blob);
    previewUrlRef.current = url;
    setPreviewUrl(url);
    setCapturedBlob(blob);
    setStep("preview");
  }

  async function handleRetake() {
    await startCamera();
  }

  async function handleConfirm() {
    if (!location || !capturedBlob) return;

    setStep("submitting");
    setError(null);

    try {
      const photoUrl = await uploadToCloudinary(capturedBlob, mode);
      const result = await submitAbsence(mode, photoUrl, location);

      setInfo(result.autoClosed ? result.note ?? null : null);
      router.refresh();
      clearPreview();
      setStep("idle");
      setLocation(null);
      setAddress(null);
    } catch (e) {
      setError((e as Error).message);
      setStep("preview");
    }
  }

  return (
    <div className="flex flex-col items-center gap-4">
      {step === "idle" && (
        <button type="button" onClick={startCamera} className="group relative flex h-44 w-44 items-center justify-center">
          <span
            className={`absolute inset-0 animate-ping rounded-full [animation-duration:1.8s] ${
              mode === "checkin" ? "bg-indigo-400/70" : "bg-orange-400/70"
            }`}
          />
          <span
            className={`absolute inset-2 animate-ping rounded-full [animation-duration:1.8s] [animation-delay:0.4s] ${
              mode === "checkin" ? "bg-violet-400/60" : "bg-rose-400/60"
            }`}
          />
          <span className="absolute inset-[-14px] rounded-full bg-white/25 blur-md" />
          <span
            className={`relative flex h-36 w-36 flex-col items-center justify-center gap-1.5 rounded-full text-white shadow-2xl ring-[6px] ring-white/60 transition-transform duration-150 group-active:scale-95 ${
              mode === "checkin"
                ? "bg-gradient-to-br from-indigo-500 to-violet-600 shadow-indigo-900/40"
                : "bg-gradient-to-br from-orange-500 to-rose-600 shadow-orange-900/40"
            }`}
          >
            <Camera size={34} strokeWidth={2.25} />
            <span className="text-base font-bold tracking-tight">
              {mode === "checkin" ? "Check-in" : "Checkout"}
            </span>
          </span>
        </button>
      )}

      {step === "camera" && (
        <div className="fixed inset-0 z-40 flex flex-col items-center justify-center bg-black">
          {/* Kotak rasio 3:4 — samakan persis dengan crop hasil akhir (cropToPortrait)
              supaya apa yang tampil di live preview = apa yang ter-capture, bukan crop full-viewport yang beda rasio. */}
          <div className="relative aspect-[3/4] max-h-full w-full max-w-[520px] overflow-hidden">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="h-full w-full object-cover"
            />
            {cameraLoading && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/70 text-white">
                <Loader2 size={28} className="animate-spin" strokeWidth={2.25} />
                <span className="text-xs font-semibold">Menyiapkan kamera...</span>
              </div>
            )}
          </div>
          <div className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-6 bg-gradient-to-t from-black/80 via-black/40 to-transparent px-6 pb-10 pt-16">
            <button
              type="button"
              onClick={handleCancel}
              aria-label="Batal"
              className="flex h-14 w-14 items-center justify-center rounded-full border border-white/40 text-white active:scale-95"
            >
              <X size={22} strokeWidth={2.25} />
            </button>
            <button
              type="button"
              onClick={handleCapture}
              disabled={cameraLoading}
              aria-label="Ambil Foto"
              className="flex h-20 w-20 items-center justify-center rounded-full bg-white shadow-2xl ring-4 ring-white/40 active:scale-95 disabled:opacity-40"
            >
              <Camera size={30} strokeWidth={2.25} className="text-indigo-600" />
            </button>
            <span className="h-14 w-14" />
          </div>
        </div>
      )}

      {step === "preview" && previewUrl && (
        <div className="fixed inset-0 z-40 flex flex-col items-center justify-center bg-black">
          {/* Container sama persis dengan live preview di step "camera" (aspect-[3/4]) —
              foto ini sudah di-crop ke rasio itu, jadi tampilannya konsisten, bukan di-stretch/crop ulang oleh viewport. */}
          <div className="relative aspect-[3/4] max-h-full w-full max-w-[520px] overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element -- object URL lokal, bukan aset remote */}
            <img src={previewUrl} alt="Preview foto absen" className="h-full w-full object-cover" />
          </div>
          <div className="absolute inset-x-0 bottom-0 flex flex-col items-center gap-3 bg-gradient-to-t from-black/85 via-black/50 to-transparent px-6 pb-10 pt-16">
            {location && (
              <button
                type="button"
                onClick={() => setShowLocationModal(true)}
                className="flex items-center gap-1.5 rounded-full bg-white/15 px-4 py-2 text-xs font-semibold text-white backdrop-blur-md active:scale-95"
              >
                <MapPin size={14} strokeWidth={2.5} />
                Cek Lokasi
              </button>
            )}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleCancel}
                aria-label="Batal Absen"
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-white/40 text-white active:scale-95"
              >
                <X size={20} strokeWidth={2.25} />
              </button>
              <button
                type="button"
                onClick={handleRetake}
                aria-label="Ambil Ulang"
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-white/40 text-white active:scale-95"
              >
                <RotateCcw size={20} strokeWidth={2.25} />
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                className={`flex items-center gap-2 rounded-full px-6 py-3 text-sm font-bold text-white shadow-md active:scale-95 ${
                  mode === "checkin"
                    ? "bg-gradient-to-br from-indigo-500 to-violet-600"
                    : "bg-gradient-to-br from-orange-500 to-rose-600"
                }`}
              >
                <Send size={18} strokeWidth={2.25} />
                {mode === "checkin" ? "Kirim Check-in" : "Kirim Checkout"}
              </button>
            </div>
          </div>
        </div>
      )}

      {step === "submitting" && (
        <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center gap-2 bg-black/80">
          <div className="flex h-28 w-28 flex-col items-center justify-center gap-2 rounded-full bg-white/15 text-white">
            <Loader2 size={28} className="animate-spin" strokeWidth={2.25} />
            <span className="text-xs font-semibold">Memproses...</span>
          </div>
        </div>
      )}

      {showLocationModal && location && (
        <Modal title="Lokasi Absen" onClose={() => setShowLocationModal(false)}>
          <div className="overflow-hidden rounded-2xl">
            <LocationMap
              lat={location.lat}
              lng={location.lng}
              accuracy={location.accuracy}
              showAccuracy
              className="h-64 w-full"
              avatarName={avatarName}
              avatarPhotoUrl={avatarPhotoUrl}
            />
          </div>
          {address?.displayName && (
            <p className="mt-3 text-sm text-slate-600">{address.displayName}</p>
          )}
        </Modal>
      )}

      <canvas ref={canvasRef} className="hidden" />

      {error && (
        <p className="max-w-xs rounded-xl bg-slate-900/80 px-3 py-2 text-center text-sm text-white backdrop-blur-lg">
          {error}
        </p>
      )}

      {info && !error && (
        <p className="max-w-xs rounded-xl bg-amber-500/90 px-3 py-2 text-center text-sm text-white backdrop-blur-lg">
          {info}
        </p>
      )}
    </div>
  );
}

const PORTRAIT_ASPECT = 3 / 4; // width / height

function cropToPortrait(
  srcW: number,
  srcH: number
): { sx: number; sy: number; sw: number; sh: number } {
  if (srcW / srcH > PORTRAIT_ASPECT) {
    // Sumber lebih lebar dari target potret — crop kiri-kanan, pertahankan tinggi penuh.
    const sh = srcH;
    const sw = srcH * PORTRAIT_ASPECT;
    return { sx: (srcW - sw) / 2, sy: 0, sw, sh };
  }
  // Sumber lebih "kurus"/sudah potret — crop atas-bawah, pertahankan lebar penuh.
  const sw = srcW;
  const sh = srcW / PORTRAIT_ASPECT;
  return { sx: 0, sy: (srcH - sh) / 2, sw, sh };
}

function getLocation(): Promise<{ lat: number; lng: number; accuracy: number }> {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        }),
      (err) => reject(new Error(getGeolocationErrorMessage(err))),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  });
}

async function fetchAddress(
  lat: number,
  lng: number
): Promise<{ shortLabel: string | null; displayName: string | null }> {
  try {
    const res = await fetch(`/api/geocode/reverse?lat=${lat}&lng=${lng}`);
    if (!res.ok) throw new Error("geocode failed");
    return await res.json();
  } catch {
    return { shortLabel: null, displayName: null };
  }
}

async function uploadToCloudinary(blob: Blob, type: Mode): Promise<string> {
  const cloudinaryType = type === "checkin" ? "checkin" : "checkout";

  const signRes = await fetch("/api/cloudinary/sign", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ type: cloudinaryType }),
  });
  if (!signRes.ok) throw new Error("Gagal menyiapkan upload foto.");
  const { signature, timestamp, publicId, apiKey, cloudName } = await signRes.json();

  const formData = new FormData();
  formData.append("file", blob);
  formData.append("api_key", apiKey);
  formData.append("timestamp", String(timestamp));
  formData.append("signature", signature);
  formData.append("public_id", publicId);
  formData.append("transformation", "q_auto:good,w_1280,c_limit");

  const uploadRes = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
    method: "POST",
    body: formData,
  });
  if (!uploadRes.ok) throw new Error("Gagal upload foto ke Cloudinary.");
  const data = await uploadRes.json();
  return data.secure_url as string;
}

async function submitAbsence(
  mode: Mode,
  photoUrl: string,
  location: { lat: number; lng: number; accuracy: number }
): Promise<{ id: string; autoClosed?: boolean; note?: string }> {
  const payload =
    mode === "checkin"
      ? { checkinPhotoUrl: photoUrl, checkinLocation: location }
      : { checkoutPhotoUrl: photoUrl, checkoutLocation: location };

  const res = await fetch(`/api/absences/${mode}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error ?? "Gagal menyimpan absen.");
  }
  return data;
}
