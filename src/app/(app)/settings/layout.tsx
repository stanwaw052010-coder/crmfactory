import { requireAuth } from "@/lib/auth/context";
import { PageHeader } from "@/components/shared/page-header";
import { SettingsNav } from "@/components/layout/settings-nav";

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireAuth();

  return (
    <div className="mx-auto max-w-[1100px]">
      <PageHeader title="Налаштування" description="Бізнес, онлайн-запис, команда та тариф." />
      <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <SettingsNav permissions={Array.from(ctx.permissions)} />
        </aside>
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
