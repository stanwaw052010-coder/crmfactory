"use client";

import { motion } from "framer-motion";

/**
 * Превʼю інтерфейсу на лендінгу.
 * Це ілюстрація продукту, а не інтерактивний дашборд — тому вона
 * навмисно статична й позначена як декоративна для скрінрідерів.
 */
export function DashboardPreview() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1], delay: 0.15 }}
      aria-hidden
      className="mx-auto max-w-[940px] overflow-hidden rounded-[18px] border border-white/10 bg-[#0B1626] shadow-[0_40px_100px_-20px_rgba(0,0,0,0.6)]"
    >
      {/* Панель вікна */}
      <div className="flex items-center gap-2 border-b border-white/8 bg-white/[0.03] px-4 py-3">
        <span className="h-2.5 w-2.5 rounded-full bg-[#FF5F57]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#FEBC2E]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#28C840]" />
        <span className="ml-3 rounded-md bg-white/[0.06] px-2.5 py-1 text-[11px] text-white/50">
          crm.factory/dashboard
        </span>
      </div>

      <div className="flex">
        {/* Sidebar */}
        <div className="hidden w-44 shrink-0 border-r border-white/8 p-3 sm:block">
          <div className="mb-4 flex items-center gap-2 px-2">
            <span className="h-5 w-5 rounded-md bg-gradient-to-br from-[#3b76f6] to-[#0d47ff]" />
            <span className="text-[12px] font-semibold text-white/90">crm.factory</span>
          </div>
          {["Головна", "Записи", "Клієнти", "Послуги", "Команда", "Аналітика"].map((label, i) => (
            <div
              key={label}
              className={`mb-0.5 flex items-center gap-2 rounded-lg px-2 py-1.5 text-[11.5px] ${
                i === 0 ? "bg-[#2563EB]/20 text-[#6096fa]" : "text-white/45"
              }`}
            >
              <span
                className={`h-3 w-3 rounded-[3px] ${i === 0 ? "bg-[#6096fa]" : "bg-white/20"}`}
              />
              {label}
            </div>
          ))}
        </div>

        {/* Контент */}
        <div className="min-w-0 flex-1 p-4 sm:p-5">
          <div className="mb-4">
            <div className="h-3 w-40 rounded bg-white/15" />
            <div className="mt-2 h-2 w-28 rounded bg-white/8" />
          </div>

          <div className="mb-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            {[
              { label: "Записів", value: "24", tone: "#6096fa" },
              { label: "Клієнтів", value: "8", tone: "#38BDF8" },
              { label: "Виручка", value: "€1,240", tone: "#34D399" },
              { label: "Відмови", value: "3", tone: "#F87171" },
            ].map((stat) => (
              <div key={stat.label} className="rounded-xl border border-white/8 bg-white/[0.03] p-3">
                <div className="text-[10px] text-white/40">{stat.label}</div>
                <div className="mt-1.5 text-[16px] font-semibold" style={{ color: stat.tone }}>
                  {stat.value}
                </div>
              </div>
            ))}
          </div>

          <div className="grid gap-2.5 lg:grid-cols-[1.6fr_1fr]">
            {/* Розклад */}
            <div className="rounded-xl border border-white/8 bg-white/[0.03] p-3">
              <div className="mb-2.5 h-2 w-24 rounded bg-white/12" />
              {[
                { time: "10:00", name: "Anna", service: "Манікюр", color: "#6096fa" },
                { time: "11:30", name: "Sofia", service: "Педикюр", color: "#38BDF8" },
                { time: "13:00", name: "Alex", service: "Консультація", color: "#A78BFA" },
                { time: "15:30", name: "Marta", service: "Стрижка", color: "#34D399" },
              ].map((row) => (
                <div key={row.time} className="mb-1.5 flex items-center gap-2.5 last:mb-0">
                  <span className="w-9 text-[10.5px] text-white/45 tabular-nums">{row.time}</span>
                  <span className="h-7 w-0.5 rounded-full" style={{ background: row.color }} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[11.5px] font-medium text-white/85">{row.name}</span>
                    <span className="block text-[10px] text-white/40">{row.service}</span>
                  </span>
                  <span className="rounded-full bg-[#34D399]/15 px-2 py-0.5 text-[9.5px] text-[#34D399]">
                    Підтверджено
                  </span>
                </div>
              ))}
            </div>

            {/* Графік */}
            <div className="rounded-xl border border-white/8 bg-white/[0.03] p-3">
              <div className="mb-3 h-2 w-20 rounded bg-white/12" />
              <div className="flex h-[86px] items-end gap-1.5">
                {[38, 55, 42, 70, 61, 88, 74].map((height, i) => (
                  <motion.div
                    key={i}
                    initial={{ height: 0 }}
                    animate={{ height: `${height}%` }}
                    transition={{ duration: 0.5, delay: 0.4 + i * 0.05, ease: [0.16, 1, 0.3, 1] }}
                    className="flex-1 rounded-t-[3px] bg-gradient-to-t from-[#2563EB]/35 to-[#6096fa]"
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
