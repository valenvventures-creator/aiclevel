import Image from "next/image";
import { ButtonLink } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main id="main" className="flex min-h-dvh flex-col items-center justify-center px-4 text-center">
      <Image src="/brand/crest-256.png" alt="" width={120} height={70} />
      <p className="eyebrow mt-8">404</p>
      <h1 className="mt-3 font-heading text-4xl font-semibold">This office doesn&apos;t exist.</h1>
      <p className="mt-2 text-sm text-ivory-muted">The page may have moved, or you may not have access to it.</p>
      <ButtonLink href="/hq" className="mt-8">Return to C-Level HQ</ButtonLink>
    </main>
  );
}
