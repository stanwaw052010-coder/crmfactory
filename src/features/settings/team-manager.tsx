"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useActionState } from "react";
import { MoreHorizontal, Shield, Trash2, UserPlus } from "lucide-react";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Modal, ConfirmDialog } from "@/components/ui/modal";
import { Field, Input, Select, Switch } from "@/components/ui/input";
import { Dropdown, DropdownItem } from "@/components/ui/dropdown";
import { SubmitButton } from "@/components/shared/submit-button";
import { useToast } from "@/components/ui/toast";
import { PERMISSIONS, ROLE_DESCRIPTIONS, ROLE_LABELS, ROLE_PERMISSIONS } from "@/lib/permissions";
import {
  inviteMemberAction,
  removeMemberAction,
  setPermissionOverrideAction,
  updateMemberRoleAction,
} from "@/server/actions/employees";
import type { Role } from "@prisma/client";
import type { ActionResult } from "@/lib/errors";

export type Member = {
  id: string;
  role: Role;
  userId: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  employeeName: string | null;
  overrides: Record<string, boolean>;
  isSelf: boolean;
};

const PERMISSION_LABELS: Record<string, string> = {
  "dashboard.view": "Головна",
  "calendar.view": "Календар",
  "calendar.view_all": "Бачити чужі записи",
  "appointment.create": "Створювати записи",
  "appointment.update": "Редагувати записи",
  "appointment.delete": "Видаляти записи",
  "client.view": "Бачити клієнтів",
  "client.create": "Додавати клієнтів",
  "client.update": "Редагувати клієнтів",
  "client.delete": "Видаляти клієнтів",
  "client.export": "Експорт клієнтів",
  "service.view": "Бачити послуги",
  "service.manage": "Керувати послугами",
  "employee.view": "Бачити команду",
  "employee.manage": "Керувати командою",
  "schedule.manage": "Графіки всіх",
  "schedule.manage_own": "Власний графік",
  "payment.view": "Бачити продажі",
  "payment.manage": "Керувати продажами",
  "analytics.view": "Аналітика",
  "pipeline.view": "Бачити воронку",
  "pipeline.manage": "Керувати воронкою",
  "settings.view": "Бачити налаштування",
  "settings.manage": "Керувати налаштуваннями",
  "team.manage": "Керувати доступами",
  "billing.manage": "Тариф і білінг",
  "organization.delete": "Видалення workspace",
};

export function TeamManager({
  members,
  employees,
  currentRole,
}: {
  members: Member[];
  employees: { id: string; name: string; hasUser: boolean }[];
  currentRole: Role;
}) {
  const router = useRouter();
  const toast = useToast();
  const [inviteOpen, setInviteOpen] = React.useState(false);
  const [permissionsFor, setPermissionsFor] = React.useState<Member | null>(null);
  const [removing, setRemoving] = React.useState<Member | null>(null);
  const [pending, setPending] = React.useState(false);
  const [state, formAction] = useActionState(
    async (prev: ActionResult<null> | null, formData: FormData) => {
      const result = await inviteMemberAction(prev, formData);
      if (result.ok) {
        toast.success("Учасника додано");
        setInviteOpen(false);
        router.refresh();
      } else if (!result.fieldErrors) {
        toast.error("Не вдалося додати", result.error);
      }
      return result;
    },
    null,
  );

  const changeRole = async (membershipId: string, role: Role) => {
    const result = await updateMemberRoleAction(membershipId, role);
    if (result.ok) {
      toast.success("Роль оновлено");
      router.refresh();
    } else {
      toast.error("Не вдалося змінити роль", result.error);
    }
  };

  const toggleOverride = async (member: Member, permission: string, allowed: boolean | null) => {
    const result = await setPermissionOverrideAction(member.id, permission, allowed);
    if (result.ok) {
      router.refresh();
      setPermissionsFor((prev) => {
        if (!prev) return prev;
        const overrides = { ...prev.overrides };
        if (allowed === null) delete overrides[permission];
        else overrides[permission] = allowed;
        return { ...prev, overrides };
      });
    } else {
      toast.error("Не вдалося змінити право", result.error);
    }
  };

  const remove = async () => {
    if (!removing) return;
    setPending(true);
    const result = await removeMemberAction(removing.id);
    setPending(false);
    setRemoving(null);
    if (result.ok) {
      toast.success("Учасника видалено");
      router.refresh();
    } else {
      toast.error("Не вдалося видалити", result.error);
    }
  };

  const roleOptions: Role[] =
    currentRole === "OWNER" ? ["OWNER", "ADMIN", "MANAGER", "EMPLOYEE"] : ["ADMIN", "MANAGER", "EMPLOYEE"];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader
          title="Учасники"
          description="Роль визначає, що людина бачить і може змінювати — і на фронтенді, і на сервері"
          action={
            <Button size="sm" onClick={() => setInviteOpen(true)}>
              <UserPlus className="h-4 w-4" />
              Додати
            </Button>
          }
        />
        <ul className="divide-y divide-[var(--border)]">
          {members.map((member) => (
            <li key={member.id} className="flex flex-wrap items-center gap-3 px-5 py-4">
              <Avatar name={member.name} src={member.avatarUrl} size="md" />
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 text-[13.5px] font-medium text-[var(--fg)]">
                  {member.name}
                  {member.isSelf && <Badge tone="neutral">це ви</Badge>}
                </p>
                <p className="truncate text-[12.5px] text-[var(--fg-muted)]">
                  {member.email}
                  {member.employeeName && ` · ${member.employeeName}`}
                </p>
              </div>

              <div className="flex items-center gap-2">
                {Object.keys(member.overrides).length > 0 && (
                  <Badge tone="info">
                    {Object.keys(member.overrides).length} змін прав
                  </Badge>
                )}
                <Select
                  className="h-8 w-auto min-w-[150px] text-[13px]"
                  value={member.role}
                  disabled={member.role === "OWNER" && currentRole !== "OWNER"}
                  onChange={(e) => changeRole(member.id, e.target.value as Role)}
                >
                  {roleOptions.map((role) => (
                    <option key={role} value={role}>
                      {ROLE_LABELS[role]}
                    </option>
                  ))}
                </Select>

                <Dropdown
                  width="w-52"
                  trigger={({ toggle }) => (
                    <button
                      type="button"
                      onClick={toggle}
                      aria-label="Дії"
                      className="rounded-lg p-1.5 text-[var(--fg-subtle)] transition-colors hover:bg-[var(--surface-hover)] hover:text-[var(--fg)]"
                    >
                      <MoreHorizontal className="h-4 w-4" />
                    </button>
                  )}
                >
                  {(close) => (
                    <>
                      <DropdownItem
                        icon={Shield}
                        onClick={() => {
                          close();
                          setPermissionsFor(member);
                        }}
                      >
                        Налаштувати права
                      </DropdownItem>
                      {!member.isSelf && (
                        <DropdownItem
                          icon={Trash2}
                          danger
                          onClick={() => {
                            close();
                            setRemoving(member);
                          }}
                        >
                          Прибрати з команди
                        </DropdownItem>
                      )}
                    </>
                  )}
                </Dropdown>
              </div>
            </li>
          ))}
        </ul>
      </Card>

      <Card>
        <CardHeader title="Що можуть ролі" />
        <CardBody className="space-y-3">
          {(["OWNER", "ADMIN", "MANAGER", "EMPLOYEE"] as Role[]).map((role) => (
            <div key={role} className="flex items-start gap-3">
              <Badge tone={role === "OWNER" ? "purple" : role === "ADMIN" ? "brand" : "neutral"}>
                {ROLE_LABELS[role]}
              </Badge>
              <p className="min-w-0 flex-1 text-[13px] text-[var(--fg-muted)]">
                {ROLE_DESCRIPTIONS[role]}
                <span className="ml-1 text-[var(--fg-subtle)]">
                  ({ROLE_PERMISSIONS[role].length} прав)
                </span>
              </p>
            </div>
          ))}
        </CardBody>
      </Card>

      {/* Запрошення */}
      <Modal
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        size="md"
        title="Додати учасника"
        description="Створює обліковий запис одразу — передайте людині email і пароль"
      >
        <form action={formAction} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Ім'я" error={state && !state.ok ? state.fieldErrors?.name : undefined}>
              <Input name="name" required autoFocus />
            </Field>
            <Field label="Email" error={state && !state.ok ? state.fieldErrors?.email : undefined}>
              <Input name="email" type="email" required />
            </Field>
          </div>

          <Field
            label="Тимчасовий пароль"
            hint="мінімум 8 символів"
            error={state && !state.ok ? state.fieldErrors?.password : undefined}
          >
            <Input name="password" type="text" required minLength={8} placeholder="Передайте його співробітнику" />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Роль">
              <Select name="role" defaultValue="EMPLOYEE">
                <option value="ADMIN">{ROLE_LABELS.ADMIN}</option>
                <option value="MANAGER">{ROLE_LABELS.MANAGER}</option>
                <option value="EMPLOYEE">{ROLE_LABELS.EMPLOYEE}</option>
              </Select>
            </Field>
            <Field label="Прив'язати до співробітника" hint="необов'язково">
              <Select name="employeeId" defaultValue="">
                <option value="">Не прив&apos;язувати</option>
                {employees
                  .filter((employee) => !employee.hasUser)
                  .map((employee) => (
                    <option key={employee.id} value={employee.id}>
                      {employee.name}
                    </option>
                  ))}
              </Select>
            </Field>
          </div>

          <p className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-3.5 py-3 text-[12.5px] leading-relaxed text-[var(--fg-muted)]">
            Прив&apos;язка до співробітника потрібна для ролі «Співробітник»: тоді людина бачить
            власний розклад і власні записи.
          </p>

          <div className="flex justify-end gap-2 border-t border-[var(--border)] pt-4">
            <Button type="button" variant="ghost" onClick={() => setInviteOpen(false)}>
              Скасувати
            </Button>
            <SubmitButton>Додати учасника</SubmitButton>
          </div>
        </form>
      </Modal>

      {/* Точкові права */}
      <Modal
        open={Boolean(permissionsFor)}
        onClose={() => setPermissionsFor(null)}
        size="md"
        title={`Права: ${permissionsFor?.name ?? ""}`}
        description="Точкові винятки понад базову роль. Перевіряються на сервері."
      >
        {permissionsFor && (
          <div className="space-y-1">
            {permissionsFor.role === "OWNER" ? (
              <p className="py-6 text-center text-[13px] text-[var(--fg-muted)]">
                Власник має повний доступ — його права не обмежуються.
              </p>
            ) : (
              PERMISSIONS.map((permission) => {
                const base = ROLE_PERMISSIONS[permissionsFor.role].includes(permission);
                const override = permissionsFor.overrides[permission];
                const effective = override ?? base;
                return (
                  <div
                    key={permission}
                    className="flex items-center justify-between gap-4 rounded-lg px-2 py-2 hover:bg-[var(--surface-hover)]"
                  >
                    <div className="min-w-0">
                      <p className="text-[13px] font-medium text-[var(--fg)]">
                        {PERMISSION_LABELS[permission] ?? permission}
                      </p>
                      <p className="text-[11.5px] text-[var(--fg-subtle)]">
                        {base ? "Доступно за роллю" : "Недоступно за роллю"}
                        {override !== undefined && " · змінено вручну"}
                      </p>
                    </div>
                    <Switch
                      checked={effective}
                      onCheckedChange={(value) =>
                        toggleOverride(permissionsFor, permission, value === base ? null : value)
                      }
                    />
                  </div>
                );
              })
            )}
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={Boolean(removing)}
        onClose={() => setRemoving(null)}
        onConfirm={remove}
        loading={pending}
        title="Прибрати з команди?"
        description={`${removing?.name ?? ""} втратить доступ до цього workspace. Записи та історія залишаться.`}
        confirmLabel="Прибрати"
      />
    </div>
  );
}
