import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  CreditCard,
  KanbanSquare,
  MessageCircle,
  Phone,
  Sparkles,
  Users,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo, SystemStatus } from "@/components/shared/logo";
import { MarketingNav } from "@/features/marketing/marketing-nav";
import { DashboardPreview } from "@/features/marketing/dashboard-preview";

export const metadata: Metadata = {
  title: "crm.factory — CRM, яка тримає ваш бізнес під контролем",
  description:
    "Клієнти, записи, команда, продажі та аналітика — в одній системі. Онлайн-запис, нагадування та воронка продажів для сервісного бізнесу.",
};

const PROBLEMS = [
  { icon: MessageCircle, title: "Заявки в Direct", text: "Instagram, Telegram, Viber — і все в різних місцях" },
  { icon: Phone, title: "Забуті дзвінки", text: "Менеджер обіцяв передзвонити — і не передзвонив" },
  { icon: CalendarDays, title: "Пропущені записи", text: "Клієнт не прийшов, бо просто забув про візит" },
];

const FEATURES = [
  {
    icon: CalendarDays,
    title: "Записи",
    text: "Календар на день, тиждень і місяць. Перенесення перетягуванням, перевірка конфліктів, статуси візитів.",
  },
  {
    icon: Users,
    title: "Клієнти",
    text: "Історія візитів, суми, вподобання та внутрішні нотатки менеджера — усе в картці клієнта.",
  },
  {
    icon: Sparkles,
    title: "Команда",
    text: "Графіки, перерви, відпустки та послуги кожного майстра. Ролі й права доступу.",
  },
  {
    icon: CreditCard,
    title: "Продажі",
    text: "Оплати за записами й ручні продажі. Виручка за день, тиждень і місяць.",
  },
  {
    icon: BarChart3,
    title: "Аналітика",
    text: "Виручка, середній чек, скасування, no-show і результати кожного співробітника.",
  },
  {
    icon: KanbanSquare,
    title: "Воронка",
    text: "Заявки з месенджерів проходять етапи: нова → зв'язалися → записані → відвідали.",
  },
];

const STEPS = [
  { title: "Створіть workspace", text: "Реєстрація за хвилину — без карти й дзвінків менеджера" },
  { title: "Додайте послуги", text: "Назва, тривалість, ціна — далі система працює сама" },
  { title: "Додайте команду", text: "Графіки, послуги й доступи для кожного співробітника" },
  { title: "Отримуйте записи", text: "Поділіться посиланням — клієнти записуються самі, 24/7" },
  { title: "Керуйте бізнесом", text: "Один екран замість п'яти месенджерів і паперового зошита" },
];

const BENEFITS = [
  "Усі заявки — під контролем",
  "Контакти та історія спілкування — збережені",
  "Менеджери не забувають передзвонити",
  "Видно, на якому етапі кожен клієнт",
  "Автоматизуються повторювані процеси",
  "Легше контролювати роботу команди",
  "Простіше аналізувати продажі",
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <MarketingNav />

      {/* Hero */}
      <section className="relative overflow-hidden bg-[#050B1F] px-5 pt-28 pb-24 sm:px-8">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(1100px 560px at 50% -10%, rgba(13,71,255,0.35), transparent 60%), radial-gradient(760px 420px at 85% 100%, rgba(56,189,248,0.16), transparent 62%)",
          }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)",
            backgroundSize: "56px 56px",
            maskImage: "radial-gradient(circle at 50% 30%, black, transparent 72%)",
          }}
        />

        <div className="relative mx-auto max-w-[1100px] text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3.5 py-1.5 text-[12.5px] font-medium text-white/80 backdrop-blur">
            <Zap className="h-3.5 w-3.5 text-[#38BDF8]" />
            Операційна система вашого бізнесу
          </span>

          <h1 className="mx-auto mt-7 max-w-3xl text-[36px] leading-[1.1] font-semibold tracking-tight text-balance text-white sm:text-[52px]">
            CRM, яка тримає ваш бізнес під контролем.
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-[16px] leading-relaxed text-balance text-slate-300 sm:text-[17px]">
            Клієнти, записи, команда, продажі та аналітика — в одній системі.
          </p>

          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <Link href="/register">
              <Button size="lg" className="shadow-[0_10px_40px_-10px_rgba(37,99,235,0.8)]">
                Спробувати безкоштовно
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/book/luna-beauty-studio">
              <Button
                size="lg"
                variant="outline"
                className="border-white/20 text-white hover:bg-white/10"
              >
                Переглянути демо
              </Button>
            </Link>
          </div>

          <p className="mt-4 text-[12.5px] text-slate-400">
            Без картки · Готово до роботи за 5 хвилин
          </p>

          <div className="mt-14">
            <DashboardPreview />
          </div>
        </div>
      </section>

      {/* Problem */}
      <section id="problem" className="px-5 py-20 sm:px-8">
        <div className="mx-auto max-w-[1000px]">
          <h2 className="mx-auto max-w-2xl text-center text-[28px] leading-tight font-semibold tracking-tight text-balance text-[var(--fg)] sm:text-[34px]">
            📊 Скільки клієнтів ваш бізнес втрачає просто через хаос?
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-center text-[15px] leading-relaxed text-balance text-[var(--fg-muted)]">
            Заявки приходять у Direct, Telegram, Viber, месенджери… І десь між ними губляться гроші.
          </p>

          <div className="mt-12 grid gap-4 sm:grid-cols-3">
            {PROBLEMS.map((problem) => {
              const Icon = problem.icon;
              return (
                <div key={problem.title} className="card p-6">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--danger-soft)] text-[var(--danger)]">
                    <Icon className="h-5 w-5" />
                  </span>
                  <h3 className="mt-4 text-[15px] font-semibold text-[var(--fg)]">{problem.title}</h3>
                  <p className="mt-1.5 text-[13.5px] leading-relaxed text-[var(--fg-muted)]">
                    {problem.text}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Solution */}
      <section className="px-5 py-20 sm:px-8">
        <div className="mx-auto max-w-[1000px]">
          <div className="card overflow-hidden">
            <div className="grid gap-8 p-8 sm:p-12 lg:grid-cols-2">
              <div>
                <h2 className="text-[28px] leading-tight font-semibold tracking-tight text-balance text-[var(--fg)] sm:text-[32px]">
                  crm.factory збирає все в одному місці.
                </h2>
                <p className="mt-4 text-[15px] leading-relaxed text-[var(--fg-muted)]">
                  CRM — це не просто програма. Це система, яка допомагає бізнесу не втрачати гроші
                  через людський фактор.
                </p>
                <Link href="/register" className="mt-7 inline-block">
                  <Button size="lg">
                    Навести порядок
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
              </div>

              <ul className="space-y-3">
                {BENEFITS.map((benefit) => (
                  <li key={benefit} className="flex items-start gap-2.5">
                    <CheckCircle2 className="mt-0.5 h-[18px] w-[18px] shrink-0 text-[var(--success)]" />
                    <span className="text-[14px] leading-relaxed text-[var(--fg)]">{benefit}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="px-5 py-20 sm:px-8">
        <div className="mx-auto max-w-[1100px]">
          <h2 className="text-center text-[28px] leading-tight font-semibold tracking-tight text-balance text-[var(--fg)] sm:text-[34px]">
            Усе, що потрібно сервісному бізнесу
          </h2>
          <p className="mx-auto mt-4 max-w-lg text-center text-[15px] text-balance text-[var(--fg-muted)]">
            Без зайвих модулів, які ніхто не відкриває.
          </p>

          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((feature) => {
              const Icon = feature.icon;
              return (
                <div
                  key={feature.title}
                  className="card group p-6 transition-shadow duration-200 hover:shadow-[var(--shadow-lift)]"
                >
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--primary-soft)] text-[var(--primary)] transition-transform duration-200 group-hover:scale-105">
                    <Icon className="h-5 w-5" />
                  </span>
                  <h3 className="mt-4 text-[15.5px] font-semibold text-[var(--fg)]">
                    {feature.title}
                  </h3>
                  <p className="mt-1.5 text-[13.5px] leading-relaxed text-[var(--fg-muted)]">
                    {feature.text}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="px-5 py-20 sm:px-8">
        <div className="mx-auto max-w-[900px]">
          <h2 className="text-center text-[28px] leading-tight font-semibold tracking-tight text-balance text-[var(--fg)] sm:text-[34px]">
            Як це працює
          </h2>

          <ol className="mt-12 space-y-4">
            {STEPS.map((step, index) => (
              <li key={step.title} className="card flex items-start gap-4 p-5">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--primary)] text-[14px] font-semibold text-white">
                  {index + 1}
                </span>
                <div className="min-w-0">
                  <h3 className="text-[15px] font-semibold text-[var(--fg)]">{step.title}</h3>
                  <p className="mt-1 text-[13.5px] text-[var(--fg-muted)]">{step.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="px-5 py-20 sm:px-8">
        <div className="mx-auto max-w-[1100px]">
          <h2 className="text-center text-[28px] leading-tight font-semibold tracking-tight text-balance text-[var(--fg)] sm:text-[34px]">
            Прозорі тарифи
          </h2>
          <p className="mx-auto mt-4 max-w-lg text-center text-[15px] text-balance text-[var(--fg-muted)]">
            Почніть безкоштовно. Переходьте на платний тариф, коли зростете.
          </p>

          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { name: "Free", price: "€0", text: "1 співробітник, до 50 клієнтів" },
              { name: "Starter", price: "€19", text: "До 3 співробітників, воронка" },
              { name: "Business", price: "€39", text: "До 10 співробітників, аналітика", highlight: true },
              { name: "Pro", price: "€79", text: "Необмежена команда, кілька workspace" },
            ].map((plan) => (
              <div
                key={plan.name}
                className={`card relative p-6 ${plan.highlight ? "ring-2 ring-[var(--primary)]" : ""}`}
              >
                {plan.highlight && (
                  <span className="absolute -top-2.5 left-6 rounded-full bg-[var(--primary)] px-2.5 py-0.5 text-[11px] font-semibold text-white">
                    Популярний
                  </span>
                )}
                <p className="text-[15px] font-semibold text-[var(--fg)]">{plan.name}</p>
                <p className="mt-3 text-[30px] leading-none font-semibold text-[var(--fg)]">
                  {plan.price}
                  <span className="text-[13px] font-normal text-[var(--fg-subtle)]">/міс</span>
                </p>
                <p className="mt-3 text-[13px] leading-relaxed text-[var(--fg-muted)]">{plan.text}</p>
                <Link href="/register" className="mt-5 block">
                  <Button variant={plan.highlight ? "primary" : "secondary"} className="w-full">
                    Почати
                  </Button>
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-5 pb-20 sm:px-8">
        <div className="mx-auto max-w-[1000px]">
          <div
            className="relative overflow-hidden rounded-[22px] px-8 py-14 text-center sm:px-14"
            style={{ background: "linear-gradient(135deg, #0D47FF, #050B1F)" }}
          >
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 opacity-10"
              style={{
                backgroundImage:
                  "linear-gradient(rgba(255,255,255,0.7) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.7) 1px, transparent 1px)",
                backgroundSize: "44px 44px",
              }}
            />
            <div className="relative">
              <h2 className="mx-auto max-w-xl text-[28px] leading-tight font-semibold tracking-tight text-balance text-white sm:text-[34px]">
                Готові навести порядок у бізнесі?
              </h2>
              <p className="mx-auto mt-4 max-w-md text-[15px] text-balance text-white/80">
                Створіть workspace за хвилину — і почніть приймати записи вже сьогодні.
              </p>
              <Link href="/register" className="mt-8 inline-block">
                <Button size="lg" variant="secondary">
                  Спробувати crm.factory
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-[var(--border)] px-5 py-10 sm:px-8">
        <div className="mx-auto flex max-w-[1100px] flex-wrap items-center justify-between gap-4">
          <Logo size="sm" />
          <SystemStatus />
          <p className="text-[12.5px] text-[var(--fg-subtle)]">
            © {new Date().getFullYear()} crm.factory — a modern operating system for your business
          </p>
        </div>
      </footer>
    </div>
  );
}
