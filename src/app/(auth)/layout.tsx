import Image from "next/image";
import { Wordmark } from "@/components/brand/brand";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.05fr_1fr]">
      <aside className="relative hidden overflow-hidden border-r border-line bg-ink-1000 lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div aria-hidden className="bg-grid absolute inset-0 opacity-50 [mask-image:radial-gradient(ellipse_at_center,#000_20%,transparent_70%)]" />
        <div aria-hidden className="absolute left-1/2 top-1/2 h-[30rem] w-[30rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(239,186,17,.16),transparent_65%)] blur-2xl" />
        <Wordmark className="relative" />
        <div className="relative mx-auto flex max-w-md flex-col items-center text-center">
          <Image src="/brand/crest-full.png" alt="" width={1195} height={1195} className="h-auto w-64 drop-shadow-[0_0_60px_rgba(239,186,17,.25)]" priority />
          <p className="mt-10 font-mono text-[11px] leading-6 tracking-[0.35em] text-gold-300">
            SEVEN EXECUTIVES.
            <br />
            ONE ORGANIZATION.
            <br />
            SHARED INTELLIGENCE.
          </p>
        </div>
        <p className="relative text-xs text-ivory-faint">Calm intelligence. Executive authority.</p>
      </aside>
      <main id="main" className="flex flex-col px-4 py-8 sm:px-10">
        <div className="lg:hidden">
          <Wordmark />
        </div>
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-10">{children}</div>
      </main>
    </div>
  );
}
