import type { Metadata } from "next";
import { requireViewPermission } from "@/lib/auth/context";
import { prisma } from "@/lib/db/prisma";
import { PageHeader } from "@/components/shared/page-header";
import { PipelineBoard } from "@/features/pipeline/pipeline-board";

export const metadata: Metadata = { title: "Воронка" };

export default async function PipelinePage() {
  const ctx = await requireViewPermission("pipeline.view");

  const [stages, leads, services, employees] = await Promise.all([
    prisma.pipelineStage.findMany({
      where: { organizationId: ctx.organization.id },
      orderBy: { sortOrder: "asc" },
    }),
    prisma.lead.findMany({
      where: { organizationId: ctx.organization.id },
      include: {
        service: { select: { name: true } },
        assignedTo: { select: { name: true } },
        client: {
          select: {
            id: true,
            appointments: {
              where: { startAt: { gte: new Date() }, status: { in: ["CONFIRMED", "WAITING"] } },
              orderBy: { startAt: "asc" },
              take: 1,
              select: { startAt: true },
            },
          },
        },
      },
      orderBy: [{ position: "asc" }, { createdAt: "desc" }],
    }),
    prisma.service.findMany({
      where: { organizationId: ctx.organization.id, isActive: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.employee.findMany({
      where: { organizationId: ctx.organization.id, isActive: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <div className="mx-auto max-w-[1500px]">
      <PageHeader
        title="Воронка"
        description="Заявки з месенджерів і дзвінків — видно, на якому етапі кожен клієнт."
      />
      <PipelineBoard
        stages={stages}
        currency={ctx.organization.currency}
        canManage={ctx.permissions.has("pipeline.manage")}
        services={services}
        employees={employees}
        leads={leads.map((lead) => ({
          id: lead.id,
          stageId: lead.stageId,
          name: lead.name,
          phone: lead.phone,
          email: lead.email,
          source: lead.source,
          valueCents: lead.valueCents,
          note: lead.note,
          position: lead.position,
          clientId: lead.clientId,
          serviceName: lead.service?.name ?? null,
          assignedToName: lead.assignedTo?.name ?? null,
          nextAppointment: lead.client?.appointments[0]?.startAt ?? null,
        }))}
      />
    </div>
  );
}
