/**
 * Demo-дані для dev-середовища.
 *
 * Створює живий workspace «LUNA BEAUTY STUDIO»: 10 співробітників,
 * 10 послуг, ~50 клієнтів і ~120 записів із реалістичним розподілом
 * у часі, статусами та оплатами — щоб інтерфейс одразу виглядав робочим,
 * а не порожнім.
 *
 * Запуск: npm run db:seed
 * Скрипт ідемпотентний: повторний запуск перестворює demo-організацію.
 */

import { PrismaClient, type Prisma, type Client, type Service, type ServiceCategory, type Employee } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const DEMO_SLUG = "luna-beauty-studio";
const OWNER_EMAIL = "demo@crm.factory";
const DEMO_PASSWORD = "demo1234";

// Детермінований генератор — щоб демо виглядало однаково при кожному seed.
let seedValue = 20260824;
function random() {
  seedValue = (seedValue * 1664525 + 1013904223) % 4294967296;
  return seedValue / 4294967296;
}
function pick<T>(items: T[]): T {
  return items[Math.floor(random() * items.length)];
}
function randomInt(min: number, max: number) {
  return Math.floor(random() * (max - min + 1)) + min;
}

const EMPLOYEES = [
  { name: "Марія Ковальчук", position: "Топ-майстер манікюру", color: "#2563EB" },
  { name: "Анна Тихонова", position: "Майстер манікюру", color: "#0891B2" },
  { name: "Софія Литвин", position: "Майстер педикюру", color: "#0D9488" },
  { name: "Ольга Дмитрук", position: "Бровист", color: "#7C3AED" },
  { name: "Катерина Бойко", position: "Візажист", color: "#DB2777" },
  { name: "Дарина Мороз", position: "Косметолог", color: "#D97706" },
  { name: "Вікторія Савчук", position: "Майстер зачісок", color: "#DC2626" },
  { name: "Юлія Панченко", position: "Лешмейкер", color: "#4F46E5" },
  { name: "Ірина Гаврилюк", position: "Адміністратор", color: "#475569" },
  { name: "Наталя Кравець", position: "Масажист", color: "#059669" },
];

const CATEGORIES = [
  { name: "Нігтьовий сервіс", color: "#2563EB" },
  { name: "Брови та вії", color: "#7C3AED" },
  { name: "Волосся", color: "#DC2626" },
  { name: "Обличчя й тіло", color: "#0D9488" },
];

const SERVICES = [
  { name: "Манікюр з покриттям", category: 0, duration: 90, price: 3500, color: "#2563EB" },
  { name: "Класичний манікюр", category: 0, duration: 60, price: 2200, color: "#3B76F6" },
  { name: "Педикюр", category: 0, duration: 75, price: 4500, color: "#0891B2" },
  { name: "Нарощування нігтів", category: 0, duration: 150, price: 6500, color: "#0D9488" },
  { name: "Корекція брів", category: 1, duration: 45, price: 2000, color: "#7C3AED" },
  { name: "Ламінування вій", category: 1, duration: 90, price: 5000, color: "#8B5CF6" },
  { name: "Стрижка", category: 2, duration: 60, price: 3000, color: "#DC2626" },
  { name: "Фарбування волосся", category: 2, duration: 180, price: 9000, color: "#DB2777" },
  { name: "Чистка обличчя", category: 3, duration: 90, price: 5500, color: "#D97706" },
  { name: "Масаж спини", category: 3, duration: 60, price: 4000, color: "#059669" },
];

const FIRST_NAMES = [
  "Анна", "Софія", "Марія", "Олена", "Ірина", "Катерина", "Наталія", "Юлія",
  "Тетяна", "Вікторія", "Оксана", "Христина", "Дарина", "Аліна", "Богдана",
  "Олександр", "Андрій", "Дмитро", "Сергій", "Максим", "Артем", "Володимир",
];

const LAST_NAMES = [
  "Шевченко", "Ковальчук", "Бондаренко", "Ткаченко", "Кравченко", "Олійник",
  "Шевчук", "Поліщук", "Бойко", "Мельник", "Марченко", "Лисенко", "Руденко",
  "Савченко", "Петренко", "Романенко", "Гончаренко", "Мороз", "Литвин",
];

const SOURCES = ["Instagram", "Telegram", "Рекомендація", "Google", "Онлайн-запис", "Viber"];

const NOTES = [
  "Любить ранкові слоти, після 10:00.",
  "Алергія на ацетон — використовуємо безацетонові засоби.",
  "Постійна клієнтка, завжди залишає чайові.",
  "Просила нагадувати за день до візиту.",
  "Приходить із дитиною — потрібне місце в зоні очікування.",
  "Віддає перевагу спокійним відтінкам.",
];

function daysAgo(days: number, hour: number, minute = 0) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  date.setHours(hour, minute, 0, 0);
  return date;
}

async function main() {
  console.log("🌱 Seed: створюємо demo-workspace…");

  // Ідемпотентність: прибираємо попередню demo-організацію разом із даними.
  const existing = await prisma.organization.findUnique({ where: { slug: DEMO_SLUG } });
  if (existing) {
    await prisma.organization.delete({ where: { id: existing.id } });
    console.log("   ↺ Попередній demo-workspace видалено");
  }

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);
  const superAdminEmail = process.env.SUPER_ADMIN_EMAIL?.toLowerCase() ?? "admin@crm.factory";

  const owner = await prisma.user.upsert({
    where: { email: OWNER_EMAIL },
    create: { email: OWNER_EMAIL, name: "Демид Власник", passwordHash },
    update: { passwordHash, name: "Демид Власник" },
  });

  const superAdmin = await prisma.user.upsert({
    where: { email: superAdminEmail },
    create: {
      email: superAdminEmail,
      name: "Платформа crm.factory",
      passwordHash,
      isSuperAdmin: true,
    },
    update: { isSuperAdmin: true, passwordHash },
  });

  const organization = await prisma.organization.create({
    data: {
      name: "LUNA BEAUTY STUDIO",
      slug: DEMO_SLUG,
      industry: "Салон краси",
      phone: "+380 67 123 45 67",
      email: "hello@lunabeauty.studio",
      address: "вул. Хрещатик, 22, Київ",
      about:
        "Студія краси в центрі Києва. Манікюр, брови, волосся та догляд за обличчям — у команді 10 майстрів.",
      timezone: "Europe/Kyiv",
      currency: "EUR",
      brandColor: "#2563EB",
      onboardingCompleted: true,
      onboardingStep: 6,
      bookingWelcomeText: "Оберіть послугу та зручний час — ми чекаємо на вас ✨",
      reminderEnabled: true,
      reminderHoursBefore: 24,
      reminderChannels: "IN_APP",
    },
  });

  await prisma.subscription.create({
    data: {
      organizationId: organization.id,
      plan: "BUSINESS",
      status: "ACTIVE",
      priceCents: 3900,
      seats: 10,
      currentPeriodStart: daysAgo(12, 0),
      currentPeriodEnd: daysAgo(-18, 0),
    },
  });

  await prisma.membership.create({
    data: { userId: owner.id, organizationId: organization.id, role: "OWNER" },
  });

  await prisma.businessHours.createMany({
    data: Array.from({ length: 7 }, (_, weekday) => ({
      organizationId: organization.id,
      weekday,
      openMinute: weekday === 6 ? 600 : 540,
      closeMinute: weekday === 6 ? 960 : 1200,
      isClosed: weekday === 0,
    })),
  });

  await prisma.pipelineStage.createMany({
    data: [
      { key: "new", name: "Нова заявка", color: "#38BDF8", sortOrder: 0 },
      { key: "contacted", name: "Зв'язалися", color: "#6366F1", sortOrder: 1 },
      { key: "booked", name: "Записані", color: "#2563EB", sortOrder: 2 },
      { key: "visited", name: "Відвідали", color: "#0D9488", sortOrder: 3, isWon: true },
      { key: "repeat", name: "Повторні", color: "#059669", sortOrder: 4, isWon: true },
    ].map((stage) => ({ ...stage, organizationId: organization.id })),
  });

  // ── Категорії та послуги ───────────────────────────────────────────────────
  const categories: ServiceCategory[] = [];
  for (const [index, category] of CATEGORIES.entries()) {
    categories.push(
      await prisma.serviceCategory.create({
        data: { organizationId: organization.id, ...category, sortOrder: index },
      }),
    );
  }

  const services: Service[] = [];
  for (const [index, service] of SERVICES.entries()) {
    services.push(
      await prisma.service.create({
        data: {
          organizationId: organization.id,
          categoryId: categories[service.category].id,
          name: service.name,
          durationMin: service.duration,
          priceCents: service.price,
          color: service.color,
          sortOrder: index,
          bufferMin: service.duration >= 120 ? 15 : 0,
          description:
            index % 3 === 0
              ? "Включає консультацію майстра та підбір догляду."
              : null,
        },
      }),
    );
  }

  // ── Команда ────────────────────────────────────────────────────────────────
  const employees: Employee[] = [];
  for (const [index, employee] of EMPLOYEES.entries()) {
    const created = await prisma.employee.create({
      data: {
        organizationId: organization.id,
        name: employee.name,
        position: employee.position,
        color: employee.color,
        phone: `+380 6${randomInt(0, 9)} ${randomInt(100, 999)} ${randomInt(10, 99)} ${randomInt(10, 99)}`,
        hiredAt: daysAgo(randomInt(60, 900), 9),
        acceptsOnlineBooking: employee.position !== "Адміністратор",
        bio:
          index < 4
            ? "Понад 5 років досвіду. Працює з преміальними матеріалами."
            : null,
      },
    });

    // Графік: адміністратор працює всі дні, майстри — з одним плаваючим вихідним.
    const floatingDayOff = index % 5 === 0 ? 1 : index % 5 === 1 ? 2 : 0;
    await prisma.employeeSchedule.createMany({
      data: Array.from({ length: 7 }, (_, weekday) => ({
        employeeId: created.id,
        weekday,
        startMinute: weekday === 6 ? 600 : 540,
        endMinute: weekday === 6 ? 960 : 1140,
        breakStart: index % 3 === 0 ? 780 : null,
        breakEnd: index % 3 === 0 ? 840 : null,
        isDayOff: weekday === 0 || weekday === floatingDayOff,
      })),
    });

    employees.push(created);
  }

  // Прив'язуємо власника до першого майстра — щоб «мої записи» працювали.
  await prisma.membership.updateMany({
    where: { userId: owner.id, organizationId: organization.id },
    data: { employeeId: employees[0].id },
  });

  // Одна відпустка — щоб було видно, як працюють винятки графіка.
  await prisma.scheduleException.create({
    data: {
      employeeId: employees[3].id,
      date: daysAgo(-9, 0),
      endDate: daysAgo(-4, 0),
      type: "VACATION",
      note: "Щорічна відпустка",
    },
  });

  // Хто які послуги виконує: адміністратор — жодної, решта — за спеціалізацією.
  const serviceAssignments: Prisma.EmployeeServiceCreateManyInput[] = [];
  for (const [index, employee] of employees.entries()) {
    if (employee.position === "Адміністратор") continue;
    const primary = index % services.length;
    const assigned = new Set<number>([primary, (primary + 1) % services.length]);
    if (index < 4) assigned.add((primary + 2) % services.length);
    for (const serviceIndex of assigned) {
      serviceAssignments.push({ employeeId: employee.id, serviceId: services[serviceIndex].id });
    }
  }
  await prisma.employeeService.createMany({ data: serviceAssignments });

  // ── Клієнти ────────────────────────────────────────────────────────────────
  const clients: Client[] = [];
  for (let i = 0; i < 50; i++) {
    const firstName = pick(FIRST_NAMES);
    const lastName = pick(LAST_NAMES);
    // Перші 9 клієнтів — «свіжі» (останній тиждень), решта розподілені по році,
    // щоб статистика «Нових клієнтів за 7 днів» була змістовною.
    const createdAt =
      i < 9
        ? daysAgo(randomInt(0, 6), randomInt(9, 19))
        : daysAgo(randomInt(8, 420), randomInt(9, 19));
    const status =
      i < 6 ? "VIP" : i < 12 ? "NEW" : i < 42 ? "ACTIVE" : ("INACTIVE" as const);

    clients.push(
      await prisma.client.create({
        data: {
          organizationId: organization.id,
          firstName,
          lastName,
          phone: `+380 ${randomInt(50, 99)} ${randomInt(100, 999)} ${randomInt(10, 99)} ${randomInt(10, 99)}`,
          email:
            random() > 0.35
              ? `${firstName.toLowerCase()}.${i}@example.com`
              : null,
          status: status as "VIP" | "NEW" | "ACTIVE" | "INACTIVE",
          source: pick(SOURCES),
          tags: status === "VIP" ? ["постійний", "VIP"] : random() > 0.7 ? ["постійний"] : [],
          marketingOptIn: random() > 0.4,
          createdAt,
          birthday:
            random() > 0.6
              ? new Date(1985 + randomInt(0, 20), randomInt(0, 11), randomInt(1, 28))
              : null,
        },
      }),
    );
  }

  // Внутрішні нотатки для частини клієнтів.
  for (let i = 0; i < 12; i++) {
    await prisma.clientNote.create({
      data: {
        clientId: clients[i].id,
        authorId: owner.id,
        body: pick(NOTES),
        pinned: i < 3,
        createdAt: daysAgo(randomInt(1, 90), randomInt(10, 18)),
      },
    });
  }

  // ── Записи ─────────────────────────────────────────────────────────────────
  // Розподіл: минуле (завершені/скасовані), сьогодні, майбутнє.
  const masters = employees.filter((e) => e.position !== "Адміністратор");
  const employeeServices = await prisma.employeeService.findMany({
    where: { employee: { organizationId: organization.id } },
  });
  const servicesByEmployee = new Map<string, string[]>();
  for (const link of employeeServices) {
    const list = servicesByEmployee.get(link.employeeId) ?? [];
    list.push(link.serviceId);
    servicesByEmployee.set(link.employeeId, list);
  }

  type Slot = { employeeId: string; start: number; end: number; day: number };
  const taken: Slot[] = [];

  const tryCreate = async (dayOffset: number, index: number) => {
    for (let attempt = 0; attempt < 12; attempt++) {
      const employee = pick(masters);
      const serviceIds = servicesByEmployee.get(employee.id);
      if (!serviceIds || serviceIds.length === 0) continue;

      const service = services.find((s) => s.id === pick(serviceIds));
      if (!service) continue;

      const date = new Date();
      date.setDate(date.getDate() - dayOffset);
      const weekday = date.getDay();
      if (weekday === 0) return null; // неділя — вихідний

      const startMinute = randomInt(0, 18) * 30 + 540; // 09:00–18:00, крок 30 хв
      const endMinute = startMinute + service.durationMin;
      if (endMinute > 1140) continue;

      const conflict = taken.some(
        (slot) =>
          slot.day === dayOffset &&
          slot.employeeId === employee.id &&
          startMinute < slot.end &&
          endMinute > slot.start,
      );
      if (conflict) continue;

      taken.push({ employeeId: employee.id, start: startMinute, end: endMinute, day: dayOffset });

      const startAt = new Date(date);
      startAt.setHours(0, startMinute, 0, 0);
      const endAt = new Date(startAt.getTime() + service.durationMin * 60_000);

      const isPast = dayOffset > 0;
      const isToday = dayOffset === 0;
      const roll = random();

      const status = isPast
        ? roll < 0.82
          ? "COMPLETED"
          : roll < 0.92
            ? "CANCELLED"
            : "NO_SHOW"
        : isToday
          ? startAt < new Date()
            ? "COMPLETED"
            : "CONFIRMED"
          : roll < 0.85
            ? "CONFIRMED"
            : "WAITING";

      const client = clients[(index * 7 + dayOffset) % clients.length];

      const appointment = await prisma.appointment.create({
        data: {
          organizationId: organization.id,
          clientId: client.id,
          serviceId: service.id,
          employeeId: employee.id,
          startAt,
          endAt,
          status,
          priceCents: service.priceCents,
          source: random() > 0.65 ? "ONLINE" : "CRM",
          createdById: owner.id,
          completedAt: status === "COMPLETED" ? endAt : null,
          cancelledAt: status === "CANCELLED" ? new Date(startAt.getTime() - 3600_000) : null,
          cancelReason: status === "CANCELLED" ? "Клієнт переніс візит" : null,
          note: random() > 0.85 ? "Просила майстра підібрати відтінок" : null,
        },
      });

      if (status === "COMPLETED") {
        await prisma.payment.create({
          data: {
            organizationId: organization.id,
            appointmentId: appointment.id,
            clientId: client.id,
            employeeId: employee.id,
            amountCents: service.priceCents,
            currency: "EUR",
            method: random() > 0.45 ? "CARD" : "CASH",
            status: "PAID",
            paidAt: endAt,
          },
        });
      }
      return appointment;
    }
    return null;
  };

  let created = 0;
  // Минулі 45 днів — щільніше до сьогодні.
  for (let dayOffset = 45; dayOffset >= 1; dayOffset--) {
    const perDay = dayOffset > 30 ? 1 : dayOffset > 14 ? 2 : 3;
    for (let i = 0; i < perDay; i++) {
      if (await tryCreate(dayOffset, created)) created++;
    }
  }
  // Сьогодні.
  for (let i = 0; i < 8; i++) {
    if (await tryCreate(0, created)) created++;
  }
  // Наступні 14 днів.
  for (let dayOffset = -1; dayOffset >= -14; dayOffset--) {
    for (let i = 0; i < 3; i++) {
      if (await tryCreate(dayOffset, created)) created++;
    }
  }

  // ── Воронка ────────────────────────────────────────────────────────────────
  const stages = await prisma.pipelineStage.findMany({
    where: { organizationId: organization.id },
    orderBy: { sortOrder: "asc" },
  });

  const LEADS = [
    { name: "Оксана Тимчук", stage: 0, value: 3500, source: "Instagram Direct" },
    { name: "Ілона Гринь", stage: 0, value: 5000, source: "Telegram" },
    { name: "Марта Дяченко", stage: 1, value: 4500, source: "Viber" },
    { name: "Юлія Романюк", stage: 1, value: 9000, source: "Рекомендація" },
    { name: "Ліна Кушнір", stage: 2, value: 3500, source: "Instagram Direct" },
    { name: "Христина Мазур", stage: 2, value: 6500, source: "Google" },
    { name: "Аліна Пасічник", stage: 3, value: 2200, source: "Онлайн-запис" },
    { name: "Дарія Швець", stage: 4, value: 4000, source: "Рекомендація" },
  ];

  for (const [index, lead] of LEADS.entries()) {
    await prisma.lead.create({
      data: {
        organizationId: organization.id,
        stageId: stages[lead.stage].id,
        name: lead.name,
        phone: `+380 ${randomInt(50, 99)} ${randomInt(100, 999)} ${randomInt(10, 99)} ${randomInt(10, 99)}`,
        source: lead.source,
        valueCents: lead.value,
        serviceId: services[index % services.length].id,
        assignedToId: masters[index % masters.length].id,
        clientId: lead.stage >= 3 ? clients[index].id : null,
        position: index,
        note: index % 3 === 0 ? "Питала про вільні вечірні слоти." : null,
        createdAt: daysAgo(randomInt(1, 20), randomInt(10, 19)),
      },
    });
  }

  // ── Сповіщення ─────────────────────────────────────────────────────────────
  await prisma.notification.createMany({
    data: [
      {
        organizationId: organization.id,
        type: "BOOKING_CREATED",
        title: "Новий онлайн-запис",
        body: `${clients[0].firstName} ${clients[0].lastName} — ${services[0].name}`,
        createdAt: daysAgo(0, new Date().getHours(), Math.max(0, new Date().getMinutes() - 12)),
      },
      {
        organizationId: organization.id,
        type: "APPOINTMENT_REMINDER",
        title: "Нагадування про візит завтра",
        body: `${clients[1].firstName} ${clients[1].lastName} — ${services[2].name}`,
        createdAt: daysAgo(0, Math.max(0, new Date().getHours() - 2)),
      },
      {
        organizationId: organization.id,
        type: "CLIENT_CREATED",
        title: "Новий клієнт у базі",
        body: `${clients[2].firstName} ${clients[2].lastName}`,
        readAt: daysAgo(1, 12),
        createdAt: daysAgo(1, 11),
      },
      {
        organizationId: organization.id,
        type: "SYSTEM",
        title: "Ласкаво просимо до crm.factory 🚀",
        body: "Demo-workspace заповнено реальними даними — досліджуйте систему.",
        readAt: daysAgo(2, 10),
        createdAt: daysAgo(2, 9),
      },
    ],
  });

  await prisma.auditLog.createMany({
    data: [
      {
        organizationId: organization.id,
        userId: owner.id,
        action: "auth.login",
        createdAt: daysAgo(0, 9),
      },
      {
        organizationId: organization.id,
        userId: owner.id,
        action: "onboarding.complete",
        createdAt: daysAgo(30, 10),
      },
      {
        organizationId: organization.id,
        action: "booking.public_create",
        entityType: "appointment",
        createdAt: daysAgo(0, 8),
      },
    ],
  });

  const counts = await Promise.all([
    prisma.employee.count({ where: { organizationId: organization.id } }),
    prisma.service.count({ where: { organizationId: organization.id } }),
    prisma.client.count({ where: { organizationId: organization.id } }),
    prisma.appointment.count({ where: { organizationId: organization.id } }),
    prisma.payment.count({ where: { organizationId: organization.id } }),
  ]);

  console.log(`
✅ Demo-workspace готовий: LUNA BEAUTY STUDIO

   Співробітників: ${counts[0]}
   Послуг:         ${counts[1]}
   Клієнтів:       ${counts[2]}
   Записів:        ${counts[3]}
   Оплат:          ${counts[4]}

   Вхід у CRM:
     ${OWNER_EMAIL} / ${DEMO_PASSWORD}

   Super Admin (/admin):
     ${superAdmin.email} / ${DEMO_PASSWORD}

   Сторінка онлайн-запису:
     ${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3001"}/book/${DEMO_SLUG}
`);
}

main()
  .catch((error) => {
    console.error("❌ Seed завершився помилкою:", error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
