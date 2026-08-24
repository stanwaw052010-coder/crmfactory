"use client";

import { useEffect, useState } from "react";
import {
  CATEGORICAL_DARK,
  CATEGORICAL_LIGHT,
  SEQUENTIAL_DARK,
  SEQUENTIAL_LIGHT,
} from "@/components/charts/palette";

/**
 * Темна тема для графіків — не автоматичний інверс, а власний набір кроків,
 * перевірений під темну поверхню. Тому колір беремо звідси, а не з CSS-змінних.
 */
export function useChartTheme() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const update = () => setDark(document.documentElement.classList.contains("dark"));
    update();
    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  return {
    dark,
    categorical: dark ? CATEGORICAL_DARK : CATEGORICAL_LIGHT,
    primary: dark ? SEQUENTIAL_DARK : SEQUENTIAL_LIGHT,
    grid: dark ? "#1c2c48" : "#e8edf5",
    axis: dark ? "#64789b" : "#94a3b8",
    surface: dark ? "#0b1626" : "#ffffff",
  };
}
