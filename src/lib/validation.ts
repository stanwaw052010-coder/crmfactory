import { z } from "zod";

/**
 * Єдине джерело правди для валідації.
 * Ті самі схеми використовуються у формах (клієнт) і в серверних діях (сервер).
 * Дані з фронтенду ніколи не потрапляють у БД без цієї перевірки.
 */

const requiredString = (label: string, max = 200) =>
  z.string().trim().min(1, `${label} — обов'язкове поле`).max(max, `${label}: забагато символів`);

/**
 * Нормалізація значень із HTML-форми.
 *
 * `formData.get()` повертає `null` для поля, якого у формі немає, і `""` для
 * порожнього input чи `<select>` без вибору. Обидва випадки означають
 * «значення не задано», тому зводимо їх до `undefined` ДО валідації.
 *
 * Наївне `z.string().optional().or(z.literal("").transform(...))` тут не
 * працює: перша гілка union'а приймає `""` як валідний рядок і повертає його,
 * а порожній id далі падає на foreign key — саме так ламалося створення
 * послуги, заявки та запрошення в команду.
 */
const formValue = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((value) => {
    if (value == null) return undefined;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  });

const optionalString = (max = 500) =>
  formValue.pipe(z.string().max(max, "Забагато символів").optional());

/** Необов'язкове посилання на іншу сутність (id із `<select>`). */
const optionalId = () => formValue.pipe(z.string().max(64).optional());

export const phoneSchema = z
  .string()
  .trim()
  .min(6, "Схоже, номер неповний")
  .max(32, "Задовгий номер")
  .regex(/^[+\d][\d\s()\-.]*$/, "Номер може містити лише цифри, пробіли та + ( ) -");

export const emailSchema = z.string().trim().toLowerCase().email("Некоректний email");

const optionalPhone = () => formValue.pipe(phoneSchema.optional());
const optionalEmail = () => formValue.pipe(emailSchema.optional());

// ── Auth ─────────────────────────────────────────────────────────────────────

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Введіть пароль"),
});

export const registerSchema = z.object({
  businessName: requiredString("Назва бізнесу", 80),
  name: requiredString("Ваше ім'я", 80),
  email: emailSchema,
  password: z
    .string()
    .min(8, "Пароль має містити щонайменше 8 символів")
    .max(128, "Задовгий пароль")
    .regex(/[a-zA-Zа-яА-ЯіїєґІЇЄҐ]/, "Додайте хоча б одну літеру")
    .regex(/\d/, "Додайте хоча б одну цифру"),
});

// ── Клієнти ──────────────────────────────────────────────────────────────────

export const clientSchema = z.object({
  firstName: requiredString("Ім'я", 60),
  lastName: optionalString(60),
  phone: optionalPhone(),
  email: optionalEmail(),
  status: z.enum(["NEW", "ACTIVE", "VIP", "INACTIVE", "BLOCKED"]).default("NEW"),
  source: optionalString(60),
  birthday: optionalString(40),
  address: optionalString(200),
  tags: z.array(z.string().trim().max(24)).max(10).default([]),
  marketingOptIn: z.boolean().default(false),
});

export const clientNoteSchema = z.object({
  clientId: z.string().min(1),
  body: requiredString("Нотатка", 2000),
  pinned: z.boolean().default(false),
});

// ── Послуги ──────────────────────────────────────────────────────────────────

export const serviceSchema = z.object({
  name: requiredString("Назва послуги", 100),
  description: optionalString(1000),
  categoryId: optionalId(),
  durationMin: z.coerce.number().int().min(5, "Мінімум 5 хвилин").max(600, "Максимум 10 годин"),
  bufferMin: z.coerce.number().int().min(0).max(120).default(0),
  priceCents: z.coerce.number().int().min(0, "Ціна не може бути від'ємною").max(100_000_00),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Некоректний колір").default("#2563EB"),
  isActive: z.boolean().default(true),
  onlineBooking: z.boolean().default(true),
  employeeIds: z.array(z.string()).default([]),
});

export const serviceCategorySchema = z.object({
  name: requiredString("Назва категорії", 60),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#2563EB"),
});

// ── Співробітники ────────────────────────────────────────────────────────────

export const employeeSchema = z.object({
  name: requiredString("Ім'я співробітника", 80),
  position: optionalString(80),
  email: optionalEmail(),
  phone: optionalPhone(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#2563EB"),
  bio: optionalString(500),
  isActive: z.boolean().default(true),
  acceptsOnlineBooking: z.boolean().default(true),
  serviceIds: z.array(z.string()).default([]),
});

export const scheduleDaySchema = z.object({
  weekday: z.coerce.number().int().min(0).max(6),
  isDayOff: z.boolean().default(false),
  startMinute: z.coerce.number().int().min(0).max(1440),
  endMinute: z.coerce.number().int().min(0).max(1440),
  breakStart: z.coerce.number().int().min(0).max(1440).nullable().optional(),
  breakEnd: z.coerce.number().int().min(0).max(1440).nullable().optional(),
});

export const scheduleSchema = z.object({
  employeeId: z.string().min(1),
  days: z.array(scheduleDaySchema).length(7),
});

export const scheduleExceptionSchema = z.object({
  employeeId: z.string().min(1),
  date: z.string().min(1, "Оберіть дату"),
  endDate: optionalString(40),
  type: z.enum(["DAY_OFF", "VACATION", "SICK_LEAVE", "CUSTOM_HOURS"]).default("DAY_OFF"),
  startMinute: z.coerce.number().int().min(0).max(1440).optional(),
  endMinute: z.coerce.number().int().min(0).max(1440).optional(),
  note: optionalString(200),
});

// ── Записи ───────────────────────────────────────────────────────────────────

export const appointmentSchema = z.object({
  clientId: z.string().min(1, "Оберіть клієнта"),
  serviceId: z.string().min(1, "Оберіть послугу"),
  employeeId: z.string().min(1, "Оберіть співробітника"),
  date: z.string().min(1, "Оберіть дату"),
  time: z.string().regex(/^\d{2}:\d{2}$/, "Оберіть час"),
  durationMin: z.coerce.number().int().min(5).max(600),
  priceCents: z.coerce.number().int().min(0).max(100_000_00),
  status: z.enum(["WAITING", "CONFIRMED", "COMPLETED", "CANCELLED", "NO_SHOW"]).default("CONFIRMED"),
  note: optionalString(1000),
});

export const appointmentMoveSchema = z.object({
  id: z.string().min(1),
  startAt: z.string().datetime(),
  durationMin: z.coerce.number().int().min(5).max(600).optional(),
  employeeId: z.string().optional(),
});

export const appointmentStatusSchema = z.object({
  id: z.string().min(1),
  status: z.enum(["WAITING", "CONFIRMED", "COMPLETED", "CANCELLED", "NO_SHOW"]),
  cancelReason: optionalString(300),
});

// ── Продажі ──────────────────────────────────────────────────────────────────

export const paymentSchema = z.object({
  appointmentId: optionalId(),
  clientId: optionalId(),
  employeeId: optionalId(),
  amountCents: z.coerce.number().int().min(0).max(1_000_000_00),
  method: z.enum(["CASH", "CARD", "ONLINE", "TRANSFER", "CERTIFICATE"]).default("CASH"),
  status: z.enum(["PAID", "PENDING", "REFUNDED"]).default("PAID"),
  paidAt: optionalString(40),
  note: optionalString(300),
});

// ── Воронка ──────────────────────────────────────────────────────────────────

export const leadSchema = z.object({
  name: requiredString("Ім'я", 80),
  phone: optionalPhone(),
  email: optionalEmail(),
  stageId: z.string().min(1, "Оберіть етап"),
  clientId: optionalId(),
  serviceId: optionalId(),
  assignedToId: optionalId(),
  valueCents: z.coerce.number().int().min(0).max(1_000_000_00).default(0),
  source: optionalString(60),
  note: optionalString(1000),
});

export const leadMoveSchema = z.object({
  id: z.string().min(1),
  stageId: z.string().min(1),
  position: z.coerce.number().int().min(0).default(0),
});

// ── Налаштування ─────────────────────────────────────────────────────────────

export const organizationSchema = z.object({
  name: requiredString("Назва бізнесу", 80),
  industry: optionalString(60),
  phone: optionalPhone(),
  email: optionalEmail(),
  address: optionalString(200),
  about: optionalString(600),
  timezone: requiredString("Часовий пояс", 60),
  currency: z.enum(["EUR", "USD", "UAH", "PLN", "GBP", "CZK"]),
  brandColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#2563EB"),
  logoUrl: optionalString(500),
});

export const bookingSettingsSchema = z.object({
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .min(3, "Мінімум 3 символи")
    .max(48)
    .regex(/^[a-z0-9-]+$/, "Лише латиниця, цифри та дефіс"),
  bookingEnabled: z.boolean().default(true),
  bookingAutoConfirm: z.boolean().default(true),
  bookingLeadTimeMin: z.coerce.number().int().min(0).max(10080),
  bookingHorizonDays: z.coerce.number().int().min(1).max(365),
  bookingCancelHours: z.coerce.number().int().min(0).max(168),
  bookingSlotStepMin: z.coerce.number().int().min(5).max(120),
  bookingRequireEmail: z.boolean().default(false),
  bookingWelcomeText: optionalString(400),
});

export const businessHoursSchema = z.object({
  days: z
    .array(
      z.object({
        weekday: z.coerce.number().int().min(0).max(6),
        isClosed: z.boolean().default(false),
        openMinute: z.coerce.number().int().min(0).max(1440),
        closeMinute: z.coerce.number().int().min(0).max(1440),
      }),
    )
    .length(7),
});

export const notificationSettingsSchema = z.object({
  reminderEnabled: z.boolean().default(true),
  reminderHoursBefore: z.coerce.number().int().min(1).max(168),
  channels: z.array(z.enum(["IN_APP", "EMAIL", "TELEGRAM", "SMS", "WHATSAPP"])).min(1),
});

export const memberRoleSchema = z.object({
  membershipId: z.string().min(1),
  role: z.enum(["OWNER", "ADMIN", "MANAGER", "EMPLOYEE"]),
});

export const inviteSchema = z.object({
  email: emailSchema,
  name: requiredString("Ім'я", 80),
  role: z.enum(["ADMIN", "MANAGER", "EMPLOYEE"]).default("EMPLOYEE"),
  employeeId: optionalId(),
  password: z.string().min(8, "Пароль — щонайменше 8 символів").max(128),
});

export const profileSchema = z.object({
  name: requiredString("Ім'я", 80),
  phone: optionalPhone(),
});

export const passwordChangeSchema = z
  .object({
    currentPassword: z.string().min(1, "Введіть поточний пароль"),
    newPassword: z
      .string()
      .min(8, "Мінімум 8 символів")
      .regex(/[a-zA-Zа-яА-ЯіїєґІЇЄҐ]/, "Додайте літеру")
      .regex(/\d/, "Додайте цифру"),
    confirmPassword: z.string(),
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    message: "Паролі не збігаються",
    path: ["confirmPassword"],
  });

// ── Онлайн-запис (публічна форма) ────────────────────────────────────────────

export const publicBookingSchema = z.object({
  slug: z.string().min(1),
  serviceId: z.string().min(1, "Оберіть послугу"),
  employeeId: z.string().min(1, "Оберіть майстра"),
  date: z.string().min(1, "Оберіть дату"),
  time: z.string().regex(/^\d{2}:\d{2}$/, "Оберіть час"),
  name: requiredString("Ваше ім'я", 80),
  phone: phoneSchema,
  email: optionalEmail(),
  comment: optionalString(500),
});

// ── Онбординг ────────────────────────────────────────────────────────────────

export const onboardingSchema = z.object({
  industry: requiredString("Сфера", 60),
  timezone: requiredString("Часовий пояс", 60),
  currency: z.enum(["EUR", "USD", "UAH", "PLN", "GBP", "CZK"]),
  services: z
    .array(
      z.object({
        name: requiredString("Назва послуги", 100),
        durationMin: z.coerce.number().int().min(5).max(600),
        priceCents: z.coerce.number().int().min(0),
      }),
    )
    .min(1, "Додайте хоча б одну послугу"),
  employees: z
    .array(
      z.object({
        name: requiredString("Ім'я", 80),
        position: optionalString(80),
      }),
    )
    .min(1, "Додайте хоча б одного співробітника"),
  openMinute: z.coerce.number().int().min(0).max(1440),
  closeMinute: z.coerce.number().int().min(0).max(1440),
  workingDays: z.array(z.coerce.number().int().min(0).max(6)).min(1, "Оберіть робочі дні"),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .min(3, "Мінімум 3 символи")
    .regex(/^[a-z0-9-]+$/, "Лише латиниця, цифри та дефіс"),
});

export type ClientInput = z.infer<typeof clientSchema>;
export type ServiceInput = z.infer<typeof serviceSchema>;
export type EmployeeInput = z.infer<typeof employeeSchema>;
export type AppointmentInput = z.infer<typeof appointmentSchema>;
export type PaymentInput = z.infer<typeof paymentSchema>;
export type LeadInput = z.infer<typeof leadSchema>;
