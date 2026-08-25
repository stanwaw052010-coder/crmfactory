import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { AI_TOOLS, runTool, type ToolContext } from "@/lib/ai/tools";

/**
 * factory AI — асистент, що відповідає на питання про власний бізнес.
 *
 * Схема роботи: модель отримує питання і набір інструментів, сама обирає,
 * які дані їй потрібні, сервер виконує запити до Postgres у межах ОДНІЄЇ
 * організації, модель формулює відповідь із отриманих чисел.
 *
 * Чому саме так, а не «згенеруй SQL»:
 * — модель не може дістатися чужих даних, бо в її розпорядженні немає
 *   параметра з ідентифікатором організації;
 * — числа рахує база, а не мовна модель, тож у відповіді не з'явиться
 *   правдоподібна, але вигадана сума.
 */

export function aiEnabled(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY?.trim());
}

/** Скільки разів модель може сходити по дані, перш ніж відповісти. */
const MAX_TOOL_ROUNDS = 6;

const MODEL = "claude-opus-5";

function systemPrompt(params: { businessName: string; currency: string; today: string }) {
  return [
    `Ти — factory AI, вбудований помічник CRM-системи crm.factory для салону «${params.businessName}».`,
    `Сьогодні ${params.today}. Валюта салону — ${params.currency}.`,
    "",
    "Відповідай українською, стисло і по суті. Власниця салону читає це між клієнтами.",
    "",
    "Правила:",
    "— Бери числа ВИКЛЮЧНО з інструментів. Якщо даних немає, скажи про це прямо, не вигадуй.",
    "— Не рахуй суми в голові: інструменти вже повертають готові значення у валюті салону.",
    "— Спочатку відповідь, потім за потреби 1–2 речення пояснення. Без вступів на кшталт «Звісно!».",
    "— Якщо питання неоднозначне щодо періоду, бери останні 30 днів і скажи, за який період відповідаєш.",
    "— Коли бачиш проблему в цифрах, назви її і запропонуй конкретну наступну дію.",
    "— Не вигадуй імена клієнтів, послуг чи співробітників — використовуй лише ті, що повернули інструменти.",
  ].join("\n");
}

export type AssistantTurn = { role: "user" | "assistant"; content: string };

export type AssistantResult =
  | { ok: true; text: string; toolsUsed: string[] }
  | { ok: false; error: string };

export async function askAssistant(params: {
  question: string;
  history: AssistantTurn[];
  ctx: ToolContext;
  businessName: string;
}): Promise<AssistantResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) {
    return { ok: false, error: "factory AI не налаштовано на цьому сервері." };
  }

  const client = new Anthropic({ apiKey });
  const toolsUsed: string[] = [];

  const messages: Anthropic.MessageParam[] = [
    ...params.history.map((turn) => ({
      role: turn.role,
      content: turn.content,
    })),
    { role: "user" as const, content: params.question },
  ];

  const system = systemPrompt({
    businessName: params.businessName,
    currency: params.ctx.currency,
    today: new Date().toLocaleDateString("uk-UA", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }),
  });

  try {
    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      const response = await client.messages.create({
        model: MODEL,
        max_tokens: 4096,
        // Питання про бізнес майже завжди вимагають зіставити кілька
        // показників, тож адаптивне мислення тут доречне.
        thinking: { type: "adaptive" },
        output_config: { effort: "medium" },
        system,
        tools: AI_TOOLS as unknown as Anthropic.Tool[],
        messages,
      });

      if (response.stop_reason === "refusal") {
        return { ok: false, error: "Не можу відповісти на це питання." };
      }

      messages.push({ role: "assistant", content: response.content });

      const toolCalls = response.content.filter(
        (block): block is Anthropic.ToolUseBlock => block.type === "tool_use",
      );

      if (toolCalls.length === 0) {
        const text = response.content
          .filter((block): block is Anthropic.TextBlock => block.type === "text")
          .map((block) => block.text)
          .join("\n")
          .trim();

        return text
          ? { ok: true, text, toolsUsed }
          : { ok: false, error: "Порожня відповідь. Спробуйте переформулювати питання." };
      }

      // Усі результати повертаються ОДНИМ повідомленням: якщо розбити їх
      // на кілька, модель поступово перестає викликати інструменти паралельно.
      const results: Anthropic.ToolResultBlockParam[] = await Promise.all(
        toolCalls.map(async (call) => {
          toolsUsed.push(call.name);
          try {
            const output = await runTool(
              call.name,
              (call.input ?? {}) as Record<string, unknown>,
              params.ctx,
            );
            return { type: "tool_result" as const, tool_use_id: call.id, content: output };
          } catch (error) {
            console.error("[factory-ai] інструмент упав", call.name, error);
            return {
              type: "tool_result" as const,
              tool_use_id: call.id,
              content: "Не вдалося отримати дані.",
              is_error: true,
            };
          }
        }),
      );

      messages.push({ role: "user", content: results });
    }

    return {
      ok: false,
      error: "Питання вийшло надто складним. Спробуйте розбити його на частини.",
    };
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) {
      return { ok: false, error: "Ключ ANTHROPIC_API_KEY відхилено. Перевірте його в змінних середовища." };
    }
    if (error instanceof Anthropic.RateLimitError) {
      return { ok: false, error: "Забагато запитів до AI. Спробуйте за хвилину." };
    }
    if (error instanceof Anthropic.APIError) {
      console.error("[factory-ai] помилка API", error.status, error.message);
      return { ok: false, error: `AI недоступний (${error.status}). Спробуйте пізніше.` };
    }
    console.error("[factory-ai] несподівана помилка", error);
    return { ok: false, error: "Не вдалося звернутися до AI." };
  }
}
