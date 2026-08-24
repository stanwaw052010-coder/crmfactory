"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useChartTheme } from "@/components/charts/use-chart-theme";
import { ChartTooltip } from "@/components/charts/chart-tooltip";
import { currencySymbol } from "@/lib/money";
import { MONTHS_UK } from "@/lib/time";

function formatDay(value: string) {
  const date = new Date(`${value}T00:00:00`);
  return `${date.getDate()} ${MONTHS_UK[date.getMonth()].slice(0, 3)}`;
}

/**
 * Виручка в часі. Одна серія — легенда не потрібна, заголовок картки її називає.
 * Одна вісь значень: друга метрика ніколи не додається сюди другою шкалою.
 */
export function RevenueChart({
  data,
  currency = "EUR",
  height = 260,
  compact,
}: {
  data: { date: string; revenue: number }[];
  currency?: string;
  height?: number;
  compact?: boolean;
}) {
  const theme = useChartTheme();
  const symbol = currencySymbol(currency);
  const gradientId = "revenue-gradient";

  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={theme.primary} stopOpacity={0.28} />
              <stop offset="100%" stopColor={theme.primary} stopOpacity={0.02} />
            </linearGradient>
          </defs>

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
            width={compact ? 52 : 60}
            tickFormatter={(value: number) =>
              value >= 1000 ? `${symbol}${(value / 1000).toFixed(1)}k` : `${symbol}${value}`
            }
          />
          <Tooltip
            cursor={{ stroke: theme.axis, strokeDasharray: "4 4" }}
            content={
              <ChartTooltip
                labelFormatter={formatDay}
                formatter={(value) => `${symbol}${value.toLocaleString("uk-UA")}`}
              />
            }
          />
          <Area
            type="monotone"
            dataKey="revenue"
            name="Виручка"
            stroke={theme.primary}
            strokeWidth={2}
            fill={`url(#${gradientId})`}
            activeDot={{ r: 4, strokeWidth: 2, stroke: theme.surface }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
