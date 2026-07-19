"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  Users,
  ShieldCheck,
  ClipboardList,
  FileBarChart,
  LayoutGrid,
  HardDrive,
  LogOut,
} from "lucide-react";

export const ADMIN_NAV_ITEMS = [
  { href: "/admin", label: "Dashboard", icon: LayoutGrid, superAdminOnly: false },
  { href: "/admin/report", label: "Report", icon: FileBarChart, superAdminOnly: false },
  { href: "/admin/employees", label: "Karyawan", icon: Users, superAdminOnly: false },
  { href: "/admin/admins", label: "Admin", icon: ShieldCheck, superAdminOnly: false },
  { href: "/admin/absences", label: "Absence", icon: ClipboardList, superAdminOnly: false },
  { href: "/admin/storage", label: "Storage", icon: HardDrive, superAdminOnly: true },
] as const;

// Sidebar desktop untuk area admin — hanya tampil di layar lebar (lg+).
// Di mobile, navigasi dipindah ke AdminMobileNav (top bar + drawer).
export function AdminNav({ role }: { role: "admin" | "super_admin" }) {
  const pathname = usePathname();
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);
  const items = ADMIN_NAV_ITEMS.filter((item) => !item.superAdminOnly || role === "super_admin");

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/login");
      router.refresh();
    } finally {
      setLoggingOut(false);
    }
  }

  return (
    <nav className="hidden w-64 shrink-0 flex-col gap-1 border-r border-slate-200 bg-white p-4 lg:flex">
      <Link href="/admin" className="mb-6 flex items-center gap-2 px-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 ring-2 ring-indigo-50">
          <Image src="/logo.png" alt="Absento" width={28} height={28} />
        </span>
        <span className="text-base font-bold text-slate-900">Absento</span>
      </Link>
      {items.map((item) => {
        const Icon = item.icon;
        const isActive = item.href === "/admin" ? pathname === "/admin" : pathname?.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
              isActive
                ? "bg-indigo-50 text-indigo-700"
                : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
            }`}
          >
            <Icon size={18} strokeWidth={isActive ? 2.5 : 2} />
            {item.label}
          </Link>
        );
      })}
      <button
        type="button"
        onClick={handleLogout}
        disabled={loggingOut}
        className="mt-auto flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-rose-600 transition-colors hover:bg-rose-50 disabled:opacity-50"
      >
        <LogOut size={18} />
        {loggingOut ? "Logout..." : "Logout"}
      </button>
    </nav>
  );
}
