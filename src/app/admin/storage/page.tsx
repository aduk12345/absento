import { redirect } from "next/navigation";
import { getSession, isAdminSession } from "@/lib/session";
import { cloudinary } from "@/lib/cloudinary";
import { StorageUsagePanel } from "@/components/StorageUsagePanel";

// Khusus Super Admin — pemakaian storage Cloudinary + hapus data absensi lama.
export default async function AdminStoragePage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!isAdminSession(session)) redirect("/");
  if (session.role !== "super_admin") redirect("/admin");

  let initialUsage = null;
  try {
    const usage = await cloudinary.api.usage();
    initialUsage = {
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
    };
  } catch (err) {
    console.error("Gagal mengambil Cloudinary usage:", err);
  }

  return <StorageUsagePanel initialUsage={initialUsage} />;
}
