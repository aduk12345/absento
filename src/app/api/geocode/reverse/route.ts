import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";

// Proxy server-side ke Nominatim (OpenStreetMap) — dipanggil dari server, bukan
// langsung dari client, supaya bisa kirim User-Agent yang valid (wajib menurut
// usage policy Nominatim) dan tidak expose rate-limit/CORS handling ke client.
// Dipakai untuk watermark alamat di foto absen (lihat src/lib/watermark.ts).
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const lat = request.nextUrl.searchParams.get("lat");
  const lng = request.nextUrl.searchParams.get("lng");
  if (!lat || !lng) {
    return NextResponse.json({ error: "lat/lng wajib diisi" }, { status: 400 });
  }

  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(
        lat
      )}&lon=${encodeURIComponent(lng)}&zoom=16&addressdetails=1`,
      {
        headers: {
          "User-Agent": "eh-absence/1.0 (internal attendance app)",
          "Accept-Language": "id",
        },
      }
    );
    if (!res.ok) throw new Error("Nominatim error");
    const data = await res.json();

    const address = data.address ?? {};
    const regency: string | undefined =
      address.city || address.regency || address.county || address.city_district;
    const province: string | undefined = address.state;
    const country: string | undefined = address.country;
    const shortLabel = [regency, province, country].filter(Boolean).join(", ");

    return NextResponse.json({
      shortLabel: shortLabel || null,
      displayName: (data.display_name as string) ?? null,
    });
  } catch {
    // Best-effort — watermark tetap tampil dengan koordinat saja kalau geocoding gagal.
    return NextResponse.json({ shortLabel: null, displayName: null });
  }
}
