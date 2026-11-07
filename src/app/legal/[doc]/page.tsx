import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Wordmark } from "@/components/brand/brand";

const DOCS = {
  terms: { title: "Terms of Service", body: ["These placeholder terms must be replaced by counsel-approved Terms of Service before commercial launch.", "A.I. C-Suite executives are artificial-intelligence systems. Their output is analysis and recommendation, not professional legal, financial, tax, accounting or medical advice.", "You remain responsible for decisions and for approving any consequential external action."] },
  privacy: { title: "Privacy Policy", body: ["This placeholder privacy policy must be replaced by a counsel-approved policy before commercial launch.", "Each organization's data is isolated and used only to serve that organization.", "Provider credentials are stored server-side and never exposed to browsers."] },
} as const;

export function generateStaticParams() {
  return Object.keys(DOCS).map((doc) => ({ doc }));
}

export async function generateMetadata({ params }: PageProps<"/legal/[doc]">): Promise<Metadata> {
  const { doc } = await params;
  return { title: DOCS[doc as keyof typeof DOCS]?.title ?? "Legal" };
}

export default async function LegalPage({ params }: PageProps<"/legal/[doc]">) {
  const { doc } = await params;
  const d = DOCS[doc as keyof typeof DOCS];
  if (!d) notFound();
  return (
    <main id="main" className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
      <Wordmark />
      <h1 className="mt-12 font-heading text-4xl font-semibold">{d.title}</h1>
      <p className="mt-2 font-mono text-[10px] tracking-[0.2em] text-warn">DRAFT — NOT LEGAL TEXT</p>
      <div className="mt-8 space-y-4 text-sm leading-relaxed text-ivory-muted">{d.body.map((p) => <p key={p}>{p}</p>)}</div>
    </main>
  );
}
