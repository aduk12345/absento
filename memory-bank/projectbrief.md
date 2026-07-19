# Project Brief — eh-absence

## Nama Project

eh-absence (kode/repo). **Nama brand/produk: SJB Attendance** (sebelumnya "Absento", diganti 2026-07-19 atas permintaan eksplisit user).

## Ringkasan

Aplikasi absensi berbasis web (PWA, installable) untuk karyawan, dengan fitur absen menggunakan lokasi GPS + foto selfie. Direncanakan ada versi mobile native di masa depan (kemungkinan React Native/Expo agar tetap satu bahasa JavaScript).

## Routing Utama

- `absence.com` — halaman karyawan (self-service absen)
- `absence.com/admin` — halaman admin/HR (manajemen & koreksi data)

## Tujuan Inti

- Mencatat kehadiran karyawan (check-in/check-out) dengan bukti lokasi GPS dan foto selfie saat itu juga.
- Menyediakan dashboard admin untuk mengelola karyawan, mengelola akun admin, mengoreksi data absen, dan membuat laporan absensi.
- Web app bisa di-install sebagai PWA di HP karyawan, tanpa harus lewat App Store/Play Store dulu (setidaknya untuk versi awal).

## Scope Versi Awal (MVP)

**Termasuk:**
- Login karyawan & admin (custom login: query database, cocokkan username/email + password — bukan Firebase Authentication).
- Check-in/check-out dengan foto selfie + lokasi wajib (tanpa validasi radius geofencing untuk versi awal).
- History absen per karyawan (read-only, filter per bulan).
- Profile karyawan (read-only + ganti password).
- Manage karyawan, manage admin, koreksi absen manual, dan report/export Excel di halaman admin.
- PWA installable.

**Di luar scope versi awal (dicatat untuk fase lanjutan):**
- Radius/geofencing validasi lokasi absen.
- Deteksi fake GPS / mock location.
- Fitur izin/cuti.
- Password hashing (saat ini plain text — technical debt yang wajib diperbaiki sebelum production sungguhan).
- Aplikasi mobile native terpisah.
- Multi-cabang/multi-lokasi kantor, shift kerja.

## Dokumen Sumber

Project brief ini disusun berdasarkan hasil diskusi yang didokumentasikan di:
- `docs/tech-stack.md`
- `docs/features.md`
- `docs/database-schema.md`
- `docs/cloudinary-schema.md`

Dokumen-dokumen tersebut tetap menjadi rujukan detail; file-file di `memory-bank/` merangkum dan menyusunnya ke format yang lebih siap dipakai untuk konteks kerja berkelanjutan.
