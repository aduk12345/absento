import { NextResponse } from "next/server";
import { getSession, isAdminSession } from "@/lib/session";
import { cloudinary } from "@/lib/cloudinary";

// Pemakaian storage/bandwidth Cloudinary aktual, lewat Admin API `usage()`.
// docs/cloudinary-schema.md — dipakai untuk memantau agar tetap di free tier.
export async function GET() {
  const session = await getSession();
  if (!session || !isAdminSession(session) || session.role !== "super_admin") {
    return NextResponse.json(
      { error: "Hanya Super Admin yang bisa melihat pemakaian storage" },
      { status: 403 }
    );
  }

  try {
    const usage = await cloudinary.api.usage();
    return NextResponse.json({
      plan: usage.plan ?? null,
      credits: usage.credits
        ? {
            usage: usage.credits.usage ?? null,
            limit: usage.credits.limit ?? null,
            usedPercent: usage.credits.used_percent ?? null,
          }
        : null,
      storageBytes: usage.storage?.usage ?? null,
      bandwidthBytes: usage.bandwidth?.usage ?? null,
      objects: usage.objects?.usage ?? null,
      lastUpdated: usage.last_updated ?? null,
    });
  } catch (err) {
    console.error("Gagal mengambil Cloudinary usage:", err);
    return NextResponse.json({ error: "Gagal mengambil data pemakaian Cloudinary" }, { status: 502 });
  }
}
