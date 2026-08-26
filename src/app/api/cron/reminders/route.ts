import { NextResponse } from "next/server";
import { dispatchDueReminders } from "@/lib/reminders";
import { dispatchDueReviewRequests } from "@/lib/reviews";
import { safeCompare } from "@/lib/auth/password-reset";

/**
 * Розсилка нагадувань. Викликається планувальником, не людиною.
 *
 * Чому окремий HTTP-роут, а не `vercel.json` → `crons`:
 * планувальник Vercel на тарифі Hobby вміє запускати задачу лише РАЗ НА ДОБУ
 * (частіші вирази відхиляються ще на деплої). Для нагадувань за годину-дві
 * до візиту цього замало. Роут же викличе будь-що, що вміє HTTP: GitHub
 * Actions, cron-job.org, власний сервер — і той самий Vercel Cron, якщо
 * тариф підвищать. Планувальник змінюється, застосунок — ні.
 *
 * Захист: заголовок `Authorization: Bearer <CRON_SECRET>`. Саме такий
 * заголовок Vercel Cron надсилає сам, коли задано змінну CRON_SECRET.
 * Без заданої змінної роут ВІДМОВЛЯЄ: відкритий ендпоінт, що надсилає
 * листи, — це чужа розсилка за твій рахунок.
 */

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Скільки задач за один запуск. Обмежене, щоб не впертися в ліміт функції. */
const BATCH = 50;

/** Відгуків за запуск менше: вони не термінові, а функція одна на обидві черги. */
const REVIEW_BATCH = 25;

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;

  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) return false;

  return safeCompare(token, secret);
}

async function run(request: Request) {
  if (!process.env.CRON_SECRET?.trim()) {
    console.error("[cron] CRON_SECRET не задано — розсилку вимкнено");
    return NextResponse.json({ error: "CRON_SECRET не налаштовано" }, { status: 503 });
  }

  if (!authorized(request)) {
    return NextResponse.json({ error: "Немає доступу" }, { status: 401 });
  }

  const started = Date.now();

  // Дві черги, один планувальник. Заводити другий cron заради відгуків
  // означало б удвічі більше налаштувань на боці власника платформи —
  // і другий спосіб зламатися.
  //
  // Послідовно, а не Promise.all: обидві черги пишуть у ту саму базу й
  // ходять до тієї самої пошти, а виграш у пару секунд для фонової задачі
  // не вартий подвоєного навантаження в піку.
  const reminders = await dispatchDueReminders(BATCH);
  const reviews = await dispatchDueReviewRequests(REVIEW_BATCH);
  const ms = Date.now() - started;

  // Лог має бути читабельним у консолі Vercel: якщо листи не доходять,
  // саме сюди дивляться першим ділом.
  console.log(
    `[cron] нагадування: взято ${reminders.picked}, надіслано ${reminders.sent}, провалено ${reminders.failed} · ` +
      `відгуки: взято ${reviews.picked}, надіслано ${reviews.sent}, провалено ${reviews.failed} · ${ms} мс`,
  );

  return NextResponse.json({ reminders, reviews, ms });
}

// GET — щоб роут міг смикнути будь-який простий планувальник; POST — для тих,
// хто принципово не робить GET із побічними ефектами. Логіка одна.
export async function GET(request: Request) {
  return run(request);
}

export async function POST(request: Request) {
  return run(request);
}
