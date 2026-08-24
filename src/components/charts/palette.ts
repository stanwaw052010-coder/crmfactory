/**
 * Палітра графіків.
 *
 * Значення перевірені валідатором на: смугу світлості, мінімальну насиченість,
 * розрізнюваність сусідніх пар при дальтонізмі (deutan/protan/tritan),
 * розрізнюваність при звичайному зорі та контраст із поверхнею —
 * окремо для світлої (#ffffff) та темної (#0b1626) теми.
 *
 * Кольори призначаються сутностям у фіксованому порядку і НІКОЛИ не
 * перефарбовуються при фільтрації: колір належить сутності, а не її позиції.
 */

export const CATEGORICAL_LIGHT = [
  "#2563EB",
  "#0D9488",
  "#7C3AED",
  "#D97706",
  "#DB2777",
  "#0891B2",
] as const;

export const CATEGORICAL_DARK = [
  "#4D8DF6",
  "#0D9488",
  "#8B5CF6",
  "#D97706",
  "#EC4899",
  "#0891B2",
] as const;

/** Один відтінок для величини — виручка, кількість записів. */
export const SEQUENTIAL_LIGHT = "#2563EB";
export const SEQUENTIAL_DARK = "#4D8DF6";

/** Статуси — зарезервовані значення, ніколи не використовуються як «серія N». */
export const STATUS_COLORS = {
  good: { light: "#059669", dark: "#10B981" },
  warning: { light: "#D97706", dark: "#F59E0B" },
  serious: { light: "#DC2626", dark: "#F87171" },
  neutral: { light: "#64748B", dark: "#7C8FAE" },
  info: { light: "#2563EB", dark: "#4D8DF6" },
} as const;

export function categorical(index: number, dark: boolean): string {
  const palette = dark ? CATEGORICAL_DARK : CATEGORICAL_LIGHT;
  return palette[index % palette.length];
}
