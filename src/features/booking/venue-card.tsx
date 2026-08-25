"use client";

import * as React from "react";
import { Check, Clock, Instagram, Link2, MapPin, Navigation, Share2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { minutesToTime, WEEKDAYS_UK } from "@/lib/time";

export type GalleryPhoto = { id: string; url: string };
export type BusinessHour = {
  weekday: number;
  openMinute: number;
  closeMinute: number;
  isClosed: boolean;
};

/**
 * Картка «про салон» під формою запису.
 *
 * Усе, що клієнт питає по телефону перед візитом: як виглядає місце, як
 * доїхати, коли відчинено. Кожна відповідь тут — це дзвінок, якого не буде.
 */
export function VenueCard({
  name,
  address,
  mapUrl,
  gallery,
  hours,
  instagramUrl,
  facebookUrl,
  tiktokUrl,
  accent,
}: {
  name: string;
  address: string | null;
  mapUrl: string | null;
  gallery: GalleryPhoto[];
  hours: BusinessHour[];
  instagramUrl: string | null;
  facebookUrl: string | null;
  tiktokUrl: string | null;
  accent: string;
}) {
  const hasSocial = Boolean(instagramUrl || facebookUrl || tiktokUrl);
  if (gallery.length === 0 && !address && hours.length === 0 && !hasSocial) return null;

  return (
    <div className="mt-5 space-y-5 rounded-[20px] border border-[var(--border)] bg-[var(--surface)] p-5 sm:p-6">
      {gallery.length > 0 && <Gallery photos={gallery} name={name} />}

      {address && (
        <div>
          <p className="mb-2 flex items-center gap-1.5 text-[12px] font-medium tracking-wide text-[var(--fg-subtle)] uppercase">
            <MapPin className="h-3.5 w-3.5" />
            Як дістатися
          </p>
          <p className="text-[14px] leading-relaxed text-[var(--fg)]">{address}</p>
          {mapUrl && (
            <a
              href={mapUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-3 inline-flex h-10 items-center gap-2 rounded-xl px-4 text-[14px] font-medium text-white transition-transform duration-150 hover:-translate-y-px active:translate-y-0"
              style={{ background: accent }}
            >
              <Navigation className="h-4 w-4" />
              Прокласти маршрут
            </a>
          )}
        </div>
      )}

      {hours.length > 0 && <Hours hours={hours} />}

      {hasSocial && (
        <div className="flex flex-wrap items-center gap-2 border-t border-[var(--border)] pt-4">
          {instagramUrl && (
            <SocialLink href={instagramUrl} icon={Instagram} label="Instagram" />
          )}
          {facebookUrl && <SocialLink href={facebookUrl} icon={Link2} label="Facebook" />}
          {tiktokUrl && <SocialLink href={tiktokUrl} icon={Link2} label="TikTok" />}
          <ShareButton name={name} />
        </div>
      )}

      {!hasSocial && <ShareButton name={name} className="w-full justify-center" />}
    </div>
  );
}

/** Проста галерея: клік розгортає фото на всю ширину картки. */
function Gallery({ photos, name }: { photos: GalleryPhoto[]; name: string }) {
  const [active, setActive] = React.useState(0);

  return (
    <div>
      <div className="overflow-hidden rounded-xl bg-[var(--surface-2)]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          key={photos[active].id}
          src={photos[active].url}
          alt={`${name} — фото ${active + 1}`}
          className="animate-fade-in aspect-[4/3] w-full object-cover"
        />
      </div>

      {photos.length > 1 && (
        <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
          {photos.map((photo, index) => (
            <button
              key={photo.id}
              type="button"
              onClick={() => setActive(index)}
              aria-label={`Фото ${index + 1}`}
              className={cn(
                "h-14 w-14 shrink-0 overflow-hidden rounded-lg transition-all duration-200",
                index === active
                  ? "ring-2 ring-[var(--primary)] ring-offset-2 ring-offset-[var(--surface)]"
                  : "opacity-60 hover:opacity-100",
              )}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photo.url} alt="" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Hours({ hours }: { hours: BusinessHour[] }) {
  // Тиждень починається з понеділка — так його читають в Україні,
  // хоча в JS getDay() неділя має номер 0.
  const ordered = [1, 2, 3, 4, 5, 6, 0]
    .map((weekday) => hours.find((hour) => hour.weekday === weekday))
    .filter((hour): hour is BusinessHour => Boolean(hour));

  const today = new Date().getDay();

  return (
    <div>
      <p className="mb-2 flex items-center gap-1.5 text-[12px] font-medium tracking-wide text-[var(--fg-subtle)] uppercase">
        <Clock className="h-3.5 w-3.5" />
        Години роботи
      </p>
      <ul className="space-y-1">
        {ordered.map((hour) => {
          const isToday = hour.weekday === today;
          return (
            <li
              key={hour.weekday}
              className={cn(
                "flex items-center justify-between rounded-md px-2 py-1 text-[13px]",
                isToday && "bg-[var(--primary-soft)] font-medium",
              )}
            >
              <span className={isToday ? "text-[var(--primary)]" : "text-[var(--fg-muted)]"}>
                {WEEKDAYS_UK[hour.weekday]}
                {isToday && " · сьогодні"}
              </span>
              <span
                className={cn(
                  "tabular-nums",
                  hour.isClosed
                    ? "text-[var(--fg-subtle)]"
                    : isToday
                      ? "text-[var(--primary)]"
                      : "text-[var(--fg)]",
                )}
              >
                {hour.isClosed
                  ? "вихідний"
                  : `${minutesToTime(hour.openMinute)} – ${minutesToTime(hour.closeMinute)}`}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function SocialLink({
  href,
  icon: Icon,
  label,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-[var(--border)] px-3 text-[13px] font-medium text-[var(--fg-muted)] transition-all duration-150 hover:-translate-y-px hover:border-[var(--border-strong)] hover:text-[var(--fg)]"
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </a>
  );
}

/**
 * «Поділитися».
 *
 * На телефоні відкриває системне меню — салон надсилає посилання клієнтці
 * прямо у той месенджер, де вони спілкуються. На десктопі системного меню
 * немає, тож копіюємо адресу в буфер і кажемо про це.
 */
function ShareButton({ name, className }: { name: string; className?: string }) {
  const [copied, setCopied] = React.useState(false);

  const share = async () => {
    const url = window.location.href;

    if (navigator.share) {
      try {
        await navigator.share({ title: name, url });
        return;
      } catch {
        // Користувач закрив системне меню — це не помилка, мовчимо.
        return;
      }
    }

    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* Буфер недоступний (http або заборона) — кнопка просто нічого не робить. */
    }
  };

  return (
    <button
      type="button"
      onClick={share}
      className={cn(
        "inline-flex h-9 items-center gap-1.5 rounded-xl border border-[var(--border)] px-3 text-[13px] font-medium transition-all duration-150 hover:-translate-y-px hover:border-[var(--border-strong)]",
        copied ? "text-[var(--success)]" : "text-[var(--fg-muted)] hover:text-[var(--fg)]",
        className,
      )}
    >
      {copied ? <Check className="h-3.5 w-3.5" /> : <Share2 className="h-3.5 w-3.5" />}
      {copied ? "Скопійовано" : "Поділитися"}
    </button>
  );
}
