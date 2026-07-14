# Project Progress — eh-absence

## Current Phase: Phase 3 — Implementasi Business Logic
**Objective**: Mengisi halaman placeholder dengan logic sungguhan.
**Status**: SEMUA fitur inti sudah diimplementasikan DAN terverifikasi jalan (dikerjakan tim paralel: riset + coding-1 + coding-2 + testing, lalu 2 composite index Firestore dibuat manual oleh user untuk resolve bug 500). 17/17 skenario PASS setelah index kedua dibuat.

### Phase Checklist
- [x] API routes & UI Manage Karyawan (`/api/employees`, `EmployeesTable.tsx`)
- [x] API routes & UI check-in/check-out (`AbsenPanel.tsx`, kamera + geolocation + Cloudinary signed upload)
- [x] **Manage Admin**: `/api/admins`, `/api/admins/[id]`, `AdminsTable.tsx` — create/edit/delete dibatasi `super_admin`, list tidak pernah expose field `password`. Semua PASS.
- [x] **Manage Absence**: `/api/absences`, `/api/absences/[id]`, `AbsencesTable.tsx`, `src/lib/audit.ts` — reason wajib untuk absen manual, foto/lokasi ditolak saat edit (400), setiap create/update/delete tercatat di `absence_audit_logs` (before/after snapshot benar). Semua PASS.
- [x] **Report**: `/api/report`, `/api/report/export` (pakai `exceljs`), `ReportView.tsx` — validasi range maks 31 hari PASS, query data PASS (200, summary+records benar), export PASS (file `.xlsx` valid, terverifikasi `file` command = "Microsoft Excel 2007+", header Content-Disposition/Content-Type benar).
- [x] **History**: `/api/absences/mine`, `HistoryList.tsx` — employeeId dari session (aman dari akses silang), PASS (200).
- [x] **Profile**: `/api/auth/change-password`, `ProfileForm.tsx` — semua skenario PASS.
- [x] UI kit modern (`src/components/ui/Card.tsx`, `Button.tsx`, `Badge.tsx`, `Input.tsx`) dipakai konsisten di semua fitur baru sesuai permintaan user ("jangan flat, seperti app tren saat ini").
- [x] Build gabungan sukses: 24 route, 0 error TypeScript/compile.
- [x] **2 composite Firestore index dibuat** di collection `absences`: (1) `employeeId` ASC + `checkinTime` DESC — dipakai History; (2) `employeeId` ASC + `checkinTime` ASC — dipakai Report & Report Export. Keduanya sudah "Enabled" dan diverifikasi lewat re-test API, semua 200.

### Phase Completion Criteria
- [x] Bug nyata ditemukan & fixed saat test browser sungguhan: **"Invalid Signature" dari Cloudinary saat upload foto checkin/checkout**. Root cause: `quality` bukan parameter upload langsung yang sah untuk Cloudinary (harus lewat `transformation`). Fixed: `transformation: "q_auto:good,w_1280,c_limit"` di kedua sisi (`src/app/api/cloudinary/sign/route.ts` dan `src/components/AbsenPanel.tsx`) — field & value HARUS persis sama di kedua tempat. Diverifikasi user: upload foto checkin/checkout sudah berhasil di browser sungguhan.
- [x] Fix tambahan: `deleteEmployeePhotos()` di `src/lib/cloudinary.ts` sekarang selalu pakai `{ invalidate: true }` supaya CDN cache Cloudinary ikut di-invalidate saat hapus foto lewat aplikasi (bukan cuma delete dari storage).
- [ ] Konfirmasi asumsi Manage Admin (edit/delete dibatasi super_admin) ke user — masih asumsi kerja tim, belum dikonfirmasi eksplisit.

## Phase 5: UI Overhaul (Selesai) ✅
**Trigger**: User eksplisit minta desain dirombak total — "sangat flat", minta referensi app absensi modern (Kerjoo dkk), dan **dark mode dimatikan total** (paksa light mode terlepas dari setting device).

**Yang dikerjakan:**
- [x] Install `lucide-react` untuk ikon (sebelumnya tidak ada ikon sama sekali, cuma teks).
- [x] `globals.css`: dark mode dihapus total — `color-scheme: light only` di `:root` & `html`, tidak ada lagi blok `@media (prefers-color-scheme: dark)`. **Aturan project baru: JANGAN PERNAH tambahkan class `dark:` atau blok `prefers-color-scheme: dark` lagi di komponen manapun** — ini keputusan produk eksplisit dari user.
- [x] `layout.tsx`: `viewport.colorScheme = "light"` + inline `style={{ colorScheme: "light" }}` di tag `<html>` untuk memaksa browser native UI (scrollbar, form control) juga light.
- [x] Palet warna diganti total dari `zinc`/`blue` → `slate`/`indigo`+`violet` (brand color `#4f46e5`), konsisten di `manifest.json` & meta theme-color juga.
- [x] UI kit (`src/components/ui/`) dirombak: `Card`, `Button`, `Badge`, `Input` di-redesign (shadow lebih dalam, gradient di Button primary/danger, rounded lebih besar), ditambah 2 komponen baru: `Avatar.tsx` (avatar bulat dengan warna konsisten per-nama atau foto asli) dan `StatCard.tsx` (kartu statistik dengan ikon berwarna, dipakai di dashboard admin & Report).
- [x] `BottomNav.tsx` (karyawan) & `AdminNav.tsx` (admin, sekarang jadi sidebar dengan highlight halaman aktif via `usePathname`) — keduanya sekarang pakai ikon `lucide-react`, bukan teks polos.
- [x] Halaman `/login`: full redesign — logo brand, background gradient lembut, card dengan shadow dalam.
- [x] Halaman `/` (Absen): hero card gradient ungu dengan tombol lingkaran besar bergaya "shutter" kamera, badge status, avatar + greeting di header.
- [x] `AbsenPanel.tsx`: tombol & state kamera diselaraskan dengan tema gradient (tombol putih di atas background ungu).
- [x] Semua tabel admin (`EmployeesTable`, `AdminsTable`, `AbsencesTable`) dirombak: avatar di setiap baris, badge status berwarna, action button jadi icon+text link (bukan tombol kotak polos).
- [x] `ReportView.tsx`: ringkasan summary sekarang pakai `StatCard` (ikon + angka besar) alih-alih teks polos.
- [x] `HistoryList.tsx`, `ProfileForm.tsx` (profile card dengan banner gradient + avatar).
- [x] Dashboard admin (`/admin`) yang tadinya kosong sekarang berisi 3 `StatCard` real (karyawan aktif, absen hari ini, total admin) dari query Firestore langsung.
- [x] Verifikasi: `npm run build` sukses (24 route, 0 error), `npx eslint src/` bersih (cuma 2 warning pre-existing tidak terkait).

**Belum dilakukan:**
- [ ] Icon PWA (`public/icons/icon-192.png`, `icon-512.png`) masih placeholder lama, belum diselaraskan dengan warna brand baru (`#4f46e5`).

## Phase 6: Fix Responsive Desktop Layout (Selesai) ✅
**Trigger**: User lapor UI selalu tampil seperti mobile app sempit yang mengambang di tengah, walau dibuka di browser laptop lebar — karena halaman karyawan (`/`, `/history`, `/profile`) tidak punya shell desktop, cuma card sempit (`max-w-sm`) tanpa sidebar, beda dengan halaman admin yang sudah punya sidebar (`AdminNav`) sejak awal.

**Yang dikerjakan:**
- [x] `src/components/EmployeeNav.tsx` (BARU) — sidebar desktop untuk area karyawan, `hidden lg:flex` (cuma tampil di layar lebar), styling konsisten dengan `AdminNav.tsx` (logo, 3 menu dengan ikon, highlight halaman aktif via `usePathname`).
- [x] `src/components/BottomNav.tsx` — ditambah `lg:hidden`, jadi cuma tampil di mobile/tablet sempit; di desktop digantikan `EmployeeNav`.
- [x] `src/app/page.tsx`, `src/app/history/page.tsx`, `src/app/profile/page.tsx` — dibungkus layout `flex` baru: `EmployeeNav` (kiri, desktop-only) + kolom konten (header + main + `BottomNav` mobile-only). Konten History/Profile dilebarkan pakai `mx-auto max-w-3xl`/`max-w-2xl` supaya proporsional di layar lebar (bukan `max-w-sm` sempit seperti sebelumnya).
- [x] Halaman Absen (`page.tsx`): hero card gradient tetap berupa card terpusat (`max-w-sm` mobile → `lg:max-w-md` desktop) — ini disengaja (form capture foto memang tidak perlu selebar mungkin), tapi sekarang berada di dalam shell sidebar+header yang mengisi sisa layar, bukan mengambang sendirian di tengah viewport kosong.
- [x] Login page (`/login`) TIDAK diubah — card login terpusat di atas background gradient full-bleed itu pola desktop yang wajar (mirip Notion/Linear), bukan bagian dari keluhan "seperti mobile".
- [x] Verifikasi: `npm run build` sukses (24 route), `npx eslint src/` bersih.

**Catatan**: user tampaknya juga sudah menambahkan fitur baru di luar sesi ini (terdeteksi lewat file `AbsenPanel.tsx`, `HistoryList.tsx` berubah) — ada `LocationMap` (Leaflet, dynamic import `ssr:false`) dan `Modal` component baru yang belum didokumentasikan di sini. Perlu di-review/didokumentasikan di sesi berikutnya kalau relevan.

## Phase 7: Redesign Halaman Absen — Full-Screen Map (Selesai) ✅
**Trigger**: User minta tampilan awal halaman Absen dirombak: background full-screen map dengan titik lokasi, tombol check-in/checkout di tengah layar, header kiri diganti nama aplikasi, greeting+tanggal dipindah jadi overlay pojok kiri, badge "Status Hari Ini" digabung ke overlay yang sama. Dikerjakan via tim (`timku`): riset → 1 coding teammate (riset merekomendasikan TIDAK dipecah 2 paralel karena scope kecil & saling terkait erat secara visual) → verifikasi langsung oleh leader.

**Yang dikerjakan:**
- [x] `src/components/LocationMap.tsx` (Leaflet — ini yang tadinya "fitur di luar sesi", sekarang terdokumentasi resmi) — ditambah prop opsional `className` (default `"h-40 w-full"`), backward-compatible dengan pemakaian existing di `AbsenPanel.tsx`/`HistoryList.tsx`.
- [x] `src/components/AbsenMapBackground.tsx` (BARU, client) — fetch lokasi sendiri saat mount (`useEffect` + `getCurrentPosition`, terpisah dari fungsi lokasi di `AbsenPanel.tsx` yang dipakai khusus proses checkin/checkout), 3 state (`loading` skeleton pulse, `error` + tombol "Coba Lagi", `success` render `LocationMap` full-screen dengan scrim gradient tipis untuk kontras).
- [x] `src/app/page.tsx` — header kiri ganti jadi logo+nama app "eh-absence" (bukan lagi greeting); `main` jadi `relative overflow-hidden` berisi `AbsenMapBackground` (z-0) + panel overlay pojok kiri atas (greeting, tanggal, badge status — frosted glass `bg-white/80 backdrop-blur-md`) + `AbsenPanel` di-center absolut di tengah (z-10). `EmployeeNav`/`BottomNav` tidak disentuh.
- [x] `src/components/AbsenPanel.tsx` — HANYA styling (logic checkin/checkout/kamera/lokasi/upload Cloudinary tidak diubah sama sekali, diverifikasi manual oleh leader): step `camera` & `submitting` dibungkus panel `bg-slate-900/80 backdrop-blur-lg` supaya tetap kontras di atas map (sebelumnya mengandalkan card gradient ungu yang sekarang sudah dihapus dari `page.tsx`). Step `idle` (tombol bulat putih) tidak berubah.
- [x] Verifikasi leader: `npm run build` sukses (24 route), `npx eslint src/` bersih (0 error, cuma 2 warning pre-existing tidak terkait), grep konfirmasi semua fungsi bisnis inti (`handleStart`, `handleCapture`, `getLocation`, `uploadToCloudinary`, `submitAbsence`) masih utuh di `AbsenPanel.tsx`.

**Follow-up polish (dikerjakan langsung, tanpa tim — cuma penyesuaian visual kecil):**
- [x] User bilang header/info panel/tombol check-in "kaku" → di-refresh: tombol check-in sekarang gradient (indigo→violet untuk checkin, orange→rose untuk checkout) dengan efek ring pulsing (`animate-ping`) di sekitarnya; panel info pojok kiri atas ditambah pill tanggal dengan ikon `CalendarDays`, greeting lebih besar/bold, badge status dengan dot berkedip (`animate-ping`) khusus saat "Sedang Bekerja"; header dapat `shadow-sm` + border logo `ring-2`.
- [x] User tanya opsi tile map lain (masih pakai Leaflet) → ganti dari OSM default ke **CARTO Voyager** (gratis, tanpa API key, tampilan pastel lebih bersih untuk overlay UI) di `src/components/LocationMap.tsx`. **PENTING**: `attributionControl` yang sebelumnya dimatikan (`false`) HARUS diaktifkan lagi — CARTO basemap gratis mewajibkan atribusi ditampilkan (syarat pemakaian), jadi jangan pernah set `attributionControl={false}` lagi di komponen ini kalau masih pakai tile CARTO.
- [x] Verifikasi ulang: build + lint bersih setelah kedua perubahan di atas.
- [x] User sempat minta ganti tile ke CARTO Dark Matter, lalu minta dikembalikan lagi ke Voyager — final: **CARTO Voyager** tetap yang dipakai.
- [x] `LocationMap.tsx` ditambah prop `interactive` (default `false`, backward-compatible) — mengontrol `dragging`/`scrollWheelZoom`/`doubleClickZoom`/`touchZoom`/`zoomControl` Leaflet sekaligus. `AbsenMapBackground.tsx` (full-screen map di halaman Absen) pakai `interactive` (bisa digeser/zoom); preview kecil di `AbsenPanel.tsx` step kamera & `HistoryList.tsx` TETAP statis (tidak diubah, default `false`).
- [x] Fix bug tersembunyi yang ditemukan saat implementasi drag: wrapper `absolute inset-0` pembungkus tombol check-in di `page.tsx` menutupi seluruh layar dan diam-diam memblokir drag peta di area kosong (div penuh layar tanpa `pointer-events-none` selalu menangkap pointer event walau visualnya kosong). Fixed: `pointer-events-none` di wrapper, `pointer-events-auto` cuma dibungkus langsung di sekitar `AbsenPanel`.
- [x] User minta atribusi peta dihapus — **DITOLAK sebagian**: atribusi CARTO wajib secara lisensi (tidak boleh dihapus total), tapi disepakati dibuat sangat kecil/samar (`globals.css` — `.leaflet-control-attribution`: font-size 8px, opacity 0.45, transparent, opacity naik jadi 0.9 saat hover). **Aturan project baru: JANGAN PERNAH hapus/matikan attribution TileLayer di `LocationMap.tsx` atau set `display:none` di CSS attribution — cuma boleh diperkecil/disamarkan.**
- [x] Tombol zoom bawaan Leaflet (defaultnya top-left) dipindah ke **bottom-right** via `<ZoomControl position="bottomright" />` (bukan prop `zoomControl` boolean lagi) — sebelumnya tertutup/bentrok dengan panel info yang juga di pojok kiri atas.
- [x] Tombol **"kembali ke lokasi saya"** (ikon `LocateFixed`) ditambahkan di atas tombol zoom (pojok kanan bawah) — pakai `mapRef` (via `ref` prop `MapContainer`, react-leaflet v4) + `map.flyTo([lat,lng], 16)`. Cuma muncul saat `interactive=true`.
- [x] `LocationMap.tsx` sekarang dibungkus `<div className={\`relative ${className}\`}>` (perlu untuk positioning absolut tombol recenter) — `MapContainer` sendiri selalu `className="h-full w-full"` mengisi div pembungkus itu.
- [x] Panel overlay info (tanggal/greeting/status) di `page.tsx` di-redesign lebih modern: kartu `rounded-[28px]` dengan glow gradient blur dekoratif di pojok, ikon Sparkles gradient (bukan Avatar lagi — hindari duplikasi visual dengan Avatar di header), greeting+tanggal disatukan 1 blok, status jadi strip terpisah dengan gradient halus (bukan cuma badge pill polos).
- [x] Bug ditemukan user: gesture pinch **cuma bisa zoom-out**, zoom-in tidak jalan. Root cause kemungkinan besar: peta dirender di dalam container `absolute inset-0` (full-screen background) yang ukurannya baru final setelah layout browser selesai — Leaflet sempat mengukur ukuran container yang belum stabil saat inisialisasi, bikin perhitungan titik pusat gesture (terutama arah zoom-in) salah. **Fixed**: `useEffect` panggil `mapRef.current.invalidateSize()` ~100ms setelah mount (cuma saat `interactive=true`) — ini fix standar untuk Leaflet di container yang ukurannya dinamis/absolute-positioned. Sekalian set `minZoom={3}`/`maxZoom={19}` eksplisit di `MapContainer` & `TileLayer` biar tidak ada batas zoom yang ambigu.

**Belum dilakukan**: review visual langsung di browser oleh user (perubahan ini murni layout/styling + fetch lokasi baru, belum di-screenshot manual — terutama perlu dicek pengalaman izin lokasi ganda: sekali saat halaman dibuka untuk `AbsenMapBackground`, sekali lagi saat user tekan tombol check-in untuk `AbsenPanel` — browser modern hanya prompt sekali per origin jadi seharusnya tidak mengganggu, tapi perlu dikonfirmasi di device asli).

**Catatan tambahan (di luar sesi ini, terdeteksi lewat kode)**: `AbsenMapBackground.tsx` sekarang punya `SURABAYA_FALLBACK` — kalau lokasi gagal/ditolak, map tetap tampil (arah ke Surabaya, bukan lokasi asli user) dengan notice non-blocking + tombol "Coba Lagi", bukan blank error state seperti versi awal. Perlu didokumentasikan resmi kalau ada sesi kerja lanjutan di area ini.

## Fix: Penanganan Izin Lokasi Diblokir ("Never Allow") ✅

**Trigger**: User lapor saat checkin pilih "Never allow" untuk izin lokasi di browser, klik checkin lagi tidak memunculkan prompt izin lagi (tidak jelas kenapa macet).

**Root cause**: Perilaku standar browser by design — begitu origin di-block untuk lokasi, `getCurrentPosition()` selalu gagal instan dengan `error.code === PERMISSION_DENIED` tanpa pernah menampilkan prompt izin lagi (tidak bisa dipicu ulang lewat JS, cuma bisa diubah manual oleh user lewat setting browser). Sebelumnya `getLocation()` di `AbsenPanel.tsx` dan `fetchLocation()` di `AbsenMapBackground.tsx` membuang detail `error.code` dan selalu menampilkan pesan generik yang menyiratkan tinggal "coba lagi".

**Fix**:
- `src/lib/geolocation.ts` (BARU) — `getGeolocationErrorMessage(error: GeolocationPositionError)`, membedakan pesan per `error.code`: `PERMISSION_DENIED` dapat instruksi eksplisit ("klik ikon gembok → Site settings → Location → Allow, lalu muat ulang"), `POSITION_UNAVAILABLE` dan timeout dapat pesan lain yang lebih akurat. Dipakai bersama oleh `AbsenPanel.tsx` (`getLocation()`) dan `AbsenMapBackground.tsx` (`fetchLocation()`).
- `AbsenMapBackground.tsx` ditambah `useEffect` yang query `navigator.permissions.query({name:"geolocation"})` dan pasang `status.onchange` — begitu user unblock izin lewat setting browser, map di-refetch otomatis tanpa perlu reload manual halaman. Di-guard dengan `"permissions" in navigator` karena Permissions API tidak universal (mis. Safari lama).
- **Pola untuk fitur baru ke depan**: kalau ada tempat lain yang panggil `getCurrentPosition()`/`watchPosition()`, pakai `getGeolocationErrorMessage()` dari `src/lib/geolocation.ts`, jangan bikin pesan error lokasi generik baru.
- Verifikasi: `npm run build` sukses (24 route, 0 error), `npx eslint src/` bersih (1 warning pre-existing tidak terkait).

**Belum dilakukan**: test manual di browser sungguhan — set izin lokasi ke "Never allow", coba checkin (pastikan pesan instruksi muncul), lalu ubah balik ke "Allow" lewat site settings dan konfirmasi `AbsenMapBackground` auto-refetch tanpa reload.

**Catatan tambahan**: user sempat mengubah `AbsenMapBackground.tsx` di luar sesi fix ini — blok notice error non-blocking + tombol "Coba Lagi" (`handleRetry`, ikon `RotateCw`) sudah dihapus dari JSX, jadi `errorMessage`/`handleRetry`/`RotateCw` sekarang unused (lint warning, bukan error). Belum dikonfirmasi apakah ini sengaja (mis. errorMessage/retry mau ditangani beda) — tanyakan ke user kalau relevan di sesi berikutnya sebelum "membersihkan" kode itu.

## Fitur: Filter History — Bulan atau Custom Date Range ✅

**Trigger**: User minta filter di halaman History bisa pilih per bulan (seperti sebelumnya) ATAU rentang tanggal custom.

**Yang dikerjakan**:
- `src/app/api/absences/mine/route.ts` — terima query param `startDate`/`endDate` (format `yyyy-MM-dd`) sebagai alternatif dari `month`. Kalau keduanya diisi, dipakai sebagai rentang custom (validasi: tanggal valid, `start <= end`, rentang maks 31 hari — pola & pesan error sama persis dengan `MAX_RANGE_DAYS` di `/api/report`). Kalau tidak, fallback ke logic `month` yang sudah ada. Response tidak lagi mengembalikan field `month` (tidak dipakai client, dan tidak valid lagi untuk mode custom).
- `src/components/HistoryList.tsx` — filter sekarang toggle 2 mode: "Bulan" (select bulan seperti sebelumnya) dan "Custom" (2 input `<input type="date">` untuk start/end, saling membatasi via `min`/`max` biar `start <= end` selalu terjaga di UI). Validasi rentang (maks 31 hari) juga dicek di client (`isCustomRangeValid`) sebelum fetch, supaya pesan error muncul instan tanpa round-trip API kalau user pilih rentang lebih dari 31 hari.
- **Pola untuk fitur filter tanggal lain ke depan**: reuse `MAX_RANGE_DAYS = 31` + validasi `start/end` dengan pesan error yang konsisten (sudah ada di 2 tempat: `/api/report` dan `/api/absences/mine` — pertimbangkan ekstrak ke helper bersama kalau ada tempat ketiga yang butuh pola sama).
- Verifikasi: `npm run build` sukses (24 route, 0 error), `npx eslint` bersih untuk kedua file yang diubah.

**Belum dilakukan**: test manual di browser — coba toggle Bulan↔Custom, pilih rentang >31 hari (pastikan pesan error muncul), pilih rentang valid dan konfirmasi data yang tampil benar.

## Phase History

### Phase 1: Perencanaan & Dokumentasi ✅
**Completed Tasks**:
- [x] Tentukan tech stack (Next.js vs Flutter) — Next.js dipilih
- [x] Tentukan strategi PWA — manual manifest + service worker (bukan `next-pwa`, tidak kompatibel dengan Next.js 16)
- [x] Bahas & dokumentasikan fitur halaman karyawan (Absen, History, Profile) — `docs/features.md`
- [x] Bahas & dokumentasikan fitur halaman admin (Manage Karyawan, Manage Admin, Manage Absence, Report) — `docs/features.md`
- [x] Rancang schema Firestore — `docs/database-schema.md`
- [x] Putuskan strategi Auth: custom login (bukan Firebase Authentication) karena admin login pakai username
- [x] Putuskan password plain text untuk versi awal (technical debt terdokumentasi)
- [x] Rancang schema Cloudinary + alur upload foto — `docs/cloudinary-schema.md`
- [x] Inisialisasi Memory Bank (`/cline-init`)

### Phase 2: Scaffolding Project ✅
**Completed Tasks**:
- [x] Scaffold project Next.js (App Router, TypeScript, Tailwind) via `create-next-app`
- [x] Install dependency inti: `firebase`, `firebase-admin`, `cloudinary`, `jose`
- [x] Lib inti: `firebase-admin.ts` (lazy singleton — WAJIB tetap lazy, `next build` gagal kalau eager), `cloudinary.ts`, `session.ts`
- [x] Auth routes: `/api/auth/login`, `/api/auth/logout`
- [x] PWA manual: `manifest.json`, `sw.js`, placeholder icon
- [x] Semua halaman route dibuat sebagai placeholder dengan auth guard aktif
- [x] `.env.local` diisi kredensial Firebase (project `absence-dd5b3`) — terverifikasi konek
- [x] `.env.local` diisi kredensial Cloudinary (`gdqpp5hz`) — terisi tapi belum terverifikasi (sandbox tidak ada akses internet keluar ke `api.cloudinary.com`, perlu test ulang di environment normal)
- [x] Akun `super_admin` pertama dibuat manual di Firestore (username `superadmin`, password di-set manual — tidak dicatat di sini) via route seeding sementara (sudah dihapus dari kode)

## Phase 4: Fitur Lanjutan (Belum Dimulai) 🚧
**Rencana cakupan:**
- Manage Admin (CRUD, super_admin only)
- Manage Absence (koreksi + audit log)
- Report + export Excel
- History & Profile karyawan (read data sungguhan)

**Blockers**: Tidak ada — bisa lanjut kapan saja, tidak bergantung fitur lain.

## Known Issues / Technical Debt
- ~~Firestore composite index belum dibuat~~ **RESOLVED**: 2 index sudah dibuat di collection `absences` (`employeeId` ASC + `checkinTime` DESC untuk History; `employeeId` ASC + `checkinTime` ASC untuk Report/Export). Semua endpoint yang tadinya 500 sekarang 200. Kalau nanti ada composite index-missing baru (query Firestore baru dengan kombinasi filter+sort berbeda), Firestore selalu kasih link langsung di error log server (`FAILED_PRECONDITION`) — tinggal klik.
- **Password plain text** (bukan hash) di `employees`/`admins` — wajib diganti `bcrypt`/`argon2` sebelum data karyawan sungguhan dipakai. Lihat `techContext.md`.
- Belum ada validasi radius/geofencing lokasi absen.
- Belum ada deteksi fake GPS/mock location.
- Belum ada bulk import karyawan (input satu-satu untuk versi awal).
- Icon PWA (`public/icons/icon-192.png`, `icon-512.png`) masih placeholder generated, perlu diganti logo asli.
- Session strategy final: **JWT custom di httpOnly cookie** (bukan NextAuth).
- Ada banyak data uji coba tersisa di Firestore production (karyawan test, admin `testadmin1`, beberapa record `absences` & `absence_audit_logs`) dari verifikasi end-to-end oleh tim — aman dipakai untuk testing UI lebih lanjut, atau hapus manual via Firebase Console kalau ingin database bersih sebelum go-live.
- Cloudinary upload (`AbsenPanel.tsx`), kamera, dan Geolocation API belum pernah dites di browser sungguhan (cuma diverifikasi lewat `curl` dengan URL foto dummy) — perlu ditest manual di browser untuk konfirmasi kamera + upload asli bekerja.
- Manage Admin: edit/delete akun admin dibatasi ke `super_admin` sebagai asumsi kerja (tidak eksplisit di `docs/features.md`) — perlu dikonfirmasi ke user apakah ini keputusan final.
- Report: "range maks 31 hari" diimplementasikan sebagai 31 hari inklusif (bukan strict "1 bulan kalender") — konsisten dengan spec tapi sedikit beda dari makna literal "1 bulan".
