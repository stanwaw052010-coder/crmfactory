import { cn } from "@/lib/utils";
import { colorFromString, initials } from "@/lib/utils";

const SIZES = {
  xs: "h-6 w-6 text-[10px]",
  sm: "h-8 w-8 text-[11px]",
  md: "h-10 w-10 text-[13px]",
  lg: "h-14 w-14 text-lg",
  xl: "h-20 w-20 text-2xl",
} as const;

export function Avatar({
  name,
  src,
  color,
  size = "md",
  className,
  ring,
}: {
  name: string;
  src?: string | null;
  color?: string | null;
  size?: keyof typeof SIZES;
  className?: string;
  ring?: boolean;
}) {
  const background = color ?? colorFromString(name);

  if (src) {
    // Аватари приходять із довільних доменів (логотипи, фото команди),
    // тому next/image з його білим списком доменів тут не підходить.
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={name}
        className={cn(
          "shrink-0 rounded-full object-cover",
          SIZES[size],
          ring && "ring-2 ring-[var(--surface)]",
          className,
        )}
      />
    );
  }

  return (
    <span
      aria-hidden
      title={name}
      style={{ background: `linear-gradient(135deg, ${background}, ${background}cc)` }}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white select-none",
        SIZES[size],
        ring && "ring-2 ring-[var(--surface)]",
        className,
      )}
    >
      {initials(name) || "?"}
    </span>
  );
}
