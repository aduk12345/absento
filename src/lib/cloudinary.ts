import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

export { cloudinary };

type AbsenceType = "checkin" | "checkout";

// Folder & naming convention: docs/cloudinary-schema.md
// - Foto absen (checkin/checkout): absence/attendance/{employeeId}/{yyyy-MM}/{type}_{timestamp}
// - Foto profil karyawan: absence/employees/{employeeId}/profile_{timestamp}
export function buildAbsencePublicId(
  employeeId: string,
  type: AbsenceType,
  timestampMillis: number
): string {
  const yyyyMM = new Date(timestampMillis).toISOString().slice(0, 7); // "2026-07"
  return `absence/attendance/${employeeId}/${yyyyMM}/${type}_${timestampMillis}`;
}

export function buildProfilePublicId(employeeId: string, timestampMillis: number): string {
  return `absence/employees/${employeeId}/profile_${timestampMillis}`;
}

export async function deleteEmployeePhotos(employeeId: string): Promise<void> {
  await Promise.all([
    cloudinary.api.delete_resources_by_prefix(`absence/attendance/${employeeId}/`, {
      invalidate: true,
    }),
    cloudinary.api.delete_resources_by_prefix(`absence/employees/${employeeId}/`, {
      invalidate: true,
    }),
  ]);
}

// secure_url yang disimpan di Firestore (checkinPhotoUrl/checkoutPhotoUrl) berbentuk
// https://res.cloudinary.com/{cloud}/image/upload/v{version}/{public_id}.{ext} —
// public_id (termasuk folder) perlu diekstrak balik sebelum bisa dipakai untuk destroy().
export function extractPublicIdFromUrl(url: string): string | null {
  try {
    const { pathname } = new URL(url);
    const uploadMarker = "/upload/";
    const uploadIndex = pathname.indexOf(uploadMarker);
    if (uploadIndex === -1) return null;

    let rest = pathname.slice(uploadIndex + uploadMarker.length);
    rest = rest.replace(/^v\d+\//, ""); // strip version segment
    rest = rest.replace(/\.[a-zA-Z0-9]+$/, ""); // strip file extension

    return rest || null;
  } catch {
    return null;
  }
}

// Best-effort: gagal hapus foto di Cloudinary (mis. sudah terhapus, network error)
// tidak boleh menggagalkan penghapusan record absence di Firestore.
export async function deletePhotoByUrl(url: string | null | undefined): Promise<void> {
  if (!url) return;

  const publicId = extractPublicIdFromUrl(url);
  if (!publicId) return;

  try {
    await cloudinary.uploader.destroy(publicId, { invalidate: true });
  } catch (err) {
    console.error(`Gagal menghapus foto Cloudinary (public_id: ${publicId}):`, err);
  }
}
