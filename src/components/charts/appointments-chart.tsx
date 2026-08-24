"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useChartTheme } from "@/components/charts/use-chart-theme";
import { ChartTooltip } from "@/components/charts/chart-tooltip";
import { MONTHS_UK } from "@/lib/time";

function formatDay(value: string) {
  const date = new Date(`${value}T00:00:00`);
  return `${date.getDate()} ${MONTHS_UK[date.getMonth()].slice(0, 3)}`;
}

/** Кількість записів у часі: тонкі стовпці, заокруглені кінці, одна серія. */
export function AppointmentsChart({
  data,
  height = 240,
}: {
  data: { date: string; appointments: number }[];
  height?: number;
}) {
  const theme = useChartTheme();

  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }} barCategoryGap="28%">
          <CartesianGrid stroke={theme.grid} strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="date"
            tickFormatter={formatDay}
            tick={{ fill: theme.axis, fontSize: 11.5 }}
            tickLine={false}
            axisLine={false}
            minTickGap={24}
          />
          <YAxis
            tick={{ fill: theme.axis, fontSize: 11.5 }}
            tickLine={false}
            axisLine={false}
            width={36}
            allowDecimals={false}
          />
          <Tooltip
            cursor={{ fill: theme.grid, opacity: 0.4 }}
            content={<ChartTooltip labelFormatter={formatDay} />}
          />
          <Bar
            dataKey="appointments"
            name="Записів"
            fill={theme.primary}
            radius={[4, 4, 0, 0]}
            maxBarSize={26}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
