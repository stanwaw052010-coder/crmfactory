import type { Metadata } from "next";
import { requireViewPermission } from "@/lib/auth/context";
import { prisma } from "@/lib/db/prisma";
import { PageHeader } from "@/components/shared/page-header";
import { ServicesBoard } from "@/features/services/services-board";

export const metadata: Metadata = { title: "Послуги" };

export default async function ServicesPage() {
  const ctx = await requireViewPermission("service.view");

  const [services, categories, employees] = await Promise.all([
    prisma.service.findMany({
      where: { organizationId: ctx.organization.id },
      include: {
        category: { select: { id: true, name: true } },
        employees: { select: { employeeId: true } },
      },
      orderBy: [{ isActive: "desc" }, { sortOrder: "asc" }, { name: "asc" }],
    }),
    prisma.serviceCategory.findMany({
      where: { organizationId: ctx.organization.id },
      orderBy: { sortOrder: "asc" },
      select: { id: true, name: true, color: true },
    }),
    prisma.employee.findMany({
      where: { organizationId: ctx.organization.id, isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, position: true, color: true },
    }),
  ]);

  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHeader
        title="Послуги"
        description="Тривалість, ціна та виконавці — основа календаря й онлайн-запису."
      />
      <ServicesBoard
        currency={ctx.organization.currency}
        canManage={ctx.permissions.has("service.manage")}
        categories={categories}
        employees={employees}
        services={services.map((service) => ({
          id: service.id,
          name: service.name,
          description: service.description,
          categoryId: service.categoryId,
          categoryName: service.category?.name ?? null,
          durationMin: service.durationMin,
          bufferMin: service.bufferMin,
          priceCents: service.priceCents,
          color: service.color,
          isActive: service.isActive,
          onlineBooking: service.onlineBooking,
          employeeIds: service.employees.map((e) => e.employeeId),
          employeeCount: service.employees.length,
        }))}
      />
    </div>
  );
}
