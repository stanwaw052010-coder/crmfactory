"use client";

import * as React from "react";
import { useActionState } from "react";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { Field, Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { SubmitButton } from "@/components/shared/submit-button";
import { useToast } from "@/components/ui/toast";
import { ROLE_LABELS } from "@/lib/permissions";
import { changePasswordAction, updateProfileAction } from "@/server/actions/auth";
import type { Role } from "@prisma/client";

export function ProfileForm({
  user,
  role,
  organizationName,
}: {
  user: { name: string; email: string; phone: string | null };
  role: Role;
  organizationName: string;
}) {
  const toast = useToast();
  const [profileState, profileAction] = useActionState(updateProfileAction, null);
  const [passwordState, passwordAction] = useActionState(changePasswordAction, null);
  const passwordForm = React.useRef<HTMLFormElement>(null);

  React.useEffect(() => {
    if (profileState?.ok) toast.success("Профіль оновлено");
    else if (profileState && !profileState.ok) toast.error("Не вдалося зберегти", profileState.error);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileState]);

  React.useEffect(() => {
    if (passwordState?.ok) {
      toast.success("Пароль змінено", "Сесії на інших пристроях завершено");
      passwordForm.current?.reset();
    } else if (passwordState && !passwordState.ok) {
      toast.error("Не вдалося змінити пароль", passwordState.error);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [passwordState]);

  return (
    <div className="space-y-6">
      <form action={profileAction}>
        <Card>
          <CardHeader
            title="Мій профіль"
            description={`${organizationName} · ${ROLE_LABELS[role]}`}
            action={<Badge tone="brand">{ROLE_LABELS[role]}</Badge>}
          />
          <CardBody className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Ім'я"
                error={profileState && !profileState.ok ? profileState.fieldErrors?.name : undefined}
              >
                <Input name="name" defaultValue={user.name} required />
              </Field>
              <Field label="Телефон">
                <Input name="phone" type="tel" defaultValue={user.phone ?? ""} />
              </Field>
            </div>
            <Field label="Email" hint="змінити email поки не можна">
              <Input value={user.email} disabled readOnly />
            </Field>
          </CardBody>
          <div className="flex justify-end border-t border-[var(--border)] px-5 py-3.5">
            <SubmitButton size="sm">Зберегти</SubmitButton>
          </div>
        </Card>
      </form>

      <form ref={passwordForm} action={passwordAction}>
        <Card>
          <CardHeader
            title="Пароль"
            description="Після зміни всі інші сесії завершаться — це стандартна практика безпеки"
          />
          <CardBody className="space-y-4">
            <Field
              label="Поточний пароль"
              error={passwordState && !passwordState.ok ? passwordState.fieldErrors?.currentPassword : undefined}
            >
              <Input name="currentPassword" type="password" required autoComplete="current-password" />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Новий пароль"
                error={passwordState && !passwordState.ok ? passwordState.fieldErrors?.newPassword : undefined}
              >
                <Input name="newPassword" type="password" required autoComplete="new-password" />
              </Field>
              <Field
                label="Повторіть пароль"
                error={passwordState && !passwordState.ok ? passwordState.fieldErrors?.confirmPassword : undefined}
              >
                <Input name="confirmPassword" type="password" required autoComplete="new-password" />
              </Field>
            </div>
          </CardBody>
          <div className="flex justify-end border-t border-[var(--border)] px-5 py-3.5">
            <SubmitButton size="sm" variant="secondary">
              Змінити пароль
            </SubmitButton>
          </div>
        </Card>
      </form>

      <Card>
        <CardHeader title="Вигляд" description="Налаштування зберігається у вашому браузері" />
        <CardBody>
          <ThemeToggle />
        </CardBody>
      </Card>
    </div>
  );
}
