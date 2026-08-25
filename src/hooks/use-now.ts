"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * Поточний час, що сам оновлюється.
 *
 * Потрібен там, де інтерфейс стверджує «зараз»: підсвічений запис, що
 * саме йде, лінія поточного часу, «через 20 хв». Серверний компонент
 * рахує `new Date()` один раз під час рендеру — і на вкладці, відкритій
 * з ранку, «зараз» лишається ранковим до перезавантаження.
 *
 * Два моменти реалізації:
 *
 * 1. Значення квантоване по інтервалу. `getSnapshot` мусить повертати
 *    те саме значення між змінами — сирий `Date.now()` міняється щомілісекунди
 *    і вводить React у нескінченний ререндер.
 * 2. Час сервера приходить пропом і слугує серверним знімком: перший
 *    рендер збігається з HTML, а далі значення живе своїм життям.
 */
export function useNow(serverNow: number, intervalMs = 30_000): number {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const timer = setInterval(onChange, intervalMs);
      return () => clearInterval(timer);
    },
    [intervalMs],
  );

  return useSyncExternalStore(
    subscribe,
    () => Math.floor(Date.now() / intervalMs) * intervalMs,
    () => serverNow,
  );
}
