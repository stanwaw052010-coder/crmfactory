import Link from "next/link";
import { requireSuperAdmin } from "@/lib/auth/context";
import { Logo } from "@/components/shared/logo";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { Button } from "@/components/ui/button";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireSuperAdmin();

  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b border-[var(--border)] bg-[var(--surface)]/85 px-5 backdrop-blur-xl sm:px-8">
        <Link href="/admin" className="flex items-center gap-2.5">
          <Logo size="sm" />
        </Link>
        <Badge tone="purple">Super Admin</Badge>
        <div className="ml-auto flex items-center gap-3">
          <span className="hidden text-[13px] text-[var(--fg-muted)] sm:block">{user.email}</span>
          <ThemeToggle compact />
          <Link href="/dashboard">
            <Button variant="secondary" size="sm">
              До CRM
            </Button>
          </Link>
        </div>
      </header>
      <main className="px-5 py-8 sm:px-8">{children}</main>
    </div>
  );
}
