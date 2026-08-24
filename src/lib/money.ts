/**
 * Гроші в системі — цілі числа в мінорних одиницях (центах).
 * Жодних float-обчислень над сумами.
 */

const SYMBOLS: Record<string, string> = {
  EUR: "€",
  USD: "$",
  UAH: "₴",
  PLN: "zł",
  GBP: "£",
  CZK: "Kč",
};

export const CURRENCIES = Object.keys(SYMBOLS);

export function currencySymbol(currency = "EUR") {
  return SYMBOLS[currency] ?? currency;
}

export function formatMoney(cents: number, currency = "EUR", opts?: { compact?: boolean }) {
  const value = cents / 100;
  const symbol = currencySymbol(currency);
  if (opts?.compact && Math.abs(value) >= 1000) {
    const k = value / 1000;
    return `${symbol}${k.toFixed(k >= 10 ? 0 : 1)}k`;
  }
  const formatted = new Intl.NumberFormat("uk-UA", {
    minimumFractionDigits: value % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(value);
  return `${symbol}${formatted}`;
}

/** "35", "35.5", "35,50" → 3550 */
export function parseMoneyToCents(input: string | number): number {
  if (typeof input === "number") return Math.round(input * 100);
  const normalized = input.replace(/\s/g, "").replace(",", ".");
  const parsed = Number.parseFloat(normalized);
  if (Number.isNaN(parsed)) return 0;
  return Math.round(parsed * 100);
}

export function centsToInput(cents: number): string {
  return (cents / 100).toFixed(2).replace(/\.00$/, "");
}
