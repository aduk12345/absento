# Tech Context — eh-absence

Ringkasan teknis. Detail lengkap & alasan keputusan ada di `docs/tech-stack.md`, `docs/database-schema.md`, `docs/cloudinary-schema.md`.

## Stack

| Layer | Teknologi |
|---|---|
| Frontend & Server | Next.js (React), termasuk API routes untuk logic server-side |
| PWA | `next-pwa` atau setup manual service worker + manifest.json |
| Database | Firebase Firestore (NoSQL, document-based) |
| Auth | **Custom login** (bukan Firebase Authentication) — API route query Firestore via Firebase Admin SDK, cocokkan username/email + password |
| Session | JWT (`jose`) di httpOnly cookie — final, bukan NextAuth |
| Ikon | `lucide-react` |
| Penyimpanan Foto | Cloudinary (free tier, tanpa kartu kredit) |
| Lokasi | Geolocation API (browser native) |
| Kamera/Selfie | `getUserMedia` (browser native) |
| Export Report | Excel (.xlsx) |

## Kenapa Next.js, Bukan Flutter

- Tim familiar JavaScript, hindari overhead belajar Dart.
- Flutter web: bundle size besar (CanvasKit/WASM), PWA masih kelas dua, akses kamera web kurang matang dibanding `getUserMedia` native.
- Rencana mobile masa depan: React Native (Expo) — tetap satu bahasa JS, reuse pengetahuan dari web.

## Kenapa Custom Login, Bukan Firebase Authentication

- Admin login pakai **username**, bukan email — Firebase Auth native butuh email.
- Custom login lewat API route lebih fleksibel: username asli langsung dipakai tanpa trik (email semu), dan gampang extend ke "login pakai email atau no. HP" untuk karyawan nanti.
- **Konsekuensi arsitektur penting**: karena tidak ada Firebase Auth, client tidak punya `request.auth`/`auth.uid` di Firestore. Firestore Security Rules berbasis auth context tidak berlaku. **Semua read & write Firestore harus lewat Next.js API routes** (Firebase Admin SDK di server) — client tidak pernah akses Firestore langsung.

## Penyimpanan Foto — Cloudinary

- Upload **langsung dari client ke Cloudinary** (signed upload — signature digenerate oleh API route `/api/cloudinary/sign`, API Secret tidak pernah ke client).
- Struktur folder: `absence/{employeeId}/{yyyy-MM}/{checkin|checkout}_{timestamp}`.
- Kompresi otomatis lewat parameter `transformation: "q_auto:good,w_1280,c_limit"` — **PENTING**: `quality` BUKAN parameter upload langsung yang sah di Cloudinary (harus lewat `transformation`), kalau dikirim terpisah sebagai field `quality`, Cloudinary mengabaikannya saat menghitung ulang signature dan upload akan gagal "Invalid Signature". Field & value `transformation` ini harus PERSIS sama di `src/app/api/cloudinary/sign/route.ts` (saat generate signature) dan `src/components/AbsenPanel.tsx` (saat kirim FormData ke Cloudinary) — signature dihitung dari kombinasi parameter yang dikirim, satu karakter beda saja bikin mismatch.
- Setelah upload, `secure_url` dikirim ke API route Next.js untuk disimpan sebagai field di document `absences` (Firestore).
- Detail lengkap: `docs/cloudinary-schema.md`.

## Kenapa Bukan Cloudflare R2 / Google Drive

- **Cloudflare R2**: mewajibkan kartu kredit untuk aktivasi meski masih di free tier — ditolak.
- **Google Drive**: rate limit API, thumbnail link expiring (tidak stabil untuk `<img src>` permanen), tidak didesain untuk pola akses tinggi-frekuensi seperti attendance app — ditolak untuk production, mungkin oke untuk prototipe cepat saja.

## Design System / UI

- **Dark mode DIMATIKAN TOTAL** — keputusan produk eksplisit dari user. `globals.css` set `color-scheme: light only` di `:root` dan `html`, `layout.tsx` set `viewport.colorScheme = "light"` + inline style di tag `<html>`. **JANGAN PERNAH** tambahkan class `dark:` (Tailwind) atau blok `@media (prefers-color-scheme: dark)` di komponen manapun — aplikasi harus selalu tampil light walau device/browser user diset dark mode.
- **Palet warna**: `slate` (netral/teks/border) + `indigo`/`violet` (brand/aksen, warna utama `#4f46e5`). Jangan pakai `zinc`/`blue` lagi (palet lama sebelum overhaul, sudah di-retire total).
- **UI kit** di `src/components/ui/`: `Card`, `PageHeader`, `Button` (variant primary/secondary/danger/ghost), `Badge` (tone green/zinc/orange/red/blue), `Input`, `Avatar` (inisial berwarna konsisten per-nama atau foto asli), `StatCard` (kartu statistik dengan ikon — dipakai di dashboard admin & Report). **Semua UI baru wajib pakai komponen ini**, jangan bikin `<table>`/`<button>`/`<input>` HTML polos lagi.
- **Ikon**: `lucide-react`, dipakai konsisten di navigasi (`BottomNav`, `AdminNav`), tombol aksi, dan `StatCard`.
- Referensi gaya: aplikasi HR-tech Indonesia modern (Kerjoo, Talenta, Gadjian) — sidebar dengan ikon, stat card berwarna, avatar bulat, tombol pill/rounded, shadow lembut tapi jelas (bukan flat).

## Technical Debt yang Diketahui (Disengaja untuk MVP)

- **Password plain text** di Firestore (bukan di-hash) — keputusan sementara demi kecepatan development. **Wajib** diganti ke `bcrypt`/`argon2` sebelum dipakai untuk data karyawan sungguhan/production. Field `password` tidak boleh pernah diakses langsung dari client (hanya lewat API route).
- Tanpa radius/geofencing validasi lokasi.
- Tanpa deteksi fake GPS/mock location.

## Environment Variables (Diperkirakan)

```
# Firebase
FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=

# Cloudinary
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=

# Session/JWT
JWT_SECRET=   # atau NEXTAUTH_SECRET kalau pakai NextAuth
```

## Constraints

- Fitur kamera & lokasi butuh **HTTPS** (wajib juga untuk PWA) — tidak ada trade-off tambahan karena keduanya sama-sama butuh HTTPS.
- Serverless function Next.js (mis. di Vercel) punya limit payload request (~4.5MB) — ini salah satu alasan foto upload langsung client→Cloudinary, tidak lewat API route Next.js.
