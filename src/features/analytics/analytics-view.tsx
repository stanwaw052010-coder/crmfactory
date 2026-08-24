"use client";

import * as React from "react";
import { useRouter, usePathname } from "next/navigation";
import {
  CalendarCheck2,
  CalendarX2,
  Receipt,
  TrendingUp,
  UserPlus,
  Users,
  Wallet,
} from "lucide-react";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { SegmentedControl } from "@/components/ui/tabs";
import { StatCard } from "@/components/shared/stat-card";
import { EmptyState } from "@/components/ui/empty-state";
import { RevenueChart } from "@/components/charts/revenue-chart";
import { AppointmentsChart } from "@/components/charts/appointments-chart";
import { StatusDonut } from "@/components/charts/status-donut";
import { HorizontalBars } from "@/components/charts/horizontal-bars";
import { formatMoney } from "@/lib/money";
import { deltaPercent } from "@/lib/utils";
import { RANGE_LABELS, type AnalyticsRange } from "@/lib/analytics-range";
import type { AnalyticsData } from "@/server/queries/analytics";

const RANGES: { value: AnalyticsRange; label: string }[] = [
  { value: "7d", label: RANGE_LABELS["7d"] },
  { value: "30d", label: RANGE_LABELS["30d"] },
  { value: "90d", label: RANGE_LABELS["90d"] },
  { value: "365d", label: RANGE_LABELS["365d"] },
];

export function AnalyticsView({
  data,
  currency,
}: {
  data: AnalyticsData;
  currency: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { totals } = data;

  const hasData = totals.appointments > 0 || totals.revenueCents > 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SegmentedControl
          options={RANGES}
          value={data.range}
          onChange={(value) => router.push(`${pathname}?range=${value}`, { scroll: false })}
        />
      </div>

      {!hasData ? (
        <Card>
          <EmptyState
            icon={TrendingUp}
            title="Даних за цей період ще немає"
            description="Аналітика заповнюється автоматично, щойно з'являться записи та оплати. Оберіть довший період або створіть перші записи."
          />
        </Card>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Виручка"
              value={formatMoney(totals.revenueCents, currency)}
              delta={deltaPercent(totals.revenueCents, totals.prevRevenueCents)}
              hint="проти попереднього періоду"
              icon={Wallet}
              tone="success"
            />
            <StatCard
              label="Записів"
              value={totals.appointments}
              delta={deltaPercent(totals.appointments, totals.prevAppointments)}
              hint="проти попереднього періоду"
              icon={CalendarCheck2}
              tone="brand"
            />
            <StatCard
              label="Нових клієнтів"
              value={totals.newClients}
              delta={deltaPercent(totals.newClients, totals.prevNewClients)}
              hint={`${totals.returningClients} повторних`}
              icon={UserPlus}
              tone="info"
            />
            <StatCard
              label="Середній чек"
              value={formatMoney(totals.averageCheckCents, currency)}
              delta={deltaPercent(totals.averageCheckCents, totals.prevAverageCheckCents)}
              hint="проти попереднього періоду"
              icon={Receipt}
              tone="brand"
            />
          </div>

          <Card>
            <CardHeader
              title="Виручка"
              description={`Разом за період: ${formatMoney(totals.revenueCents, currency)}`}
            />
            <CardBody className="pr-4 pl-1">
              <RevenueChart data={data.revenueSeries} currency={currency} height={300} />
            </CardBody>
          </Card>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader title="Записи" description="Кількість за період" />
              <CardBody className="pr-4 pl-1">
                <AppointmentsChart data={data.appointmentSeries} />
              </CardBody>
            </Card>

            <Card>
              <CardHeader title="Статуси записів" description="Розподіл за період" />
              <CardBody>
                {data.statusBreakdown.length > 0 ? (
                  <StatusDonut data={data.statusBreakdown} />
                ) : (
                  <EmptyState compact icon={CalendarCheck2} title="Немає записів за період" />
                )}
              </CardBody>
            </Card>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Рівень скасувань"
              value={`${totals.cancellationRate}%`}
              delta={deltaPercent(totals.cancellationRate, totals.prevCancellationRate)}
              icon={CalendarX2}
              tone={totals.cancellationRate > 20 ? "danger" : "warning"}
              invertDelta
            />
            <StatCard
              label="Не прийшли (no-show)"
              value={`${totals.noShowRate}%`}
              icon={Users}
              tone={totals.noShowRate > 10 ? "danger" : "info"}
              invertDelta
            />
            <StatCard label="Завершено візитів" value={totals.completed} icon={CalendarCheck2} tone="success" />
            <StatCard label="Повторні клієнти" value={totals.returningClients} icon={Users} tone="brand" />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader title="Виручка по співробітниках" description="За обраний період" />
              <CardBody>
                <HorizontalBars
                  items={data.byEmployee.map((employee) => ({
                    id: employee.id,
                    label: employee.name,
                    value: employee.revenue,
                    sublabel: `${employee.appointments} записів`,
                  }))}
                  formatValue={(value) => formatMoney(Math.round(value * 100), currency)}
                  emptyLabel="Ще немає оплат за період"
                />
              </CardBody>
            </Card>

            <Card>
              <CardHeader title="Популярні послуги" description="За кількістю записів" />
              <CardBody>
                <HorizontalBars
                  items={data.byService.map((service) => ({
                    id: service.id,
                    label: service.name,
                    value: service.count,
                    sublabel: formatMoney(Math.round(service.revenue * 100), currency, {
                      compact: true,
                    }),
                  }))}
                  emptyLabel="Ще немає записів за період"
                />
              </CardBody>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
