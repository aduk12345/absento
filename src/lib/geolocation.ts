// Pesan error lokasi dibedakan per kode — terutama PERMISSION_DENIED, karena begitu user
// pilih "Never allow"/"Block" di browser, getCurrentPosition() langsung gagal tanpa prompt
// izin lagi (tidak bisa dipicu ulang lewat JS). User butuh instruksi manual untuk unblock.
export function getGeolocationErrorMessage(error: GeolocationPositionError): string {
  switch (error.code) {
    case error.PERMISSION_DENIED:
      return "Izin lokasi diblokir di browser. Klik ikon gembok/info di address bar → Site settings → Location → Allow, lalu muat ulang halaman.";
    case error.POSITION_UNAVAILABLE:
      return "Lokasi tidak dapat dideteksi. Pastikan GPS aktif lalu coba lagi.";
    default:
      return "Gagal mendapatkan lokasi (waktu habis). Coba lagi.";
  }
}
