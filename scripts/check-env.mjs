/**
 * Перевірка змінних середовища перед збіркою.
 *
 * Без цього відсутній DATABASE_URL проявляється як `Prisma schema
 * validation P1012` десь у середині логу — повідомлення, за яким
 * неможливо здогадатися, що саме треба зробити. Тут падаємо одразу
 * і кажемо, якої змінної бракує та де її додати.
 */

const REQUIRED = [
  {
    name: "DATABASE_URL",
    hint: "Рядок підключення до PostgreSQL, напр. postgresql://user:pass@host/db?sslmode=require",
    check: (value) =>
      value.startsWith("postgres://") || value.startsWith("postgresql://")
        ? null
        : "має починатися з postgresql:// або postgres://",
  },
  {
    name: "DIRECT_URL",
    hint:
      "Пряме підключення до тієї самої бази, в обхід пулера — його вимагають міграції.\n" +
      "    У Neon це адреса БЕЗ `-pooler` у хості, у Supabase — порт 5432 замість 6543.\n" +
      "    Локально пулера немає: просто скопіюйте сюди значення DATABASE_URL.",
    check: (value) =>
      value.includes("-pooler") || value.includes(":6543")
        ? "вказує на пулер, а не на пряме підключення — саме через це зупиняється prisma migrate deploy"
        : null,
  },
  {
    name: "AUTH_SECRET",
    hint: "Секрет для підпису сесій. Згенеруйте: openssl rand -base64 48",
    check: (value) => (value.length >= 32 ? null : "закороткий — потрібно щонайменше 32 символи"),
  },
];

const RECOMMENDED = [
  {
    name: "NEXT_PUBLIC_APP_URL",
    hint: "Публічна адреса застосунку — з неї будуються посилання й QR на сторінку онлайн-запису",
  },
];

const problems = [];

for (const variable of REQUIRED) {
  const value = process.env[variable.name];
  if (!value || value.trim() === "") {
    problems.push(`  ✗ ${variable.name} — не задано\n    ${variable.hint}`);
    continue;
  }
  const issue = variable.check?.(value.trim());
  if (issue) problems.push(`  ✗ ${variable.name} — ${issue}\n    ${variable.hint}`);
}

for (const variable of RECOMMENDED) {
  if (!process.env[variable.name]) {
    console.warn(`⚠  ${variable.name} не задано — ${variable.hint}`);
  }
}

if (problems.length > 0) {
  console.error(
    [
      "",
      "──────────────────────────────────────────────────────────────",
      " Збірка зупинена: не налаштовані змінні середовища",
      "──────────────────────────────────────────────────────────────",
      "",
      ...problems,
      "",
      " Де їх додати:",
      "   Vercel   → Settings → Environment Variables → Save → Redeploy",
      "   Railway  → Variables",
      "   Локально → файл .env у корені проєкту (див. .env.example)",
      "",
      " Важливо: після додавання змінних потрібен ПОВТОРНИЙ деплой —",
      " збірка, яка вже запустилася, нових значень не побачить.",
      "──────────────────────────────────────────────────────────────",
      "",
    ].join("\n"),
  );
  process.exit(1);
}

console.log("✓ Змінні середовища на місці");
