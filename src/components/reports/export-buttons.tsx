import { FileDown, FileText, FileType2 } from "lucide-react";
import { cn } from "@/lib/utils";

/** Download buttons for a branded export. `href` is the export endpoint without a format. */
export function ExportButtons({ href, compact = false }: { href: string; compact?: boolean }) {
  const sep = href.includes("?") ? "&" : "?";
  const items = [
    { format: "pdf", label: "PDF", hint: "Branded, ready to share or print", icon: FileDown, primary: true },
    { format: "docx", label: "Word", hint: "Editable .docx for Microsoft Word or Google Docs", icon: FileType2, primary: false },
    { format: "md", label: "Markdown", hint: "Plain text with formatting marks", icon: FileText, primary: false },
  ] as const;
  return (
    <div className={cn("flex flex-wrap gap-2", !compact && "flex-col")}>
      {items.map((i) => (
        <a
          key={i.format}
          href={`${href}${sep}format=${i.format}`}
          download
          title={i.hint}
          className={cn(
            "inline-flex items-center gap-2 rounded-full border transition",
            compact ? "h-8 px-3 text-xs" : "h-10 px-4 text-sm",
            i.primary ? "border-transparent bg-gradient-to-b from-gold-300 to-gold-500 font-medium text-ink-950 hover:from-gold-200 hover:to-gold-400" : "border-line-strong text-ivory hover:border-line-gold",
          )}
        >
          <i.icon className="size-3.5" aria-hidden /> {compact ? i.label : `Download ${i.label}`}
        </a>
      ))}
    </div>
  );
}
