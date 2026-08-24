import Link from "next/link";
import { SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

/**
 * «Запис не знайдено» всередині оболонки CRM.
 *
 * Окремий екран 404 на всю сторінку тут був би різким: користувач лишається
 * в застосунку, бачить бічне меню й отримує зрозумілий шлях назад.
 */
export function RecordNotFound({
  title = "Запис не знайдено",
  description = "Можливо, його видалили або посилання застаріле.",
  backHref,
  backLabel,
}: {
  title?: string;
  description?: string;
  backHref: string;
  backLabel: string;
}) {
  return (
    <div className="mx-auto max-w-[720px]">
      <div className="card">
        <EmptyState
          icon={SearchX}
          title={title}
          description={description}
          action={
            <Link href={backHref}>
              <Button>{backLabel}</Button>
            </Link>
          }
        />
      </div>
    </div>
  );
}
