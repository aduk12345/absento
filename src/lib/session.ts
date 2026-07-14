import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";

const COOKIE_NAME = "eh_absence_session";
const SESSION_DURATION_SECONDS = 60 * 60 * 12; // 12 hours

export type EmployeeSession = {
  role: "employee";
  employeeId: string;
  name: string;
};

export type AdminSession = {
  role: "admin" | "super_admin";
  adminId: string;
  name: string;
};

export type Session = EmployeeSession | AdminSession;

function getSecretKey(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("Missing JWT_SECRET in .env.local");
  }
  return new TextEncoder().encode(secret);
}

export async function createSession(payload: Session): Promise<void> {
  const token = await new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DURATION_SECONDS}s`)
    .sign(getSecretKey());

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DURATION_SECONDS,
  });
}

export async function getSession(): Promise<Session | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    return payload as unknown as Session;
  } catch {
    return null;
  }
}

export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

export function isAdminSession(session: Session): session is AdminSession {
  return session.role === "admin" || session.role === "super_admin";
}

export function isEmployeeSession(session: Session): session is EmployeeSession {
  return session.role === "employee";
}
