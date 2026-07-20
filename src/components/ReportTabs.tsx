"use client";

import { useState } from "react";
import { ReportView, type ReportEmployee } from "@/components/ReportView";
import { MonthlyReportView } from "@/components/MonthlyReportView";
import { DailyReportView } from "@/components/DailyReportView";

const TABS = [
  { key: "daily", label: "Rekap Harian" },
  { key: "monthly", label: "Rekap Bulanan" },
  { key: "employee", label: "Per Karyawan" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

export function ReportTabs({ employees }: { employees: ReportEmployee[] }) {
  const [tab, setTab] = useState<TabKey>("daily");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-px">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`rounded-t-xl px-4 py-2.5 text-sm font-semibold transition-colors ${
              tab === t.key
                ? "border-b-2 border-indigo-600 text-indigo-700"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "employee" && <ReportView employees={employees} />}
      {tab === "monthly" && <MonthlyReportView />}
      {tab === "daily" && <DailyReportView />}
    </div>
  );
}
