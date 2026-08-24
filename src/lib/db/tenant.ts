import "server-only";

/**
 * Tenant-ізоляція.
 *
 * Правило проєкту: жоден запит до бізнес-таблиці не виконується без
 * `organizationId` у `where`. Ці хелпери роблять порушення цього правила
 * помітним у коді (і падаючим у рантаймі), а не тихою витоком даних.
 */

export class TenantViolationError extends Error {
  constructor(message = "Спроба доступу до даних іншої організації") {
    super(message);
    this.name = "TenantViolationError";
  }
}

/** Будує `where`-фрагмент, гарантовано прив'язаний до організації. */
export function scoped<T extends object>(
  organizationId: string,
  where?: T,
): T & { organizationId: string } {
  if (!organizationId) throw new TenantViolationError("organizationId відсутній");
  return { ...(where ?? ({} as T)), organizationId };
}

/**
 * Перевіряє, що знайдений запис справді належить організації.
 * Використовується після `findUnique` за id (де tenant-фільтр неможливий).
 */
export function assertTenant<T extends { organizationId: string } | null>(
  record: T,
  organizationId: string,
): NonNullable<T> {
  if (!record || record.organizationId !== organizationId) {
    throw new TenantViolationError();
  }
  return record as NonNullable<T>;
}
