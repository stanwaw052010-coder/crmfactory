"use client";

import { useEffect, useState } from "react";

/** Значення, що «наздоганяє» вхідне із затримкою — для пошуку без спаму запитів. */
export function useDebounced<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}
