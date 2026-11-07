import type { HTMLAttributes, InputHTMLAttributes, LabelHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Card({ className, ...p }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("surface p-5", className)} {...p} />;
}

export function Plate({ className, ...p }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("plate p-5", className)} {...p} />;
}

export function Eyebrow({ className, ...p }: HTMLAttributes<HTMLSpanElement>) {
  return <span className={cn("eyebrow", className)} {...p} />;
}

const tones = {
  neutral: "border-line-strong text-ivory-muted",
  gold: "border-line-gold text-gold-300 bg-gold-400/[0.07]",
  ok: "border-ok/30 text-ok bg-ok/[0.07]",
  warn: "border-warn/30 text-warn bg-warn/[0.07]",
  risk: "border-risk/30 text-risk bg-risk/[0.07]",
  info: "border-info/30 text-info bg-info/[0.07]",
} as const;
export type Tone = keyof typeof tones;

export function Badge({ tone = "neutral", className, ...p }: HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  return <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em]", tones[tone], className)} {...p} />;
}

export function SimulatedBadge() {
  return (
    <Badge tone="warn" title="Demo content — not live A.I. model output">
      Simulated
    </Badge>
  );
}

export function Label({ className, ...p }: LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn("mb-1.5 block text-xs font-medium tracking-wide text-ivory-muted", className)} {...p} />;
}

const field =
  "w-full rounded-xl border border-line-strong bg-ink-900/80 px-3.5 text-sm text-ivory placeholder:text-ivory-faint transition-colors focus:border-gold-500 focus:outline-none focus:ring-2 focus:ring-gold-400/20 aria-[invalid=true]:border-risk/60";

export function Input({ className, ...p }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(field, "h-11", className)} {...p} />;
}
export function Textarea({ className, ...p }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(field, "min-h-24 py-3 leading-relaxed", className)} {...p} />;
}
export function Select({ className, ...p }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cn(field, "h-11 pr-8", className)} {...p} />;
}

export function FieldError({ id, children }: { id?: string; children?: ReactNode }) {
  if (!children) return null;
  return (
    <p id={id} role="alert" className="mt-1.5 text-xs text-risk">
      {children}
    </p>
  );
}

export function EmptyState({ icon, title, body, action }: { icon?: ReactNode; title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-line-strong px-6 py-14 text-center">
      {icon && <div className="mb-4 grid size-12 place-items-center rounded-full border border-line-gold bg-gold-400/[0.06] text-gold-300">{icon}</div>}
      <p className="font-heading text-xl text-ivory">{title}</p>
      {body && <p className="mt-2 max-w-sm text-sm text-ivory-muted">{body}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function PageHeader({ eyebrow, title, description, actions }: { eyebrow?: string; title: ReactNode; description?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div className="min-w-0">
        {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
        <h1 className="mt-2 font-heading text-3xl font-semibold tracking-tight text-ivory md:text-4xl">{title}</h1>
        {description && <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ivory-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </header>
  );
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="eyebrow">{children}</h2>
      {action}
    </div>
  );
}

export function Alert({ tone = "info", children }: { tone?: "info" | "warn" | "risk" | "ok"; children: ReactNode }) {
  const t = { info: "border-info/25 bg-info/[0.06] text-info", warn: "border-warn/25 bg-warn/[0.06] text-warn", risk: "border-risk/25 bg-risk/[0.06] text-risk", ok: "border-ok/25 bg-ok/[0.06] text-ok" }[tone];
  return (
    <div role={tone === "risk" ? "alert" : "status"} className={cn("rounded-xl border px-4 py-3 text-sm", t)}>
      {children}
    </div>
  );
}
