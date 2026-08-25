"use server";

import { requireAuth } from "@/lib/auth/context";
import { askAssistant, type AssistantTurn } from "@/lib/ai/assistant";
import { fail, ok, toActionError, type ActionResult } from "@/lib/errors";
import { consume, LIMITS } from "@/lib/rate-limit";
import { audit } from "@/lib/audit";

/** Скільки попередніх реплік передавати моделі. */
const HISTORY_LIMIT = 8;

/** Обмеження на довжину питання — щоб один запит не з'їв бюджет. */
const MAX_QUESTION_LENGTH = 600;

export type AskResult = { text: string; toolsUsed: string[] };

/**
 * Питання до factory AI.
 *
 * Доступ — той самий, що до аналітики: асистент бачить зведення по всьому
 * салону, тож рядовому майстру, який має бачити лише свої записи, він
 * не належить.
 */
export async function askFactoryAiAction(
  _prev: ActionResult<AskResult> | null,
  formData: FormData,
): Promise<ActionResult<AskResult>> {
  try {
    const ctx = await requireAuth();

    if (!ctx.permissions.has("analytics.view")) {
      return fail("Недостатньо прав для доступу до factory AI");
    }

    const question = String(formData.get("question") ?? "").trim();
    if (!question) return fail("Введіть питання");
    if (question.length > MAX_QUESTION_LENGTH) {
      return fail(`Питання задовге — максимум ${MAX_QUESTION_LENGTH} символів.`);
    }

    // Ліміт на організацію, а не на IP: платить власник платформи,
    // і рахунок росте від кількості запитів салону, звідки б вони не йшли.
    const limit = consume(`ai:${ctx.organization.id}`, LIMITS.ai.limit, LIMITS.ai.windowSec);
    if (!limit.allowed) {
      return fail(
        `Ліміт запитів до AI вичерпано. Спробуйте через ${Math.ceil(limit.retryAfterSec / 60)} хв.`,
      );
    }

    let history: AssistantTurn[] = [];
    try {
      const raw = JSON.parse(String(formData.get("history") ?? "[]"));
      if (Array.isArray(raw)) {
        history = raw
          .filter(
            (turn): turn is AssistantTurn =>
              turn &&
              (turn.role === "user" || turn.role === "assistant") &&
              typeof turn.content === "string",
          )
          .slice(-HISTORY_LIMIT)
          .map((turn) => ({ role: turn.role, content: turn.content.slice(0, 4000) }));
      }
    } catch {
      /* Зіпсована історія не має ламати запит — починаємо розмову заново. */
    }

    const result = await askAssistant({
      question,
      history,
      businessName: ctx.organization.name,
      ctx: {
        organizationId: ctx.organization.id,
        currency: ctx.organization.currency,
      },
    });

    if (!result.ok) return fail(result.error);

    await audit({
      organizationId: ctx.organization.id,
      userId: ctx.user.id,
      action: "ai.question",
      meta: { tools: result.toolsUsed },
    });

    return ok({ text: result.text, toolsUsed: result.toolsUsed });
  } catch (error) {
    return toActionError(error);
  }
}
