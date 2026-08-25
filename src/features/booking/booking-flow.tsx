"use client";

import * as React from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  CalendarPlus,
  CalendarX2,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Loader2,
  MapPin,
  Moon,
  Phone,
  Sparkles,
  Sun,
  Sunrise,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Confetti, DrawnCheck } from "@/components/shared/celebrate";
import { VenueCard } from "@/features/booking/venue-card";
import { Avatar } from "@/components/ui/avatar";
import { Field, Input, Textarea } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { cn, pluralUk } from "@/lib/utils";
import { formatMoney } from "@/lib/money";
import {
  addDays,
  durationLabel,
  formatDateUk,
  isSameDay,
  startOfDay,
  toDateKey,
  WEEKDAYS_SHORT_UK,
} from "@/lib/time";
import {
  createPublicBookingAction,
  getPublicAvailableDaysAction,
  getPublicSlotsAction,
  type BookingConfirmation,
} from "@/server/actions/booking";

type Organization = {
  name: string;
  slug: string;
  about: string | null;
  phone: string | null;
  address: string | null;
  logoUrl: string | null;
  brandColor: string;
  currency: string;
  enabled: boolean;
  requireEmail: boolean;
  welcomeText: string | null;
  horizonDays: number;
  instagramUrl: string | null;
  facebookUrl: string | null;
  tiktokUrl: string | null;
  /** Готове посилання на карти — зібране на сервері з mapsUrl або адреси. */
  mapUrl: string | null;
};

export type GalleryPhoto = { id: string; url: string };

export type BusinessHour = {
  weekday: number;
  openMinute: number;
  closeMinute: number;
  isClosed: boolean;
};

type Service = {
  id: string;
  name: string;
  description: string | null;
  durationMin: number;
  priceCents: number;
  color: string;
  categoryName: string | null;
  employeeIds: string[];
};

type Employee = {
  id: string;
  name: string;
  position: string | null;
  color: string;
  avatarUrl: string | null;
  bio: string | null;
};

const STEP_LABELS = ["Послуга", "Майстер", "Час", "Контакти"];

/**
 * Слоти по частинах дня.
 *
 * Тридцять кнопок поспіль клієнт не читає — він шукає очима «після роботи»
 * або «зранку». Групування робить те саме, що робить адміністраторка по
 * телефону: звужує вибір до частини дня, а вже потім до часу.
 */
const SLOT_GROUPS = [
  { label: "Ранок", icon: Sunrise, until: 12 },
  { label: "День", icon: Sun, until: 17 },
  { label: "Вечір", icon: Moon, until: 24 },
] as const;

function groupSlots(slots: string[]) {
  return SLOT_GROUPS.map((group, index) => {
    const from = index === 0 ? 0 : SLOT_GROUPS[index - 1].until;
    return {
      label: group.label,
      icon: group.icon,
      slots: slots.filter((slot) => {
        const hour = Number.parseInt(slot.slice(0, 2), 10);
        return hour >= from && hour < group.until;
      }),
    };
  }).filter((group) => group.slots.length > 0);
}

export function BookingFlow({
  organization,
  services,
  employees,
  gallery = [],
  hours = [],
}: {
  organization: Organization;
  services: Service[];
  employees: Employee[];
  gallery?: GalleryPhoto[];
  hours?: BusinessHour[];
}) {
  const [step, setStep] = React.useState(0);
  const [service, setService] = React.useState<Service | null>(null);
  const [employee, setEmployee] = React.useState<Employee | null>(null);
  const [dateKey, setDateKey] = React.useState<string | null>(null);
  const [time, setTime] = React.useState<string | null>(null);
  const [slots, setSlots] = React.useState<string[]>([]);
  const [availableDays, setAvailableDays] = React.useState<Set<string> | null>(null);
  // useTransition замість ручних прапорців: стан «завантажується» веде сам React,
  // а setState трапляється після await — не синхронно в тілі ефекту.
  const [loadingSlots, startSlots] = React.useTransition();
  const [loadingDays, startDays] = React.useTransition();
  const [weekOffset, setWeekOffset] = React.useState(0);
  const [submitting, setSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({});
  const [confirmation, setConfirmation] = React.useState<BookingConfirmation | null>(null);

  const accent = organization.brandColor;

  const eligibleEmployees = React.useMemo(() => {
    if (!service) return employees;
    if (service.employeeIds.length === 0) return employees;
    return employees.filter((item) => service.employeeIds.includes(item.id));
  }, [service, employees]);

  // Дні з вільними слотами — щоб клієнт не тикав у порожні дати.
  React.useEffect(() => {
    if (!service || !employee) return;
    let cancelled = false;
    startDays(async () => {
      const result = await getPublicAvailableDaysAction({
        slug: organization.slug,
        serviceId: service.id,
        employeeId: employee.id,
        fromDate: toDateKey(new Date()),
        days: Math.min(organization.horizonDays, 45),
      });
      if (cancelled) return;
      setAvailableDays(new Set(result.ok ? result.data : []));
    });
    return () => {
      cancelled = true;
    };
  }, [service, employee, organization.slug, organization.horizonDays]);

  React.useEffect(() => {
    if (!service || !employee || !dateKey) return;
    let cancelled = false;
    startSlots(async () => {
      setTime(null);
      const result = await getPublicSlotsAction({
        slug: organization.slug,
        serviceId: service.id,
        employeeId: employee.id,
        date: dateKey,
      });
      if (cancelled) return;
      setSlots(result.ok ? result.data.slots : []);
    });
    return () => {
      cancelled = true;
    };
  }, [service, employee, dateKey, organization.slug]);

  const submit = async (formData: FormData) => {
    if (!service || !employee || !dateKey || !time) return;
    setSubmitting(true);
    setError(null);
    setFieldErrors({});

    const result = await createPublicBookingAction({
      slug: organization.slug,
      serviceId: service.id,
      employeeId: employee.id,
      date: dateKey,
      time,
      name: String(formData.get("name") ?? ""),
      phone: String(formData.get("phone") ?? ""),
      email: String(formData.get("email") ?? "") || undefined,
      comment: String(formData.get("comment") ?? "") || undefined,
    });
    setSubmitting(false);

    if (result.ok) {
      setConfirmation(result.data);
    } else {
      setError(result.error);
      setFieldErrors(result.fieldErrors ?? {});
    }
  };

  if (!organization.enabled) {
    return (
      <Shell organization={organization} accent={accent} gallery={gallery} hours={hours}>
        <div className="card">
          <EmptyState
            icon={CalendarX2}
            title="Онлайн-запис тимчасово недоступний"
            description={
              organization.phone
                ? `Зателефонуйте нам: ${organization.phone} — ми запишемо вас вручну.`
                : "Спробуйте, будь ласка, пізніше або зв'яжіться з нами."
            }
          />
        </div>
      </Shell>
    );
  }

  if (services.length === 0 || employees.length === 0) {
    return (
      <Shell organization={organization} accent={accent} gallery={gallery} hours={hours}>
        <div className="card">
          <EmptyState
            icon={Sparkles}
            title="Запис ще налаштовується"
            description="Найближчим часом тут з'являться доступні послуги."
          />
        </div>
      </Shell>
    );
  }

  if (confirmation) {
    return (
      <Shell organization={organization} accent={accent} gallery={gallery} hours={hours}>
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          className="card relative overflow-hidden p-8 text-center"
        >
          {confirmation.autoConfirmed && <Confetti />}

          <DrawnCheck color={accent} />

          <h2 className="mt-5 text-[22px] font-semibold tracking-[-0.02em] text-[var(--fg)]">
            {confirmation.autoConfirmed ? "Вас записано" : "Заявку прийнято"}
          </h2>
          <p className="mt-2 text-[14px] text-[var(--fg-muted)]">
            {confirmation.autoConfirmed
              ? "Чекаємо на вас! Деталі візиту нижче."
              : "Ми зв'яжемось із вами, щоб підтвердити час."}
          </p>

          <div className="animate-fade-up mt-6 space-y-3 rounded-[14px] border border-[var(--border)] bg-[var(--surface-2)] p-5 text-left [animation-delay:220ms]">
            <Row label="Дата" value={formatDateUk(new Date(`${confirmation.date}T00:00:00`), { weekday: true })} />
            <Row label="Час" value={confirmation.time} />
            <Row label="Послуга" value={confirmation.serviceName} />
            <Row label="Майстер" value={confirmation.employeeName} />
            <Row
              label="Вартість"
              value={formatMoney(confirmation.priceCents, confirmation.currency)}
            />
          </div>

          {/* Найкорисніша кнопка на цьому екрані: візит одразу лягає в
              телефон клієнта з нагадуванням за годину — і його вже не
              «забули». Це працює навіть без налаштованих SMS. */}
          <a
            href={`/api/booking/${confirmation.appointmentId}/calendar.ics`}
            download
            className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-[var(--border-strong)] text-[14px] font-medium text-[var(--fg)] transition-all duration-150 hover:-translate-y-px hover:bg-[var(--surface-hover)] active:translate-y-0"
          >
            <CalendarPlus className="h-4 w-4" />
            Додати в календар
          </a>

          <p className="mt-5 text-[13px] text-[var(--fg-muted)]">
            {organization.name}
            {organization.phone && ` · ${organization.phone}`}
          </p>

          <Button
            variant="ghost"
            className="mt-4"
            onClick={() => {
              setConfirmation(null);
              setStep(0);
              setService(null);
              setEmployee(null);
              setDateKey(null);
              setTime(null);
            }}
          >
            Записатися ще раз
          </Button>
        </motion.div>
      </Shell>
    );
  }

  const weekStart = addDays(startOfDay(new Date()), weekOffset * 7);
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const maxOffset = Math.ceil(Math.min(organization.horizonDays, 45) / 7) - 1;

  return (
    <Shell organization={organization} accent={accent} gallery={gallery} hours={hours}>
      <BookingSteps step={step} accent={accent} onJump={setStep} />

      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, x: 10 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -10 }}
          transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
        >
          {step === 0 && (
            <div>
              <h2 className="mb-4 text-[18px] font-semibold tracking-tight text-[var(--fg)]">
                Виберіть послугу
              </h2>
              <div className="stagger space-y-2.5">
                {services.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setService(item);
                      setEmployee(null);
                      setDateKey(null);
                      setStep(1);
                    }}
                    className="card group flex w-full items-center gap-4 p-4 text-left transition-all duration-200 ease-[var(--ease-out-expo)] hover:-translate-y-0.5 hover:border-[var(--border-strong)] hover:shadow-[var(--shadow-lift)]"
                  >
                    <span
                      className="h-11 w-1 shrink-0 rounded-full transition-all duration-200 ease-[var(--ease-out-expo)] group-hover:h-14 group-hover:w-1.5"
                      style={{ background: item.color }}
                      aria-hidden
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[14.5px] font-medium text-[var(--fg)]">
                        {item.name}
                      </span>
                      {item.description && (
                        <span className="mt-0.5 block line-clamp-1 text-[12.5px] text-[var(--fg-muted)]">
                          {item.description}
                        </span>
                      )}
                      <span className="mt-1 flex items-center gap-1.5 text-[12.5px] text-[var(--fg-subtle)]">
                        <Clock className="h-3 w-3" />
                        {durationLabel(item.durationMin)}
                      </span>
                    </span>
                    <span className="shrink-0 text-[15px] font-semibold" style={{ color: accent }}>
                      {formatMoney(item.priceCents, organization.currency)}
                    </span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-[var(--fg-subtle)] transition-transform duration-200 group-hover:translate-x-0.5" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {step === 1 && (
            <div>
              <BackButton onClick={() => setStep(0)} />
              <h2 className="mb-4 text-[18px] font-semibold tracking-tight text-[var(--fg)]">
                Виберіть майстра
              </h2>
              {eligibleEmployees.length === 0 ? (
                <div className="card">
                  <EmptyState
                    compact
                    icon={CalendarX2}
                    title="Немає доступних майстрів"
                    description="Оберіть іншу послугу."
                  />
                </div>
              ) : (
                <div className="stagger space-y-2.5">
                  {eligibleEmployees.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setEmployee(item);
                        setDateKey(null);
                        setStep(2);
                      }}
                      className="card group flex w-full items-center gap-3.5 p-4 text-left transition-all duration-200 ease-[var(--ease-out-expo)] hover:-translate-y-0.5 hover:border-[var(--border-strong)] hover:shadow-[var(--shadow-lift)]"
                    >
                      <Avatar name={item.name} src={item.avatarUrl} color={item.color} size="md" />
                      <span className="min-w-0 flex-1">
                        <span className="block text-[14.5px] font-medium text-[var(--fg)]">
                          {item.name}
                        </span>
                        <span className="block truncate text-[12.5px] text-[var(--fg-muted)]">
                          {item.position ?? "Спеціаліст"}
                        </span>
                      </span>
                      <ChevronRight className="h-4 w-4 shrink-0 text-[var(--fg-subtle)] transition-transform duration-200 group-hover:translate-x-0.5" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {step === 2 && (
            <div>
              <BackButton onClick={() => setStep(1)} />
              <h2 className="mb-4 text-[18px] font-semibold tracking-tight text-[var(--fg)]">
                Виберіть дату й час
              </h2>

              <div className="card p-4">
                <div className="mb-3 flex items-center justify-between">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    disabled={weekOffset === 0}
                    onClick={() => setWeekOffset((v) => Math.max(0, v - 1))}
                    aria-label="Попередній тиждень"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <p className="text-[13px] font-medium text-[var(--fg)]">
                    {formatDateUk(weekDays[0])} — {formatDateUk(weekDays[6])}
                  </p>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    disabled={weekOffset >= maxOffset}
                    onClick={() => setWeekOffset((v) => Math.min(maxOffset, v + 1))}
                    aria-label="Наступний тиждень"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>

                <div className="grid grid-cols-7 gap-1.5">
                  {weekDays.map((date) => {
                    const key = toDateKey(date);
                    const past = date < startOfDay(new Date());
                    const available = availableDays === null || availableDays.has(key);
                    const disabled = past || !available;
                    const selected = dateKey === key;

                    return (
                      <button
                        key={key}
                        type="button"
                        disabled={disabled}
                        onClick={() => setDateKey(key)}
                        className={cn(
                          "flex flex-col items-center gap-0.5 rounded-xl border py-2 transition-colors",
                          selected
                            ? "border-transparent text-white"
                            : disabled
                              ? "cursor-not-allowed border-[var(--border)] bg-[var(--surface-2)] text-[var(--fg-subtle)] opacity-50"
                              : "border-[var(--border)] bg-[var(--surface-2)] text-[var(--fg)] hover:border-[var(--border-strong)]",
                        )}
                        style={selected ? { background: accent } : undefined}
                      >
                        <span className="text-[10.5px] font-medium opacity-70">
                          {WEEKDAYS_SHORT_UK[date.getDay()]}
                        </span>
                        <span className="text-[14px] font-semibold tabular-nums">
                          {date.getDate()}
                        </span>
                        {isSameDay(date, new Date()) && (
                          <span className="h-1 w-1 rounded-full bg-current" />
                        )}
                      </button>
                    );
                  })}
                </div>

                {loadingDays && (
                  <p className="mt-3 flex items-center justify-center gap-2 text-[12.5px] text-[var(--fg-subtle)]">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Шукаємо вільні дати…
                  </p>
                )}
              </div>

              {dateKey && (
                <div className="mt-4">
                  <p className="mb-2.5 text-[13px] font-medium text-[var(--fg)]">
                    Вільний час на {formatDateUk(new Date(`${dateKey}T00:00:00`))}
                  </p>
                  {loadingSlots ? (
                    <div className="flex flex-wrap gap-2">
                      {Array.from({ length: 10 }).map((_, i) => (
                        <Skeleton key={i} className="h-10 w-[74px] rounded-xl" />
                      ))}
                    </div>
                  ) : slots.length === 0 ? (
                    <div className="card">
                      <EmptyState
                        compact
                        icon={CalendarX2}
                        title="На цю дату вільних місць немає"
                        description="Спробуйте обрати інший день або іншого майстра."
                      />
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {groupSlots(slots).map((group) => (
                        <div key={group.label}>
                          <p className="mb-2 flex items-center gap-1.5 text-[11.5px] font-medium tracking-wide text-[var(--fg-subtle)] uppercase">
                            <group.icon className="h-3.5 w-3.5" />
                            {group.label}
                            <span className="font-normal normal-case">
                              · {group.slots.length}{" "}
                              {pluralUk(group.slots.length, "місце", "місця", "місць")}
                            </span>
                          </p>
                          <div className="stagger flex flex-wrap gap-2">
                            {group.slots.map((slot) => (
                              <button
                                key={slot}
                                type="button"
                                onClick={() => setTime(slot)}
                                className={cn(
                                  "rounded-xl border px-4 py-2.5 text-[13.5px] font-medium tabular-nums",
                                  "transition-all duration-200 ease-[var(--ease-out-expo)]",
                                  time === slot
                                    ? "border-transparent text-white shadow-[var(--shadow-lift)]"
                                    : "border-[var(--border)] bg-[var(--surface)] text-[var(--fg)] hover:-translate-y-0.5 hover:border-[var(--border-strong)] hover:shadow-[var(--shadow-soft)]",
                                )}
                                style={time === slot ? { background: accent } : undefined}
                              >
                                {slot}
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {time && (
                <Button
                  className="mt-5 w-full"
                  size="lg"
                  style={{ background: accent }}
                  onClick={() => setStep(3)}
                >
                  Далі
                  <ChevronRight className="h-4 w-4" />
                </Button>
              )}
            </div>
          )}

          {step === 3 && service && employee && dateKey && time && (
            <div>
              <BackButton onClick={() => setStep(2)} />
              <h2 className="mb-4 text-[18px] font-semibold tracking-tight text-[var(--fg)]">
                Ваші контакти
              </h2>

              <div className="card mb-4 p-4">
                <p className="text-[12px] text-[var(--fg-subtle)]">Ваш запис</p>
                <p className="mt-1 text-[14.5px] font-medium text-[var(--fg)]">
                  {service.name} · {employee.name}
                </p>
                <p className="mt-0.5 text-[13px] text-[var(--fg-muted)]">
                  {formatDateUk(new Date(`${dateKey}T00:00:00`), { weekday: true })} о {time} ·{" "}
                  {formatMoney(service.priceCents, organization.currency)}
                </p>
              </div>

              <form action={submit} className="card space-y-4 p-5">
                <Field label="Ваше ім'я" error={fieldErrors.name}>
                  <Input name="name" required autoFocus placeholder="Анна" />
                </Field>
                <Field label="Телефон" error={fieldErrors.phone}>
                  <Input name="phone" type="tel" required placeholder="+380 XX XXX XX XX" />
                </Field>
                <Field
                  label="Email"
                  hint={organization.requireEmail ? undefined : "необов'язково"}
                  error={fieldErrors.email}
                >
                  <Input
                    name="email"
                    type="email"
                    required={organization.requireEmail}
                    placeholder="anna@email.com"
                  />
                </Field>
                <Field label="Коментар" hint="необов'язково">
                  <Textarea name="comment" rows={2} placeholder="Побажання до візиту" />
                </Field>

                {error && (
                  <p className="rounded-xl border border-[var(--danger)]/25 bg-[var(--danger-soft)] px-3.5 py-3 text-[13px] text-[var(--danger)]">
                    {error}
                  </p>
                )}

                <Button
                  type="submit"
                  size="lg"
                  className="w-full"
                  style={{ background: accent }}
                  loading={submitting}
                >
                  Забронювати
                </Button>

                <p className="text-center text-[11.5px] leading-relaxed text-[var(--fg-subtle)]">
                  Натискаючи «Забронювати», ви погоджуєтесь на обробку контактних даних для
                  підтвердження візиту.
                </p>
              </form>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </Shell>
  );
}

/**
 * Індикатор кроків.
 *
 * Пройдені кроки позначаються галочкою і лишаються клікабельними —
 * повернутися й змінити послугу можна з будь-якого місця, не втрачаючи
 * решту вибору. З'єднувальна лінія заповнюється, а не просто перефарбовується:
 * видно напрямок руху.
 */
function BookingSteps({
  step,
  accent,
  onJump,
}: {
  step: number;
  accent: string;
  onJump: (index: number) => void;
}) {
  return (
    <div className="mb-6 flex items-center">
      {STEP_LABELS.map((label, index) => {
        const done = index < step;
        const current = index === step;

        return (
          <React.Fragment key={label}>
            <button
              type="button"
              disabled={index > step}
              onClick={() => done && onJump(index)}
              aria-current={current ? "step" : undefined}
              className={cn(
                "group flex shrink-0 items-center gap-2",
                done && "cursor-pointer",
                index > step && "cursor-default",
              )}
            >
              <span
                className={cn(
                  "flex h-6 w-6 items-center justify-center rounded-full text-[11.5px] font-semibold",
                  "transition-all duration-300 ease-[var(--ease-spring)]",
                  done || current ? "text-white" : "text-[var(--fg-subtle)]",
                  !done && !current && "border border-[var(--border-strong)]",
                  done && "group-hover:scale-110",
                )}
                style={done || current ? { background: accent } : undefined}
              >
                {done ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : index + 1}
              </span>
              <span
                className={cn(
                  "hidden text-[12.5px] font-medium whitespace-nowrap transition-colors sm:block",
                  current
                    ? "text-[var(--fg)]"
                    : done
                      ? "text-[var(--fg-muted)] group-hover:text-[var(--fg)]"
                      : "text-[var(--fg-subtle)]",
                )}
              >
                {label}
              </span>
            </button>

            {index < STEP_LABELS.length - 1 && (
              <div className="mx-2 h-0.5 flex-1 overflow-hidden rounded-full bg-[var(--border)]">
                <div
                  className="h-full rounded-full transition-transform duration-500 ease-[var(--ease-out-expo)]"
                  style={{
                    background: accent,
                    transform: `scaleX(${done ? 1 : 0})`,
                    transformOrigin: "left",
                  }}
                />
              </div>
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

function Shell({
  organization,
  accent,
  gallery = [],
  hours = [],
  children,
}: {
  gallery?: GalleryPhoto[];
  hours?: BusinessHour[];
  organization: Organization;
  accent: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen">
      <div
        className="relative overflow-hidden px-5 pt-12 pb-20"
        style={{
          background: `linear-gradient(135deg, ${accent}, color-mix(in oklab, ${accent} 55%, #050B1F))`,
        }}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.09]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.7) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.7) 1px, transparent 1px)",
            backgroundSize: "48px 48px",
            maskImage: "radial-gradient(circle at 50% 0%, black, transparent 70%)",
          }}
        />
        <div className="relative mx-auto max-w-[620px] text-center">
          {organization.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={organization.logoUrl}
              alt={organization.name}
              className="mx-auto mb-4 h-16 w-16 rounded-2xl object-cover ring-4 ring-white/20"
            />
          ) : (
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/15 text-2xl font-semibold text-white ring-4 ring-white/10">
              {organization.name.slice(0, 2).toUpperCase()}
            </div>
          )}
          <h1 className="text-[26px] leading-tight font-semibold tracking-tight text-white">
            {organization.name}
          </h1>
          {(organization.welcomeText || organization.about) && (
            <p className="mx-auto mt-2.5 max-w-md text-[14px] leading-relaxed text-balance text-white/85">
              {organization.welcomeText ?? organization.about}
            </p>
          )}
          <div className="mt-4 flex flex-wrap items-center justify-center gap-x-5 gap-y-1.5 text-[12.5px] text-white/75">
            {organization.phone && (
              <a href={`tel:${organization.phone}`} className="flex items-center gap-1.5 hover:text-white">
                <Phone className="h-3.5 w-3.5" />
                {organization.phone}
              </a>
            )}
            {organization.address &&
              (organization.mapUrl ? (
                <a
                  href={organization.mapUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="group flex items-center gap-1.5 hover:text-white"
                >
                  <MapPin className="h-3.5 w-3.5" />
                  <span className="underline decoration-white/30 underline-offset-2 group-hover:decoration-white">
                    {organization.address}
                  </span>
                </a>
              ) : (
                <span className="flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5" />
                  {organization.address}
                </span>
              ))}
          </div>
        </div>
      </div>

      <div className="relative z-10 mx-auto -mt-10 max-w-[620px] px-5 pb-16">
        <div className="rounded-[20px] border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow-pop)] sm:p-6">
          {children}
        </div>

        <VenueCard
          name={organization.name}
          address={organization.address}
          mapUrl={organization.mapUrl}
          gallery={gallery}
          hours={hours}
          instagramUrl={organization.instagramUrl}
          facebookUrl={organization.facebookUrl}
          tiktokUrl={organization.tiktokUrl}
          accent={accent}
        />

        <p className="mt-6 text-center text-[12px] text-[var(--fg-subtle)]">
          Працює на{" "}
          <Link href="/" className="font-medium text-[var(--fg-muted)] hover:underline">
            crm.factory
          </Link>
        </p>
      </div>
    </div>
  );
}

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mb-3 inline-flex items-center gap-1.5 text-[13px] font-medium text-[var(--fg-muted)] transition-colors hover:text-[var(--fg)]"
    >
      <ArrowLeft className="h-3.5 w-3.5" />
      Назад
    </button>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-[13px] text-[var(--fg-muted)]">{label}</span>
      <span className="text-[13.5px] font-medium text-[var(--fg)]">{value}</span>
    </div>
  );
}
