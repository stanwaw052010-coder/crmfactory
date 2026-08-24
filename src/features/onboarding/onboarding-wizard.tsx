"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  CalendarClock,
  Check,
  Link2,
  Plus,
  Sparkles,
  Trash2,
  UserRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { cn, slugify } from "@/lib/utils";
import { CURRENCIES, currencySymbol, parseMoneyToCents } from "@/lib/money";
import { minutesToTime, timeToMinutes, WEEKDAYS_SHORT_UK } from "@/lib/time";
import { completeOnboardingAction } from "@/server/actions/onboarding";

const INDUSTRIES = [
  { value: "Салон краси", services: [["Стрижка", 60, "25"], ["Фарбування", 120, "60"], ["Укладка", 45, "20"]] },
  { value: "Нігтьова студія", services: [["Манікюр", 60, "35"], ["Педикюр", 75, "45"], ["Нарощування", 120, "55"]] },
  { value: "Барбершоп", services: [["Стрижка", 45, "20"], ["Борода", 30, "15"], ["Комплекс", 75, "30"]] },
  { value: "Масаж і СПА", services: [["Класичний масаж", 60, "40"], ["Спортивний масаж", 90, "55"]] },
  { value: "Стоматологія", services: [["Консультація", 30, "20"], ["Чистка", 60, "50"]] },
  { value: "Фітнес / тренер", services: [["Персональне тренування", 60, "30"], ["Консультація", 30, "15"]] },
  { value: "Тату-студія", services: [["Консультація", 30, "0"], ["Сеанс", 180, "150"]] },
  { value: "Автосервіс", services: [["Діагностика", 60, "30"], ["Заміна оливи", 45, "40"]] },
  { value: "Інше", services: [["Консультація", 60, "30"]] },
];

const TIMEZONES = [
  "Europe/Kyiv", "Europe/Warsaw", "Europe/Berlin", "Europe/Brussels",
  "Europe/Prague", "Europe/London", "Europe/Lisbon", "Europe/Madrid",
];

const STEPS = [
  { key: "business", label: "Бізнес", icon: Building2 },
  { key: "services", label: "Послуги", icon: Sparkles },
  { key: "team", label: "Команда", icon: UserRound },
  { key: "hours", label: "Графік", icon: CalendarClock },
  { key: "booking", label: "Онлайн-запис", icon: Link2 },
];

type ServiceDraft = { name: string; durationMin: number; price: string };
type EmployeeDraft = { name: string; position: string };

export function OnboardingWizard({
  organizationName,
  userName,
  defaultSlug,
  appUrl,
}: {
  organizationName: string;
  userName: string;
  defaultSlug: string;
  appUrl: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [step, setStep] = React.useState(0);
  const [saving, setSaving] = React.useState(false);

  const [industry, setIndustry] = React.useState(INDUSTRIES[0].value);
  const [timezone, setTimezone] = React.useState("Europe/Kyiv");
  const [currency, setCurrency] = React.useState("EUR");
  const [services, setServices] = React.useState<ServiceDraft[]>(
    INDUSTRIES[0].services.map(([name, duration, price]) => ({
      name: String(name),
      durationMin: Number(duration),
      price: String(price),
    })),
  );
  const [employees, setEmployees] = React.useState<EmployeeDraft[]>([
    { name: userName, position: "Власник" },
  ]);
  const [openMinute, setOpenMinute] = React.useState(540);
  const [closeMinute, setCloseMinute] = React.useState(1080);
  const [workingDays, setWorkingDays] = React.useState<number[]>([1, 2, 3, 4, 5, 6]);
  const [slug, setSlug] = React.useState(defaultSlug);

  // Зміна сфери підставляє типові послуги — але лише поки їх не редагували.
  const applyIndustry = (value: string) => {
    setIndustry(value);
    const preset = INDUSTRIES.find((item) => item.value === value);
    if (preset) {
      setServices(
        preset.services.map(([name, duration, price]) => ({
          name: String(name),
          durationMin: Number(duration),
          price: String(price),
        })),
      );
    }
  };

  const canContinue = React.useMemo(() => {
    if (step === 0) return industry.length > 0;
    if (step === 1) return services.length > 0 && services.every((s) => s.name.trim().length > 0);
    if (step === 2) return employees.length > 0 && employees.every((e) => e.name.trim().length > 0);
    if (step === 3) return workingDays.length > 0 && closeMinute > openMinute;
    if (step === 4) return slug.length >= 3;
    return true;
  }, [step, industry, services, employees, workingDays, openMinute, closeMinute, slug]);

  const finish = async () => {
    setSaving(true);
    const result = await completeOnboardingAction({
      industry,
      timezone,
      currency,
      slug,
      services: services.map((service) => ({
        name: service.name.trim(),
        durationMin: service.durationMin,
        priceCents: parseMoneyToCents(service.price),
      })),
      employees: employees.map((employee) => ({
        name: employee.name.trim(),
        position: employee.position.trim() || undefined,
      })),
      openMinute,
      closeMinute,
      workingDays,
    });
    setSaving(false);

    if (result.ok) {
      toast.success("Готово!", "Ваш workspace налаштовано");
      router.push("/dashboard");
      router.refresh();
    } else {
      toast.error("Не вдалося зберегти", result.error);
    }
  };

  return (
    <div className="mx-auto w-full max-w-[680px]">
      {/* Прогрес */}
      <div className="mb-8 flex items-center gap-1.5">
        {STEPS.map((item, index) => {
          const done = index < step;
          const active = index === step;
          const Icon = item.icon;
          return (
            <React.Fragment key={item.key}>
              <div className="flex flex-col items-center gap-1.5">
                <div
                  className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-xl transition-colors",
                    done
                      ? "bg-[var(--success)] text-white"
                      : active
                        ? "bg-[var(--primary)] text-white"
                        : "bg-[var(--surface-hover)] text-[var(--fg-subtle)]",
                  )}
                >
                  {done ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                </div>
                <span
                  className={cn(
                    "hidden text-[11px] font-medium sm:block",
                    active ? "text-[var(--fg)]" : "text-[var(--fg-subtle)]",
                  )}
                >
                  {item.label}
                </span>
              </div>
              {index < STEPS.length - 1 && (
                <div
                  className={cn(
                    "mb-5 h-0.5 flex-1 rounded-full transition-colors",
                    index < step ? "bg-[var(--success)]" : "bg-[var(--border)]",
                  )}
                />
              )}
            </React.Fragment>
          );
        })}
      </div>

      <div className="card p-6 sm:p-8">
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -12 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          >
            {step === 0 && (
              <div className="space-y-5">
                <Header
                  title={`Вітаємо в crm.factory, ${userName.split(" ")[0]} 🚀`}
                  description={`Налаштуємо «${organizationName}» за 5 кроків. Усе можна змінити пізніше.`}
                />
                <Field label="Сфера бізнесу" hint="підставимо типові послуги">
                  <Select value={industry} onChange={(e) => applyIndustry(e.target.value)}>
                    {INDUSTRIES.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.value}
                      </option>
                    ))}
                  </Select>
                </Field>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Часовий пояс">
                    <Select value={timezone} onChange={(e) => setTimezone(e.target.value)}>
                      {TIMEZONES.map((zone) => (
                        <option key={zone} value={zone}>
                          {zone}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="Валюта">
                    <Select value={currency} onChange={(e) => setCurrency(e.target.value)}>
                      {CURRENCIES.map((code) => (
                        <option key={code} value={code}>
                          {code} · {currencySymbol(code)}
                        </option>
                      ))}
                    </Select>
                  </Field>
                </div>
              </div>
            )}

            {step === 1 && (
              <div className="space-y-5">
                <Header
                  title="Які послуги ви надаєте?"
                  description="Тривалість і ціна автоматично підставлятимуться при створенні запису."
                />
                <div className="space-y-2">
                  {services.map((service, index) => (
                    <div key={index} className="flex flex-wrap items-end gap-2">
                      <Input
                        value={service.name}
                        onChange={(e) =>
                          setServices((prev) =>
                            prev.map((s, i) => (i === index ? { ...s, name: e.target.value } : s)),
                          )
                        }
                        placeholder="Назва послуги"
                        className="min-w-[160px] flex-1"
                      />
                      <Select
                        value={String(service.durationMin)}
                        onChange={(e) =>
                          setServices((prev) =>
                            prev.map((s, i) =>
                              i === index ? { ...s, durationMin: Number(e.target.value) } : s,
                            ),
                          )
                        }
                        className="w-[110px]"
                      >
                        {[15, 30, 45, 60, 90, 120, 180, 240].map((value) => (
                          <option key={value} value={value}>
                            {value} хв
                          </option>
                        ))}
                      </Select>
                      <div className="relative w-[110px]">
                        <Input
                          value={service.price}
                          onChange={(e) =>
                            setServices((prev) =>
                              prev.map((s, i) => (i === index ? { ...s, price: e.target.value } : s)),
                            )
                          }
                          inputMode="decimal"
                          className="pr-7"
                        />
                        <span className="absolute top-1/2 right-3 -translate-y-1/2 text-[13px] text-[var(--fg-subtle)]">
                          {currencySymbol(currency)}
                        </span>
                      </div>
                      {services.length > 1 && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setServices((prev) => prev.filter((_, i) => i !== index))}
                          aria-label="Видалити"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() =>
                    setServices((prev) => [...prev, { name: "", durationMin: 60, price: "0" }])
                  }
                >
                  <Plus className="h-3.5 w-3.5" />
                  Додати послугу
                </Button>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-5">
                <Header
                  title="Хто працює у вашій команді?"
                  description="У кожного буде власний графік, календар і статистика доходу."
                />
                <div className="space-y-2">
                  {employees.map((employee, index) => (
                    <div key={index} className="flex flex-wrap items-end gap-2">
                      <Input
                        value={employee.name}
                        onChange={(e) =>
                          setEmployees((prev) =>
                            prev.map((x, i) => (i === index ? { ...x, name: e.target.value } : x)),
                          )
                        }
                        placeholder="Ім'я"
                        className="min-w-[140px] flex-1"
                      />
                      <Input
                        value={employee.position}
                        onChange={(e) =>
                          setEmployees((prev) =>
                            prev.map((x, i) => (i === index ? { ...x, position: e.target.value } : x)),
                          )
                        }
                        placeholder="Посада"
                        className="min-w-[140px] flex-1"
                      />
                      {employees.length > 1 && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setEmployees((prev) => prev.filter((_, i) => i !== index))}
                          aria-label="Видалити"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setEmployees((prev) => [...prev, { name: "", position: "" }])}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Додати співробітника
                </Button>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-5">
                <Header
                  title="Коли ви працюєте?"
                  description="Онлайн-запис не запропонує клієнтам час поза цими межами."
                />
                <div>
                  <p className="mb-2 text-[13px] font-medium text-[var(--fg)]">Робочі дні</p>
                  <div className="flex flex-wrap gap-1.5">
                    {[1, 2, 3, 4, 5, 6, 0].map((weekday) => {
                      const active = workingDays.includes(weekday);
                      return (
                        <button
                          key={weekday}
                          type="button"
                          onClick={() =>
                            setWorkingDays((prev) =>
                              prev.includes(weekday)
                                ? prev.filter((d) => d !== weekday)
                                : [...prev, weekday],
                            )
                          }
                          className={cn(
                            "h-10 w-12 rounded-xl border text-[13px] font-medium transition-colors",
                            active
                              ? "border-transparent bg-[var(--primary)] text-white"
                              : "border-[var(--border)] bg-[var(--surface-2)] text-[var(--fg-muted)] hover:border-[var(--border-strong)]",
                          )}
                        >
                          {WEEKDAYS_SHORT_UK[weekday]}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Відкриття">
                    <Input
                      type="time"
                      step={900}
                      value={minutesToTime(openMinute)}
                      onChange={(e) => setOpenMinute(timeToMinutes(e.target.value))}
                    />
                  </Field>
                  <Field label="Закриття">
                    <Input
                      type="time"
                      step={900}
                      value={minutesToTime(closeMinute)}
                      onChange={(e) => setCloseMinute(timeToMinutes(e.target.value))}
                    />
                  </Field>
                </div>
                {closeMinute <= openMinute && (
                  <p className="text-[12.5px] text-[var(--danger)]">
                    Час закриття має бути пізніше за час відкриття.
                  </p>
                )}
              </div>
            )}

            {step === 4 && (
              <div className="space-y-5">
                <Header
                  title="Ваша сторінка онлайн-запису"
                  description="Поділіться цим посиланням — і клієнти записуватимуться самі, без дзвінків."
                />
                <Field label="Адреса сторінки" hint={`${appUrl}/book/`}>
                  <Input
                    value={slug}
                    onChange={(e) => setSlug(slugify(e.target.value))}
                    placeholder="my-business"
                  />
                </Field>
                <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-4 py-3.5">
                  <p className="text-[11.5px] text-[var(--fg-subtle)]">Посилання виглядатиме так</p>
                  <p className="mt-1 truncate text-[14px] font-medium text-[var(--primary)]">
                    {appUrl}/book/{slug || "my-business"}
                  </p>
                </div>
                <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-4">
                  <p className="mb-2 text-[13px] font-medium text-[var(--fg)]">Що буде створено</p>
                  <ul className="space-y-1.5 text-[12.5px] text-[var(--fg-muted)]">
                    <li className="flex items-center gap-2">
                      <Check className="h-3.5 w-3.5 text-[var(--success)]" />
                      {services.length} послуг
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="h-3.5 w-3.5 text-[var(--success)]" />
                      {employees.length} співробітників із графіком{" "}
                      {minutesToTime(openMinute)}–{minutesToTime(closeMinute)}
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="h-3.5 w-3.5 text-[var(--success)]" />
                      Публічна сторінка запису
                    </li>
                  </ul>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        <div className="mt-8 flex items-center justify-between gap-3 border-t border-[var(--border)] pt-5">
          <Button
            variant="ghost"
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={step === 0 || saving}
          >
            <ArrowLeft className="h-4 w-4" />
            Назад
          </Button>

          {step < STEPS.length - 1 ? (
            <Button onClick={() => setStep((s) => s + 1)} disabled={!canContinue}>
              Далі
              <ArrowRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button onClick={finish} loading={saving} disabled={!canContinue}>
              Завершити налаштування
              <ArrowRight className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function Header({ title, description }: { title: string; description: string }) {
  return (
    <div>
      <h2 className="text-[20px] leading-tight font-semibold tracking-tight text-[var(--fg)]">
        {title}
      </h2>
      <p className="mt-1.5 text-[13.5px] text-[var(--fg-muted)]">{description}</p>
    </div>
  );
}
