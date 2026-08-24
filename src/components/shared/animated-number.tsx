"use client";

import * as React from "react";
import { useMediaQuery } from "@/hooks/use-media-query";
import { formatMoney } from "@/lib/money";

/**
 * Число, що «докручується» до значення — і при появі, і при зміні.
 *
 * Два моменти, які тут важливі:
 *
 * 1. Початковий стан дорівнює кінцевому значенню, тому серверний HTML і
 *    перший клієнтський рендер збігаються (жодного mismatch при гідрації),
 *    а без JS користувач одразу бачить правильне число.
 *
 * 2. Відлік запускається в `useLayoutEffect` — між комітом і малюванням.
 *    Якби це був звичайний `useEffect`, браузер устиг би показати кінцеве
 *    значення, потім воно стрибнуло б у нуль і поїхало назад: замість
 *    анімації вийшло б блимання.
 *
 * На сервері хук підмінено на `useEffect` (там `useLayoutEffect` не
 * виконується і лише пише попередження в лог) — стандартний
 * isomorphic-layout-effect. Вибір робиться один раз на модуль, а не на
 * кожен рендер, тож ідентичність хука стабільна.
 */
const useIsomorphicLayoutEffect =
  typeof document === "undefined" ? React.useEffect : React.useLayoutEffect;

export function AnimatedNumber({
  value,
  duration = 700,
  format = (n: number) => String(Math.round(n)),
  className,
}: {
  value: number;
  duration?: number;
  format?: (value: number) => string;
  className?: string;
}) {
  const [display, setDisplay] = React.useState(value);
  // Скільки показано ЗАРАЗ. Саме з цього числа стартує наступний відлік —
  // тому перерваний і перезапущений ефект продовжує рух, а не смикається.
  const displayRef = React.useRef(0);
  const frameRef = React.useRef<number | null>(null);

  // Через useSyncExternalStore, а не перевіркою всередині ефекту: інакше
  // довелося б викликати setState прямо в тілі ефекту заради одного стрибка.
  const reduced = useMediaQuery("(prefers-reduced-motion: reduce)");

  useIsomorphicLayoutEffect(() => {
    if (reduced) return;

    const from = displayRef.current;
    const delta = value - from;

    if (delta === 0) {
      setDisplay(value);
      return;
    }

    const start = performance.now();

    const step = (now: number) => {
      const progress = Math.min(1, (now - start) / duration);
      // easeOutExpo — швидкий старт, м'яке гальмування
      const eased = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
      const current = from + delta * eased;

      displayRef.current = current;
      setDisplay(current);

      if (progress < 1) frameRef.current = requestAnimationFrame(step);
    };

    displayRef.current = from;
    setDisplay(from);
    frameRef.current = requestAnimationFrame(step);

    // У cleanup лише скасовуємо кадр. Записати сюди кінцеве значення було б
    // помилкою: у StrictMode ефект одразу монтується вдруге, побачив би
    // delta === 0 і зупинив би анімацію, не почавши її.
    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    };
  }, [value, duration, reduced]);

  return <span className={className}>{format(reduced ? value : display)}</span>;
}

/**
 * Гроші, що докручуються.
 *
 * Окремий компонент, а не `format`-проп: серверні компоненти не можуть
 * передавати функції в клієнтські, тож `<AnimatedNumber format={...} />`
 * впало б на кожній сторінці, зібраній на сервері. Тут через межу йдуть
 * лише число та код валюти.
 */
export function AnimatedMoney({
  cents,
  currency = "EUR",
  duration,
  className,
}: {
  cents: number;
  currency?: string;
  duration?: number;
  className?: string;
}) {
  const format = React.useCallback(
    (value: number) => formatMoney(Math.round(value), currency),
    [currency],
  );

  return (
    <AnimatedNumber value={cents} duration={duration} format={format} className={className} />
  );
}
