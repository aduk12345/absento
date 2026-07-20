// Zona waktu acuan tunggal untuk menentukan "hari yang sama" di seluruh app
// (absen lintas hari, dsb) — supaya tidak bergantung timezone server deployment.
const TIMEZONE = "Asia/Jakarta";

// WIB tidak pernah DST, jadi offset tetap +07:00 — aman dipakai untuk membangun
// batas awal/akhir hari secara instan (tanpa perlu Intl timezone math).
const JAKARTA_UTC_OFFSET = "+07:00";

export function jakartaDateString(date: Date): string {
  return date.toLocaleDateString("en-CA", { timeZone: TIMEZONE });
}

export function isSameJakartaDay(a: Date, b: Date): boolean {
  return jakartaDateString(a) === jakartaDateString(b);
}

// Batas awal/akhir hari (00:00:00.000 / 23:59:59.999 WIB) untuk `dateStr` ("yyyy-MM-dd"),
// dikembalikan sebagai instan UTC yang benar — dipakai untuk filter rentang tanggal
// query Firestore terhadap `checkinTime` (disimpan sebagai instan UTC). JANGAN bangun batas
// ini langsung lewat `T00:00:00.000Z`/`T23:59:59.999Z` — itu memperlakukan tanggal sebagai UTC,
// bukan WIB, jadi checkin jam 00:00-06:59 WIB (rentang UTC hari sebelumnya) akan salah hari.
export function startOfJakartaDayUtc(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00.000${JAKARTA_UTC_OFFSET}`);
}

export function endOfJakartaDayUtc(dateStr: string): Date {
  return new Date(`${dateStr}T23:59:59.999${JAKARTA_UTC_OFFSET}`);
}

// Batas awal/akhir bulan kalender WIB untuk `year`/`month` (1-12) — dipakai fallback
// filter History per-bulan (beda dari `startOfJakartaDayUtc`/`endOfJakartaDayUtc` yang per-hari).
export function jakartaMonthRangeUtc(year: number, month: number): { start: Date; end: Date } {
  const pad = (n: number) => String(n).padStart(2, "0");
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return {
    start: startOfJakartaDayUtc(`${year}-${pad(month)}-01`),
    end: endOfJakartaDayUtc(`${year}-${pad(month)}-${pad(lastDay)}`),
  };
}

// Format tanggal/jam WIB eksplisit (id-ID locale) — dipakai di tempat yang memformat
// checkinTime/checkoutTime untuk ditampilkan (mis. export Excel), supaya tidak bergantung
// timezone server (server production bisa jalan di UTC, bukan WIB).
export function formatJakartaDateId(date: Date): string {
  return date.toLocaleDateString("id-ID", { timeZone: TIMEZONE });
}

export function formatJakartaTimeId(date: Date): string {
  return date.toLocaleTimeString("id-ID", {
    timeZone: TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Dipakai untuk watermark foto absen (src/lib/watermark.ts) — format "Kamis, 11/12/2025" + "20:09 WIB".
export function formatJakartaWatermarkDateTime(date: Date): { dateLine: string; timeLine: string } {
  const dayName = date.toLocaleDateString("id-ID", { timeZone: TIMEZONE, weekday: "long" });
  const dmy = date.toLocaleDateString("en-GB", { timeZone: TIMEZONE }); // dd/mm/yyyy
  const time = date.toLocaleTimeString("en-GB", {
    timeZone: TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
  });
  return { dateLine: `${dayName}, ${dmy}`, timeLine: `${time} WIB` };
}
