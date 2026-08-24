import Link from "next/link";
import { Compass } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/shared/logo";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-5 text-center">
      <Logo size="lg" className="mb-10" />
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--primary-soft)] text-[var(--primary)]">
        <Compass className="h-6 w-6" />
      </div>
      <h1 className="mt-5 text-[22px] font-semibold tracking-tight text-[var(--fg)]">
        Сторінку не знайдено
      </h1>
      <p className="mt-2 max-w-sm text-[14px] leading-relaxed text-balance text-[var(--fg-muted)]">
        Можливо, посилання застаріле або запис було видалено.
      </p>
      <div className="mt-6 flex gap-2">
        <Link href="/dashboard">
          <Button>До робочого простору</Button>
        </Link>
        <Link href="/">
          <Button variant="secondary">На головну</Button>
        </Link>
      </div>
    </div>
  );
}
