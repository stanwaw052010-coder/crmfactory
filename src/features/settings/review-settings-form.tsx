"use client";

import * as React from "react";
import { useActionState } from "react";
import { Check, Loader2, Star } from "lucide-react";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/input";
import { updateReviewSettingsAction } from "@/server/actions/settings";

/**
 * Налаштування запитів відгуку.
 *
 * Посилання на публічну площадку тут — головне поле, і воно не про
 * зручність, а про сенс усієї механіки: без нього задоволеним клієнтам
 * нема куди піти, і відгуки лишаються всередині CRM, нікого не приводячи.
 */
export function ReviewSettingsForm({
  settings,
  canManage,
}: {
  settings: { reviewsEnabled: boolean; reviewDelayHours: number; reviewPublicUrl: string | null };
  canManage: boolean;
}) {
  const [state, formAction, pending] = useActionState(updateReviewSettingsAction, null);
  const [enabled, setEnabled] = React.useState(settings.reviewsEnabled);

  return (
    <Card>
      <CardHeader
        title="Відгуки"
        description="Через кілька годин після візиту клієнт отримує лист з оцінкою"
        action={<Star className="h-4 w-4 text-[var(--fg-subtle)]" />}
      />
      <CardBody>
        <form action={formAction} className="space-y-5">
          <input type="hidden" name="reviewsEnabled" value={enabled ? "on" : ""} />

          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              checked={enabled}
              disabled={!canManage}
              onChange={(event) => setEnabled(event.target.checked)}
              className="mt-0.5 h-4 w-4 accent-[var(--primary)]"
            />
            <span className="space-y-0.5">
              <span className="block text-[14px] font-medium text-[var(--fg)]">
                Питати враження після візиту
              </span>
              <span className="block text-[12.5px] leading-relaxed text-[var(--fg-muted)]">
                Лист іде лише тим, у кого в картці є email, і лише раз на візит.
              </span>
            </span>
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Через скільки годин" htmlFor="reviewDelayHours">
              <Input
                id="reviewDelayHours"
                name="reviewDelayHours"
                type="number"
                min={1}
                max={168}
                defaultValue={settings.reviewDelayHours}
                disabled={!canManage || !enabled}
              />
            </Field>
          </div>

          <Field
            label="Посилання на публічну сторінку"
            htmlFor="reviewPublicUrl"
            hint="Google Карти, Facebook — куди вести тих, хто готовий написати публічно"
          >
            <Input
              id="reviewPublicUrl"
              name="reviewPublicUrl"
              type="url"
              inputMode="url"
              placeholder="https://maps.app.goo.gl/..."
              defaultValue={settings.reviewPublicUrl ?? ""}
              disabled={!canManage}
            />
          </Field>

          <p className="rounded-xl bg-[var(--surface-2)] px-3.5 py-3 text-[12.5px] leading-relaxed text-[var(--fg-muted)]">
            Посилання бачать усі, хто залишив відгук, — незалежно від оцінки.
            Показувати його лише задоволеним заманливо, але це порушує правила
            Google: за відбір відгуків за оцінкою площадка може зняти бізнесу
            всі відгуки одразу. Тим, кому не сподобалося, ми спершу даємо
            розповісти про це вам.
          </p>

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={!canManage || pending}
              className="flex items-center gap-2 rounded-xl bg-[var(--primary)] px-4 py-2.5 text-[14px] font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              {pending && <Loader2 className="h-4 w-4 animate-spin" />}
              Зберегти
            </button>
            {state?.ok && (
              <span className="flex items-center gap-1.5 text-[13px] text-[var(--success)]">
                <Check className="h-3.5 w-3.5" /> Збережено
              </span>
            )}
            {state && !state.ok && (
              <span className="text-[13px] text-[var(--danger)]">{state.error}</span>
            )}
          </div>
        </form>
      </CardBody>
    </Card>
  );
}
