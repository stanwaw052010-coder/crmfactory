"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { useChartTheme } from "@/components/charts/use-chart-theme";
import { ChartTooltip } from "@/components/charts/chart-tooltip";

/**
 * Розподіл статусів. Статусні кольори — зарезервовані, тому поруч
 * завжди є легенда з підписами: ідентичність ніколи не тримається на кольорі.
 */
export function StatusDonut({
  data,
  height = 220,
}: {
  data: { key: string; label: string; value: number; color: string }[];
  height?: number;
}) {
  const theme = useChartTheme();
  const total = data.reduce((sum, item) => sum + item.value, 0);

  return (
    <div className="flex flex-col items-center gap-5 sm:flex-row">
      <div style={{ height, width: height }} className="relative shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="label"
              innerRadius="62%"
              outerRadius="92%"
              paddingAngle={2}
              stroke={theme.surface}
              strokeWidth={2}
            >
              {data.map((entry) => (
                <Cell key={entry.key} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              content={
                <ChartTooltip
                  formatter={(value) =>
                    `${value} (${total > 0 ? Math.round((value / total) * 100) : 0}%)`
                  }
                />
              }
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[24px] leading-none font-semibold text-[var(--fg)] tabular-nums">
            {total}
          </span>
          <span className="mt-1 text-[11.5px] text-[var(--fg-muted)]">записів</span>
        </div>
      </div>

      <ul className="w-full min-w-0 flex-1 space-y-2">
        {data.map((item) => (
          <li key={item.key} className="flex items-center gap-2.5">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-[3px]"
              style={{ background: item.color }}
              aria-hidden
            />
            <span className="min-w-0 flex-1 truncate text-[13px] text-[var(--fg-muted)]">
              {item.label}
            </span>
            <span className="text-[13px] font-semibold text-[var(--fg)] tabular-nums">
              {item.value}
            </span>
            <span className="w-10 text-right text-[12px] text-[var(--fg-subtle)] tabular-nums">
              {total > 0 ? Math.round((item.value / total) * 100) : 0}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
