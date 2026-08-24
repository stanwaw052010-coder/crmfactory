import type { Metadata } from "next";
import { Suspense } from "react";
import type { ClientStatus } from "@prisma/client";
import { requirePermission } from "@/lib/auth/context";
import { listClients } from "@/server/queries/clients";
import { PageHeader } from "@/components/shared/page-header";
import { SkeletonTable } from "@/components/ui/skeleton";
import { ClientsTable } from "@/features/clients/clients-table";

export const metadata: Metadata = { title: "Клієнти" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function ClientsPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const query = typeof params.q === "string" ? params.q : "";
  const status = typeof params.status === "string" ? params.status : "ALL";
  const page = Number(params.page ?? 1) || 1;

  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHeader
        title="Клієнти"
        description="Уся база в одному місці: контакти, історія візитів і суми."
      />
      <Suspense key={`${query}-${status}-${page}`} fallback={<SkeletonTable rows={8} cols={6} />}>
        <ClientsContent
          query={query}
          status={status}
          page={page}
          openNew={params.new === "1"}
        />
      </Suspense>
    </div>
  );
}

async function ClientsContent({
  query,
  status,
  page,
  openNew,
}: {
  query: string;
  status: string;
  page: number;
  openNew: boolean;
}) {
  const ctx = await requirePermission("client.view");
  const data = await listClients({
    organizationId: ctx.organization.id,
    query,
    status: status as ClientStatus | "ALL",
    page,
  });

  return (
    <ClientsTable
      rows={data.rows}
      total={data.total}
      page={data.page}
      pageSize={data.pageSize}
      query={query}
      status={status}
      currency={ctx.organization.currency}
      canCreate={ctx.permissions.has("client.create")}
      canUpdate={ctx.permissions.has("client.update")}
      canDelete={ctx.permissions.has("client.delete")}
      canExport={ctx.permissions.has("client.export")}
      openNew={openNew}
    />
  );
}
