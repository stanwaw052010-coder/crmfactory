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

/**
 * Модель асистента.
 *
 * За замовчуванням Opus 5 — найсильніша. Але для цієї задачі вона
 * надлишкова: рахує не модель, а Postgres (інструменти повертають готові
 * суми), і моделі лишається сформулювати відповідь українською. Тому
 * значення виведене у змінну середовища — власник платформи може
 * перемкнутися на дешевшу, не чіпаючи код.
 *
 * Ціни за мільйон токенів (вхід / вихід):
 *   claude-opus-5      $5  / $25   — найточніша
 *   claude-sonnet-5    $2  / $10   — компроміс
 *   claude-haiku-4-5   $1  / $5    — вп'ятеро дешевша за Opus
 */
const DEFAULT_MODEL = "claude-opus-5";

function model(): string {
  return process.env.ANTHROPIC_MODEL?.trim() || DEFAULT_MODEL;
}

/**
 * Чи приймає модель адаптивне мислення та `effort`.
 *
 * Це не косметика: моделі до 4.6 відхиляють обидва параметри з кодом 400.
 * Haiku 4.5 і Sonnet 4.5 — саме такі, і запит до них із `thinking:
 * adaptive` просто не проходить. Тобто вибір моделі змінює ФОРМУ запиту,
 * а не лише її назву.
 *
 * Перелік навмисно позитивний: невідома модель означає «не надсилати».
 * Запит без цих параметрів працює завжди, тож нова модель у гіршому разі
 * втратить мислення — але не зламається. Помилятися краще в цей бік.
 */
const ADAPTIVE_THINKING = /^claude-(opus|sonnet|fable|mythos)-(5|4-6|4-7|4-8)\b/;

export function supportsAdaptiveThinking(modelId: string): boolean {
  return ADAPTIVE_THINKING.test(modelId.trim());
}

function systemPrompt(params: { businessName: string; currency: string; today: string }) {
  return [
    `Ти — factory AI, вбудований помічник CRM-системи crm.factory для салону «${params.businessName}».`,
    `Сьогодні ${params.today}. Валюта салону — ${params.currency}.`,
    "",
    "Відповідай українською, стисло і по суті. Власниця салону читає це між клієнтами.",
    "Українською — повністю, без російських слів: не «растеш», а «зростаєш»; не «больше», а «більше».",
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

  /**
   * Лічильники токенів за все питання.
   *
   * Потрібні, щоб кешування можна було ПЕРЕВІРИТИ, а не вірити на слово:
   * префікс (інструкція + опис інструментів) виходить близько 1000–1600
   * токенів, а мінімум для кешу — 1024. Це межа, тож єдиний чесний
   * спосіб дізнатися — подивитися, що відповів API.
   *
   * Якщо `cacheRead` лишається нулем у кожному питанні — кеш не працює,
   * і префікс треба або збільшити, або перестати на нього розраховувати.
   */
  const usage = { input: 0, output: 0, cacheWrite: 0, cacheRead: 0 };

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
      const modelId = model();

      const response = await client.messages.create({
        model: modelId,
        max_tokens: 4096,
        // Питання про бізнес майже завжди вимагають зіставити кілька
        // показників, тож адаптивне мислення тут доречне — але лише там,
        // де модель його приймає. Старіші відхиляють ці поля з 400.
        ...(supportsAdaptiveThinking(modelId)
          ? {
              thinking: { type: "adaptive" as const },
              output_config: { effort: "medium" as const },
            }
          : {}),
        // Кешування незмінної частини запиту.
        //
        // Порядок складання запиту — tools → system → messages, тож
        // позначка в кінці system накриває і опис інструментів, і саму
        // інструкцію. Вони однакові в кожному зверненні, а змінюється
        // лише листування.
        //
        // Виграш гарантований уже всередині одного питання: модель
        // ходить по дані 2–4 рази поспіль, і кожне наступне звернення
        // читає цей блок із кешу за десяту частину ціни. Між різними
        // питаннями кеш живе 5 хвилин — спрацює, якщо власниця ставить
        // їх поспіль, і просто не спрацює, якщо раз на день.
        system: [
          { type: "text", text: system, cache_control: { type: "ephemeral" } },
        ],
        tools: AI_TOOLS as unknown as Anthropic.Tool[],
        messages,
      });

      usage.input += response.usage.input_tokens ?? 0;
      usage.output += response.usage.output_tokens ?? 0;
      usage.cacheWrite += response.usage.cache_creation_input_tokens ?? 0;
      usage.cacheRead += response.usage.cache_read_input_tokens ?? 0;

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

        console.info(
          `[factory-ai] ${modelId} · звернень ${round + 1} · вхід ${usage.input} · ` +
            `вихід ${usage.output} · кеш записано ${usage.cacheWrite} · ` +
            `кеш прочитано ${usage.cacheRead}`,
        );

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
    if (error instanceof Anthropic.BadRequestError) {
      // 400 — це майже завжди неправильна конфігурація, а не збій: модель
      // не приймає якесь поле або в ANTHROPIC_MODEL описка. «Спробуйте
      // пізніше» тут відверта неправда: без втручання воно не мине.
      console.error("[factory-ai] запит відхилено", error.message);
      return {
        ok: false,
        error: `Запит відхилено: ${error.message.slice(0, 300)}`,
      };
    }
    if (error instanceof Anthropic.NotFoundError) {
      return {
        ok: false,
        error: `Модель «${model()}» не існує. Перевірте ANTHROPIC_MODEL у змінних середовища.`,
      };
    }
    if (error instanceof Anthropic.APIError) {
      console.error("[factory-ai] помилка API", error.status, error.message);
      return { ok: false, error: `AI недоступний (${error.status}). Спробуйте пізніше.` };
    }
    console.error("[factory-ai] несподівана помилка", error);
    return { ok: false, error: "Не вдалося звернутися до AI." };
  }
}
