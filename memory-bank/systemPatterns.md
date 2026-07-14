# System Patterns — eh-absence

## Arsitektur Umum

Satu project Next.js (frontend + API routes/serverless functions) — tidak ada backend/server terpisah. Firestore & Cloudinary diakses lewat API routes di server, bukan langsung dari client (kecuali upload foto ke Cloudinary yang signed langsung dari client).

```
Client (browser/PWA)
  │
  ├─→ Next.js Pages/App Router (UI: /, /admin, dst)
  │
  ├─→ Next.js API Routes (server-side, Firebase Admin SDK)
  │     ├─→ Firestore (semua read/write data)
  │     └─→ Cloudinary Admin API (signature generation, delete resources)
  │
  └─→ Cloudinary Upload API (langsung, pakai signed upload dari API route)
```

## Pola Kunci

### 1. Semua Akses Firestore Lewat API Routes
Karena login custom (bukan Firebase Auth), tidak ada `auth.uid` di client untuk Firestore Security Rules. Maka **tidak ada akses client langsung ke Firestore** — semua lewat API routes dengan Firebase Admin SDK, otorisasi dicek manual berdasarkan session (cookie/JWT).

### 2. Upload Foto: Client → Cloudinary Langsung (Signed)
1. Client minta signature dari API route (`/api/cloudinary/sign`).
2. Client upload file langsung ke Cloudinary (menghindari limit payload serverless & double-hop).
3. Client kirim `secure_url` hasil upload ke API route lain untuk disimpan ke Firestore.

Detail: `docs/cloudinary-schema.md`.

### 3. Check-in/Check-out sebagai Satu Document (Bukan 2 Event Terpisah)
Satu siklus check-in→check-out disimpan sebagai **satu document** di collection `absences`, dengan field `checkoutTime: null` menandakan sesi masih berjalan.

- **Check-in** → CREATE document baru.
- **Check-out** → UPDATE document yang sama (cari berdasarkan `employeeId == X AND checkoutTime == null`).
- Aturan bisnis "harus checkout dulu sebelum checkin lagi" ditegakkan di API route dengan query ini sebelum membuat document baru.

### 4. Foto & Lokasi Immutable Setelah Dibuat
Field `checkinPhotoUrl`, `checkinLocation`, `checkoutPhotoUrl`, `checkoutLocation` **tidak pernah diedit** setelah pertama kali diisi — bahkan oleh admin. Koreksi absen (Manage Absence) hanya boleh mengubah **timestamp**, atau menambah/menghapus **seluruh record**.

### 5. Audit Trail untuk Semua Koreksi Admin
Setiap create/update/delete di collection `absences` yang dilakukan lewat halaman admin (Manage Absence) wajib menulis entry ke `absence_audit_logs` (before/after snapshot, adminId, timestamp, action).

### 6. Role-Based Access — 2 Level Admin
- `admin`: akses penuh ke Manage Absence, Report, tapi **tidak bisa** hapus/nonaktifkan karyawan.
- `super_admin`: semua akses `admin` + hapus & nonaktifkan karyawan + tambah akun admin baru.
- Dicek di setiap API route terkait (server-side), bukan di client.

### 7. Data Karyawan: Deactivate vs Delete
- **Nonaktifkan** (`status: inactive`): data & history tetap ada, dilakukan oleh admin biasa maupun super admin.
- **Hapus** (hard delete): data karyawan + seluruh foto di Cloudinary (`absence/{employeeId}/`) dihapus permanen — **hanya Super Admin**.

## Struktur Data (Ringkas — detail di `docs/database-schema.md`)

- `employees` — data karyawan
- `admins` — data admin (terpisah total dari employees)
- `absences` — record check-in/check-out per siklus
- `absence_audit_logs` — log koreksi admin terhadap `absences`

## Konvensi Penamaan Cloudinary

```
absence/{employeeId}/{yyyy-MM}/{checkin|checkout}_{unixTimestampMillis}
```

Detail: `docs/cloudinary-schema.md`.
