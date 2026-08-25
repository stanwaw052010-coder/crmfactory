"use client";

import * as React from "react";

/**
 * Мінімальний рендер розмітки, якою відповідає модель.
 *
 * Модель пише **жирним** і списками — так її навчено, і забороняти це
 * системною інструкцією безглуздо: розмітка тут доречна, бо відповідь
 * майже завжди має структуру «підсумок + перелік чисел». Проблема була
 * не в моделі, а в тому, що ми показували її текст як є, і власниця
 * салону бачила зірочки замість жирного.
 *
 * Це НЕ повний markdown і не має ним ставати: жодних посилань, картинок
 * чи HTML. Ми відмальовуємо React-вузли, а не вставляємо рядок через
 * dangerouslySetInnerHTML, тож текст із відповіді моделі фізично не може
 * стати розміткою сторінки.
 */

type Block =
  | { kind: "para"; lines: string[] }
  | { kind: "list"; items: string[]; ordered: boolean }
  | { kind: "heading"; text: string };

const HEADING = /^ {0,3}#{1,6}\s+(.*)$/;
// Пробіл після маркера обов'язковий — інакше рядок «**Виручка**: 12 000»
// прочитався б як пункт списку і втратив би початок.
const BULLET = /^\s*[-*•—]\s+(.*)$/;
const ORDERED = /^\s*\d{1,2}[.)]\s+(.*)$/;

export function parseBlocks(text: string): Block[] {
  const blocks: Block[] = [];
  let para: string[] = [];
  let list: { items: string[]; ordered: boolean } | null = null;

  const flushPara = () => {
    if (para.length) blocks.push({ kind: "para", lines: para });
    para = [];
  };
  const flushList = () => {
    if (list) blocks.push({ kind: "list", ...list });
    list = null;
  };

  for (const raw of text.split("\n")) {
    const line = raw.trimEnd();

    if (!line.trim()) {
      flushPara();
      flushList();
      continue;
    }

    const heading = line.match(HEADING);
    if (heading) {
      flushPara();
      flushList();
      blocks.push({ kind: "heading", text: heading[1].trim() });
      continue;
    }

    const ordered = line.match(ORDERED);
    const bullet = ordered ? null : line.match(BULLET);
    const item = ordered ?? bullet;
    if (item) {
      flushPara();
      const wantsOrdered = Boolean(ordered);
      // Зміна типу списку посеред переліку — це вже інший список.
      if (list && list.ordered !== wantsOrdered) flushList();
      list ??= { items: [], ordered: wantsOrdered };
      list.items.push(item[1].trim());
      continue;
    }

    flushList();
    para.push(line);
  }

  flushPara();
  flushList();
  return blocks;
}

const BOLD = /\*\*(.+?)\*\*/g;

/** `**жирний**` → <strong>. Решта тексту лишається текстом. */
export function inline(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  let last = 0;
  let match: RegExpExecArray | null;

  BOLD.lastIndex = 0;
  while ((match = BOLD.exec(text))) {
    if (match.index > last) parts.push(text.slice(last, match.index));
    parts.push(
      <strong key={`b${match.index}`} className="font-semibold">
        {match[1]}
      </strong>,
    );
    last = match.index + match[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

export function RichText({ text }: { text: string }) {
  const blocks = React.useMemo(() => parseBlocks(text), [text]);

  return (
    <div className="space-y-2">
      {blocks.map((block, index) => {
        if (block.kind === "heading") {
          return (
            <p key={index} className="font-semibold">
              {inline(block.text)}
            </p>
          );
        }

        if (block.kind === "list") {
          const List = block.ordered ? "ol" : "ul";
          return (
            <List
              key={index}
              className={
                block.ordered
                  ? "list-decimal space-y-1 pl-[1.15rem] marker:text-[var(--fg-subtle)]"
                  : "list-disc space-y-1 pl-[1.15rem] marker:text-[var(--fg-subtle)]"
              }
            >
              {block.items.map((item, itemIndex) => (
                <li key={itemIndex} className="pl-0.5">
                  {inline(item)}
                </li>
              ))}
            </List>
          );
        }

        return (
          <p key={index}>
            {block.lines.map((line, lineIndex) => (
              <React.Fragment key={lineIndex}>
                {lineIndex > 0 && <br />}
                {inline(line)}
              </React.Fragment>
            ))}
          </p>
        );
      })}
    </div>
  );
}
