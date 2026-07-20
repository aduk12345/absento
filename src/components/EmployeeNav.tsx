"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { CalendarCheck, CalendarOff, History, UserRound } from "lucide-react";

const ITEMS = [
  { href: "/", label: "Absen", icon: CalendarCheck },
  { href: "/leave", label: "Izin", icon: CalendarOff },
  { href: "/history", label: "History", icon: History },
  { href: "/profile", label: "Profile", icon: UserRound },
] as const;

// Sidebar desktop untuk area karyawan — hanya tampil di layar lebar (lg+).
// Di mobile, navigasi tetap pakai BottomNav.
export function EmployeeNav({ active }: { active: string }) {
  const pathname = usePathname();

  return (
    <nav className="hidden w-64 shrink-0 flex-col gap-1 border-r border-slate-200 bg-white p-4 lg:flex">
      <Link href="/" className="mb-6 flex items-center gap-2 px-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 ring-2 ring-indigo-50">
          <Image src="/logo.png" alt="SJB Attendance" width={28} height={28} />
        </span>
        <span className="text-base font-bold text-slate-900">SJB Attendance</span>
      </Link>
      {ITEMS.map((item) => {
        const Icon = item.icon;
        const isActive = pathname === item.href || item.label.toLowerCase() === active;
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
    </nav>
  );
}
