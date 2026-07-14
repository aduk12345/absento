"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { ADMIN_NAV_ITEMS } from "@/components/AdminNav";

// Top bar + drawer untuk area admin di mobile — sidebar AdminNav disembunyikan di layar sempit.
export function AdminMobileNav({ role }: { role: "admin" | "super_admin" }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const items = ADMIN_NAV_ITEMS.filter((item) => !item.superAdminOnly || role === "super_admin");

  return (
    <>
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur-sm lg:hidden">
        <Link href="/admin" className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-50 ring-2 ring-indigo-50">
            <Image src="/logo.png" alt="Absento" width={22} height={22} />
          </span>
          <span className="text-sm font-bold text-slate-900">Absento</span>
        </Link>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-600 hover:bg-slate-50"
        >
          <Menu size={20} />
        </button>
      </header>

      {open && (
        <div className="fixed inset-0 z-40 lg:hidden" onClick={() => setOpen(false)}>
          <div className="absolute inset-0 bg-slate-900/40" />
          <nav
            className="absolute right-0 top-0 flex h-full w-64 flex-col gap-1 bg-white p-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-6 flex items-center justify-between px-2">
              <span className="text-base font-bold text-slate-900">Menu</span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X size={18} />
              </button>
            </div>
            {items.map((item) => {
              const Icon = item.icon;
              const isActive =
                item.href === "/admin" ? pathname === "/admin" : pathname?.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
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
        </div>
      )}
    </>
  );
}
