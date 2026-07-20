import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";

// Proxy server-side ke tile CARTO Voyager (basemap yang sama dipakai LocationMap.tsx)
// — dipanggil dari server (bukan client langsung ke cartocdn.com) supaya gambar tile
// same-origin dari sudut pandang browser dan TIDAK men-taint <canvas> saat dipakai
// untuk bake watermark peta ke foto absen (lihat src/lib/watermark.ts).
const SUBDOMAINS = ["a", "b", "c", "d"];

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const z = Number(request.nextUrl.searchParams.get("z"));
  const x = Number(request.nextUrl.searchParams.get("x"));
  const y = Number(request.nextUrl.searchParams.get("y"));
  if (!Number.isInteger(z) || !Number.isInteger(x) || !Number.isInteger(y) || z < 0 || z > 19) {
    return NextResponse.json({ error: "Parameter tile tidak valid" }, { status: 400 });
  }

  const subdomain = SUBDOMAINS[(x + y) % SUBDOMAINS.length];
  const res = await fetch(
    `https://${subdomain}.basemaps.cartocdn.com/rastertiles/voyager/${z}/${x}/${y}.png`
  );
  if (!res.ok) {
    return NextResponse.json({ error: "Gagal ambil tile peta" }, { status: 502 });
  }

  const buffer = await res.arrayBuffer();
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=86400, immutable",
    },
  });
}
