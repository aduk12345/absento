import {
  Users,
  ShieldCheck,
  ClipboardList,
  FileBarChart,
  LayoutGrid,
  HardDrive,
  FileClock,
} from "lucide-react";

export const ADMIN_NAV_ITEMS = [
  { href: "/admin", label: "Dashboard", icon: LayoutGrid, superAdminOnly: false },
  { href: "/admin/report", label: "Report", icon: FileBarChart, superAdminOnly: false },
  { href: "/admin/absences", label: "Absence", icon: ClipboardList, superAdminOnly: false },
  { href: "/admin/leaves", label: "Izin", icon: FileClock, superAdminOnly: false },
  { href: "/admin/employees", label: "Karyawan", icon: Users, superAdminOnly: false },
  { href: "/admin/admins", label: "Admin", icon: ShieldCheck, superAdminOnly: false },
  { href: "/admin/storage", label: "Storage", icon: HardDrive, superAdminOnly: true },
] as const;
