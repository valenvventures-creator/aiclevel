import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

export function Crest({ size = 40, className }: { size?: number; className?: string }) {
  return <Image src="/brand/crest-256.png" alt="" width={size} height={Math.round(size * 0.58)} className={cn("object-contain", className)} priority />;
}

export function Wordmark({ compact = false, className, href = "/" }: { compact?: boolean; className?: string; href?: string }) {
  return (
    <Link href={href} className={cn("group flex items-center gap-3", className)} aria-label="Thought Authorities — A.I. C-Suite home">
      <Crest size={compact ? 40 : 52} />
      {!compact && (
        <span className="flex flex-col leading-none">
          <span className="font-display text-[13px] font-semibold tracking-[0.18em] text-gold-300">THOUGHT AUTHORITIES</span>
          <span className="mt-1 font-mono text-[9.5px] tracking-[0.32em] text-ivory-muted">A.I. C-SUITE</span>
        </span>
      )}
    </Link>
  );
}
