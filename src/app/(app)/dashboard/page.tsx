import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import {
  ArrowRight,
  CalendarCheck2,
  CalendarPlus,
  CalendarX2,
  Sparkles,
  UserPlus,
  Users,
  Wallet,
} from "lucide-react";
import { requireAuth, ownEmployeeFilter } from "@/lib/auth/context";
import { getDashboardData, getRevenueSeries } from "@/server/queries/dashboard";
import { StatCard } from "@/components/shared/stat-card";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { SkeletonStats, SkeletonList } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { TodaySchedule } from "@/features/dashboard/today-schedule";
import { RevenueChart } from "@/components/charts/revenue-chart";
import { HorizontalBars } from "@/components/charts/horizontal-bars";
import { ClientStatusBadge } from "@/components/shared/status";
import { formatMoney } from "@/lib/money";
import { deltaPercent } from "@/lib/utils";
import { formatDateUk, greetingUk, formatTime, relativeUk } from "@/lib/time";

export const metadata: Metadata = { title: "Головна" };

export default async function DashboardPage() {
  const ctx = await requireAuth();

  return (
    <div className="mx-auto max-w-[1400px]">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[24px] leading-tight font-semibold tracking-tight text-[var(--fg)]">
            {greetingUk()}, {ctx.user.name.split(" ")[0]} 👋
          </h1>
          <p className="mt-1.5 text-[13.5px] text-[var(--fg-muted)]">
            Сьогодні, {formatDateUk(new Date(), { weekday: true })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {ctx.permissions.has("client.create") && (
            <Link href="/clients?new=1">
              <Button variant="secondary" size="md">
                <UserPlus className="h-4 w-4" />
                <span className="hidden sm:inline">Додати клієнта</span>
              </Button>
            </Link>
          )}
          {ctx.permissions.has("appointment.create") && (
            <Link href="/calendar?new=1">
              <Button size="md">
                <CalendarPlus className="h-4 w-4" />
                Новий запис
              </Button>
            </Link>
          )}
        </div>
      </div>

      <Suspense fallback={<DashboardSkeleton />}>
        <DashboardContent />
      </Suspense>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <SkeletonStats />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <SkeletonList rows={5} />
        </div>
        <SkeletonList rows={3} />
      </div>
    </div>
  );
}

async function DashboardContent() {
  const ctx = await requireAuth();
  const employeeFilter = ownEmployeeFilter(ctx);
  const [data, revenueSeries] = await Promise.all([
    getDashboardData(ctx.organization.id, employeeFilter),
    getRevenueSeries(ctx.organization.id, 14),
  ]);

  const { stats } = data;
  const currency = ctx.organization.currency;
  const hasAnyData = stats.totalClients > 0 || data.todayAppointments.length > 0;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Записів сьогодні"
          value={stats.todayCount}
          delta={deltaPercent(stats.todayCount, stats.yesterdayCount)}
          hint="проти вчора"
          icon={CalendarCheck2}
          tone="brand"
        />
        <StatCard
          label="Нових клієнтів"
          value={stats.newClientsWeek}
          delta={deltaPercent(stats.newClientsWeek, stats.newClientsPrevWeek)}
          hint="за 7 днів"
          icon={Users}
          tone="info"
        />
        <StatCard
          label="Виручка сьогодні"
          value={formatMoney(stats.revenueTodayCents, currency)}
          delta={deltaPercent(stats.revenueTodayCents, stats.revenueYesterdayCents)}
          hint="проти вчора"
          icon={Wallet}
          tone="success"
        />
        <StatCard
          label="Скасування"
          value={stats.cancelledToday}
          delta={deltaPercent(stats.cancelledToday, stats.cancelledYesterday)}
          hint="сьогодні"
          icon={CalendarX2}
          tone="danger"
          invertDelta
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <TodaySchedule
            items={data.todayAppointments}
            currency={currency}
            canCreate={ctx.permissions.has("appointment.create")}
          />

          {ctx.permissions.has("analytics.view") && (
            <Card>
              <CardHeader
                title="Виручка за 14 днів"
                description={`Цього місяця: ${formatMoney(stats.revenueMonthCents, currency)}`}
                action={
                  <Link href="/analytics">
                    <Button variant="ghost" size="sm">
                      Аналітика
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Button>
                  </Link>
                }
              />
              <CardBody className="pr-4 pl-1">
                {revenueSeries.some((point) => point.value > 0) ? (
                  <RevenueChart
                    data={revenueSeries.map((p) => ({ date: p.date, revenue: p.value }))}
                    currency={currency}
                    height={240}
                    compact
                  />
                ) : (
                  <EmptyState
                    compact
                    icon={Wallet}
                    title="Ще немає продажів"
                    description="Позначайте записи як завершені — виручка порахується автоматично."
                  />
                )}
              </CardBody>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Найближчі записи" />
            {data.upcoming.length === 0 ? (
              <EmptyState
                compact
                icon={CalendarPlus}
                title="Попереду вільно"
                description="Наступних записів поки немає."
              />
            ) : (
              <ul className="divide-y divide-[var(--border)]">
                {data.upcoming.map((item) => (
                  <li key={item.id} className="flex items-center gap-3 px-5 py-3">
                    <span
                      className="h-8 w-1 shrink-0 rounded-full"
                      style={{ background: item.service.color }}
                      aria-hidden
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13.5px] font-medium text-[var(--fg)]">
                        {item.client.firstName} {item.client.lastName ?? ""}
                      </p>
                      <p className="truncate text-[12px] text-[var(--fg-muted)]">
                        {item.service.name} · {item.employee.name}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-[12.5px] font-medium text-[var(--fg)]">
                        {formatTime(item.startAt)}
                      </p>
                      <p className="text-[11.5px] text-[var(--fg-subtle)]">
                        {relativeUk(item.startAt)}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <CardHeader title="Популярні послуги" description="За останні 30 днів" />
            <CardBody>
              <HorizontalBars
                items={data.topServices.map((service) => ({
                  id: service.id,
                  label: service.name,
                  value: service.count,
                  sublabel: formatMoney(service.revenueCents, currency, { compact: true }),
                }))}
                emptyLabel="Ще немає завершених записів"
              />
            </CardBody>
          </Card>

          {ctx.permissions.has("client.view") && (
            <Card>
              <CardHeader
                title="Нові клієнти"
                action={
                  <Link href="/clients">
                    <Button variant="ghost" size="sm">
                      Усі
                    </Button>
                  </Link>
                }
              />
              {data.recentClients.length === 0 ? (
                <EmptyState
                  compact
                  icon={Users}
                  title="Клієнтська база порожня"
                  description="Додайте першого клієнта, щоб бачити історію візитів."
                  action={
                    ctx.permissions.has("client.create") ? (
                      <Link href="/clients?new=1">
                        <Button size="sm">
                          <UserPlus className="h-4 w-4" />
                          Додати клієнта
                        </Button>
                      </Link>
                    ) : undefined
                  }
                />
              ) : (
                <ul className="divide-y divide-[var(--border)]">
                  {data.recentClients.map((client) => (
                    <li key={client.id}>
                      <Link
                        href={`/clients/${client.id}`}
                        className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-[var(--surface-hover)]"
                      >
                        <Avatar name={`${client.firstName} ${client.lastName ?? ""}`} size="sm" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[13.5px] font-medium text-[var(--fg)]">
                            {client.firstName} {client.lastName ?? ""}
                          </p>
                          <p className="truncate text-[12px] text-[var(--fg-subtle)]">
                            {client.phone ?? relativeUk(client.createdAt)}
                          </p>
                        </div>
                        <ClientStatusBadge status={client.status} />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          )}
        </div>
      </div>

      {!hasAnyData && (
        <Card className="border-dashed">
          <CardBody>
            <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--primary-soft)] text-[var(--primary)]">
                <Sparkles className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[14.5px] font-semibold text-[var(--fg)]">
                  Ваш workspace готовий до роботи
                </p>
                <p className="mt-1 text-[13px] text-[var(--fg-muted)]">
                  Додайте послуги й команду, поділіться посиланням на онлайн-запис — і клієнти
                  почнуть записуватись самі.
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                <Link href="/services">
                  <Button variant="secondary" size="sm">
                    Послуги
                  </Button>
                </Link>
                <Link href="/settings/booking">
                  <Button size="sm">
                    Онлайн-запис
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                </Link>
              </div>
            </div>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
