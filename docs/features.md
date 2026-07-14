# Spesifikasi Fitur — Aplikasi Absensi (eh-absence)

## Routing

- `absence.com` — halaman karyawan
- `absence.com/admin` — halaman admin

---

## Halaman Karyawan (`absence.com`)

3 menu utama: **Absen**, **History**, **Setting & Profile**

### 1. Halaman Absen

**Auth:**
- Belum login → redirect ke halaman login.
- Sudah login → masuk ke halaman absen.

**Flow Check-in:**
- Tekan tombol "Absen"/Check-in → wajib foto selfie dulu.
- Sistem otomatis ambil lokasi (Geolocation API) saat proses absen.
- **Pengecekan saat tekan tombol check-in**: cek apakah GPS aktif & izin lokasi diberikan.
  - Jika GPS mati / izin lokasi ditolak → **tidak bisa absen**, tampilkan pesan minta user mengaktifkan GPS dan/atau memberi izin akses lokasi di browser.
  - Tidak ada validasi radius/geofencing untuk saat ini (skip untuk versi awal).
- Tidak ada perhitungan status telat/tepat waktu — sistem hanya mencatat waktu (timestamp), tanpa aturan jam kerja.
- Setelah check-in berhasil → tombol berubah jadi "Checkout".

**Flow Check-out:**
- Sama seperti check-in: foto selfie + ambil lokasi otomatis.
- Cek GPS aktif & izin lokasi diberikan, sama seperti check-in.

**Aturan urutan:**
- Harus checkout dulu sebelum bisa checkin lagi (checkin baru diblokir kalau masih ada sesi checkin yang belum di-checkout).
- Tidak ada batasan jumlah siklus checkin-checkout per hari untuk sementara (bisa checkin-checkout berkali-kali dalam sehari).

**Data yang disimpan per absen:**
- userId
- Foto (checkin & checkout, terpisah)
- Lokasi (lat/long, checkin & checkout, terpisah)
- Timestamp (checkin & checkout)

### 2. Halaman History

- List/riwayat absensi karyawan, **filter per bulan**.
- Detail per absen mencakup:
  - Foto checkin & checkout
  - Lokasi di peta (checkin & checkout)
  - Durasi kerja (dihitung otomatis dari selisih checkin-checkout)
- **Read-only** — karyawan tidak bisa mengedit/koreksi data absen sendiri. Koreksi dilakukan lewat halaman admin.
- Filter status: belum ditentukan (belum ada definisi status apa saja — dibahas belakangan, kemungkinan terkait fitur izin/cuti di fase 2).

### 3. Halaman Setting & Profile

- **Detail karyawan**: read-only untuk saat ini (data diisi/dikelola admin/HR).
- **Ganti password**: perlu re-authentication dengan password lama sebelum bisa ganti password baru.
- **Logout**: logout biasa (single device), redirect ke `/login`.

---

## Halaman Admin (`absence.com/admin`)

4 menu utama: **Manage Karyawan**, **Manage Admin**, **Manage Absence**, **Report/History Absence**

### 1. Manage Karyawan

**Data karyawan:**
- Nama, email, no. HP, foto (opsional), password.
- Catatan: login karyawan nantinya bisa pakai email **atau** no. HP (fitur belakangan, dicatat sebagai catatan).

**Aksi:**
- Create, Read, Update untuk semua role admin.
- **Delete**: hanya **Super Admin**.
- **Nonaktifkan (deactivate)**: bisa dilakukan oleh **Admin biasa** maupun Super Admin.
- Password default akun baru: `123456789` (karyawan diharapkan ganti password sendiri lewat halaman profile).
- Versi awal: input satu-satu (belum ada bulk import Excel/CSV).

### 2. Manage Admin

**Role:**
- **Super Admin** dan **Admin** (biasa).
- Perbedaan hak akses saat ini **hanya** pada 2 hal: hapus karyawan & nonaktifkan karyawan (keduanya eksklusif untuk Super Admin — lihat Manage Karyawan poin Aksi di atas).
- Selain itu, semua fitur admin (Manage Absence, Report, dsb) bisa diakses kedua role secara sama.

**Penambahan admin baru:**
- Hanya **Super Admin** yang bisa menambah akun admin baru.

**Struktur akun:**
- Akun admin **terpisah total** dari akun karyawan (bukan 1 akun dengan 2 role — beda collection/tabel, beda proses login).
- Data akun admin: **username, password, nama** (data statis/sederhana, tanpa email/no. HP/foto).

### 3. Manage Absence (Koreksi)

**Cakupan koreksi — semua diperbolehkan:**
- Edit waktu checkin/checkout record yang sudah ada.
- Tambah record absen manual (misal karyawan lupa absen sama sekali).
- Hapus record absen — foto `checkinPhotoUrl`/`checkoutPhotoUrl` milik record yang dihapus ikut dihapus permanen dari Cloudinary (lihat `docs/cloudinary-schema.md` § Retensi & Penghapusan).

**Batasan:**
- **Foto dan lokasi tidak bisa diedit** oleh admin — hanya waktu (timestamp) dan record itu sendiri (tambah/hapus) yang bisa diubah.

**Field tambahan khusus absen via admin:**
- **Alasan** — wajib diisi setiap kali admin melakukan absen manual (bukan koreksi timestamp record existing, tapi menambahkan absen baru dari halaman admin) atas nama karyawan.

**Audit trail:**
- **Wajib ada log** untuk setiap perubahan: admin mana yang mengubah, kapan, dan record apa yang diubah (before/after value untuk timestamp, atau jenis aksi: tambah/edit/hapus).

### 4. Report / History Absence Karyawan

**Filter:**
- Per karyawan (pilih 1 karyawan).
- Per range tanggal — **maksimal rentang 1 bulan** per query (untuk membatasi beban query/export).

**Export:**
- Format **Excel** (.xlsx).

**Proposal tampilan awal (draft untuk didiskusikan):**

```
┌─────────────────────────────────────────────────────────────┐
│  Report Absensi                                               │
├─────────────────────────────────────────────────────────────┤
│  Karyawan: [ Dropdown/Search pilih 1 karyawan      ▼]         │
│  Rentang Tanggal: [ 01 Jul 2026 ] s/d [ 31 Jul 2026 ]         │
│  (maks. rentang 1 bulan)                    [ Tampilkan ]     │
├─────────────────────────────────────────────────────────────┤
│  Ringkasan:                                                    │
│  Total Hadir: 20 hari   |  Total Jam Kerja: 160 jam            │
├─────────────────────────────────────────────────────────────┤
│  Tanggal   | Checkin  | Checkout | Durasi | Lokasi  | Foto     │
│  01/07/26  | 08:02    | 17:05    | 9j 3m  | 📍Lihat | 📷📷      │
│  02/07/26  | 08:15    | 17:00    | 8j 45m | 📍Lihat | 📷📷      │
│  03/07/26  | 08:00    | -        | -      | 📍Lihat | 📷 -     │
│  ...                                                            │
├─────────────────────────────────────────────────────────────┤
│                                          [ Export Excel ⬇ ]    │
└─────────────────────────────────────────────────────────────┘
```

Catatan draft:
- Baris "03/07/26" contoh kasus checkout belum ada (masih pending / lupa checkout).
- Klik "Lihat" lokasi → buka peta (modal/popup) titik checkin & checkout.
- Klik ikon foto → preview foto checkin/checkout.
- "Ringkasan" di atas tabel bisa disesuaikan lagi setelah didiskusikan (mis. apakah perlu breakdown lain).

---

## Catatan Terbuka / Belum Diputuskan

- Definisi status pada history absen (misal terkait izin/cuti) — belum dipikirkan, kemungkinan fase lanjutan.
- Login karyawan via email atau no. HP — dicatat sebagai kebutuhan, implementasi menyusul.
- Radius/geofencing lokasi absen — di-skip untuk versi awal, kemungkinan ditambahkan nanti.
- Fake GPS / mock location detection — ditunda (lihat `tech-stack.md`).
