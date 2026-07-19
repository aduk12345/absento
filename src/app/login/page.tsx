import { redirect } from "next/navigation";
import { getSession, isAdminSession } from "@/lib/session";
import { LoginForm } from "@/components/LoginForm";

export default async function LoginPage() {
  const session = await getSession();
  if (session) redirect(isAdminSession(session) ? "/admin" : "/");

  return <LoginForm />;
}
