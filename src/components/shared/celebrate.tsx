"use client";

import * as React from "react";
import { useIsClient } from "@/hooks/use-is-client";
import { useMediaQuery } from "@/hooks/use-media-query";

/**
 * Момент святкування після успішного запису.
 *
 * Дві частини: галочка, що сама домальовується, і конфеті.
 *
 * Конфеті — це DOM-частинки з CSS-анімацією, а не canvas: тут потрібно
 * рівно 26 клаптиків на дві секунди, і заради цього не варто тягнути
 * бібліотеку та тримати цикл рендеру. Траєкторії рахуються один раз
 * після монтування — на сервері компонент нічого не малює, тож
 * випадкові числа не спричиняють розбіжності при гідрації.
 */

const PIECES = 26;
const COLORS = ["#2563EB", "#38BDF8", "#7C3AED", "#F59E0B", "#EC4899", "#10B981"];

type Piece = {
  id: number;
  x: number;
  delay: number;
  duration: number;
  drift: number;
  rotate: number;
  color: string;
  size: number;
};

function makePieces(): Piece[] {
  return Array.from({ length: PIECES }, (_, id) => ({
    id,
    x: Math.random() * 100,
    delay: Math.random() * 0.35,
    duration: 1.4 + Math.random() * 0.9,
    drift: (Math.random() - 0.5) * 140,
    rotate: (Math.random() - 0.5) * 720,
    color: COLORS[id % COLORS.length],
    size: 5 + Math.random() * 5,
  }));
}

export function Confetti() {
  const isClient = useIsClient();
  const reduced = useMediaQuery("(prefers-reduced-motion: reduce)");

  // Ліниве значення useState: траєкторії рахуються рівно один раз.
  // `useIsClient` тримає перший рендер порожнім і на сервері, і при
  // гідрації, тому випадкові числа ніколи не потрапляють у порівняння.
  const [pieces] = React.useState(makePieces);
  const [finished, setFinished] = React.useState(false);

  React.useEffect(() => {
    // Прибираємо частинки після падіння — тримати їх у DOM більше нема сенсу.
    const timer = setTimeout(() => setFinished(true), 2600);
    return () => clearTimeout(timer);
  }, []);

  if (!isClient || reduced || finished) return null;

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-x-0 top-0 h-full overflow-hidden"
    >
      {pieces.map((piece) => (
        <span
          key={piece.id}
          className="animate-confetti absolute top-0 block rounded-[1px]"
          style={{
            left: `${piece.x}%`,
            width: piece.size,
            height: piece.size * 1.6,
            background: piece.color,
            animationDelay: `${piece.delay}s`,
            animationDuration: `${piece.duration}s`,
            ["--confetti-drift" as string]: `${piece.drift}px`,
            ["--confetti-rotate" as string]: `${piece.rotate}deg`,
          }}
        />
      ))}
    </div>
  );
}

/** Галочка, що домальовується — «система прийняла», а не просто іконка. */
export function DrawnCheck({ color, size = 56 }: { color: string; size?: number }) {
  const reduced = useMediaQuery("(prefers-reduced-motion: reduce)");

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 52 52"
      fill="none"
      role="img"
      aria-label="Готово"
      className="mx-auto"
    >
      <circle
        cx="26"
        cy="26"
        r="24"
        fill={color}
        className={reduced ? undefined : "animate-pop-in"}
        style={{ transformOrigin: "center" }}
      />
      <path
        d="M15 26.5l8 8 14-15"
        stroke="white"
        strokeWidth="3.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={reduced ? undefined : "animate-draw-check"}
      />
    </svg>
  );
}
