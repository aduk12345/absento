# Cloudinary Schema — Penyimpanan Foto Absen (eh-absence)

## Struktur Folder

```
absence/
  {employeeId}/
    {yyyy-MM}/
      checkin_{timestamp}.jpg
      checkout_{timestamp}.jpg
```

Contoh nyata:
```
absence/emp_9f8a2c/2026-07/checkin_1752192000000.jpg
absence/emp_9f8a2c/2026-07/checkout_1752221400000.jpg
```

**Alasan struktur ini:**
- Per `employeeId` → gampang audit/lihat semua foto 1 karyawan, dan gampang dihapus semua sekaligus kalau karyawan di-delete (Manage Karyawan, Super Admin).
- Per bulan (`yyyy-MM`) di dalamnya → folder tidak membengkak jadi ribuan file dalam 1 folder (Cloudinary tetap bisa handle, tapi mempermudah browsing manual lewat Cloudinary dashboard kalau perlu cek manual), dan selaras dengan filter History/Report yang juga per bulan/range tanggal.

## Public ID (Naming Convention)

Format: `{type}_{unixTimestampMillis}`

- `type`: `checkin` atau `checkout`
- Timestamp dipakai sebagai bagian nama supaya **unik otomatis** (tidak perlu generate UUID terpisah) dan **berurutan** secara natural kalau di-sort by name.

Full public_id (termasuk folder) yang dikirim ke Cloudinary:
```
absence/{employeeId}/{yyyy-MM}/{type}_{timestamp}
```

## Metadata Tambahan (Context & Tags)

Cloudinary mendukung `context` (key-value metadata) dan `tags` per asset — dipakai untuk mempermudah pencarian/filter langsung dari Cloudinary API tanpa selalu bolak-balik ke Firestore.

**Tags** (untuk filter cepat):
- `employeeId:{id}`
- `type:checkin` atau `type:checkout`
- `source:employee` atau `source:admin` (selaras dengan field `source` di `absences`)

**Context:**
| Key | Value | Keterangan |
|---|---|---|
| `employeeId` | string | |
| `absenceId` | string | ID document Firestore terkait, untuk cross-reference |
| `type` | `checkin` \| `checkout` | |
| `source` | `employee` \| `admin` | |

## Upload Strategy — Signed Upload

- Upload dari client (browser) **langsung ke Cloudinary** (tidak lewat server dulu upload filenya — hemat bandwidth server), tapi pakai **signed upload**:
  1. Client minta signature ke Next.js API route (mis. `/api/cloudinary/sign`), kirim `public_id` yang akan dipakai (sudah termasuk folder + naming convention di atas) dan `timestamp`.
  2. API route generate signature pakai Cloudinary API Secret (aman, di server) — **tidak pernah expose API Secret ke client**.
  3. Client upload langsung ke Cloudinary Upload API dengan signature tersebut.
  4. Cloudinary mengembalikan `secure_url` → client kirim URL ini + data absen lain ke API route Next.js untuk disimpan ke Firestore (`checkinPhotoUrl`/`checkoutPhotoUrl`).

**Kenapa signed upload (bukan unsigned preset):**
- Public ID dikontrol server-side (sesuai naming convention), mencegah client asal generate nama file/folder sembarangan.
- Tetap tidak membebani server Next.js dengan proses upload file besar (upload file tetap langsung client → Cloudinary).

## Alur Lengkap: Foto → Cloudinary → Firestore

Menyambungkan proses upload foto (Cloudinary) dengan penyimpanan record absen (Firestore, lihat `docs/database-schema.md`):

```
1. Client ambil foto (getUserMedia) + lokasi (Geolocation API)
2. Client → POST /api/cloudinary/sign
              (kirim rencana public_id: absence/{employeeId}/{yyyy-MM}/{checkin|checkout}_{timestamp})
   API route → generate signature (Cloudinary API Secret, server-only) → return signature
3. Client → upload foto LANGSUNG ke Cloudinary (pakai signature)
   Cloudinary → return secure_url
4. Client → POST /api/absences/checkin  (atau /api/absences/checkout)
              (kirim: checkinPhotoUrl = secure_url, checkinLocation = {lat, lng})
5. API route (Firebase Admin SDK):
   - employeeId diambil dari SESSION (cookie/JWT) yang login, bukan dari body request
   - checkin: cek belum ada sesi checkin yang checkoutTime == null → jika ada, tolak
             → jika valid, CREATE document baru di `absences`
   - checkout: cari document absences dengan employeeId == X AND checkoutTime == null
             → UPDATE document itu (isi checkoutTime, checkoutPhotoUrl, checkoutLocation)
```

**Kenapa 2 request terpisah (upload foto tidak lewat API route Next.js)?**
- Upload foto client → Cloudinary langsung: menghindari serverless function Next.js menampung file besar (bisa kena limit payload, mis. Vercel ~4.5MB/request) dan menghindari double-hop (client → server → Cloudinary) yang lebih lambat.
- Simpan URL ke Firestore lewat API route: request ini ringan (cuma teks URL + koordinat), dan di sinilah validasi bisnis penting terjadi (cek sesi checkin/checkout aktif, employeeId dari session tepercaya — bukan dari client, supaya tidak bisa dipalsukan absen atas nama orang lain).

## Transformasi & Kompresi

Terapkan transformasi otomatis saat upload (lewat parameter `eager` atau `upload preset` transformation) supaya foto selfie tidak boros storage:

| Parameter | Value | Alasan |
|---|---|---|
| `quality` | `auto:good` | Kompresi otomatis tanpa terlihat rusak signifikan |
| `fetch_format` | `auto` | Cloudinary otomatis pilih format terbaik (WebP/AVIF) sesuai browser yang request |
| `width` | max `1280px` (resize kalau lebih besar, jaga aspect ratio) | Foto selfie dari kamera HP modern sering >3000px lebar — tidak perlu resolusi setinggi itu untuk keperluan verifikasi absen |

Estimasi ukuran per foto setelah kompresi: **~100–250KB** (dari kemungkinan 2-5MB foto asli kamera HP).

## Retensi & Penghapusan

- **Saat karyawan dihapus** (Super Admin, hard delete): folder `absence/{employeeId}/` beserta seluruh isinya dihapus dari Cloudinary juga (pakai Admin API `delete_resources_by_prefix`), supaya tidak ada foto orphan yang tetap makan storage.
- **Saat 1 record absen dihapus** (Manage Absence/Koreksi, `DELETE /api/absences/[id]`): foto `checkinPhotoUrl` dan/atau `checkoutPhotoUrl` milik record tersebut ikut dihapus dari Cloudinary (pakai Upload API `uploader.destroy`, public_id diekstrak balik dari `secure_url` yang tersimpan di Firestore), supaya tidak ada foto orphan per-record.
  - **Hard delete, permanen** — tidak ada trash/recycle bin di Cloudinary secara default (kecuali akun berlangganan fitur Backup add-on, di luar cakupan aplikasi ini). `invalidate: true` juga langsung membersihkan cache CDN untuk URL tsb.
  - **Best-effort**: kalau penghapusan foto di Cloudinary gagal (network error, foto sudah tidak ada, dsb), kegagalan ini **tidak** membatalkan penghapusan record di Firestore — hanya dicatat ke log server (`console.error`). Ini supaya fitur hapus absence tetap bisa dipakai walau Cloudinary sedang bermasalah.
- **Saat karyawan dinonaktifkan** (bukan dihapus): foto **tetap disimpan** (data historis tetap perlu ada untuk audit/report).
- **Kebijakan retensi jangka panjang** (misal auto-hapus foto setelah N bulan): belum diputuskan — dicatat sebagai open item.

## Ringkasan Environment Variables yang Dibutuhkan

```
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=   # server-side only, jangan pernah prefix NEXT_PUBLIC_
```

## Belum Diputuskan

- Kebijakan retensi/auto-delete foto lama.
- Apakah perlu simpan versi thumbnail terpisah (untuk list/table di halaman Report supaya loading lebih cepat) — bisa pakai Cloudinary transformation on-the-fly via URL (`w_100,h_100,c_fill`) tanpa perlu upload terpisah, kemungkinan ini yang dipakai.
