# Product Context — eh-absence

## Kenapa Project Ini Ada

Kebutuhan mencatat kehadiran karyawan secara digital dengan bukti yang kredibel (lokasi + foto), menggantikan absensi manual/kertas atau sistem yang tidak punya bukti kehadiran fisik.

## Masalah yang Diselesaikan

- Memastikan karyawan benar-benar hadir di lokasi kerja saat absen (lewat GPS + selfie sebagai bukti), bukan sekadar klik tombol dari mana saja.
- Memberi HR/admin visibilitas & kontrol atas data kehadiran: bisa melihat, mengoreksi (kalau ada kesalahan/lupa absen), dan membuat laporan untuk keperluan payroll.
- Menghindari kebutuhan install aplikasi lewat App Store/Play Store di tahap awal — cukup buka web dan install sebagai PWA.

## Cara Kerja (High-Level)

**Karyawan:**
1. Login.
2. Tekan tombol absen → sistem minta foto selfie + otomatis ambil lokasi GPS.
3. GPS wajib aktif & izin lokasi wajib diberikan — kalau tidak, absen ditolak.
4. Tombol otomatis berubah dari "Check-in" ke "Checkout" setelah check-in berhasil; harus checkout dulu sebelum bisa check-in lagi.
5. Bisa lihat history absensi sendiri (read-only), per bulan.
6. Bisa kelola profile & ganti password sendiri.

**Admin/HR:**
1. Login terpisah dari karyawan (akun admin: username, password, nama — sederhana, tanpa email).
2. Kelola data karyawan (tambah/edit/nonaktifkan/hapus — hapus hanya Super Admin).
3. Kelola akun admin lain (hanya Super Admin yang bisa menambah admin baru).
4. Koreksi data absen kalau ada kesalahan (edit waktu, tambah manual dengan alasan wajib, hapus record) — foto & lokasi tidak bisa diedit, semua perubahan tercatat di audit log.
5. Lihat & export laporan absensi per karyawan per rentang tanggal (maks. 1 bulan), format Excel.

## User Experience Goals

- Proses absen harus **cepat dan sederhana** — buka app, foto, selesai (lokasi otomatis, tanpa input manual).
- Karyawan tidak boleh bisa memanipulasi bukti absen (foto/lokasi tidak bisa diedit sendiri, hanya bisa dikoreksi lewat admin dengan jejak audit).
- Admin butuh kontrol penuh untuk mengoreksi kesalahan manusiawi (lupa absen, lupa checkout) tanpa kehilangan akuntabilitas (audit log).
- Web terasa seperti app native di HP lewat PWA (installable, bisa dibuka tanpa buka browser dulu).

## Siapa Penggunanya

- **Karyawan**: pengguna harian, akses terbatas ke data milik sendiri.
- **Admin**: HR/staff yang mengelola data karyawan & absensi sehari-hari.
- **Super Admin**: admin dengan hak tambahan (hapus/nonaktifkan karyawan, tambah admin baru).
