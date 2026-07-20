# Database Schema — Firestore (eh-absence)

Berdasarkan `docs/features.md`. Firestore adalah database NoSQL (document-based), jadi skema di bawah berbentuk collection & document, bukan tabel relasional.

## Collections

### `employees`

Data karyawan. Document ID = Firebase Auth UID.

| Field | Tipe | Keterangan |
|---|---|---|
| `name` | string | wajib diisi |
| `email` | string \| null | unique kalau diisi, dipakai untuk login |
| `username` | string | unique, alfanumerik saja, **dibuat otomatis saat create** (kata terakhir dari `name` + suffix angka acak — lihat catatan di bawah). Bisa diubah manual lewat Edit Karyawan (tetap divalidasi alfanumerik & unique) |
| `phone` | string \| null | unique kalau diisi, dipakai untuk login juga (alternatif dari email/username) |
| `photoUrl` | string \| null | opsional, URL Cloudinary |
| `password` | string | plain text untuk versi awal (technical debt, lihat catatan Auth di bawah) |
| `status` | `'active' \| 'inactive'` | default `active`; nonaktif via admin tidak menghapus data |
| `createdAt` | timestamp | |
| `updatedAt` | timestamp | |

### `admins`

Data admin. Terpisah total dari `employees`.

| Field | Tipe | Keterangan |
|---|---|---|
| `username` | string | unique |
| `name` | string | |
| `password` | string | plain text untuk versi awal (technical debt, lihat catatan Auth di bawah) |
| `role` | `'admin' \| 'super_admin'` | menentukan akses hapus/nonaktifkan karyawan |
| `createdAt` | timestamp | |

### Keputusan Auth — Custom login (bukan Firebase Authentication)

Login karyawan & admin **tidak** memakai Firebase Authentication. Login dilakukan lewat Next.js API route yang query Firestore langsung (pakai Firebase Admin SDK di server) dan mencocokkan email/username/no. HP (karyawan) atau username (admin) + password.

**Flow login:**
1. Client submit identifier (email/username/no. HP untuk karyawan, username untuk admin) + password ke API route `/api/auth/login`.
2. API route (Admin SDK, server-side) query collection `employees` berdasarkan `email`, lalu fallback `username`, lalu fallback `phone` (coba satu-satu sampai ketemu), baru query `admins` berdasarkan `username`.
3. Cocokkan password.
4. Kalau cocok → buat session (JWT di httpOnly cookie, atau NextAuth Credentials Provider) → redirect sesuai role.

**Catatan:** password disimpan plain text untuk versi awal (keputusan sementara demi kecepatan development). Detail hardening (hashing, dsb) dibahas belakangan, dicatat sebagai technical debt di bagian "Belum Diputuskan".

**Generate username otomatis (Manage Karyawan → Tambah Karyawan):** field Username tampil di form Tambah Karyawan, terisi otomatis dari kata terakhir `name` (kalau nama lebih dari 1 kata), lowercase, buang karakter non-alfanumerik, + suffix 4 digit angka acak (mis. nama "Budi Santoso" → `santoso4821`). Ada tombol refresh di sebelah field untuk generate ulang saran acak (client-side, tidak hit server), dan admin tetap bisa mengetik/ubah manual sebelum submit. Uniqueness final tetap divalidasi di server saat submit (`POST /api/employees` — kalau bentrok balikin 409 "Username sudah terdaftar", admin generate ulang atau ketik manual lalu submit ulang). Kalau field dikosongkan saat submit, server fallback generate sendiri (retry maks. 10x). Username tetap bisa diubah lagi kapan saja lewat Edit Karyawan.

### `absences`

Record absen (checkin & checkout dalam 1 document per siklus).

| Field | Tipe | Keterangan |
|---|---|---|
| `employeeId` | string (ref → `employees`) | |
| `checkinTime` | timestamp | |
| `checkinPhotoUrl` | string | URL Cloudinary |
| `checkinLocation` | `{ lat: number, lng: number }` | |
| `checkoutTime` | timestamp \| null | null selama belum checkout |
| `checkoutPhotoUrl` | string \| null | |
| `checkoutLocation` | `{ lat: number, lng: number } \| null` | |
| `source` | `'employee' \| 'admin'` | `'admin'` kalau dibuat manual dari halaman admin |
| `reason` | string \| null | **wajib diisi** kalau `source = 'admin'` |
| `status` | `'complete' \| 'incomplete'` | opsional (absen tanpa field ini dianggap `'complete'`). `'incomplete'` = checkout dibuat otomatis oleh sistem karena hari sudah berganti sebelum karyawan checkout, bukan checkout asli — `checkoutPhotoUrl`/`checkoutLocation` selalu `null` untuk record `incomplete` |
| `createdAt` | timestamp | |
| `updatedAt` | timestamp | |

**Aturan "beda hari, belum checkout" (ditegakkan di server, saat aksi ditekan):**
- Karyawan tekan **Checkin** tapi masih ada sesi aktif (`checkoutTime == null`) dari **hari sebelumnya** (dibandingkan pakai zona waktu `Asia/Jakarta`, lihat `src/lib/date.ts`) → sesi lama otomatis di-checkout dengan `status: 'incomplete'` (tanpa foto/lokasi), baru checkin baru dibuat. Kalau sesi aktifnya masih hari yang sama → tetap ditolak 409 seperti sebelumnya.
- Karyawan tekan **Checkout** tapi sesi aktifnya ternyata dari hari sebelumnya (kasus: halaman terbuka melewati tengah malam sebelum sempat sinkron ulang) → sesi lama tetap ditutup sebagai `incomplete`, foto/lokasi yang baru diambil **tidak dipakai** (bukan milik sesi lama itu).
- Client (`AbsenPanel.tsx`) sudah punya watcher (`setTimeout` ke tengah malam + listener `visibilitychange`/`focus`) supaya tombol otomatis balik ke "Check-in" tanpa reload — safety net server di atas tetap ada untuk kasus race/edge.

**Query pattern penting:**
- Cek "apakah karyawan X masih punya sesi checkin yang belum checkout" → query `where employeeId == X AND checkoutTime == null`, harus ada composite index.
- History per bulan → query `where employeeId == X AND checkinTime >= startOfMonth AND checkinTime <= endOfMonth`.

### `leave_requests`

Pengajuan izin karyawan (fitur ditambahkan setelah MVP awal — awalnya di luar scope, lihat `projectbrief.md`).

| Field | Tipe | Keterangan |
|---|---|---|
| `employeeId` | string (ref → `employees`) | |
| `startDate` / `endDate` | string (`yyyy-MM-dd`) | rentang izin, inklusif kedua ujung |
| `totalDays` | number | dihitung server-side, inklusif (`endDate - startDate + 1`), tidak dipercaya dari client |
| `reason` | string | wajib diisi |
| `attachmentUrl` | string \| null | opsional, URL Cloudinary (belum ada UI upload) |
| `status` | `'pending' \| 'approved' \| 'rejected'` | |
| `source` | `'employee' \| 'admin'` | `'employee'` selalu masuk `pending` (butuh approval); `'admin'` (dari Manage Absence → Tambah Izin) langsung `approved` |
| `reviewedBy` | string \| null (ref → `admins`) | admin yang approve/reject |
| `reviewedAt` | timestamp \| null | |
| `reviewNote` | string \| null | catatan admin, terutama saat reject |
| `createdAt` / `updatedAt` | timestamp | |

**Query pattern**: `where employeeId == X` (+ `where status == 'approved'` untuk Report/History) — filter tanggal dilakukan client-side setelah fetch (skala data kecil per karyawan), bukan composite range query di Firestore.

**Catatan Report/History**: hari yang tercakup izin `approved` ditampilkan sebagai baris/badge "Izin" terpisah dari record `absences` (bukan menggantikan/mengisi field di `absences`) — lihat `src/lib/leave.ts` (`getApprovedLeavesInRange`, `overlapDays`).

### `absence_audit_logs`

Log setiap perubahan absen dari halaman admin (wajib ada, sesuai kesepakatan).

| Field | Tipe | Keterangan |
|---|---|---|
| `absenceId` | string (ref → `absences`) | |
| `adminId` | string (ref → `admins`) | |
| `action` | `'create' \| 'update' \| 'delete'` | |
| `beforeData` | object \| null | snapshot sebelum perubahan (null kalau action = create) |
| `afterData` | object \| null | snapshot sesudah perubahan (null kalau action = delete) |
| `timestamp` | timestamp | |

---

## Akses Data — Semua Lewat API Routes

Karena login pakai custom auth (bukan Firebase Authentication), client **tidak punya** `request.auth`/`auth.uid` dari Firebase. Konsekuensinya: Firestore Security Rules berbasis auth context tidak berlaku, sehingga **semua read & write ke Firestore dilakukan lewat Next.js API routes** (Firebase Admin SDK di server) — client tidak mengakses Firestore secara langsung sama sekali. Otorisasi (siapa boleh akses apa) dicek manual di tiap API route berdasarkan session (JWT/cookie) milik user yang login.

Detail hardening keamanan (rules, validasi session, dsb) dibahas belakangan.

---

## Implikasi ke Arsitektur "Tanpa Backend Sendiri"

Beberapa operasi di atas **tidak bisa** murni dari client Firestore SDK dan **wajib** lewat Next.js API routes (pakai **Firebase Admin SDK**, bukan client SDK):
- Membuat akun karyawan/admin baru dengan password custom.
- Update/delete `absences` (checkout, koreksi admin, hapus record).
- Semua write ke `absence_audit_logs`.
- Hapus/nonaktifkan karyawan (butuh cek role Super Admin di server, tidak bisa dipercaya dari client).

Ini tetap sesuai prinsip awal ("tanpa backend/project server terpisah") karena semua API routes ini tetap hidup di dalam project Next.js yang sama (serverless functions), bukan server/project baru.

---

## Belum Diputuskan

- Index composite yang dibutuhkan di Firestore (akan jelas setelah query pattern final saat implementasi).
- Struktur `checkinLocation`/`checkoutLocation` — simpan sebagai `GeoPoint` (tipe native Firestore) atau object `{lat, lng}` biasa. `GeoPoint` lebih idiomatic tapi object biasa lebih fleksibel untuk ditampilkan di peta (Leaflet/Google Maps) — bisa diputuskan saat implementasi.
