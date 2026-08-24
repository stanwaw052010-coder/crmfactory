import Link from "next/link";
import { Logo } from "@/components/shared/logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1fr_minmax(0,520px)]">
      {/* Ліва панель — бренд. На мобільному прихована. */}
      <aside className="relative hidden overflow-hidden bg-[#050B1F] p-12 lg:flex lg:flex-col">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(900px 480px at 12% 8%, rgba(13,71,255,0.30), transparent 60%), radial-gradient(700px 420px at 88% 92%, rgba(56,189,248,0.18), transparent 62%)",
          }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)",
            backgroundSize: "56px 56px",
            maskImage: "radial-gradient(circle at 30% 20%, black, transparent 75%)",
          }}
        />

        <Link href="/" className="relative z-10 flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-gradient-to-br from-[#3b76f6] to-[#0d47ff]">
            <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" aria-hidden>
              <path d="M4 19V10l5 3V10l5 3V6l6 4v9z" fill="white" fillOpacity="0.95" />
            </svg>
          </span>
          <span className="text-[17px] font-semibold tracking-tight text-white">
            crm<span className="text-[#6096fa]">.</span>factory
          </span>
        </Link>

        <div className="relative z-10 mt-auto max-w-md">
          <p className="text-[32px] leading-[1.15] font-semibold tracking-tight text-balance text-white">
            CRM, яка тримає ваш бізнес під контролем.
          </p>
          <p className="mt-4 text-[15px] leading-relaxed text-slate-300">
            Клієнти, записи, команда, продажі та аналітика — в одній системі. Без хаосу в
            месенджерах і забутих дзвінків.
          </p>

          <div className="mt-10 grid grid-cols-3 gap-4 border-t border-white/10 pt-8">
            {[
              { value: "1 клік", label: "до нового запису" },
              { value: "24/7", label: "онлайн-запис" },
              { value: "0 ₴", label: "щоб почати" },
            ].map((item) => (
              <div key={item.label}>
                <p className="text-lg font-semibold text-white">{item.value}</p>
                <p className="mt-0.5 text-[12.5px] text-slate-400">{item.label}</p>
              </div>
            ))}
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
