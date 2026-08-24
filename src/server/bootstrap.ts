import "server-only";
import type { Prisma } from "@prisma/client";

/**
 * Дефолти для нової організації: воронка, робочі години, підписка.
 * Виконується в одній транзакції разом зі створенням workspace.
 */

export const DEFAULT_PIPELINE_STAGES = [
  { key: "new", name: "Нова заявка", color: "#38BDF8", sortOrder: 0 },
  { key: "contacted", name: "Зв'язалися", color: "#6366F1", sortOrder: 1 },
  { key: "booked", name: "Записані", color: "#2563EB", sortOrder: 2 },
  { key: "visited", name: "Відвідали", color: "#0D9488", sortOrder: 3, isWon: true },
  { key: "repeat", name: "Повторні", color: "#059669", sortOrder: 4, isWon: true },
];

export function defaultBusinessHours(
  organizationId: string,
): Prisma.BusinessHoursCreateManyInput[] {
  return Array.from({ length: 7 }, (_, weekday) => ({
    organizationId,
    weekday,
    openMinute: 540,
    closeMinute: 1080,
    isClosed: weekday === 0,
  }));
}

export function defaultSchedule(employeeId: string): Prisma.EmployeeScheduleCreateManyInput[] {
  return Array.from({ length: 7 }, (_, weekday) => ({
    employeeId,
    weekday,
    startMinute: 540,
    endMinute: 1080,
    isDayOff: weekday === 0,
  }));
}

export function pipelineStagesFor(
  organizationId: string,
): Prisma.PipelineStageCreateManyInput[] {
  return DEFAULT_PIPELINE_STAGES.map((stage) => ({ ...stage, organizationId }));
}
