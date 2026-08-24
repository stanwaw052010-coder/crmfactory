import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requirePermission } from "@/lib/auth/context";
import { getClientProfile } from "@/server/queries/clients";
import { ClientProfile } from "@/features/clients/client-profile";

export const metadata: Metadata = { title: "Профіль клієнта" };

export default async function ClientPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requirePermission("client.view");
  const data = await getClientProfile(ctx.organization.id, id);
  if (!data) notFound();

  return (
    <ClientProfile
      client={data.client}
      appointments={data.appointments}
      payments={data.payments}
      notes={data.client.notes}
      stats={data.stats}
      nextVisit={data.nextVisit}
      currency={ctx.organization.currency}
      canUpdate={ctx.permissions.has("client.update")}
      canCreateAppointment={ctx.permissions.has("appointment.create")}
    />
  );
}
