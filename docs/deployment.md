# Deployment

## Ringkasan

Aplikasi sudah **live di production** di Vercel. Deploy berjalan otomatis lewat
**Vercel GitHub integration**: setiap push ke repo (`aduk12345/absento`) memicu build
dan langsung mengubah production. Tidak ada `vercel.json`, `Dockerfile`, atau GitHub
Actions di repo — seluruh konfigurasi deploy (env var, production branch, domain,
build setting) tinggal di **dashboard Vercel**, bukan di kode. Karena itu setup ini
tidak meninggalkan jejak apa pun di repo, dan sempat tidak terdokumentasi sama sekali.

## Cara deploy

```bash
git push        # itu saja — Vercel auto-build & deploy
```

Tidak ada langkah manual, tidak perlu Vercel CLI. Build yang dijalankan Vercel
setara `npm run build`; pastikan sukses lokal dulu sebelum push:

```bash
npm run build && npx tsc --noEmit && npx eslint src/
```

## Kondisi branch saat ini (per 2026-09-30)

| Branch | Status |
|---|---|
| `dev` | branch kerja aktif; sinkron dengan `main` (commit sama) |
| `main` | sinkron dengan `dev` |
| `master` | **basi** — masih di `Initial commit` (4659391), tidak dipakai |

`dev` dan `main` menunjuk commit yang identik, jadi **tidak ada pemisahan
staging/production di level git**: push = langsung kena production, tanpa tahap
review. Kalau ingin ada rem: set production branch di Vercel ke `main`, kerjakan
perubahan di `dev` (otomatis dapat preview URL), lalu promote dengan merge
`dev` → `main`.

## Environment variables

`.gitignore` memblok `.env*`, jadi `.env.local` **tidak ikut ter-push** dan hanya ada
di mesin lokal. Konsekuensinya: **menambah env var baru wajib dilakukan dua kali** —
di `.env.local` (untuk dev) DAN di Vercel dashboard (Settings → Environment
Variables). Kalau lupa yang kedua, deploy gagal build atau error saat runtime.

7 env var yang dipakai aplikasi (semuanya server-side, tidak ada `NEXT_PUBLIC_*`,
jadi tidak ada yang ter-bundle ke client):

```
FIREBASE_PROJECT_ID
FIREBASE_CLIENT_EMAIL
FIREBASE_PRIVATE_KEY      # newline harus tetap \n escaped, dalam tanda kutip
CLOUDINARY_CLOUD_NAME
CLOUDINARY_API_KEY
CLOUDINARY_API_SECRET
JWT_SECRET
```

`FIREBASE_PRIVATE_KEY` adalah penyebab gagal deploy paling umum: nilainya harus
di-paste dengan `\n` literal (seperti di `.env.local`), bukan newline asli.

File env lokal:
- `.env.local` → Firebase **production**, dipakai `npm run dev`
- `.env.dev.local` → Firebase **dev** (`absence-dev-c16ce`), dipakai `npm run dev:dev`

## Yang hanya bisa diuji di production

Beberapa hal mati atau berbeda di dev mode, jadi verifikasinya harus setelah deploy:

- **Service worker / PWA** — di-gate `NODE_ENV === "production"`, jadi caching dan
  install-to-homescreen baru aktif di production build.
- **Kamera & geolocation** — butuh origin secure (HTTPS atau `localhost`). Di
  production aman karena Vercel selalu HTTPS.
- **Timezone** — server Vercel jalan di UTC, bukan WIB. `src/lib/date.ts` sudah
  menangani ini secara eksplisit; kalau menyentuh logika tanggal, cek checkin dini
  hari (00:00–06:59 WIB) masuk ke tanggal yang benar di Report/History.

## Technical debt yang masih terbawa ke production

- **Password plain text** di Firestore, belum di-hash (lihat `memory-bank/techContext.md`).
- **Data uji** masih tercampur di Firestore production — karyawan test, admin
  `testadmin1`, sejumlah record `absences` & `absence_audit_logs`
  (lihat `memory-bank/progress.md`).
- **Icon PWA** masih placeholder generated, belum logo asli.

## Belum terdokumentasi

Butuh konfirmasi dari pemegang akun Vercel:

- URL production (domain custom atau `*.vercel.app`)
- Branch mana yang diset sebagai production branch di Vercel
- Apakah ada preview deployment terpisah yang memakai env `.env.dev.local`
- Akun/team Vercel pemegang project

Untuk mengambil data ini langsung dari Vercel: `npm i -g vercel && vercel login &&
vercel link`, lalu `vercel project ls`, `vercel env ls`, `vercel domains ls`.
