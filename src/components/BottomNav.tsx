import Link from "next/link";
import { CalendarCheck, History, UserRound } from "lucide-react";

const ITEMS = [
  { key: "absen", href: "/", label: "Absen", icon: CalendarCheck },
  { key: "history", href: "/history", label: "History", icon: History },
  { key: "profile", href: "/profile", label: "Profile", icon: UserRound },
] as const;

export function BottomNav({ active }: { active: (typeof ITEMS)[number]["key"] }) {
  return (
    <nav className="sticky bottom-0 flex border-t border-slate-200 bg-white/95 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur-sm lg:hidden">
      {ITEMS.map((item) => {
        const isActive = item.key === active;
        const Icon = item.icon;
        return (
          <Link
            key={item.key}
            href={item.href}
            className="flex flex-1 flex-col items-center gap-1 py-1.5"
          >
            <span
              className={`flex h-9 w-14 items-center justify-center rounded-full transition-colors ${
                isActive ? "bg-indigo-50 text-indigo-600" : "text-slate-400"
              }`}
            >
              <Icon size={20} strokeWidth={isActive ? 2.5 : 2} />
            </span>
            <span className={`text-[11px] font-medium ${isActive ? "text-indigo-600" : "text-slate-400"}`}>
              {item.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
