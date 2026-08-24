import { ZodError } from "zod";
import { PermissionDeniedError } from "@/lib/auth/context";
import { TenantViolationError } from "@/lib/db/tenant";

/** Уніфікована відповідь серверної дії. Ніяких stack trace на клієнті. */
export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

export function ok(): ActionResult<undefined>;
export function ok<T>(data: T): ActionResult<T>;
export function ok<T>(data?: T): ActionResult<T | undefined> {
  return { ok: true, data };
}

export function fail(error: string, fieldErrors?: Record<string, string>): ActionResult<never> {
  return { ok: false, error, fieldErrors };
}

/**
 * Перетворює будь-яку помилку на людське повідомлення.
 * Технічні деталі лишаються в логах сервера.
 */
export function toActionError(error: unknown): ActionResult<never> {
  if (error instanceof ZodError) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of error.issues) {
      const key = issue.path.join(".") || "form";
      if (!fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return fail("Перевірте заповнені поля", fieldErrors);
  }
  if (error instanceof PermissionDeniedError) {
    return fail("У вас недостатньо прав для цієї дії");
  }
  if (error instanceof TenantViolationError) {
    return fail("Запис не знайдено");
  }
  if (error instanceof AppError) {
    return fail(error.message, error.fieldErrors);
  }
  console.error("[action]", error);
  return fail("Щось пішло не так. Спробуйте ще раз.");
}

/** Очікувана бізнес-помилка, текст якої можна показати користувачу. */
export class AppError extends Error {
  constructor(
    message: string,
    public fieldErrors?: Record<string, string>,
  ) {
    super(message);
    this.name = "AppError";
  }
}
