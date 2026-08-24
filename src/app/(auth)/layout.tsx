import Link from "next/link";
import { Logo } from "@/components/shared/logo";
import { AuthShowcase } from "@/features/auth/auth-showcase";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1fr_minmax(0,520px)]">
      {/* Ліва панель — бренд. На мобільному прихована. */}
      <aside className="grain relative hidden overflow-hidden bg-[#050B1F] p-12 lg:flex lg:flex-col">
        {/* Дві світлові плями, що повільно дрейфують: фон дихає, але за
            22 секунди циклу рух не встигає відволікти від форми входу. */}
        <div
          aria-hidden
          className="animate-drift pointer-events-none absolute -top-1/4 -left-1/4 h-[820px] w-[820px] rounded-full opacity-60"
          style={{
            background:
              "radial-gradient(circle, rgba(13,71,255,0.42), rgba(13,71,255,0) 62%)",
          }}
        />
        <div
          aria-hidden
          className="animate-drift pointer-events-none absolute -right-1/4 -bottom-1/3 h-[720px] w-[720px] rounded-full opacity-50"
          style={{
            background: "radial-gradient(circle, rgba(56,189,248,0.30), rgba(56,189,248,0) 64%)",
            animationDelay: "-11s",
            animationDirection: "reverse",
          }}
        />
        {/* Креслярська сітка — відсилання до «factory» у назві. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)",
            backgroundSize: "56px 56px",
            maskImage: "radial-gradient(circle at 30% 20%, black, transparent 78%)",
          }}
        />

        <Link href="/" className="relative z-10 flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-gradient-to-br from-[#3b76f6] to-[#0d47ff] shadow-[0_6px_20px_-6px_rgba(13,71,255,0.9)]">
            <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" aria-hidden>
              <path d="M4 19V10l5 3V10l5 3V6l6 4v9z" fill="white" fillOpacity="0.95" />
            </svg>
          </span>
          <span className="text-[17px] font-semibold tracking-tight text-white">
            crm<span className="text-[#6096fa]">.</span>factory
          </span>
        </Link>

        <div className="relative z-10 flex flex-1 flex-col justify-center py-10">
          <div className="max-w-md">
            <div className="mb-8 flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ring-out absolute inline-flex h-full w-full rounded-full bg-[#4ade80]" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-[#4ade80]" />
              </span>
              <span className="text-[12px] font-medium tracking-wide text-slate-400 uppercase">
                Записи надходять
              </span>
            </div>

            <AuthShowcase />

            <p className="mt-10 text-[30px] leading-[1.15] font-semibold tracking-[-0.03em] text-balance text-white">
              Ваш день розписаний.{" "}
              <span className="bg-gradient-to-r from-[#6096fa] to-[#38bdf8] bg-clip-text text-transparent">
                Без жодного дзвінка.
              </span>
            </p>

            <div className="mt-8 grid grid-cols-3 gap-4 border-t border-white/10 pt-7">
              {[
                { value: "1 клік", label: "до нового запису" },
                { value: "24/7", label: "онлайн-запис" },
                { value: "0 €", label: "щоб почати" },
              ].map((item) => (
                <div key={item.label}>
                  <p className="text-lg font-semibold tracking-tight text-white">{item.value}</p>
                  <p className="mt-0.5 text-[12.5px] text-slate-400">{item.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </aside>

      <main className="flex flex-col justify-center px-5 py-10 sm:px-10">
        <div className="mx-auto w-full max-w-[400px]">
          <Link href="/" className="mb-8 inline-flex lg:hidden">
            <Logo />
          </Link>
          {children}
        </div>
      </main>
    </div>
  );
}
