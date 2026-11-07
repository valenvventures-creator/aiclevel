import Link from "next/link";
import { forwardRef, type ButtonHTMLAttributes, type ComponentProps } from "react";
import { cn } from "@/lib/utils";

type Variant = "gold" | "outline" | "ghost" | "subtle" | "danger";
type Size = "sm" | "md" | "lg";

const base = "inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium transition-all duration-200 disabled:pointer-events-none disabled:opacity-50 rounded-full";
const variants: Record<Variant, string> = {
  gold: "bg-gradient-to-b from-gold-300 to-gold-500 text-ink-950 shadow-[0_0_0_1px_rgba(239,186,17,.5),0_8px_30px_-8px_rgba(239,186,17,.55)] hover:from-gold-200 hover:to-gold-400",
  outline: "border border-line-strong bg-white/[0.02] text-ivory hover:border-line-gold hover:bg-gold-400/[0.06]",
  ghost: "text-ivory-muted hover:text-ivory hover:bg-white/[0.04]",
  subtle: "bg-ink-800 text-ivory border border-line hover:bg-ink-750",
  danger: "border border-risk/40 text-risk hover:bg-risk/10",
};
const sizes: Record<Size, string> = { sm: "h-8 px-3 text-xs", md: "h-10 px-4 text-sm", lg: "h-12 px-6 text-[15px]" };

export function buttonClass(variant: Variant = "gold", size: Size = "md", className?: string) {
  return cn(base, variants[variant], sizes[size], className);
}

export const Button = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }>(
  ({ variant = "gold", size = "md", className, ...props }, ref) => <button ref={ref} className={buttonClass(variant, size, className)} {...props} />,
);
Button.displayName = "Button";

export function ButtonLink({ variant = "gold", size = "md", className, ...props }: ComponentProps<typeof Link> & { variant?: Variant; size?: Size }) {
  return <Link className={buttonClass(variant, size, className)} {...props} />;
}
