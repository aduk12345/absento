"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { Camera, Loader2, X } from "lucide-react";
import { getGeolocationErrorMessage } from "@/lib/geolocation";

// Leaflet butuh `window` — matikan SSR supaya tidak crash saat render di server.
const LocationMap = dynamic(() => import("./LocationMap").then((m) => m.LocationMap), {
  ssr: false,
});

type Mode = "checkin" | "checkout";
type Step = "idle" | "camera" | "submitting";

export function AbsenPanel({
  hasActiveSession,
  avatarName,
  avatarPhotoUrl,
}: {
  hasActiveSession: boolean;
  avatarName: string;
  avatarPhotoUrl?: string | null;
}) {
  const router = useRouter();
  const mode: Mode = hasActiveSession ? "checkout" : "checkin";

  const [step, setStep] = useState<Step>("idle");
  const [error, setError] = useState<string | null>(null);
  const [location, setLocation] = useState<{ lat: number; lng: number; accuracy: number } | null>(
    null
  );
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  function stopCamera() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }

  useEffect(() => stopCamera, []);

  async function handleStart() {
    setError(null);

    // docs/features.md — cek GPS aktif & izin lokasi SEBELUM lanjut, tanpa ini tidak bisa absen.
    if (!("geolocation" in navigator)) {
      setError("Perangkat tidak mendukung lokasi (GPS).");
      return;
    }

    try {
      const [stream, currentLocation] = await Promise.all([
        navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } }),
        getLocation(),
      ]);
      streamRef.current = stream;
      setLocation(currentLocation);
      setStep("camera");
      // Wait for video element to mount, then attach stream.
      requestAnimationFrame(() => {
        if (videoRef.current) videoRef.current.srcObject = stream;
      });
    } catch (e) {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      setError((e as Error).message ?? "Gagal mengakses kamera. Berikan izin kamera untuk melanjutkan.");
    }
  }

  function handleCancel() {
    stopCamera();
    setStep("idle");
    setLocation(null);
    setError(null);
  }

  async function handleCapture() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")?.drawImage(video, 0, 0);

    stopCamera();
    setStep("submitting");
    setError(null);

    try {
      if (!location) throw new Error("Lokasi tidak tersedia, coba ulangi lagi.");
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/jpeg", 0.85)
      );
      if (!blob) throw new Error("Gagal memproses foto.");

      const photoUrl = await uploadToCloudinary(blob, mode);
      await submitAbsence(mode, photoUrl, location);

      router.refresh();
      setStep("idle");
      setLocation(null);
    } catch (e) {
      setError((e as Error).message);
      setStep("idle");
    }
  }

  return (
    <div className="flex flex-col items-center gap-4">
      {step === "idle" && (
        <button type="button" onClick={handleStart} className="group relative flex h-44 w-44 items-center justify-center">
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
        <div className="flex flex-col items-center gap-3 rounded-3xl bg-slate-900/80 p-6 backdrop-blur-lg">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            className="w-72 rounded-2xl ring-4 ring-white/40"
          />
          {location && (
            <div className="w-72 overflow-hidden rounded-2xl ring-4 ring-white/40">
              <LocationMap
                lat={location.lat}
                lng={location.lng}
                accuracy={location.accuracy}
                avatarName={avatarName}
                avatarPhotoUrl={avatarPhotoUrl}
              />
            </div>
          )}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleCapture}
              className="flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-bold text-indigo-600 shadow-md active:scale-95"
            >
              <Camera size={18} strokeWidth={2.25} />
              Ambil Foto
            </button>
            <button
              type="button"
              onClick={handleCancel}
              className="flex items-center gap-2 rounded-full border border-white/40 px-6 py-3 text-sm font-semibold text-white active:scale-95"
            >
              <X size={18} strokeWidth={2.25} />
              Batal
            </button>
          </div>
        </div>
      )}

      {step === "submitting" && (
        <div className="flex flex-col items-center gap-2 rounded-3xl bg-slate-900/80 p-6 backdrop-blur-lg">
          <div className="flex h-28 w-28 flex-col items-center justify-center gap-2 rounded-full bg-white/15 text-white">
            <Loader2 size={28} className="animate-spin" strokeWidth={2.25} />
            <span className="text-xs font-semibold">Memproses...</span>
          </div>
        </div>
      )}

      <canvas ref={canvasRef} className="hidden" />

      {error && (
        <p className="max-w-xs rounded-xl bg-slate-900/80 px-3 py-2 text-center text-sm text-white backdrop-blur-lg">
          {error}
        </p>
      )}
    </div>
  );
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
) {
  const payload =
    mode === "checkin"
      ? { checkinPhotoUrl: photoUrl, checkinLocation: location }
      : { checkoutPhotoUrl: photoUrl, checkoutLocation: location };

  const res = await fetch(`/api/absences/${mode}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error ?? "Gagal menyimpan absen.");
  }
}
