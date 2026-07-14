import { NextRequest, NextResponse } from "next/server";
import { cloudinary, buildAbsencePublicId, buildProfilePublicId } from "@/lib/cloudinary";
import { getSession, isEmployeeSession } from "@/lib/session";

// Signs a Cloudinary upload for checkin/checkout selfies atau foto profil karyawan.
// public_id is derived server-side (not trusted from client) per docs/cloudinary-schema.md.
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session || !isEmployeeSession(session)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { type } = (await request.json()) as { type?: "checkin" | "checkout" | "profile" };
  if (type !== "checkin" && type !== "checkout" && type !== "profile") {
    return NextResponse.json({ error: "Invalid type" }, { status: 400 });
  }

  const timestamp = Math.round(Date.now() / 1000);
  const timestampMillis = Date.now();
  const publicId =
    type === "profile"
      ? buildProfilePublicId(session.employeeId, timestampMillis)
      : buildAbsencePublicId(session.employeeId, type, timestampMillis);

  // "quality" bukan parameter upload langsung yang valid untuk Cloudinary — harus
  // lewat "transformation" (mis. "q_auto:good"), jika tidak Cloudinary menghitung
  // ulang signature TANPA field itu dan menolaknya sebagai "Invalid Signature".
  const paramsToSign = {
    timestamp,
    public_id: publicId,
    transformation: "q_auto:good,w_1280,c_limit",
  };

  const signature = cloudinary.utils.api_sign_request(
    paramsToSign,
    process.env.CLOUDINARY_API_SECRET as string
  );

  return NextResponse.json({
    signature,
    timestamp,
    publicId,
    apiKey: process.env.CLOUDINARY_API_KEY,
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
  });
}
