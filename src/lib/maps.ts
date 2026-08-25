/**
 * Посилання на карти.
 *
 * Універсальний формат Google Maps (`?api=1&query=…`) працює скрізь:
 * у браузері відкриває веб-карту, а на телефоні операційна система сама
 * перекидає в застосунок Google Maps. На iPhone без нього — у Safari,
 * що теж прийнятно: адреса шукається, маршрут будується.
 *
 * Окремих схем `geo:` чи `maps://` навмисно немає — вони ламаються
 * рівно там, де користувач їх не чекає, і дають порожню сторінку
 * замість адреси.
 */

/** Пошук за адресою — коли точних координат немає. */
export function mapsSearchUrl(address: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address.trim())}`;
}

/** Маршрут до адреси від поточного місця користувача. */
export function mapsDirectionsUrl(address: string): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address.trim())}`;
}

/**
 * Готове посилання салону або згенероване з адреси.
 *
 * Власниця може вставити власне посилання (наприклад, точну мітку
 * закладу з Google Business) — тоді воно має пріоритет: точна мітка
 * завжди краща за пошук за рядком.
 */
export function venueMapUrl(params: {
  mapsUrl?: string | null;
  address?: string | null;
}): string | null {
  const custom = params.mapsUrl?.trim();
  if (custom) return custom;

  const address = params.address?.trim();
  return address ? mapsSearchUrl(address) : null;
}
