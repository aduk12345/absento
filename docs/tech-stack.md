# Tech Stack — Aplikasi Absensi (eh-absence)

## Ringkasan

Aplikasi absensi berbasis web (PWA, installable) dengan fitur absen menggunakan lokasi GPS + selfie. Direncanakan mobile app native di masa depan.

## Struktur Routing

- `absence.com` — halaman absensi untuk karyawan
- `absence.com/admin` — halaman dashboard untuk admin/HR

## Stack

| Layer | Teknologi | Alasan |
|---|---|---|
| Frontend & Server | **Next.js** (React) | Familiar (JavaScript), performant, mendukung PWA, satu project untuk frontend + API routes (tanpa perlu backend terpisah) |
| PWA | **next-pwa** (atau setup manual service worker) | Agar web bisa di-install di HP (Add to Home Screen), butuh HTTPS |
| Database & Auth | **Firebase** (Firestore + Firebase Authentication) | Tidak perlu backend/server sendiri, client SDK langsung dari Next.js, security via Firestore Security Rules |
| Penyimpanan Foto | **Cloudinary** | Free tier tanpa kartu kredit (25GB storage + 25GB bandwidth/bulan), auto compress/resize foto selfie |
| Lokasi | **Geolocation API** (browser) | Native browser API, tidak perlu library tambahan |
| Kamera/Selfie | **`getUserMedia`** (browser) | Native browser API untuk akses kamera |
| API Routes (server-side ringan) | **Next.js API Routes** | Untuk hal yang tidak boleh dilakukan di client: generate signature upload Cloudinary, validasi geofencing server-side |

## Kenapa Next.js, bukan Flutter

- Familiar dengan JavaScript, hindari overhead belajar Dart.
- Flutter web punya kendala: bundle size besar (CanvasKit/WASM ~2-3MB awal), PWA masih "kelas dua" (plugin push notification web terbatas), akses kamera web kurang matang dibanding `getUserMedia` native.
- Untuk kebutuhan mobile di masa depan: pertimbangkan **React Native (Expo)** agar tetap satu bahasa (JavaScript) dan bisa reuse pengetahuan/logic dari web. PWA di Next.js bisa jadi solusi mobile sementara sebelum native app dibangun.

## Arsitektur Alur Absen

1. Karyawan buka halaman absen → ambil lokasi (Geolocation API) + foto selfie (`getUserMedia`).
2. Foto di-compress di client → upload ke Cloudinary (via signed upload, signature digenerate oleh Next.js API route) → dapat URL foto.
3. Record absen (userId, lokasi, url foto, timestamp) disimpan ke Firestore langsung dari client, dibatasi oleh Firestore Security Rules.
4. Validasi geofencing (radius kantor) dilakukan di server (API route) agar tidak mudah dimanipulasi dari client.
5. Dashboard admin membaca data dari Firestore dan menampilkan foto dari Cloudinary URL.

## Isu yang Sudah Dibahas & Diputuskan

- **Fake GPS / mock location detection**: ditunda untuk versi awal. Browser Geolocation API tidak bisa mendeteksi mock location. Mitigasi awal: geofencing radius + foto+lokasi+timestamp untuk audit manual, deteksi anomali lokasi di backend (fase lanjutan).
- **Penyimpanan foto di Google Drive**: dipertimbangkan tapi ditolak — rate limit API, thumbnail link expiring, tidak didesain untuk pola akses tinggi-frekuensi seperti attendance app.
- **Cloudflare R2**: dipertimbangkan tapi ditolak — mewajibkan kartu kredit untuk aktivasi meskipun masih dalam free tier.

## Belum Diputuskan / Perlu Dibahas Lebih Lanjut

- Fitur detail per halaman (absensi karyawan vs admin) — dibahas satu per satu berikutnya.
- Skala jumlah karyawan & jumlah cabang/lokasi kantor.
- Sistem shift kerja vs jam kerja tetap.
- Fitur izin/cuti — termasuk MVP atau fase 2.
